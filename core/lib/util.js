// Shared helpers. Node standard library only (runs on Node >= 18 and on Deno 2 through its node: layer).
import fs from "node:fs";
import { Buffer } from "node:buffer";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { launchTarget } from "./process.js";

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
// The one atomic writer (adapted from craft-anything platform/fs.rs, craft-libs craft-atomic and OMK
// atomic-session-file.ts; MIT/Apache-2.0, see THIRD_PARTY_NOTICES.md). A reader sees the whole old or the
// whole new file, never a cut one: a unique temp file beside the target (exclusive create, so two writers
// never share one; the old name used pid+millisecond and could collide), flushed to disk, then renamed.
// On Windows an antivirus scan or the search indexer holds a fresh file for a moment: the rename is retried
// with a short backoff instead of the old fallback that wrote the target in place (a crash then cut it).
let tmpCounter = 0;
const RENAME_RETRY = new Set(["EPERM", "EACCES", "EBUSY"]);
export function sleepSync(ms) { try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); } catch (_) { /* no wait */ } }
export function renameRetrying(from, to, tries = 12) {
    for (let i = 0; ; i++) {
        try { fs.renameSync(from, to); return; } catch (e) {
            if (!isWindows || !RENAME_RETRY.has(e.code) || i >= tries) throw e;
            sleepSync(Math.min(200, 10 * 2 ** i));
        }
    }
}
export function writeText(p, text) {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    const tmp = path.join(path.dirname(p), `.${path.basename(p)}.${process.pid}.${++tmpCounter}.${Math.random().toString(36).slice(2, 8)}.tmp`);
    let fd = null;
    try {
        fd = fs.openSync(tmp, "wx");
        const buf = ArrayBuffer.isView(text) ? Buffer.from(text.buffer, text.byteOffset, text.byteLength) : Buffer.from(String(text), "utf8");
        for (let off = 0; off < buf.length;) off += fs.writeSync(fd, buf, off, buf.length - off);
        try { fs.fsyncSync(fd); } catch (_) { /* some filesystems refuse fsync; the rename still protects */ }
        fs.closeSync(fd);
        fd = null;
        renameRetrying(tmp, p);
    } catch (e) {
        if (fd !== null) { try { fs.closeSync(fd); } catch (_) { /* closing */ } }
        try { fs.unlinkSync(tmp); } catch (_) { /* best effort */ }
        throw e;
    }
}
export function appendText(p, text) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.appendFileSync(p, text); }
export function readJson(p, fallback) {
    let raw;
    try { raw = fs.readFileSync(p, "utf8"); } catch (_) { return fallback; }
    try { return JSON.parse(raw); } catch (_) {
        if (raw.trim().length > 0) {
            // Keep every byte under a name nothing else has (an older .corrupt copy is never overwritten).
            try { fs.copyFileSync(p, exists(`${p}.corrupt`) ? `${p}.corrupt.${Date.now()}` : `${p}.corrupt`); } catch (_) { /* best effort */ }
        }
        return fallback;
    }
}
export function writeJson(p, value) { writeText(p, JSON.stringify(value, null, 2) + "\n"); }

const isJsonContainer = (v) => v !== null && typeof v === "object";

function findBalancedEnd(text, start) {
    const open = text[start];
    if (open !== "{" && open !== "[") return -1;
    const stack = [open === "{" ? "}" : "]"];
    let inStr = false, esc = false;
    for (let i = start + 1; i < text.length; i++) {
        const ch = text[i];
        if (inStr) {
            if (esc) { esc = false; continue; }
            if (ch === "\\") { esc = true; continue; }
            if (ch === '"') inStr = false;
            continue;
        }
        if (ch === '"') { inStr = true; continue; }
        if (ch === "{") stack.push("}");
        else if (ch === "[") stack.push("]");
        else if (ch === "}" || ch === "]") {
            if (stack.pop() !== ch) return -1;
            if (stack.length === 0) return i;
        }
    }
    return -1;
}

function scanBalancedJson(text) {
    let best = null, attempts = 0;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch !== "{" && ch !== "[") continue;
        if (++attempts > 512) break;
        const end = findBalancedEnd(text, i);
        if (end < 0) continue;
        try {
            const parsed = JSON.parse(text.slice(i, end + 1));
            if (isJsonContainer(parsed)) {
                best = parsed;
                i = end;
            }
        } catch (_) { /* try next candidate */ }
    }
    return best;
}

// Lenient JSON object/array extraction from model output: raw JSON, last ```json fenced block, or balanced {...}/[...].
export function extractJson(raw) {
    if (typeof raw !== "string") return null;
    const text = raw.trim();
    if (!text) return null;
    try {
        const direct = JSON.parse(text);
        if (isJsonContainer(direct)) return direct;
    } catch (_) { /* fall through to fenced/balanced extraction */ }
    let best = null;
    for (const m of text.matchAll(/```json(?![A-Za-z0-9_-])([\s\S]*?)```/gi)) {
        const block = m[1].trim();
        if (!block) continue;
        try {
            const parsed = JSON.parse(block);
            if (isJsonContainer(parsed)) { best = parsed; continue; }
        } catch (_) { /* try balanced scan inside fence */ }
        const inner = scanBalancedJson(block);
        if (inner !== null) best = inner;
    }
    if (best !== null) return best;
    return scanBalancedJson(text);
}
export const lines = (text) => String(text).split(/\r?\n/);
export const tail = (text, n) => lines(String(text).replace(/\s+$/, "")).slice(-n).join("\n");

// Every external command has a time limit; a hung command is killed and reported, never waited on forever.
// The exit code decides success: error text is never treated as data (universal lesson 2).
export function run(cmd, args = [], { cwd, timeoutMs = 120000, env } = {}) {
    // Windows: a bare "npm" is npm.cmd, which spawn without a shell cannot find (core/lib/process.js).
    if (isWindows) [cmd, ...args] = launchTarget(cmd, args, env || process.env);
    const r = spawnSync(cmd, args, { cwd, timeout: timeoutMs, encoding: "utf8", env: env || process.env, windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
    const timedOut = !!(r.error && /ETIMEDOUT|timed? ?out/i.test(String(r.error.code || r.error.message))) || r.signal === "SIGTERM";
    const missing = !!(r.error && r.error.code === "ENOENT");
    const code = r.status === null || r.status === undefined ? (timedOut ? 124 : 127) : r.status;
    return { code, ok: code === 0, timedOut, missing, text: (r.stdout || "") + (r.stderr || ""), out: (r.stdout || "").trim() };
}
// git never waits for a person (LoopTroop server/git/runCommand.ts, MIT): no credential prompt, no pager,
// no ssh passphrase question. An unattended night run once sat on a pager that nobody would close.
export const GIT_ENV = Object.freeze({ GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "never", GIT_PAGER: "cat", PAGER: "cat", ...(process.env.GIT_SSH_COMMAND || process.env.GIT_SSH ? {} : { GIT_SSH_COMMAND: "ssh -o BatchMode=yes" }) });
export const gitEnv = () => ({ ...process.env, ...GIT_ENV });
export const git = (args, cwd, timeoutMs = 60000) => run("git", args, { cwd, timeoutMs, env: gitEnv() });

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
