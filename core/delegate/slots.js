// Machine-wide slots for heavy commands (build, test). Many lanes on one machine must not all build or
// test at once: a slot is a file <state home>/slots/<kind>-<n>.lock created atomically ("wx"), holding
// the owner's pid and start time. Waiters join a FIFO priority ticket queue (1..9, default 5) with
// optional expiration (expiresMs), and checkReservoir enforces windowed rate limits.
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pidAlive, readJson, writeJson } from "../lib/util.js";
import { stateHome } from "../autonomy/share.js";

export const DEFAULT_SLOTS = { test: 2, build: 2 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ticketSeq = 0;

export const slotsDir = () => path.join(stateHome(), "slots");
export const slotCount = (cfg, kind) => Math.max(1, Math.floor(Number(((cfg.delegate || {}).slots || {})[kind] ?? DEFAULT_SLOTS[kind] ?? 1)));

function normalizePriority(priority) {
    const n = Math.floor(Number(priority));
    if (!Number.isFinite(n)) return 5;
    return Math.min(9, Math.max(1, n));
}

function listFiles(dir, prefix, suffix) {
    try { return fs.readdirSync(dir).filter((f) => f.startsWith(prefix) && f.endsWith(suffix)); }
    catch (_) { return []; }
}

function readTickets(kind, dir) {
    const prefix = `q-${kind}-`;
    const out = [];
    for (const name of listFiles(dir, prefix, ".ticket")) {
        const file = path.join(dir, name);
        const s = readJson(file, null);
        // Fallback metadata parsed from filename: q-<kind>-<pri>-<at>-<seq>-<token>.ticket
        const tailParts = name.slice(prefix.length, -7).split("-");
        const priority = normalizePriority(s ? s.priority : tailParts[0]);
        const at = Number(s ? s.at : tailParts[1]) || 0;
        const seq = Number(s ? s.seq : tailParts[2]) || 0;
        out.push({ name, file, priority, at, seq, pid: s && s.pid, token: s ? s.token : tailParts.slice(3).join("-"), expiresAt: s ? s.expiresAt : null });
    }
    out.sort((a, b) => a.priority - b.priority || a.at - b.at || a.seq - b.seq || a.name.localeCompare(b.name));
    return out;
}

// Try once to take a free slot; returns the lock file path or null.
export function tryTake(kind, max, dir = slotsDir(), me = { pid: process.pid }) {
    fs.mkdirSync(dir, { recursive: true });
    for (let i = 1; i <= max; i++) {
        const file = path.join(dir, `${kind}-${i}.lock`);
        try { fs.writeFileSync(file, JSON.stringify({ pid: me.pid, at: Date.now(), token: me.token }), { flag: "wx" }); return file; }
        catch (e) { if (e.code !== "EEXIST") throw e; }
    }
    return null;
}

// Remove stale locks (and expired/dead queue tickets) of this kind; returns how many locks were removed.
export function clearStale(kind, maxMinutes, dir = slotsDir(), { alive = pidAlive, now = Date.now() } = {}) {
    let removed = 0;
    for (const f of listFiles(dir, kind + "-", ".lock")) {
        const file = path.join(dir, f), s = readJson(file, null);
        // An unreadable slot is a half-written one: give it a moment through its file time.
        let at = s && s.at; if (!at) { try { at = fs.statSync(file).mtimeMs; } catch (_) { continue; } }
        const old = now - at > maxMinutes * 60000;
        if (old || (s && s.pid && !alive(s.pid))) { try { fs.unlinkSync(file); removed++; } catch (_) { /* someone else removed it */ } }
    }
    for (const t of readTickets(kind, dir)) {
        const expired = t.expiresAt && now > t.expiresAt;
        const old = t.at && now - t.at > Math.max(maxMinutes, 60) * 60000;
        const dead = t.pid && (t.pid !== process.pid || alive !== pidAlive) && !alive(t.pid);
        if (expired || old || dead) { try { fs.unlinkSync(t.file); } catch (_) { /* gone */ } }
    }
    return removed;
}

// Join the priority FIFO queue (1=highest..9=lowest, default 5) and acquire a slot lock.
export async function acquire(kind, max, maxMinutes = 15, opts = {}) {
    const limit = Math.floor(Number(max));
    if (!Number.isFinite(limit) || limit < 1) throw new Error(`slot max must be >= 1 (got ${max})`);
    const dir = opts.dir || slotsDir(), wait = opts.sleep || sleep, every = opts.pollMs ?? 5000, staleEvery = opts.staleMs ?? 30000;
    const priority = normalizePriority(opts.priority);
    const expiresMs = opts.expiresMs ?? opts.expiration ?? null;
    const seq = ++ticketSeq;
    const me = { pid: process.pid, token: opts.token || (Math.random().toString(36).slice(2) + seq.toString(36)) };
    fs.mkdirSync(dir, { recursive: true });
    const start = Date.now();
    const expiresAt = expiresMs && Number(expiresMs) > 0 ? start + Number(expiresMs) : null;
    const ticketFile = path.join(dir, `q-${kind}-${priority}-${String(start).padStart(15, "0")}-${String(seq).padStart(6, "0")}-${me.token}.ticket`);
    fs.writeFileSync(ticketFile, JSON.stringify({ kind, priority, at: start, seq, pid: me.pid, token: me.token, expiresAt }));

    let file = null, lastStale = 0, said = false;
    try {
        for (;;) {
            const now = Date.now();
            if (expiresAt !== null && now > expiresAt) throw new Error(`slot ${kind} expired after ${expiresMs}ms`);
            if (now - lastStale >= staleEvery) {
                lastStale = now;
                if (clearStale(kind, maxMinutes, dir, opts)) continue;
            }
            const alive = opts.alive || pidAlive;
            const tickets = [];
            for (const t of readTickets(kind, dir)) {
                if (t.token !== me.token && ((t.expiresAt && now > t.expiresAt) || (opts.alive && t.pid && !alive(t.pid)))) {
                    try { fs.unlinkSync(t.file); } catch (_) { /* gone */ }
                    continue;
                }
                tickets.push(t);
            }
            const active = listFiles(dir, kind + "-", ".lock").length;
            const free = Math.max(0, max - active);
            const myIndex = tickets.findIndex((t) => t.token === me.token);
            if (free > 0 && (myIndex === -1 || myIndex < free)) {
                file = tryTake(kind, max, dir, me);
                if (file) break;
            }
            if (!said && opts.log) { opts.log(`  waiting for a free ${kind} slot (${max} on this machine)`); said = true; }
            const rem = expiresAt !== null ? expiresAt - Date.now() : every;
            if (expiresAt !== null && rem <= 0) throw new Error(`slot ${kind} expired after ${expiresMs}ms`);
            await wait(expiresAt !== null ? Math.min(every, rem) : every);
        }
    } finally {
        try { fs.unlinkSync(ticketFile); } catch (_) { /* already removed */ }
    }
    const waitedMs = Date.now() - start;
    if (said && opts.log) opts.log(`  got ${kind} slot after ${Math.round(waitedMs / 1000)} s`);
    return { file, kind, token: me.token, priority, waitedMs };
}

// Release a slot acquired via acquire() (or by lock file path).
export function release(lockOrHandle) {
    if (!lockOrHandle) return false;
    if (typeof lockOrHandle === "string") {
        try { fs.unlinkSync(lockOrHandle); return true; } catch (_) { return false; }
    }
    const { file, token } = lockOrHandle;
    if (!file) return false;
    const s = readJson(file, null);
    if (!token || (s && s.token === token)) {
        try { fs.unlinkSync(file); return true; } catch (_) { return false; }
    }
    return false;
}

// Wait for a slot, run fn, always give the slot back. Returns fn's result; waitedMs is reported through log.
export async function withSlot(kind, max, maxMinutes, fn, opts = {}) {
    const handle = await acquire(kind, max, maxMinutes, opts);
    try { return await fn(handle.waitedMs); }
    finally { release(handle); }
}

// Inspect active locks and queued tickets for a slot kind (or all kinds when kind is null).
export function status(kind = null, max = null, dir = slotsDir()) {
    const active = [], queued = [];
    let files = [];
    try { files = fs.readdirSync(dir); } catch (_) { return { kind, max, active, queued, free: max }; }
    for (const f of files.sort()) {
        if (f.endsWith(".lock") && (!kind || f.startsWith(kind + "-"))) {
            const s = readJson(path.join(dir, f), {});
            active.push({ file: f, ...s });
        } else if (f.endsWith(".ticket") && (kind ? f.startsWith(`q-${kind}-`) : f.startsWith("q-"))) {
            const s = readJson(path.join(dir, f), {});
            queued.push({ file: f, ...s });
        }
    }
    queued.sort((a, b) => (a.priority ?? 5) - (b.priority ?? 5) || (a.at ?? 0) - (b.at ?? 0));
    return { kind, max, active, queued, free: max != null ? Math.max(0, max - active.length) : null };
}

// Bottleneck-style sliding-window reservoir rate limit persisted under <root>/.evrim/slots/.
export function checkReservoir(root, kind, limitPerMin, windowMs = 60000, opts = {}) {
    const limit = Number(limitPerMin);
    const win = Math.max(1, Number(windowMs) || 60000);
    if (!Number.isFinite(limit) || limit <= 0) {
        return { allowed: true, remaining: Infinity, used: 0, limit: limitPerMin, windowMs: win, resetAt: null, retryAfterMs: 0 };
    }
    const safeKind = String(kind || "default").replace(/[^A-Za-z0-9_.-]/g, "_");
    const baseDir = root ? path.join(root, ".evrim", "slots") : slotsDir();
    const file = path.join(baseDir, `reservoir-${safeKind}.json`);
    const now = typeof opts.now === "number" ? opts.now : Date.now();
    const data = readJson(file, { timestamps: [] });
    const raw = Array.isArray(data && data.timestamps) ? data.timestamps : [];
    const active = raw.filter((t) => typeof t === "number" && t > now - win).sort((a, b) => a - b);

    if (active.length >= limit) {
        if (active.length !== raw.length) writeJson(file, { timestamps: active });
        const oldest = active[0];
        const retryAfterMs = Math.max(1, oldest + win - now);
        return { allowed: false, remaining: 0, used: active.length, limit, windowMs: win, resetAt: new Date(oldest + win).toISOString(), retryAfterMs };
    }
    if (opts.consume !== false) {
        active.push(now);
        writeJson(file, { timestamps: active });
    } else if (active.length !== raw.length) {
        writeJson(file, { timestamps: active });
    }
    return {
        allowed: true,
        remaining: Math.max(0, limit - active.length),
        used: active.length,
        limit,
        windowMs: win,
        resetAt: active.length ? new Date(active[0] + win).toISOString() : null,
        retryAfterMs: 0
    };
}
