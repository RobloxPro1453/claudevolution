// Cheap-model coding agent. Claude writes a task spec; this agent implements it in a lane worktree on its
// own branch; Claude reviews the diff. The agent can only read the project, edit allowed files in the
// worktree, build, test and look at git: no arbitrary commands, no forbidden paths.
// Everything project-specific comes from .evrim/config.json or from plugins (core/delegate/README.md).
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawn, spawnSync } from "node:child_process";
import { appendText, exists, expand, num, readJson, readText, slash, writeJson, writeText } from "../lib/util.js";
import { PKG_ROOT, forbiddenRegexes, safeRel } from "../lib/config.js";
import { slotCount, withSlot } from "./slots.js";

const MAX_TOOL_OUTPUT = 6000, READ_LINES = 200, LOOP_WARN = 3, LOOP_STOP = 4;
const tail = (text, n) => String(text).split(/\r?\n/).slice(-n).join("\n");
const cap = (text, max = MAX_TOOL_OUTPUT) => (text.length > max ? text.slice(0, max) + `\n... (${text.length - max} more characters cut; narrow the request)` : text);

// Every command is bounded; a hung build or test is killed and reported as a failure.
export function sh(cmd, args, cwd, timeoutMs = 600000) {
    return new Promise((resolve) => {
        let text = "", done = false;
        const finish = (code) => { if (!done) { done = true; clearTimeout(timer); resolve({ code, text }); } };
        let child;
        try { child = spawn(cmd, args, { cwd, windowsHide: true }); } catch (e) { return resolve({ code: 127, text: String(e.message) }); }
        // On Windows kill the whole tree: killing only the shell left the app it started running, which then
        // locked the build output for every later build in that lane (Fotosop, 2026-11-14: 5 jobs blocked).
        const kill = () => {
            if (process.platform === "win32" && child.pid) { try { spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true }); return; } catch (_) { /* fall back */ } }
            try { child.kill(); } catch (_) { /* gone */ }
        };
        const timer = setTimeout(() => { text += `\nTIMEOUT after ${Math.round(timeoutMs / 1000)} s`; kill(); finish(124); }, timeoutMs);
        child.stdout.on("data", (d) => { text += d; });
        child.stderr.on("data", (d) => { text += d; });
        child.on("error", (e) => { text += String(e.message); finish(127); });
        child.on("close", (code) => finish(code === null ? 1 : code));
    });
}

// ------------------------------------------------------------------------------------------- pricing
export const provider = (cfg) => cfg.delegate.providers[cfg.delegate.provider];
const windows = (p) => String(p.peakUtc || "").split(",").map((w) => w.trim().match(/^(\d\d):(\d\d)-(\d\d):(\d\d)$/)).filter(Boolean).map((m) => [+m[1] * 60 + +m[2], +m[3] * 60 + +m[4]]);
// When the current peak window ends (Date), or null outside peak hours. Weekends are never peak.
export function peakUntil(p, now = new Date()) {
    const day = now.getUTCDay();
    if (day === 0 || day === 6) return null;
    const t = now.getUTCHours() * 60 + now.getUTCMinutes();
    const w = windows(p).find(([a, b]) => t >= a && t < b);
    return w ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, w[1])) : null;
}
export const offpeak = (p, now = new Date()) => !peakUntil(p, now);
export function costOf(p, tokens, now = new Date()) {
    const factor = offpeak(p, now) ? (p.offpeakFactor ?? 1) : 1;
    return (tokens.miss * p.price.input + tokens.hit * p.price.cached + tokens.out * p.price.output) / 1e6 * factor;
}

