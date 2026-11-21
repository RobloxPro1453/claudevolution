// The lasting memory: .evrim/knowledge.jsonl, one fact per line, next to (never instead of) DERSLER.md.
// Schema after metaswarm knowledge/*.jsonl (MIT): { id, type, fact, recommendation, confidence, provenance[],
// tags[], affectedFiles[], createdAt, updatedAt, usageCount, helpfulCount, outdated }. Ideas from zeroshot
// active_memory (MIT): an entry tied to files goes stale when those files are gone (source_guard.rs), and
// retrieval takes the strongest single match, not a count of repeated words (retrieval.rs: exact file 1000,
// folder 800, identifier 700, word 100). Ids are the SHA-256 of the canonical { type, fact } (craft-anything
// evidence canonical ids, H13): the same fact never becomes two entries, on any machine.
import crypto from "node:crypto";
import path from "node:path";
import { appendText, exists, lines, readText, writeText } from "../lib/util.js";

export const TYPES = ["lesson", "gotcha", "decision", "pattern", "rejected-hypothesis", "kept-hypothesis"];
export const file = (root) => path.join(root, ".evrim", "knowledge.jsonl");
const canonical = (v) => (Array.isArray(v) ? `[${v.map(canonical).join(",")}]` : v && typeof v === "object" ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(",")}}` : JSON.stringify(v));
const normFact = (t) => String(t || "").replace(/^\s*-\s+/, "").replace(/\s+/g, " ").trim();
export const idOf = (type, fact) => "k-" + crypto.createHash("sha256").update(canonical({ type, fact: normFact(fact).toLowerCase() })).digest("hex").slice(0, 16);

const WORD = /[\p{L}\p{N}_]{3,}/gu;
export const words = (t) => new Set((String(t).toLocaleLowerCase("tr").match(WORD) || []));
export function jaccard(a, b) {
    const A = words(a), B = words(b);
    if (!A.size || !B.size) return 0;
    let inter = 0;
    for (const w of A) if (B.has(w)) inter++;
    return inter / (A.size + B.size - inter);
}
// Paths a fact names ("core/delegate/agent.js:464", "src/ui.rs").
export const pathsIn = (t) => [...new Set((String(t).match(/(?:[\w.-]+\/)+[\w.-]+\.\w{1,6}|\b[\w-]+\.(?:rs|js|ts|py|go|json|toml|md|ps1|cs)\b/g) || []).map((p) => p.replace(/:\d+$/, "")))];

export function load(root) {
    const out = [];
    for (const l of lines(readText(file(root), ""))) { if (!l.trim()) continue; try { out.push(JSON.parse(l)); } catch (_) { /* a broken line is skipped, never rewritten away */ } }
    return out;
}
const serialize = (entries) => entries.map((e) => JSON.stringify(e)).join("\n") + (entries.length ? "\n" : "");

export function makeEntry({ type = "lesson", fact, recommendation = "", confidence = "observed", provenance = [], tags = [], affectedFiles = null, now = new Date() }) {
    const f = normFact(fact);
    return { id: idOf(type, f), type, fact: f, recommendation, confidence, provenance, tags, affectedFiles: affectedFiles || pathsIn(f), createdAt: now.toISOString(), updatedAt: now.toISOString(), usageCount: 0, helpfulCount: 0, outdated: false };
}

// Adds entries; an existing id or a near twin (same type, Jaccard >= 0.8) is merged (provenance joined,
// usage counted) instead of written twice. Returns { entries, added, merged }.
export function merge(existing, incoming, { threshold = 0.8, now = new Date() } = {}) {
    const entries = existing.map((e) => ({ ...e }));
    let added = 0, merged = 0;
    for (const n of incoming) {
        const twin = entries.find((e) => e.id === n.id) || entries.find((e) => e.type === n.type && jaccard(e.fact, n.fact) >= threshold);
        if (twin) {
            // Touched only when something is new: merging the same lines again changes no byte (idempotent update).
            const seen = new Set(twin.provenance.map((p) => JSON.stringify(p)));
            const fresh = n.provenance.filter((p) => !seen.has(JSON.stringify(p))), tags = n.tags.filter((t) => !twin.tags.includes(t));
            if (fresh.length || tags.length) { twin.provenance.push(...fresh); twin.tags.push(...tags); twin.updatedAt = now.toISOString(); }
            merged++;
        } else { entries.push(n); added++; }
    }
    return { entries, added, merged };
}

export function add(root, incoming, opts = {}) {
    const r = merge(load(root), [].concat(incoming), opts);
    writeText(file(root), serialize(r.entries));
    return r;
}

// DERSLER.md / HATALAR.md bullet lines as entries (the files are read, never changed).
export function fromMemoryFiles(root, autonomyDir = ".evrim/otonom", now = new Date()) {
    const out = [];
    for (const [name, type] of [["DERSLER.md", "lesson"], ["HATALAR.md", "gotcha"]]) {
        const rel = path.posix.join(autonomyDir.replace(/\\/g, "/"), name);
        const text = readText(path.join(root, rel), "").replace(/<!--[\s\S]*?-->/g, (m) => m.replace(/[^\n]/g, " "));
        lines(text).forEach((l, i) => {
            if (!/^\s*-\s+\S/.test(l)) return;
            out.push(makeEntry({ type, fact: l, confidence: "reported", provenance: [{ source: rel, ref: `line ${i + 1}` }], tags: [name === "HATALAR.md" ? "hata" : "ders"], now }));
        });
    }
    return out;
}

// The knowledge file as the update would write it: existing entries kept, the memory files' lines added.
export function migratedText(root, autonomyDir, now = new Date()) {
    const r = merge(load(root), fromMemoryFiles(root, autonomyDir, now), { now });
    return serialize(r.entries);
}

// An entry tied to files is outdated when none of them exists any more (zeroshot source guard idea).
export function isOutdated(root, e) {
    if (e.outdated) return true;
    const files = (e.affectedFiles || []).filter((p) => p.includes("/"));
    return files.length > 0 && files.every((p) => !exists(path.join(root, p)));
}

// The entries that best match a query, strongest single match first; outdated ones never.
export function retrieve(root, { files = [], text = "", limit = 8 } = {}) {
    const fileSet = new Set(files.map((f) => String(f).replace(/\\/g, "/")));
    const folders = new Set([...fileSet].map((f) => f.split("/").slice(0, -1).join("/")).filter(Boolean));
    const q = words(text);
    const scored = [];
    for (const e of load(root)) {
        if (isOutdated(root, e)) continue;
        let s = 0;
        for (const p of e.affectedFiles || []) {
            if (fileSet.has(p) || [...fileSet].some((f) => f.endsWith("/" + p))) s = Math.max(s, 1000);
            else if (folders.has(p.split("/").slice(0, -1).join("/"))) s = Math.max(s, 800);
        }
        const ew = words(e.fact);
        let hits = 0;
        for (const w of q) if (ew.has(w)) { hits++; if (/[_.]|[a-z][A-Z]/.test(w) || w.length >= 8) s = Math.max(s, 700); }
        if (hits >= 2) s = Math.max(s, 500); else if (hits === 1) s = Math.max(s, 100);
        if (s > 0) scored.push({ entry: e, score: s + (e.type === "rejected-hypothesis" || e.type === "gotcha" ? 50 : 0) + Math.min(40, e.helpfulCount * 10) });
    }
    return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function note(root, entry) { return add(root, [makeEntry(entry)]); }
export function appendRaw(root, entry) { appendText(file(root), JSON.stringify(entry) + "\n"); }
