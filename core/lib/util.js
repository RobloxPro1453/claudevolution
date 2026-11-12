// Shared helpers. Node standard library only (runs on Node >= 18 and on Deno 2 through its node: layer).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

export const isWindows = process.platform === "win32";
export const home = () => process.env.USERPROFILE || process.env.HOME || os.homedir();
export const nowIso = (d = new Date()) => d.toISOString();
// Local "YYYY-MM-DD HH:MM" for the owner-facing files.
export function stamp(d = new Date()) {
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
export const today = (d = new Date()) => stamp(d).slice(0, 10);

// "~" is the home folder, {project} the project name. Relative paths resolve against root.
export function expand(p, root, project = "") {
    let s = String(p).replace(/\{project\}/g, project);
    if (s === "~" || s.startsWith("~/") || s.startsWith("~\\")) s = path.join(home(), s.slice(1));
    return path.isAbsolute(s) ? path.normalize(s) : path.resolve(root, s);
}
export const slash = (p) => String(p).replace(/\\/g, "/");

export function exists(p) { try { fs.statSync(p); return true; } catch (_) { return false; } }
export function readText(p, fallback = null) { try { return fs.readFileSync(p, "utf8"); } catch (e) { if (fallback !== null) return fallback; throw e; } }
export function writeText(p, text) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text); }
export function appendText(p, text) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.appendFileSync(p, text); }
export function readJson(p, fallback) { try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch (_) { return fallback; } }
export function writeJson(p, value) { writeText(p, JSON.stringify(value, null, 2) + "\n"); }
export const lines = (text) => String(text).split(/\r?\n/);
export const tail = (text, n) => lines(String(text).replace(/\s+$/, "")).slice(-n).join("\n");

// Every external command has a time limit; a hung command is killed and reported, never waited on forever.
// The exit code decides success: error text is never treated as data (universal lesson 2).
export function run(cmd, args = [], { cwd, timeoutMs = 120000, env } = {}) {
    const r = spawnSync(cmd, args, { cwd, timeout: timeoutMs, encoding: "utf8", env: env || process.env, windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
    const timedOut = !!(r.error && /ETIMEDOUT|timed? ?out/i.test(String(r.error.code || r.error.message))) || r.signal === "SIGTERM";
    const missing = !!(r.error && r.error.code === "ENOENT");
    const code = r.status === null || r.status === undefined ? (timedOut ? 124 : 127) : r.status;
    return { code, ok: code === 0, timedOut, missing, text: (r.stdout || "") + (r.stderr || ""), out: (r.stdout || "").trim() };
}
export const git = (args, cwd, timeoutMs = 60000) => run("git", args, { cwd, timeoutMs });

// --flag value / --flag (true) / positionals in _.
export function parseArgs(argv) {
    const o = { _: [] };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a.startsWith("--")) {
            const k = a.slice(2), next = argv[i + 1];
            o[k] = next !== undefined && !next.startsWith("--") ? argv[++i] : true;
        } else o._.push(a);
    }
    return o;
}
export function num(v, d = null) { const n = parseFloat(v); return Number.isFinite(n) ? n : d; }

export function pidAlive(pid) {
    if (!pid) return false;
    if (isWindows) return new RegExp(`\\b${pid}\\b`).test(run("tasklist", ["/FI", `PID eq ${pid}`, "/NH"], { timeoutMs: 15000 }).text);
    try { process.kill(pid, 0); return true; } catch (e) { return e.code === "EPERM"; }
}

export function deepMerge(base, over) {
    if (Array.isArray(over) || over === null || typeof over !== "object") return over;
    const out = { ...(base && typeof base === "object" && !Array.isArray(base) ? base : {}) };
    for (const k of Object.keys(over)) out[k] = deepMerge(out[k], over[k]);
    return out;
}