// ------------------------------------------------------------------------------------------- plugins
// A plugin is a module whose default export is { name, tools?, taskTools?, askTools?, beforeEdit?, workPlan? }.
// "builtin:<name>" loads core/delegate/plugins/<name>.js; anything else is a path relative to the project.
export async function loadPlugins(cfg) {
    const out = [];
    for (const spec of cfg.delegate.plugins || []) {
        const file = spec.startsWith("builtin:") ? path.join(PKG_ROOT, "core", "delegate", "plugins", spec.slice(8) + ".js") : path.resolve(cfg.root, spec);
        if (!exists(file)) throw new Error(`delegate plugin not found: ${spec}`);
        const mod = await import("file:///" + slash(file).replace(/^\//, ""));
        out.push(typeof mod.default === "function" ? await mod.default(cfg) : mod.default);
    }
    return out;
}

// ------------------------------------------------------------------------------------------- tools
// ctx: { cfg, wt (worktree the agent writes in), readRoot (what the read tools see), track, plugins }
export function makeTools(ctx) {
    const { cfg } = ctx;
    const forbidden = forbiddenRegexes(cfg), skip = new RegExp(cfg.skipDirs);
    const refuse = (rel, verb) => { if (forbidden.some((r) => r.test(rel))) throw new Error(`${verb} ${rel} is not allowed (see the task rules)`); };
    function walk(dir, rel, out, limit) {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const r = rel ? rel + "/" + e.name : e.name;
            if (skip.test(r)) continue;
            if (e.isDirectory()) walk(path.join(dir, e.name), r, out, limit); else out.push(r);
            if (out.length >= limit) return;
        }
    }
    const git = (args) => sh("git", args, ctx.wt, 60000);
    const tools = {
        list_files: {
            description: "List files under a folder of the project (relative path, '' for the root). Build output and dependencies are skipped.",
            parameters: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
            run: async ({ path: p }) => { const rel = p ? safeRel(p) : ""; const out = []; walk(path.join(ctx.readRoot, rel), rel, out, 300); return out.sort().join("\n") || "(empty)"; }
        },
        read_file: {
            description: `Read a project file with line numbers, at most ${READ_LINES} lines per call. Use start_line/end_line; search first to find the lines you need.`,
            parameters: { type: "object", properties: { path: { type: "string" }, start_line: { type: "integer" }, end_line: { type: "integer" } }, required: ["path"] },
            run: async ({ path: p, start_line, end_line }) => {
                const ls = readText(path.join(ctx.readRoot, safeRel(p))).split(/\r?\n/);
                const from = Math.max(1, start_line || 1), to = Math.min(ls.length, end_line || from + READ_LINES - 1, from + READ_LINES - 1);
                return ls.slice(from - 1, to).map((l, i) => `${from + i}\t${l}`).join("\n") + (to < ls.length ? `\n(${ls.length} lines in total)` : "");
            }
        },
        search: {
            description: "Search project files with a JavaScript regular expression. Optional path narrows to a folder or file. Returns file:line: text, at most 40 matches.",
            parameters: { type: "object", properties: { pattern: { type: "string" }, path: { type: "string" } }, required: ["pattern"] },
            run: async ({ pattern, path: p }) => {
                const re = new RegExp(pattern), rel = p ? safeRel(p) : "", full = path.join(ctx.readRoot, rel);
                let files = [];
                if (rel && fs.statSync(full).isFile()) files = [rel]; else walk(full, rel, files, 3000);
                const hits = [];
                for (const f of files) {
                    let text;
                    try { if (fs.statSync(path.join(ctx.readRoot, f)).size > 2e6) continue; text = readText(path.join(ctx.readRoot, f)); } catch (_) { continue; }
                    if (text.includes("\u0000")) continue; // binary
                    text.split(/\r?\n/).forEach((l, i) => { if (hits.length < 40 && re.test(l)) hits.push(`${f}:${i + 1}: ${l.trim().slice(0, 160)}`); });
                    if (hits.length >= 40) break;
                }
                return hits.join("\n") || "(no matches)";
            }
        },
        write_file: {
            description: "Create a new file or replace a file completely. Prefer edit_file for changes to existing files.",
            parameters: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] },
            run: async ({ path: p, content }) => { const rel = safeRel(p); refuse(rel, "writing"); writeText(path.join(ctx.wt, rel), String(content)); ctx.track.lastWrite = ctx.track.step; return "written " + rel; }
        },
        edit_file: {
            description: "Replace exactly one occurrence of old_text with new_text in a file. old_text must match the file exactly (including indentation) and be unique.",
            parameters: { type: "object", properties: { path: { type: "string" }, old_text: { type: "string" }, new_text: { type: "string" } }, required: ["path", "old_text", "new_text"] },
            run: async ({ path: p, old_text, new_text }) => {
                const rel = safeRel(p); refuse(rel, "editing");
                const file = path.join(ctx.wt, rel), text = readText(file);
                for (const pl of ctx.plugins) if (pl.beforeEdit) ({ old_text, new_text } = pl.beforeEdit(text, old_text, new_text));
                const count = text.split(old_text).length - 1;
                if (count !== 1) throw new Error(`old_text found ${count} times; it must be unique. Read the file again and copy the exact text.`);
                fs.writeFileSync(file, text.replace(old_text, () => new_text));
                ctx.track.lastWrite = ctx.track.step;
                return "edited " + rel;
            }
        },
        run: {
            description: `Run one of: build, test (takes up to ${cfg.testMinutes} minutes, needs the build first), git_status, git_diff (changes not yet committed).`,
            parameters: { type: "object", properties: { command: { type: "string", enum: ["build", "test", "git_status", "git_diff"] } }, required: ["command"] },
            run: async ({ command }) => {
                if (command === "build" || command === "test") {
                    const c = cfg[command];
                    if (!c) { ctx.track[command === "build" ? "lastBuildOk" : "lastTestOk"] = ctx.track.step; return `no ${command} command is configured for this project (skipped)`; }
                    // A machine-wide slot first (core/delegate/slots.js); the wait costs no step and no money.
                    const minutes = command === "build" ? cfg.buildMinutes : cfg.testMinutes;
                    const r = await withSlot(command, slotCount(cfg, command), minutes + 5, () => sh(c[0], c.slice(1), ctx.wt, minutes * 60000), { log: ctx.log, ...(ctx.slotOpts || {}) });
                    if (!r.code) { if (command === "build") ctx.track.lastBuildOk = ctx.track.step; else { ctx.track.lastTestOk = ctx.track.step; ctx.track.lastTestTail = tail(r.text.trim(), 2); } }
                    return `exit ${r.code}\n` + tail(r.text, 20);
                }
                if (command === "git_status") return (await git(["status", "--short"])).text || "(clean)";
                if (command === "git_diff") return (await git(["diff"])).text || "(no changes)";
                throw new Error("unknown command");
            }
        },
        finish: {
            description: "End the task. status 'done' only if the spec's done criteria are met and build and tests pass; otherwise 'blocked'. The report is for the reviewer: what you changed and why, how you checked it, anything uncertain.",
            parameters: { type: "object", properties: { status: { type: "string", enum: ["done", "blocked"] }, report: { type: "string" } }, required: ["status", "report"] },
            run: async () => "finishing"
        },
        answer: {
            description: "Give the final answer: short, with file:line references for every claim.",
            parameters: { type: "object", properties: { answer: { type: "string" } }, required: ["answer"] },
            run: async () => "answered"
        }
    };
    const extraTask = [], extraAsk = [];
    for (const pl of ctx.plugins) {
        for (const [name, tool] of Object.entries(pl.tools || {})) tools[name] = { ...tool, run: (a) => tool.run(a, ctx) };
        extraTask.push(...(pl.taskTools || [])); extraAsk.push(...(pl.askTools || []));
    }
    return { tools, taskTools: ["list_files", "read_file", "search", ...extraTask, "write_file", "edit_file", "run", "finish"], askTools: ["list_files", "read_file", "search", ...extraAsk, "answer"] };
}
const schema = (tools, names) => names.map((name) => ({ type: "function", function: { name, description: tools[name].description, parameters: tools[name].parameters } }));

