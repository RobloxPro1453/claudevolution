// Token use on all three platforms the package supports, read from the files each one keeps (no network):
//  - Codex: ${CODEX_HOME:-~/.codex}/{sessions,archived_sessions}/**/*.jsonl, event_msg/token_count lines;
//    last_token_usage is the turn's delta (else the difference of total_token_usage). Ported from ccusage
//    rust/adapters/codex (MIT). Zstandard-compressed rollouts (.jsonl.zst) are counted as skipped.
//  - Antigravity: ~/.gemini/{antigravity,antigravity-cli,antigravity-ide,antigravity-backup,antigravity-acp}/
//    conversations/*.db (SQLite; table gen_metadata, protobuf blobs: chat model = field 1, usage = field 4,
//    input 2, output 3, cache write 4, cache read 5, reasoning 9; time = field 9 -> 4 -> seconds). Ported from
//    ccusage rust/adapters/antigravity (MIT). Read with node:sqlite when the runtime has it; else skipped.
//    (The plan's ".../conversation_summaries.db" path was wrong: ERRATA E19.)
//  - Claude: core/metrics/blocks.js (already).
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { Buffer } from "node:buffer";
import { home } from "../lib/util.js";

const dayOf = (iso) => String(iso || "").slice(0, 10);
const empty = () => ({ input: 0, cached: 0, output: 0, reasoning: 0, calls: 0 });
const addTo = (acc, u) => { for (const k of ["input", "cached", "output", "reasoning"]) acc[k] += u[k] || 0; acc.calls++; };

function walk(dir, out = []) {
    let es = [];
    try { es = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return out; }
    for (const e of es) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p, out); else out.push(p); }
    return out;
}

// One Codex rollout: [{ day, input, cached, output, reasoning }].
export function codexEvents(text) {
    const out = [];
    let prev = null;
    for (const line of String(text).split(/\r?\n/)) {
        if (!line.includes('"token_count"')) continue;
        let j;
        try { j = JSON.parse(line); } catch (_) { continue; }
        const p = j.payload || {};
        if (j.type !== "event_msg" || p.type !== "token_count" || !p.info) continue;
        const total = p.info.total_token_usage, last = p.info.last_token_usage;
        let u = last;
        if (!u && total) u = prev ? Object.fromEntries(Object.keys(total).map((k) => [k, Math.max(0, (total[k] || 0) - (prev[k] || 0))])) : total;
        if (total) prev = total;
        if (!u) continue;
        out.push({ day: dayOf(j.timestamp), input: u.input_tokens || 0, cached: u.cached_input_tokens || 0, output: u.output_tokens || 0, reasoning: u.reasoning_output_tokens || 0 });
    }
    return out;
}

export function codexUsage({ homes = [process.env.CODEX_HOME || path.join(home(), ".codex")] } = {}) {
    const byDay = {}, seen = new Set();
    let files = 0, skipped = 0;
    for (const h of homes) for (const sub of ["sessions", "archived_sessions"]) {
        for (const f of walk(path.join(h, sub))) {
            if (f.endsWith(".jsonl.zst")) { skipped++; continue; }
            if (!f.endsWith(".jsonl")) continue;
            const rel = path.relative(path.join(h, sub), f);
            if (seen.has(rel)) continue; // sessions/ wins over archived_sessions/ for the same rollout
            seen.add(rel);
            files++;
            let text = "";
            try { text = fs.readFileSync(f, "utf8"); } catch (_) { continue; }
            for (const e of codexEvents(text)) addTo(byDay[e.day] || (byDay[e.day] = empty()), e);
        }
    }
    return { platform: "codex", files, skipped, byDay };
}

