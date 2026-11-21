// Lane manager: parallel cheap-model lanes, each a DETACHED process with its own worktree and log.
// Detached on purpose (universal lesson 1): a lane started as a background job of a Claude session dies
// with that session. Peak-hour windows and the daily budget are checked before every task.
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { appendText, git, isWindows, nowIso, pidAlive, readJson, readText, run, writeJson } from "../lib/util.js";
import { auto, branchOf, laneDir, newCtx, peakUntil, provider, spentToday, stateDir } from "./agent.js";
import { parseDeclaredScope } from "./verify.js";
import { readHandoff, recordHandoff } from "./choose.js";

const CV = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "bin", "cv.js");
const lanesDir = (cfg) => path.join(stateDir(cfg), "lanes");
const laneFile = (cfg, n) => path.join(lanesDir(cfg), `lane-${n}.json`);
const laneLog = (cfg, n) => path.join(lanesDir(cfg), `lane-${n}.log`);
export const blackboardFile = (cfg) => path.join(cfg.root, ".evrim", "lanes", "blackboard.json");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PASS_STATUSES = new Set(["done", "ready", "ok", "passed", "success"]);
const FAIL_STATUSES = new Set(["error", "failed", "blocked", "stopped", "red", "timeout", "budget"]);

// Round-robin split: lane i gets tasks i, i+lanes, ... (kept for callers; batch uses planLanes below).
export function split(tasks, lanes) {
    const n = Math.max(1, Math.min(lanes, tasks.length));
    return Array.from({ length: n }, (_, i) => tasks.filter((_, k) => k % n === i));
}

