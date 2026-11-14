// Cycle lock: one autonomous cycle per project at a time (and, through share.js, one per machine).
// The lock file holds the session id and the time it was taken; a lock older than
// autonomy.lockStaleMinutes (90) is stale: its owner died (crash, limit, closed lid) and it may be taken over.
import fs from "node:fs";
import path from "node:path";
import { nowIso, readJson } from "../lib/util.js";

export function lockInfo(file, staleMinutes, now = new Date()) {
    const held = readJson(file, null);
    if (!held || !held.at) return { held: false };
    const ageMin = (now.getTime() - new Date(held.at).getTime()) / 60000;
    return { held: true, session: held.session, at: held.at, ageMin: Math.round(ageMin * 10) / 10, stale: !(ageMin < staleMinutes), note: held.note || "" };
}

// Returns { ok, takenOver, holder }. Creating with the "wx" flag makes two sessions starting together safe:
// only one create succeeds.
export function acquire(file, session, staleMinutes, now = new Date(), note = "") {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const body = JSON.stringify({ session, at: nowIso(now), note }) + "\n";
    try { fs.writeFileSync(file, body, { flag: "wx" }); return { ok: true, takenOver: false }; } catch (e) { if (e.code !== "EEXIST") throw e; }
    const info = lockInfo(file, staleMinutes, now);
    if (info.held && !info.stale && info.session !== session) return { ok: false, holder: info };
    fs.writeFileSync(file, body);
    return { ok: true, takenOver: info.held && info.session !== session, holder: info };
}

// Refresh the timestamp of a lock we hold (a long cycle must not look stale).
export function touch(file, session, now = new Date()) {
    const held = readJson(file, null);
    if (!held || held.session !== session) return false;
    fs.writeFileSync(file, JSON.stringify({ ...held, at: nowIso(now) }) + "\n");
    return true;
}

// Release only our own lock, unless forced (owner said "dur", or recovery removes a stale one).
export function release(file, session, force = false) {
    const held = readJson(file, null);
    if (!held) return { ok: true, was: null };
    if (!force && session && held.session !== session) return { ok: false, was: held.session };
    try { fs.unlinkSync(file); } catch (_) { /* already gone */ }
    return { ok: true, was: held.session };
}
