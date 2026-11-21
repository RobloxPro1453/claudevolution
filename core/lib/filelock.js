// A lock across processes for one read-modify-write of a shared file (the lanes' blackboard, lane records).
// An atomic rename protects a file from being cut, not two processes from each reading the old version and
// the second write undoing the first (craft-anything pitfall "Atomic replacements still lost concurrent
// investigation updates"; OMK durable-file-lock-*.ts, MIT). The lock is a directory next to the file
// (mkdir is atomic everywhere) with an owner record { pid, host, token }; a lock whose owner process is gone
// on this host is stale and taken over; waiting is bounded, never forever; release checks the token.
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { pidAlive, sleepSync } from "./util.js";

export class LockBusyError extends Error { constructor(file) { super(`another process holds the lock on ${path.basename(file)}`); this.name = "LockBusyError"; } }

const lockDir = (file) => `${file}.lock`;
function readOwner(dir) { try { return JSON.parse(fs.readFileSync(path.join(dir, "owner.json"), "utf8")); } catch (_) { return null; } }

export function acquire(file, { timeoutMs = 15000, alive = pidAlive } = {}) {
    const dir = lockDir(file), token = crypto.randomBytes(8).toString("hex");
    fs.mkdirSync(path.dirname(dir), { recursive: true });
    const start = Date.now();
    let wait = 5, checkedStale = 0;
    for (;;) {
        try {
            fs.mkdirSync(dir);
            fs.writeFileSync(path.join(dir, "owner.json"), JSON.stringify({ pid: process.pid, host: os.hostname(), token, at: new Date().toISOString() }));
            return { file, dir, token };
        } catch (e) {
            if (e.code !== "EEXIST") throw e;
        }
        // Held: is its owner gone? (checked now and then: pidAlive is a process listing on Windows)
        if (Date.now() - checkedStale > 500) {
            checkedStale = Date.now();
            const owner = readOwner(dir);
            const orphan = owner ? owner.host === os.hostname() && !alive(owner.pid) : (() => { try { return Date.now() - fs.statSync(dir).mtimeMs > 5000; } catch (_) { return true; } })();
            if (orphan) { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) { /* someone else took it */ } continue; }
        }
        if (Date.now() - start > timeoutMs) throw new LockBusyError(file);
        sleepSync(wait);
        wait = Math.min(100, wait * 2);
    }
}

export function release(lock) {
    if (!lock) return;
    const owner = readOwner(lock.dir);
    if (owner && owner.token !== lock.token) return; // taken over (we were thought dead): not ours to remove
    try { fs.rmSync(lock.dir, { recursive: true, force: true }); } catch (_) { /* gone */ }
}

// Runs fn while holding the lock on `file` (fn reads and writes the file itself).
export function withFileLock(file, fn, opts = {}) {
    const lock = acquire(file, opts);
    try { return fn(); } finally { release(lock); }
}
