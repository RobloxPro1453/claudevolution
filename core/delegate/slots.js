// Machine-wide slots for heavy commands (build, test). Many lanes on one machine must not all build or
// test at once: a slot is a file <state home>/slots/<kind>-<n>.lock created atomically ("wx"), holding
// the owner's pid and start time. A lane waits (outside its step and money budget) until a slot is free.
// A slot is stale when its pid is gone or it is older than its time limit; stale slots are removed.
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pidAlive, readJson } from "../lib/util.js";
import { stateHome } from "../autonomy/share.js";

export const DEFAULT_SLOTS = { test: 2, build: 2 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const slotsDir = () => path.join(stateHome(), "slots");
export const slotCount = (cfg, kind) => Math.max(1, Math.floor(Number(((cfg.delegate || {}).slots || {})[kind] ?? DEFAULT_SLOTS[kind] ?? 1)));

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

// Remove stale slots of this kind; returns how many were removed.
export function clearStale(kind, maxMinutes, dir = slotsDir(), { alive = pidAlive, now = Date.now() } = {}) {
    let removed = 0, files = [];
    try { files = fs.readdirSync(dir).filter((f) => f.startsWith(kind + "-") && f.endsWith(".lock")); } catch (_) { return 0; }
    for (const f of files) {
        const file = path.join(dir, f), s = readJson(file, null);
        // An unreadable slot is a half-written one: give it a moment through its file time.
        let at = s && s.at; if (!at) { try { at = fs.statSync(file).mtimeMs; } catch (_) { continue; } }
        const old = now - at > maxMinutes * 60000;
        if (old || (s && s.pid && !alive(s.pid))) { try { fs.unlinkSync(file); removed++; } catch (_) { /* someone else removed it */ } }
    }
    return removed;
}

// Wait for a slot, run fn, always give the slot back. Returns fn's result; waitedMs is reported through log.
export async function withSlot(kind, max, maxMinutes, fn, opts = {}) {
    const dir = opts.dir || slotsDir(), wait = opts.sleep || sleep, every = opts.pollMs ?? 5000, staleEvery = opts.staleMs ?? 30000;
    const me = { pid: process.pid, token: Math.random().toString(36).slice(2) };
    const start = Date.now();
    let file = null, lastStale = 0, said = false;
    while (!(file = tryTake(kind, max, dir, me))) {
        if (Date.now() - lastStale >= staleEvery) { lastStale = Date.now(); if (clearStale(kind, maxMinutes, dir, opts)) continue; }
        if (!said && opts.log) { opts.log(`  waiting for a free ${kind} slot (${max} on this machine)`); said = true; }
        await wait(every);
    }
    const waited = Date.now() - start;
    if (said && opts.log) opts.log(`  got ${kind} slot after ${Math.round(waited / 1000)} s`);
    try { return await fn(waited); }
    finally {
        // Give back only our own slot (a stale-cleaner may have removed it and someone else taken the name).
        const s = readJson(file, null);
        if (s && s.token === me.token) { try { fs.unlinkSync(file); } catch (_) { /* gone */ } }
    }
}