// Loop detection: the same tool with the same arguments failing with the same error.
export function loopGuard() {
    const seen = new Map();
    return (name, args, result) => {
        if (!String(result).startsWith("ERROR")) return 0;
        const key = name + "\u0000" + JSON.stringify(args) + "\u0000" + String(result).slice(0, 300);
        const n = (seen.get(key) || 0) + 1;
        seen.set(key, n);
        return n;
    };
}

// ------------------------------------------------------------------------------------------- model
// The key comes from the environment only and is never logged, stored or echoed.
function apiKey(cfg) {
    const p = provider(cfg), key = process.env[p.keyEnv];
    if (!key) throw new Error(`${p.keyEnv} is not set (the key lives only in that environment variable)`);
    return key;
}
async function chat(cfg, messages, key, toolList, fetchImpl = fetch) {
    const p = provider(cfg);
    for (let attempt = 0; attempt < 5; attempt++) {
        const body = { model: p.model, messages, tools: toolList, temperature: 0.2, max_tokens: 16384 };
        if (p.thinking !== undefined) body.thinking = { type: p.thinking ? "enabled" : "disabled" };
        const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 300000);
        let res;
        try { res = await fetchImpl(p.apiBase.replace(/\/$/, "") + "/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + key }, body: JSON.stringify(body), signal: ctl.signal }); }
        catch (e) { clearTimeout(timer); await new Promise((r) => setTimeout(r, 3000 * (attempt + 1))); continue; }
        clearTimeout(timer);
        if (res.status === 429 || res.status >= 500) { await new Promise((r) => setTimeout(r, 3000 * (attempt + 1))); continue; }
        if (!res.ok) throw new Error("API " + res.status + ": " + (await res.text()).slice(0, 300));
        const data = await res.json(), u = data.usage || {};
        const hit = u.prompt_cache_hit_tokens ?? (u.prompt_tokens_details && u.prompt_tokens_details.cached_tokens) ?? 0;
        const tokens = { hit, miss: u.prompt_cache_miss_tokens ?? Math.max(0, (u.prompt_tokens || 0) - hit), out: u.completion_tokens || 0 };
        const cost = costOf(p, tokens);
        // Every call goes to the spend ledger at once: run records are written only when a run ends, so stopped,
        // killed and in-flight runs were missing from the daily total (Fotosop 2026-11-14: counter $0.32, provider $1.36).
        try { fs.appendFileSync(path.join(stateDir(cfg), "spend.jsonl"), JSON.stringify({ at: new Date().toISOString(), cost, ...tokens }) + "\n"); } catch (_) { /* never block a call */ }
        return { message: data.choices[0].message, cost, tokens };
    }
    throw new Error("API kept failing");
}

// The step loop shared by run/fix, scout and ask. Returns { finish, cost, steps, tokens, stopReason }.
export async function loop(ctx, messages, key, names, maxSteps, budget, finishName, chatImpl = chat) {
    const { tools } = ctx.kit;
    let cost = 0, steps = 0, finish = null, stopReason = null, edited = false;
    const tokens = { hit: 0, miss: 0, out: 0 }, guard = loopGuard();
    // A run that has changed no file is nudged at 40% and 75% of its steps instead of being stopped early.
    const nudgeAt = [Math.floor(maxSteps * 0.4), Math.floor(maxSteps * 0.75)];
    while (!finish && steps < maxSteps) {
        if (cost >= budget) { stopReason = "budget"; finish = { status: "blocked", report: `Stopped: the budget of $${budget.toFixed(2)} was used up after ${steps} steps.` }; break; }
        ctx.track.step = ++steps;
        let reply;
        try { reply = await chatImpl(ctx.cfg, messages, key, schema(tools, names)); }
        catch (error) { stopReason = "api"; finish = { status: "blocked", report: `Stopped by the runner: the model API failed (${String(error.message).slice(0, 200)}). The work so far is committed; continue with the fix command.` }; break; }
        cost += reply.cost; tokens.hit += reply.tokens.hit; tokens.miss += reply.tokens.miss; tokens.out += reply.tokens.out;
        const m = reply.message, said = { role: "assistant", content: m.content || "", tool_calls: m.tool_calls };
        if (m.reasoning_content) said.reasoning_content = m.reasoning_content; // thinking mode wants it back during tool calls
        messages.push(said);
        if (!m.tool_calls || !m.tool_calls.length) { messages.push({ role: "user", content: `Use the tools to continue, or call ${finishName}.` }); continue; }
        let warn = null;
        for (const call of m.tool_calls) {
            let args = {}, result;
            try { args = JSON.parse(call.function.arguments || "{}"); } catch (_) { /* empty args */ }
            const name = call.function.name;
            try {
                if (!names.includes(name)) throw new Error("unknown tool " + name);
                if (name === "finish") finish = { status: args.status === "done" ? "done" : "blocked", report: String(args.report || "") };
                if (name === "answer") finish = { status: "done", report: String(args.answer || "") };
                if (name === "edit_file" || name === "write_file") edited = true;
                result = await tools[name].run(args);
            } catch (error) { result = "ERROR: " + error.message; }
            if (ctx.log) ctx.log(`  [${steps}] ${name}(${JSON.stringify(args).slice(0, 90)}) $${cost.toFixed(3)}${String(result).startsWith("ERROR") ? " ERROR" : ""}`);
            messages.push({ role: "tool", tool_call_id: call.id, content: cap(String(result)) });
            const n = guard(name, args, result);
            if (n >= LOOP_STOP && !finish) { stopReason = "loop"; finish = { status: "blocked", report: `Stopped by the runner: ${name} failed ${n} times with the same arguments and the same error:\n${String(result).slice(0, 300)}` }; }
            else if (n === LOOP_WARN) warn = `${name} has now failed ${n} times with the same arguments and the same error. Do not try it again. Call ${finishName} now${finishName === "finish" ? ' with status "blocked"' : ""} and explain what you tried and what you found.`;
        }
        if (!warn && !finish && finishName === "finish" && !edited && nudgeAt.includes(steps)) warn = `You have used ${steps} of ${maxSteps} steps and changed no file. Stop exploring: write a first version now with what you know, build, and check it with the tests; refine after. If it truly cannot be done, call finish with status "blocked" and report what you found and the exact open question.`;
        if (warn && !finish) messages.push({ role: "user", content: warn });
    }
    if (!finish) { stopReason = "steps"; finish = { status: "blocked", report: `Stopped after ${maxSteps} steps without finishing.` }; }
    return { finish, cost, steps, tokens, stopReason: stopReason || "finish" };
}

// ------------------------------------------------------------------------------------------- state, git
export const stateDir = (cfg) => path.join(cfg.root, cfg.delegate.stateDir);
export const laneDir = (cfg, lane) => path.join(expand(cfg.delegate.worktreeRoot, cfg.root, cfg.project), "lane-" + lane);
export const branchOf = (cfg, task) => cfg.delegate.branchPrefix + task;
const loadState = (cfg, task) => readJson(path.join(stateDir(cfg), task + ".json"), { task, runs: [], cost: 0 });
const saveState = (cfg, state) => writeJson(path.join(stateDir(cfg), state.task + ".json"), state);

// Money spent today (UTC) over all tasks; no new task starts once delegate.dailyBudget is reached.
export function spentToday(cfg, now = new Date()) {
    const day = now.toISOString().slice(0, 10);
    // The ledger (every API call) is the truth once it exists; run records are the fallback for older state.
    try {
        const ledger = fs.readFileSync(path.join(stateDir(cfg), "spend.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
        if (ledger.length) return ledger.filter((r) => String(r.at).startsWith(day)).reduce((s, r) => s + (r.cost || 0), 0);
    } catch (_) { /* no ledger yet */ }
    let total = 0, files = [];
    try { files = fs.readdirSync(stateDir(cfg)).filter((f) => f.endsWith(".json")); } catch (_) { /* nothing yet */ }
    for (const f of files) for (const r of (readJson(path.join(stateDir(cfg), f), {}).runs || [])) if (String(r.at || "").startsWith(day)) total += r.cost || 0;
    return total;
}

export async function newCtx(cfg, lane, log = console.log) {
    const ctx = { cfg, wt: laneDir(cfg, lane), readRoot: laneDir(cfg, lane), lane, log, plugins: await loadPlugins(cfg), track: { step: 0, lastWrite: 0, lastBuildOk: 0, lastTestOk: 0, lastTestTail: "" } };
    ctx.kit = makeTools(ctx);
    ctx.git = (args) => sh("git", args, ctx.wt, 120000);
    return ctx;
}

// The lane worktree is created on demand, detached at the base branch; linkDirs (untracked folders the
// build needs) are linked from the main checkout.
export async function ensureLane(ctx) {
    const { cfg, wt } = ctx;
    if (!exists(wt)) {
        const r = await sh("git", ["worktree", "add", "--detach", wt, cfg.baseBranch], cfg.root, 120000);
        if (r.code) throw new Error("could not create the lane worktree:\n" + r.text);
    }
    for (const dir of cfg.delegate.linkDirs || []) {
        const src = path.join(cfg.root, dir), dst = path.join(wt, dir);
        if (exists(src) && !exists(dst)) { try { fs.symlinkSync(src, dst, "junction"); } catch (e) { ctx.log(`note: could not link ${dir}: ${e.message}`); } }
    }
}

// A new task gets a fresh branch cut from the base branch. A branch left with work on it (stopped from
// outside, e.g. the balance ran out) is resumed, never reset. Returns true when resuming.
export async function syncForTask(ctx, task) {
    const { cfg } = ctx, branch = branchOf(cfg, task);
    const dirty = (await ctx.git(["status", "--porcelain"])).text.trim();
    if (dirty) throw new Error("the lane worktree has uncommitted changes; clean it first:\n" + dirty);
    // A missing branch makes git log fail; its error text must not count as commits ahead (lesson 2).
    const lg = await ctx.git(["log", "--oneline", `${cfg.baseBranch}..${branch}`]);
    if (!lg.code && lg.text.trim()) {
        const c = await ctx.git(["checkout", branch]);
        if (c.code) throw new Error(`could not resume ${branch} (checked out in another worktree? detach it):\n` + c.text);
        const m = await ctx.git(["merge", "--no-edit", cfg.baseBranch]);
        if (m.code) await ctx.git(["merge", "--abort"]); // conflicts: resume on the old base; the reviewer merges
        return true;
    }
    const r = await ctx.git(["checkout", "-B", branch, cfg.baseBranch]);
    if (r.code) throw new Error("could not create " + branch + ":\n" + r.text);
    return false;
}

function systemPrompt(cfg) {
    return `${cfg.delegate.intro}
A senior reviewer wrote the task spec you get; follow it exactly and do nothing outside it.
Work only through the tools. Read before you edit. Keep changes small and in the style of the
surrounding code. When the spec says to stop and report, stop with finish(status: "blocked").
Always build and run the tests before finish(status: "done"). Write the report in plain English.

=== Rules (${cfg.tasks.rules}) ===
${readText(path.join(cfg.root, cfg.tasks.rules))}`;
}

export async function runTask(ctx, task, feedbackFile = null, deps = {}) {
    const { cfg } = ctx, key = deps.key || apiKey(cfg), p = provider(cfg);
    const specPath = path.join(cfg.root, cfg.tasks.dir, task + ".md");
    if (!exists(specPath)) throw new Error(`no spec at ${cfg.tasks.dir}/${task}.md`);
    const spec = readText(specPath);
    const budget = num((spec.match(/^Budget:\s*\$?([\d.]+)/m) || [])[1], cfg.delegate.defaultBudget);
    const maxSteps = num((spec.match(/^Steps:\s*(\d+)/m) || [])[1], cfg.delegate.defaultSteps);
    const state = loadState(cfg, task);
    const before = (await ctx.git(["rev-parse", "HEAD"])).text.trim(), startedAt = new Date().toISOString();
    ctx.readRoot = ctx.wt;
    Object.assign(ctx.track, { step: 0, lastWrite: 0, lastBuildOk: 0, lastTestOk: 0, lastTestTail: "" });

    let user = `Task ${task}. The spec:\n\n${spec}`;
    const scoutFile = path.join(stateDir(cfg), task + ".scout.md");
    if (!feedbackFile && exists(scoutFile)) user += `\n\nScout notes from a read-only pass over the code (good leads, not verified facts):\n${readText(scoutFile)}`;
    user += "\n\n" + [cfg.delegate.workPlan, ...ctx.plugins.map((pl) => pl.workPlan).filter(Boolean)].join(" ");
    const reportRel = `${cfg.tasks.dir}/${task}.report.md`, reportFile = path.join(ctx.wt, reportRel);
    if (feedbackFile) user += `\n\nYou already worked on this task. Your previous report:\n${readText(reportFile, "(none)")}\n\nThe reviewer's notes, which you must address now:\n${readText(feedbackFile)}`;
    const messages = [{ role: "system", content: systemPrompt(cfg) }, { role: "user", content: user }];

    ctx.log(`${task}: ${feedbackFile ? "fixing" : "starting"} with ${p.model}, budget $${budget.toFixed(2)}, ${maxSteps} steps, lane ${ctx.lane}`);
    const r = await loop(ctx, messages, key, ctx.kit.taskTools, maxSteps, budget, "finish", deps.chat);
    const finish = r.finish, t = ctx.track;

    // The runner checks for itself: a "done" claim is trusted only if build and tests pass. If the agent's
    // own build and test passed after its last file change, that is the same tree's result and is not repeated.
    let tests = "not run", testsBy = null;
    if (finish.status === "done") {
        if (t.lastTestOk && t.lastBuildOk && t.lastWrite < t.lastBuildOk && t.lastBuildOk <= t.lastTestOk) { tests = t.lastTestTail || "passed"; testsBy = "agent"; }
        else {
            const b = await ctx.kit.tools.run.run({ command: "build" });
            const tt = /^exit [1-9]/.test(b) ? "exit 1\nbuild failed" : await ctx.kit.tools.run.run({ command: "test" });
            tests = /^exit [1-9]/.test(tt) ? "FAILED: " + tail(tt, 6) : tail(tt.trim(), 2);
            testsBy = "runner";
            if (tests.startsWith("FAILED")) finish.status = "blocked"; // "done" without passing tests is not done
        }
    }
    const header = `# ${task} report (${new Date().toISOString().slice(0, 16)} UTC, ${p.model})\n\nStatus: ${finish.status}\nTests (${testsBy || "runner"}): ${tests}\nCost: $${r.cost.toFixed(3)}, ${r.steps} steps, stop: ${r.stopReason}\n\n`;
    writeText(reportFile, header + finish.report + "\n" + (exists(reportFile) ? "\n\n---\n\n" + readText(reportFile) : ""));
    await ctx.git(["add", "-A"]);
    await ctx.git(["commit", "-m", `${task}: ${finish.status} (${feedbackFile ? "fix" : "first pass"})\n\nTests: ${tests.split("\n")[0]}\nReport: ${reportRel}\n\n${cfg.delegate.commitTrailer || ""}`.trim()]);
    const head = (await ctx.git(["rev-parse", "HEAD"])).text.trim();
    const files = (await ctx.git(["diff", "--numstat", before, head])).text.split(/\r?\n/).filter(Boolean).map((l) => l.split("\t")).filter((x) => x[2] && !x[2].endsWith(".report.md")).map((x) => `${x[2]} +${x[0]} -${x[1]}`);
    const summary = { files, tests: tests.split("\n")[0], testsBy, stop: r.stopReason, firstReportLine: finish.report.split(/\r?\n/).find((l) => l.trim()) || "" };
    Object.assign(state, { cost: (state.cost || 0) + r.cost, status: finish.status, tests, summary, branch: branchOf(cfg, task), lane: ctx.lane });
    state.runs.push({ startedAt, at: new Date().toISOString(), kind: feedbackFile ? "fix" : "first", before, after: head, cost: r.cost, steps: r.steps, tokens: r.tokens, status: finish.status, stopReason: r.stopReason, testsBy, offpeak: offpeak(p, new Date(startedAt)) });
    saveState(cfg, state);
    ctx.log(`${task}: ${finish.status.toUpperCase()} (${r.stopReason}), tests (${testsBy || "-"}): ${tests.split("\n")[0]}, cost $${r.cost.toFixed(3)} (task total $${state.cost.toFixed(3)})\nchanged: ${files.join(", ") || "(nothing)"}`);
    return { status: finish.status, stopReason: r.stopReason, tests };
}

// Scout: a read-only pass that finds the exact place in the code before the coder starts.
export async function scout(ctx, task, deps = {}) {
    const { cfg } = ctx, key = deps.key || apiKey(cfg);
    const spec = readText(path.join(cfg.root, cfg.tasks.dir, task + ".md"));
    const messages = [
        { role: "system", content: `${cfg.delegate.intro}\nYou are the scout for a coder who will implement the task below. Read-only. Find the files and functions to change (file:line) and the existing helpers to reuse. Then call answer with notes of at most 40 lines: each fact with a file:line, and what you could not find. No guesses presented as facts.` },
        { role: "user", content: `Task ${task}:\n\n${spec}` }
    ];
    const r = await loop(ctx, messages, key, ctx.kit.askTools, 80, 0.30, "answer", deps.chat);
    // Only real notes are kept: a scout stopped by the API or the step limit has nothing to pass on.
    if (r.stopReason === "finish") writeText(path.join(stateDir(cfg), task + ".scout.md"), r.finish.report.trim() + "\n");
    const state = loadState(cfg, task);
    state.cost = (state.cost || 0) + r.cost;
    state.scout = { at: new Date().toISOString(), cost: r.cost, steps: r.steps, stop: r.stopReason };
    saveState(cfg, state);
    ctx.log(`${task}: scout ${r.stopReason}, ${r.steps} steps, $${r.cost.toFixed(3)}`);
}

// auto: scout, run, and one automatic fix pass if the run ends blocked. Used by the lanes.
export async function auto(ctx, task, deps = {}) {
    const { cfg } = ctx;
    await ensureLane(ctx);
    const resumed = await syncForTask(ctx, task);
    const notes = path.join(stateDir(cfg), task + ".auto-review.md");
    if (!exists(path.join(stateDir(cfg), task + ".scout.md"))) { try { await scout(ctx, task, deps); } catch (e) { ctx.log(`${task}: scout failed: ${e.message}`); } }
    let first;
    if (resumed) {
        writeText(notes, "The runner (not a person) resumes this task: your previous pass was stopped from outside. Your previous commit is in place; continue from the current files, finish the spec, build and test until they pass.\n");
        first = await runTask(ctx, task, notes, deps);
    } else first = await runTask(ctx, task, null, deps);
    if (first.status === "done" || first.stopReason === "api") return first;
    writeText(notes, `The runner (not a person) stopped your previous pass: ${first.stopReason}. Tests: ${String(first.tests).split("\n")[0]}.\nYour previous commit is in place; continue from the current files. If you were exploring, stop and write the change now; build and test until they pass. Finish blocked only if the spec's "Stop and report" condition is really met, with the exact open question.\n`);
    return await runTask(ctx, task, notes, deps);
}

// Read-only question about the code. Looks at the main checkout, never writes, small budget.
export async function ask(ctx, question, deps = {}) {
    const { cfg } = ctx, key = deps.key || apiKey(cfg);
    ctx.readRoot = cfg.root;
    const messages = [
        { role: "system", content: `${cfg.delegate.intro}\nYou answer one question about the code, read-only. Search narrowly, read only the lines you need, then call answer. At most 25 lines: the facts, each with a file:line reference, and say plainly what you could not find. No guesses presented as facts.` },
        { role: "user", content: question }
    ];
    const r = await loop(ctx, messages, key, ctx.kit.askTools, 30, 0.05, "answer", deps.chat);
    appendText(path.join(stateDir(cfg), "asks.jsonl"), JSON.stringify({ at: new Date().toISOString(), question: question.slice(0, 200), steps: r.steps, cost: r.cost, tokens: r.tokens, stop: r.stopReason }) + "\n");
    return { answer: r.finish.report.trim(), steps: r.steps, cost: r.cost, stop: r.stopReason };
}