// Two declared scopes (files, folders, globs) may touch the same file: compared by their fixed prefix, so a
// folder and a file under it overlap, and a pattern with no fixed part overlaps everything (careful side).
const scopeStem = (s) => String(s).replace(/\\/g, "/").replace(/^\.\//, "").split(/[*?[{]/)[0];
export function scopesOverlap(a, b) {
    if (!Array.isArray(a) || !Array.isArray(b) || !a.length || !b.length) return false;
    for (const x of a) for (const y of b) {
        const p = scopeStem(x), q = scopeStem(y);
        if (!p || !q || p === q || p.startsWith(q.endsWith("/") ? q : q + "/") || q.startsWith(p.endsWith("/") ? p : p + "/")) return true;
    }
    return false;
}

// Which lane runs which tasks. A task and everything it depends on (Depends-On:) share a lane, so a
// prerequisite is always finished, in the same lane, before its dependent starts (round-robin put them in
// different lanes, where the dependent waited up to 10 minutes and then gave up, or started from a base
// without the prerequisite's code). Tasks whose declared Scope: may touch the same file also share a lane
// (ERRATA E9): two lanes editing one file never run at once. Groups are spread over the lanes, largest first;
// each lane keeps the topological order.
export function planLanes(order, lanes, { deps = {}, scopes = {} } = {}) {
    const parent = new Map(order.map((t) => [t, t]));
    const find = (t) => { while (parent.get(t) !== t) { parent.set(t, parent.get(parent.get(t))); t = parent.get(t); } return t; };
    const union = (a, b) => { const x = find(a), y = find(b); if (x !== y) parent.set(y, x); };
    for (const t of order) for (const d of deps[t] || []) if (parent.has(d)) union(t, d);
    for (let i = 0; i < order.length; i++) for (let j = i + 1; j < order.length; j++) if (scopesOverlap(scopes[order[i]], scopes[order[j]])) union(order[i], order[j]);
    const groups = new Map();
    for (const t of order) { const r = find(t); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(t); }
    const n = Math.max(1, Math.min(lanes, groups.size));
    const bins = Array.from({ length: n }, () => []);
    for (const g of [...groups.values()].sort((a, b) => b.length - a.length || order.indexOf(a[0]) - order.indexOf(b[0]))) {
        const i = bins.reduce((best, bin, k) => (bin.length < bins[best].length ? k : best), 0);
        bins[i].push(...g);
    }
    return bins.filter((b) => b.length).map((b) => b.sort((x, y) => order.indexOf(x) - order.indexOf(y)));
}

// Parse `Depends-On:` / `Bağımlılık:` declarations from a task markdown spec.
export function parseDependsOn(text) {
    const deps = [];
    const seen = new Set();
    const re = /^\s*(?:[-*]\s*)?(?:\*\*)?(?:depends[-_\s]?on|bağımlılık(?:lar)?)(?:\*\*)?\s*:\s*(.+)$/gim;
    let m;
    while ((m = re.exec(String(text || "")))) {
        for (const raw of m[1].split(/[,\s;]+/)) {
            const tok = raw.replace(/^[`"'[\]()]+|[`"'[\]()]+$/g, "").trim();
            if (!tok || /^(?:none|yok|-+|null|n\/a)$/i.test(tok) || seen.has(tok)) continue;
            seen.add(tok);
            deps.push(tok);
        }
    }
    return deps;
}

function findCyclePath(nodes, adj) {
    const state = new Map(); // 0=unvisited, 1=visiting, 2=done
    const stack = [];
    const dfs = (u) => {
        state.set(u, 1);
        stack.push(u);
        for (const v of adj.get(u) || []) {
            if (state.get(v) === 1) {
                const idx = stack.indexOf(v);
                return [...stack.slice(idx), v];
            }
            if (!state.get(v)) {
                const hit = dfs(v);
                if (hit) return hit;
            }
        }
        stack.pop();
        state.set(u, 2);
        return null;
    };
    for (const n of nodes) {
        if (!state.get(n)) {
            const hit = dfs(n);
            if (hit) return hit;
        }
    }
    return nodes.slice(0, 2);
}

// Build topological execution waves from `Depends-On:` / `Bağımlılık:` headers and detect cycles.
export function buildDagWaves(root, taskIds, opts = {}) {
    const baseRoot = typeof root === "string" ? root : root?.root;
    const tasksDir = opts.tasksDir || (typeof root === "object" ? root?.tasks?.dir : null) || "docs/tasks";
    const unique = [];
    const nodeSet = new Set();
    for (const id of taskIds || []) {
        if (!nodeSet.has(id)) { nodeSet.add(id); unique.push(id); }
    }
    const deps = {};
    const externalDeps = {};
    const inDegree = new Map();
    const dependents = new Map();
    const internalAdj = new Map();
    for (const id of unique) {
        inDegree.set(id, 0);
        dependents.set(id, []);
        internalAdj.set(id, []);
    }
    for (const id of unique) {
        const specText = opts.specs?.[id] ?? (baseRoot ? readText(path.join(baseRoot, tasksDir, `${id}.md`), "") : "");
        const parsed = parseDependsOn(specText);
        deps[id] = parsed;
        const ext = [];
        for (const d of parsed) {
            if (nodeSet.has(d)) {
                inDegree.set(id, inDegree.get(id) + 1);
                dependents.get(d).push(id);
                internalAdj.get(id).push(d);
            } else {
                ext.push(d);
            }
        }
        if (ext.length) externalDeps[id] = ext;
    }

    const waves = [];
    const order = [];
    let frontier = unique.filter((id) => inDegree.get(id) === 0);
    while (frontier.length) {
        waves.push(frontier);
        order.push(...frontier);
        const nextSet = new Set();
        for (const u of frontier) {
            for (const v of dependents.get(u)) {
                inDegree.set(v, inDegree.get(v) - 1);
                if (inDegree.get(v) === 0) nextSet.add(v);
            }
        }
        frontier = unique.filter((id) => nextSet.has(id));
    }

    if (order.length !== unique.length) {
        const remaining = unique.filter((id) => !order.includes(id));
        const cycle = findCyclePath(remaining, internalAdj);
        throw new Error(`görev bağımlılıklarında döngü (cycle) var: ${cycle.join(" -> ")}`);
    }
    return { waves, order, deps, externalDeps };
}

export function loadBlackboard(cfg) {
    const bb = readJson(blackboardFile(cfg), null);
    if (!bb || typeof bb !== "object") return { updatedAt: null, tasks: {} };
    return { updatedAt: bb.updatedAt || null, tasks: bb.tasks && typeof bb.tasks === "object" ? bb.tasks : {} };
}

export function saveBlackboard(cfg, bb) {
    const file = blackboardFile(cfg);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    writeJson(file, { ...bb, updatedAt: nowIso() });
}

export function recordBlackboard(cfg, task, entry) {
    const bb = loadBlackboard(cfg);
    bb.tasks[task] = { ...(bb.tasks[task] || {}), ...entry, task, updatedAt: nowIso() };
    saveBlackboard(cfg, bb);
    return bb;
}

export function formatPriorWork(bb, task, taskDeps = []) {
    const entries = bb?.tasks || {};
    const picked = [];
    const seen = new Set();
    const addEntry = (id) => {
        if (id === task || seen.has(id)) return;
        const e = entries[id];
        if (!e || !PASS_STATUSES.has(e.status)) return;
        seen.add(id);
        const files = Array.isArray(e.files) && e.files.length ? ` [${e.files.slice(0, 6).join(", ")}]` : "";
        picked.push(`- ${id} (${e.branch || "-"}): ${e.summary || e.status}${files}`);
    };
    for (const d of taskDeps || []) addEntry(d);
    for (const id of Object.keys(entries)) {
        if (picked.length >= 8) break;
        addEntry(id);
    }
    return picked.join("\n");
}

function seedBlackboard(cfg, dag) {
    const bb = loadBlackboard(cfg);
    dag.waves.forEach((wave, waveIdx) => {
        for (const task of wave) {
            bb.tasks[task] = {
                task,
                status: "pending",
                wave: waveIdx,
                deps: dag.deps[task] || [],
                blockedBy: [],
                branch: branchOf(cfg, task),
                updatedAt: nowIso(),
            };
        }
    });
    saveBlackboard(cfg, bb);
}

function taskSummaryFromState(cfg, task, res) {
    if (res?.summaryText) return res.summaryText;
    const st = readJson(path.join(stateDir(cfg), `${task}.json`), null);
    const files = st?.summary?.files || res?.files || [];
    const tests = String(st?.tests || res?.tests || "").split("\n")[0];
    const parts = [];
    if (res?.status) parts.push(`status=${res.status}`);
    if (tests) parts.push(`tests=${tests}`);
    return { summary: parts.join("; ") || res?.status || "done", files };
}

function depOwnedByAliveLane(cfg, dep) {
    try {
        for (const f of fs.readdirSync(lanesDir(cfg)).filter((x) => /^lane-\d+\.json$/.test(x))) {
            const l = readJson(path.join(lanesDir(cfg), f), null);
            if (!l || l.state !== "running" || !pidAlive(l.pid)) continue;
            if ((l.tasks || []).includes(dep) && !(l.done || []).some((d) => String(d).split(":")[0] === dep)) return true;
        }
    } catch (_) { /* no lanes dir */ }
    return false;
}

async function resolveDepsForTask(cfg, task, taskDeps, { sleepFn, pendingInBatch, log }) {
    if (!taskDeps || !taskDeps.length) return [];
    const start = Date.now();
    const maxWaitMs = 10 * 60 * 1000;
    while (true) {
        const bb = loadBlackboard(cfg);
        const blockedBy = [];
        let waitingFor = null;
        for (const d of taskDeps) {
            const entry = bb.tasks[d];
            if (entry && FAIL_STATUSES.has(entry.status)) {
                blockedBy.push(d);
            } else if (entry && PASS_STATUSES.has(entry.status)) {
                continue;
            } else if (depOwnedByAliveLane(cfg, d) || (entry?.status === "running" && pendingInBatch?.has(d))) {
                waitingFor = d;
            } else if (entry?.status === "pending" && pendingInBatch?.has(d) && Date.now() - start < 5000) {
                waitingFor = d;
            } else if (entry?.status === "running" || entry?.status === "pending") {
                blockedBy.push(d);
            }
        }
        if (blockedBy.length || !waitingFor) return blockedBy;
        if (Date.now() - start > maxWaitMs) return [waitingFor];
        log?.(`${task}: waiting on dependency ${waitingFor}`);
        await sleepFn(1000);
    }
}

async function executeTaskStep(cfg, ctx, task, dag, log, deps, pendingInBatch) {
    const p = provider(cfg);
    const taskDeps = dag.deps[task] || [];
    const blockedBy = await resolveDepsForTask(cfg, task, taskDeps, {
        sleepFn: deps.sleep || sleep,
        pendingInBatch,
        log,
    });
    if (blockedBy.length) {
        const msg = `blocked by failed/blocked dependency: ${blockedBy.join(", ")}`;
        log?.(`${task}: ${msg}`);
        recordBlackboard(cfg, task, { status: "blocked", blockedBy, error: msg });
        return { task, status: "blocked", blockedBy };
    }

    for (let until; (until = peakUntil(p)) && !process.env.CV_PEAK_OK;) {
        log?.(`peak hours: waiting until ${until.toISOString().slice(11, 16)} UTC`);
        deps.onWait?.(task, "peak");
        await (deps.sleep || sleep)(Math.max(30000, until.getTime() - Date.now() + 30000));
    }
    const spent = deps.spentToday ? deps.spentToday(cfg) : spentToday(cfg);
    if (spent >= cfg.delegate.dailyBudget) {
        log?.(`daily budget reached ($${spent.toFixed(2)} of $${cfg.delegate.dailyBudget}); not starting ${task}`);
        recordBlackboard(cfg, task, { status: "budget", error: "daily budget reached" });
        return { task, status: "budget", budgetStop: true };
    }

    // The API path is closed (balance gone / key refused, K25): leave the task for the fallback worker.
    const handoff = (deps.readHandoff || readHandoff)(cfg);
    if (handoff) {
        log?.(`${task}: API hand-off (${handoff.kind}); left for the main model (cv delegate which)`);
        recordBlackboard(cfg, task, { status: "handoff", error: `API ${handoff.kind}` });
        return { task, status: "handoff", handoff: true };
    }

    log?.(`=== ${task} ===`);
    deps.onStart?.(task);
    recordBlackboard(cfg, task, { status: "running", blockedBy: [] });
    const bb = loadBlackboard(cfg);
    const priorWork = deps.priorWork ?? formatPriorWork(bb, task, taskDeps);
    const autoFn = deps.auto || auto;
    try {
        const r = await autoFn(ctx, task, { ...deps, ...(priorWork ? { priorWork } : {}), dependsOn: taskDeps });
        const rawStatus = r?.status || (r?.ok === false ? "error" : "done");
        const { summary, files } = taskSummaryFromState(cfg, task, r);
        recordBlackboard(cfg, task, { status: rawStatus, branch: r?.branch || branchOf(cfg, task), summary, files });
        // Every rung refused for billing/auth: hand the rest of the night to the fallback at once (H50).
        if (r?.stopReason === "api" && (r.apiKind === "billing" || r.apiKind === "auth")) {
            recordHandoff(cfg, { kind: r.apiKind, task });
            log?.(`${task}: API ${r.apiKind}; hand-off written, remaining tasks go to the main model`);
            return { task, status: rawStatus, result: r, handoff: true };
        }
        return { task, status: rawStatus, result: r };
    } catch (e) {
        log?.(`${task}: ERROR ${e.message}`);
        recordBlackboard(cfg, task, { status: "error", error: e.message });
        return { task, status: "error", error: e.message };
    }
}

// Start the lanes and return at once. Each lane is `cv delegate lane N <tasks...>` in its own process.
export function batch(cfg, tasks, { lanes = cfg.delegate.lanes, from = 1 } = {}) {
    for (const t of tasks) if (!fs.existsSync(path.join(cfg.root, cfg.tasks.dir, t + ".md"))) throw new Error(`tarif yok: ${cfg.tasks.dir}/${t}.md`);
    const dag = buildDagWaves(cfg.root, tasks, { tasksDir: cfg.tasks?.dir });
    if (!process.env[provider(cfg).keyEnv]) throw new Error(`${provider(cfg).keyEnv} ortam değişkeni tanımlı değil`);
    // A task already queued on a running lane must not start twice (two lanes on one branch fight over it).
    const busy = new Map();
    try {
        for (const f of fs.readdirSync(lanesDir(cfg)).filter((x) => /^lane-\d+\.json$/.test(x))) {
            const l = readJson(path.join(lanesDir(cfg), f), null);
            if (l && l.state === "running" && pidAlive(l.pid)) for (const t of l.tasks) if (!(l.done || []).some((d) => String(d).split(":")[0] === t)) busy.set(t, l.lane);
        }
    } catch (_) { /* no lanes yet */ }
    const dup = dag.order.filter((t) => busy.has(t));
    if (dup.length) throw new Error(`zaten bir şeritte: ${dup.map((t) => `${t} (şerit ${busy.get(t)})`).join(", ")}`);
    // Check every target lane before starting any, so a refusal never leaves half of a batch running.
    const scopes = Object.fromEntries(dag.order.map((t) => [t, parseDeclaredScope(readText(path.join(cfg.root, cfg.tasks.dir, t + ".md"), ""))]));
    const groups = planLanes(dag.order, lanes, { deps: dag.deps, scopes });
    groups.forEach((_, i) => {
        const n = from + i, old = readJson(laneFile(cfg, n), null);
        if (old && old.state === "running" && pidAlive(old.pid)) throw new Error(`şerit ${n} zaten çalışıyor (${old.tasks.join(", ")}); --from ile başka numara verin`);
    });
    seedBlackboard(cfg, dag);
    const started = [];
    groups.forEach((mine, i) => {
        const n = from + i;
        fs.mkdirSync(lanesDir(cfg), { recursive: true });
        fs.writeFileSync(laneLog(cfg, n), `lane ${n}: ${mine.join(", ")}\n`);
        const isDeno = !!process.versions.deno;
        const args = [...(isDeno ? ["run", "-A", "--quiet"] : []), CV, "delegate", "lane", String(n), ...mine];
        const child = spawn(process.execPath, args, { cwd: cfg.root, detached: true, stdio: "ignore", windowsHide: true });
        child.unref();
        writeJson(laneFile(cfg, n), { lane: n, pid: child.pid, tasks: mine, state: "running", startedAt: nowIso(), current: null, done: [] });
        started.push({ lane: n, tasks: mine, log: laneLog(cfg, n) });
    });
    return started;
}

// Execute a full task set wave-by-wave in process with failure isolation and blackboard sharing.
export async function runDag(cfg, tasks, deps = {}) {
    const dag = buildDagWaves(cfg.root, tasks, { tasksDir: cfg.tasks?.dir, specs: deps.specs });
    seedBlackboard(cfg, dag);
    const log = deps.log || (() => {});
    const ctx = deps.ctx || (deps.newCtx ? await deps.newCtx(cfg, 1, log) : await newCtx(cfg, 1, log));
    const results = [];
    const blocked = [];
    const pendingInBatch = new Set(dag.order);
    let budgetHit = false;
    for (const wave of dag.waves) {
        if (budgetHit) break;
        for (const task of wave) {
            pendingInBatch.delete(task);
            const r = await executeTaskStep(cfg, ctx, task, dag, log, deps, pendingInBatch);
            results.push(r);
            if (r.status === "blocked") blocked.push(r);
            if (r.budgetStop || r.handoff) { budgetHit = true; break; }
        }
    }
    return {
        ok: results.every((r) => PASS_STATUSES.has(r.status)),
        dag,
        results,
        blocked,
        blackboard: loadBlackboard(cfg),
    };
}

// The body of one lane process: tasks in topological wave order; failed tasks isolate dependents without stopping independent ones.
export async function runLane(cfg, n, tasks, deps = {}) {
    const log = (line) => appendText(laneLog(cfg, n), line + "\n");
    const record = (patch) => writeJson(laneFile(cfg, n), { ...readJson(laneFile(cfg, n), { lane: n, tasks, done: [] }), pid: process.pid, ...patch });
    record({ state: "running" });
    const dag = buildDagWaves(cfg.root, tasks, { tasksDir: cfg.tasks?.dir, specs: deps.specs });
    const existingBb = loadBlackboard(cfg);
    for (const t of dag.order) {
        if (!existingBb.tasks[t]) recordBlackboard(cfg, t, { status: "pending", deps: dag.deps[t] || [], branch: branchOf(cfg, t) });
    }
    const ctx = deps.ctx || (deps.newCtx ? await deps.newCtx(cfg, n, log) : await newCtx(cfg, n, log));
    const done = [];
    const pendingInBatch = new Set(dag.order);
    for (const task of dag.order) {
        pendingInBatch.delete(task);
        const r = await executeTaskStep(cfg, ctx, task, dag, log, {
            ...deps,
            onWait: (t, why) => record({ current: t, waiting: why }),
            onStart: (t) => record({ current: t, waiting: null }),
        }, pendingInBatch);
        if (r.budgetStop) break;
        if (r.handoff) {
            done.push(`${task}:${r.status}`);
            for (const rest of dag.order.slice(dag.order.indexOf(task) + 1)) if (!done.some((d) => d.startsWith(rest + ":"))) { recordBlackboard(cfg, rest, { status: "handoff", error: "API hand-off" }); done.push(`${rest}:handoff`); }
            record({ done });
            break;
        }
        done.push(`${task}:${r.status}`);
        record({ done });
    }
    record({ state: "done", current: null, endedAt: nowIso() });
}

export function stop(cfg, n) {
    const lane = readJson(laneFile(cfg, n), null);
    if (!lane) return `şerit ${n} kaydı yok`;
    if (lane.state === "running" && pidAlive(lane.pid)) {
        // Only processes we started (recorded pid) are ever killed.
        if (isWindows) run("taskkill", ["/PID", String(lane.pid), "/T", "/F"], { timeoutMs: 20000 }); else { try { process.kill(lane.pid); } catch (_) { /* gone */ } }
    }
    writeJson(laneFile(cfg, n), { ...lane, state: "stopped", endedAt: nowIso() });
    return `şerit ${n} durduruldu; yarım iş ${lane.current ? branchOf(cfg, lane.current) + " dalında / " : ""}çalışma kopyasında duruyor (${laneDir(cfg, n)})`;
}

// Tasks, lanes and branches waiting for review, in one bounded text.
export function statusText(cfg) {
    const out = [];
    let files = [];
    try { files = fs.readdirSync(stateDir(cfg)).filter((f) => f.endsWith(".json")); } catch (_) { /* none */ }
    for (const f of files.sort()) {
        const s = readJson(path.join(stateDir(cfg), f), null);
        if (!s || !Array.isArray(s.runs)) continue;
        const last = s.runs[s.runs.length - 1] || {};
        out.push(`${s.task}: ${s.status || "?"}, ${s.runs.length} koşu, $${(s.cost || 0).toFixed(3)}, test: ${String(s.tests || "").split("\n")[0]}${last.stopReason && last.stopReason !== "finish" ? ", durma: " + last.stopReason : ""}${s.summary && s.summary.files.length ? " · " + s.summary.files.slice(0, 4).join(", ") : ""}`);
    }
    let lanes = [];
    try { lanes = fs.readdirSync(lanesDir(cfg)).filter((f) => f.endsWith(".json")); } catch (_) { /* none */ }
    for (const f of lanes.sort()) {
        const l = readJson(path.join(lanesDir(cfg), f), null);
        if (!l) continue;
        const alive = l.state === "running" && pidAlive(l.pid);
        out.push(`şerit ${l.lane}: ${l.state === "running" ? (alive ? "çalışıyor" : "ÖLMÜŞ (cv recover --fix)") : l.state}${l.current ? ", şu an " + l.current + (l.waiting ? " (yoğun saat bekliyor)" : "") : ""} · biten: ${(l.done || []).join(", ") || "-"}`);
    }
    const bb = loadBlackboard(cfg);
    const blocked = Object.values(bb.tasks).filter((t) => t.status === "blocked");
    if (blocked.length) out.push(`engellenen görevler: ${blocked.map((t) => `${t.task} (${(t.blockedBy || []).join("+")})`).join(", ")}`);
    // A failed git command yields no branches; its error text is never parsed as data.
    const br = git(["branch", "--list", "--format=%(refname:short)", cfg.delegate.branchPrefix + "*"], cfg.root);
    const waiting = [];
    for (const b of br.ok ? br.out.split(/\r?\n/).filter(Boolean) : []) {
        const lg = git(["rev-list", "--count", `${cfg.baseBranch}..${b}`], cfg.root);
        if (lg.ok && parseInt(lg.out, 10) > 0) waiting.push(`${b} (+${lg.out.trim()})`);
    }
    out.push(waiting.length ? "gözden geçirilmeyi bekleyen dallar: " + waiting.join(", ") : "gözden geçirilmeyi bekleyen dal yok");
    out.push(`bugünkü harcama: $${spentToday(cfg).toFixed(3)} / $${cfg.delegate.dailyBudget}`);
    return out.join("\n");
}
