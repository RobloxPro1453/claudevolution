// Context management for the cheap-model agent loop, built around the provider's prompt cache.
// Ideas adapted from craft-anything crates/ai/src/context.rs (trim_old, cut_point, summarised; MIT OR
// Apache-2.0), OMK deepseek-harness.ts and specs 051/066/113 (MIT); see THIRD_PARTY_NOTICES.md.
//
// DeepSeek bills a cached prompt prefix at about 1/50 of a miss (ERRATA E5). Anything that rewrites an
// earlier message breaks the cache from that point on, so nothing here runs on every step:
//  - tool output is cut once, when it is produced (head + tail, the middle marked): the start holds the
//    command and the first error, the end holds the summary line; a head-only cut lost the summary and a
//    tail-only cut lost the first error;
//  - only when the conversation passes its budget (an "epoch"), old tool results are shortened in one go,
//    and if that is not enough the oldest turns are replaced by a runner-written summary. Both land well
//    under the budget, so the next epoch is far away and the prefix stays stable between epochs.
// Never touched: the system message and the task spec (the cached head; the owner's rules travel there,
// OMK spec 018), the last KEEP_RECENT messages, and any field of a kept assistant message (reasoning_content
// stays, ERRATA E2). Whole old turns may go; a kept tool call always keeps its result.

export const KEEP_RECENT = 12;
const TRIMMED_KEEP = 400;
export const TRIMMED_NOTE = "\n... (trimmed to save room; run the tool again if you need the rest)";
const MIN_SUMMARISED = 3;

// Head + tail with a marker in the middle; the same input always gives the same output.
export function headTail(text, max = 6000, headShare = 0.65) {
    const s = String(text);
    if (s.length <= max) return s;
    const head = Math.floor(max * headShare), tailLen = max - head;
    const cut = s.length - head - tailLen;
    return `${s.slice(0, head)}\n... (${cut} characters cut from the middle; narrow the request to see them)\n${s.slice(s.length - tailLen)}`;
}
// The same by lines, for build and test output (first error near the top, the summary at the bottom).
export function headTailLines(text, headLines = 15, tailLines = 25) {
    const ls = String(text).replace(/\s+$/, "").split(/\r?\n/);
    if (ls.length <= headLines + tailLines + 1) return ls.join("\n");
    return [...ls.slice(0, headLines), `... (${ls.length - headLines - tailLines} lines cut from the middle)`, ...ls.slice(-tailLines)].join("\n");
}

const textOf = (m) => {
    let n = String(m.content || "").length + String(m.reasoning_content || "").length;
    for (const c of m.tool_calls || []) n += String((c.function && c.function.arguments) || "").length + 20;
    return n;
};
// About 4 characters a token: enough to decide when an epoch is due.
export const estimateTokens = (messages) => Math.ceil(messages.reduce((s, m) => s + textOf(m) + 8, 0) / 4);

// Shortens tool results older than the last `keep` messages. Returns how many changed.
export function trimOld(messages, keep = KEEP_RECENT, head = 2) {
    let changed = 0;
    for (let i = head; i < messages.length - keep; i++) {
        const m = messages[i];
        if (m.role !== "tool") continue;
        const c = String(m.content || "");
        if (c.length <= TRIMMED_KEEP + 100 || c.endsWith(TRIMMED_NOTE)) continue;
        messages[i] = { ...m, content: c.slice(0, TRIMMED_KEEP) + TRIMMED_NOTE };
        changed++;
    }
    return changed;
}

// Where to cut so the part before it can be summarised: an assistant message (a turn starts there, so its
// tool results stay with it) with about the last third after it. null when too little would be summarised.
export function cutPoint(messages, head = 2) {
    const start = Math.min(messages.length - Math.floor(messages.length / 3), messages.length - KEEP_RECENT);
    for (let i = start; i >= head + MIN_SUMMARISED; i--) if (messages[i].role === "assistant") return i;
    return null;
}

// What the replaced turns did, written by the runner from the calls themselves: no model call, no guess.
export function runnerSummary(turns) {
    const calls = [], written = new Set(), read = new Set();
    let lastBuild = null, lastTest = null;
    const results = new Map(turns.filter((m) => m.role === "tool").map((m) => [m.tool_call_id, String(m.content || "")]));
    for (const m of turns) {
        if (m.role !== "assistant") continue;
        for (const c of m.tool_calls || []) {
            const name = c.function && c.function.name;
            let args = {};
            try { args = JSON.parse((c.function && c.function.arguments) || "{}"); } catch (_) { /* unreadable */ }
            const out = results.get(c.id) || "";
            calls.push(name);
            if ((name === "write_file" || name === "edit_file") && args.path && !out.startsWith("ERROR")) written.add(args.path);
            if (name === "read_file" && args.path) read.add(args.path);
            if (name === "run" && (args.command === "build" || args.command === "test")) {
                const line = `${out.split("\n")[0]}${out.split("\n").length > 1 ? " · " + out.trim().split("\n").pop().slice(0, 160) : ""}`;
                if (args.command === "build") lastBuild = line; else lastTest = line;
            }
        }
    }
    const count = calls.reduce((m, n) => m.set(n, (m.get(n) || 0) + 1), new Map());
    return [
        "(The runner replaced your earlier steps with this summary to save room. Your files on disk are as you left them; read them again before editing.)",
        `Tool calls: ${[...count].map(([n, k]) => `${n} ×${k}`).join(", ") || "none"}.`,
        `Files you changed: ${[...written].join(", ") || "none"}.`,
        `Files you read: ${[...read].slice(0, 30).join(", ") || "none"}.`,
        `Last build: ${lastBuild || "not run"}. Last test: ${lastTest || "not run"}.`,
        "Continue the task from here."
    ].join("\n");
}

// One epoch when the conversation passes budgetTokens: trim, then summarise the oldest turns if still above
// 70% of the budget. Mutates messages; returns { changed, trimmed, summarised, before, after }.
export function compact(messages, { budgetTokens = 64000, head = 2 } = {}) {
    const before = estimateTokens(messages);
    if (!budgetTokens || before <= budgetTokens) return { changed: false, trimmed: 0, summarised: 0, before, after: before };
    const trimmed = trimOld(messages, KEEP_RECENT, head);
    let summarised = 0;
    if (estimateTokens(messages) > budgetTokens * 0.7) {
        const cut = cutPoint(messages, head);
        if (cut !== null) {
            const old = messages.slice(head, cut);
            messages.splice(head, cut - head, { role: "user", content: runnerSummary(old) });
            summarised = old.length;
        }
    }
    return { changed: trimmed > 0 || summarised > 0, trimmed, summarised, before, after: estimateTokens(messages) };
}