// --- minimal protobuf reader: fields of one message as [{ number, wire, value }] ---
export function decodeFields(buf) {
    const out = [];
    let i = 0;
    const varint = () => { let v = 0n, shift = 0n; for (;;) { if (i >= buf.length) throw new Error("cut varint"); const b = buf[i++]; v |= BigInt(b & 0x7f) << shift; if (!(b & 0x80)) return v; shift += 7n; } };
    while (i < buf.length) {
        const key = Number(varint()), number = key >> 3, wire = key & 7;
        if (wire === 0) out.push({ number, wire, value: Number(varint()) });
        else if (wire === 2) { const len = Number(varint()); out.push({ number, wire, value: buf.subarray(i, i + len) }); i += len; }
        else if (wire === 1) i += 8;
        else if (wire === 5) i += 4;
        else throw new Error(`wire type ${wire}`);
    }
    return out;
}
const fBytes = (fs_, n) => (fs_.find((f) => f.number === n && f.wire === 2) || {}).value;
const fVar = (fs_, n) => (fs_.find((f) => f.number === n && f.wire === 0) || {}).value || 0;

export function antigravityGeneration(blob) {
    const root = decodeFields(blob);
    const chat = fBytes(root, 1);
    if (!chat) return null;
    const cm = decodeFields(chat);
    const usageBlob = fBytes(cm, 4);
    if (!usageBlob) return null;
    const u = decodeFields(usageBlob);
    let day = null;
    const gen = fBytes(cm, 9);
    if (gen) { const ts = fBytes(decodeFields(gen), 4); if (ts) { const s = fVar(decodeFields(ts), 1); if (s > 0) day = new Date(s * 1000).toISOString().slice(0, 10); } }
    return { day, input: fVar(u, 2), output: fVar(u, 3), cacheWrite: fVar(u, 4), cached: fVar(u, 5), reasoning: fVar(u, 9) };
}

export async function antigravityUsage({ roots = ["antigravity", "antigravity-cli", "antigravity-ide", "antigravity-backup", "antigravity-acp"].map((r) => path.join(home(), ".gemini", r)), openDb = null } = {}) {
    const byDay = {};
    let files = 0, skipped = 0, why = null;
    let open = openDb;
    if (!open) {
        try { const { DatabaseSync } = await import("node:sqlite"); open = (f) => new DatabaseSync(f, { readOnly: true }); } catch (_) { why = "bu çalışma ortamında node:sqlite yok"; }
    }
    for (const r of roots) {
        for (const f of walk(path.join(r, "conversations")).filter((p) => p.endsWith(".db"))) {
            if (!open) { skipped++; continue; }
            let db;
            try {
                db = open(f);
                const rows = db.prepare("SELECT data FROM gen_metadata ORDER BY idx ASC").all();
                files++;
                // Newer versions keep no time per generation: the conversation's own time (trajectory blob, field 2
                // -> seconds) dates its rows instead (ccusage parse_trajectory_timestamp).
                let convDay = null;
                try {
                    const t = db.prepare("SELECT data FROM trajectory_metadata_blob ORDER BY rowid ASC LIMIT 1").get();
                    const ts = t && fBytes(decodeFields(Buffer.from(t.data)), 2);
                    const s = ts ? fVar(decodeFields(ts), 1) : 0;
                    if (s > 0) convDay = new Date(s * 1000).toISOString().slice(0, 10);
                } catch (_) { /* older layout */ }
                for (const row of rows) {
                    let g = null;
                    try { g = antigravityGeneration(Buffer.from(row.data)); } catch (_) { /* unreadable row */ }
                    const day = (g && (g.day || convDay)) || "?";
                    if (g) addTo(byDay[day] || (byDay[day] = empty()), g);
                }
            } catch (_) { skipped++; } finally { try { db && db.close(); } catch (_) { /* closed */ } }
        }
    }
    return { platform: "antigravity", files, skipped, why, byDay };
}

export const sumDays = (byDay, days) => days.reduce((acc, d) => { const x = byDay[d]; if (x) for (const k of Object.keys(acc)) acc[k] += x[k] || 0; return acc; }, empty());
export const lastDays = (n, now = new Date()) => Array.from({ length: n }, (_, i) => new Date(now.getTime() - i * 86400e3).toISOString().slice(0, 10));
