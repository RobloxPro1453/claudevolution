// Lane manager: parallel cheap-model lanes, each a DETACHED process with its own worktree and log.
// Detached on purpose (universal lesson 1): a lane started as a background job of a Claude session dies
// with that session. Peak-hour windows and the daily budget are checked before every task.
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { appendText, git, isWindows, nowIso, pidAlive, readJson, run, writeJson } from "../lib/util.js";
import { auto, branchOf, laneDir, newCtx, peakUntil, provider, spentToday, stateDir } from "./agent.js";

const CV = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "bin", "cv.js");
const lanesDir = (cfg) => path.join(stateDir(cfg), "lanes");
const laneFile = (cfg, n) => path.join(lanesDir(cfg), `lane-${n}.json`);
const laneLog = (cfg, n) => path.join(lanesDir(cfg), `lane-${n}.log`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Round-robin split: lane i gets tasks i, i+lanes, ...
export function split(tasks, lanes) {
    const n = Math.max(1, Math.min(lanes, tasks.length));
    return Array.from({ length: n }, (_, i) => tasks.filter((_, k) => k % n === i));
}

// Start the lanes and return at once. Each lane is `cv delegate lane N <tasks...>` in its own process.
export function batch(cfg, tasks, { lanes = cfg.delegate.lanes, from = 1 } = {}) {
    for (const t of tasks) if (!fs.existsSync(path.join(cfg.root, cfg.tasks.dir, t + ".md"))) throw new Error(`tarif yok: ${cfg.tasks.dir}/${t}.md`);
    if (!process.env[provider(cfg).keyEnv]) throw new Error(`${provider(cfg).keyEnv} ortam değişkeni tanımlı değil`);
    const started = [];
    split(tasks, lanes).forEach((mine, i) => {
        const n = from + i, old = readJson(laneFile(cfg, n), null);
        if (old && old.state === "running" && pidAlive(old.pid)) throw new Error(`şerit ${n} zaten çalışıyor (${old.tasks.join(", ")}); --from ile başka numara verin`);
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

// The body of one lane process: tasks in order; a failed task does not stop the lane.
export async function runLane(cfg, n, tasks, deps = {}) {
    const log = (line) => appendText(laneLog(cfg, n), line + "\n");
    const record = (patch) => writeJson(laneFile(cfg, n), { ...readJson(laneFile(cfg, n), { lane: n, tasks, done: [] }), pid: process.pid, ...patch });
    record({ state: "running" });
    const ctx = await newCtx(cfg, n, log), p = provider(cfg), done = [];
    for (const task of tasks) {
        for (let until; (until = peakUntil(p)) && !process.env.CV_PEAK_OK;) {
            log(`peak hours: waiting until ${until.toISOString().slice(11, 16)} UTC`);
            record({ current: task, waiting: "peak" });
            await (deps.sleep || sleep)(Math.max(30000, until.getTime() - Date.now() + 30000));
        }
        const spent = spentToday(cfg);
        if (spent >= cfg.delegate.dailyBudget) { log(`daily budget reached ($${spent.toFixed(2)} of $${cfg.delegate.dailyBudget}); not starting ${task}`); break; }
        log(`=== ${task} ===`);
        record({ current: task, waiting: null });
        try { const r = await auto(ctx, task, deps); done.push(`${task}:${r.status}`); }
        catch (e) { log(`${task}: ERROR ${e.message}`); done.push(`${task}:error`); }
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
