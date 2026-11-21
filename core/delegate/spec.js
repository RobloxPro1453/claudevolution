// Reading a task spec's header lines (shared by the agent, the lanes and the verifier; no imports, so no cycle).

const headerValues = (text, names) => {
    const re = new RegExp(`^\\s*(?:[-*]\\s*)?(?:\\*\\*)?(?:${names})(?:\\*\\*)?\\s*:\\s*(.+)$`, "gim");
    const out = [];
    for (const m of String(text || "").matchAll(re)) out.push(m[1].trim());
    return out;
};
const clean = (t) => String(t).trim().replace(/^[`"']+|[`"',;]+$/g, "").replace(/\\/g, "/").replace(/^\.\//, "");
const empty = (v) => !v || /^(?:-+|none|yok|null|n\/a|\(none\))$/i.test(v.trim());

// Locked acceptance test (ERRATA E8). The planner (the main model) writes the test before the task is handed
// out and commits it; the spec names it:
//   Acceptance: tests/accept/T-004.test.js            (Kabul: ...)   files the coding agent may not change
//   Acceptance-Cmd: node tests/accept/T-004.test.js   (Kabul-Komutu: ...)  optional: run on the base (must
//                                                      fail: red) and on the branch (must pass: green)
// The command is split on spaces and run without a shell.
export function parseAcceptance(specText) {
    const files = [];
    for (const v of headerValues(specText, "acceptance|kabul")) if (!empty(v)) for (const p of v.split(/[\s,]+/)) { const c = clean(p); if (c) files.push(c); }
    const cmdLine = headerValues(specText, "acceptance[-_ ]cmd|kabul[-_ ]komutu")[0];
    const cmd = cmdLine && !empty(cmdLine) ? splitCommand(cmdLine.replace(/^`|`$/g, "")) : null;
    return { files: [...new Set(files)], cmd };
}

// A command line as program + arguments, no shell: a JSON array as written, else words split on spaces with
// "double" or 'single' quotes keeping a path with spaces together (C:\Program Files\...).
export function splitCommand(line) {
    const s = String(line).trim();
    if (s.startsWith("[")) { try { const a = JSON.parse(s); if (Array.isArray(a) && a.every((x) => typeof x === "string")) return a; } catch (_) { /* words */ } }
    const out = [];
    for (const m of s.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)) out.push(m[1] ?? m[2] ?? m[3]);
    return out.length ? out : null;
}

// Is a scout pass worth its cost? Not when the spec already names a small scope and its known facts point at
// the code (file:line); yes for an undeclared or wide scope, or when nothing is known yet.
export function needsScout(specText) {
    const s = String(specText || "");
    const scope = headerValues(s, "scope|files|kapsam").filter((v) => !empty(v)).flatMap((v) => v.split(/[\s,]+/).filter(Boolean));
    if (!scope.length || scope.length > 3 || scope.some((p) => /[*?]|\/$/.test(p))) return true;
    const facts = (s.match(/##\s*Known facts\s*\n([\s\S]*?)(?:\n##\s|$)/i) || [])[1] || "";
    return !/[\w./-]+\.\w+:\d+/.test(facts);
}
