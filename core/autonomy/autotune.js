// Hypothesis-driven self-tuning, layer 1 (owner decision #14: keep what works, learn from what doesn't; no
// blind trial and error). From the cheap model's run records (delegate state) it reads signals; a rule whose
// signal is clearly off proposes ONE bounded change to ONE whitelisted setting, with the reason and the
// expected effect. The change is a trial: after K new runs the same signal is measured again. Better: kept
// (and noted). Not better: the setting goes back and the failed hypothesis becomes a lasting lesson with its
// cause (.evrim/knowledge.jsonl, type rejected-hypothesis), so it is not tried again blindly.
// Roles of the zeroshot auto_research templates (explorer, researcher, challenger, synthesizer; MIT) map to:
// signals (explore), rule (research), the guard that refuses thin evidence (challenger), the record (synthesis).
// Never touched: safety lists, quota gates (K6 cap), paths, commands, keys, anything outside SETTINGS.
import fs from "node:fs";
import path from "node:path";
import { readJson, writeJson } from "../lib/util.js";
import { CONFIG_REL } from "../lib/config.js";
import * as knowledge from "./knowledge.js";

export const MIN_RUNS = 6;  // the challenger: fewer runs than this is not evidence
export const K = 6;         // runs to wait before judging a trial
export const SETTINGS = {
    "delegate.defaultSteps": { min: 80, max: 400 },
    "delegate.contextBudget": { min: 24000, max: 128000 },
    "delegate.lanes": { min: 1, max: 6 }
};
const hypFile = (root) => path.join(root, ".evrim", "hypotheses.json");

// Run records of the cheap model, oldest first: { at, steps, stopReason, status, kind, tokens }.
export function runs(cfg) {
    const dir = path.join(cfg.root, cfg.delegate.stateDir);
    let files = [];
    try { files = fs.readdirSync(dir).filter((f) => /\.json$/.test(f) && !/^(api-handoff|train)\.json$/.test(f)); } catch (_) { return []; }
    const out = [];
    for (const f of files) for (const r of (readJson(path.join(dir, f), {}) || {}).runs || []) out.push({ ...r, task: f.replace(/\.json$/, "") });
    return out.sort((a, b) => String(a.at).localeCompare(String(b.at)));
}

export function signals(list) {
    const n = list.length;
    if (!n) return { runs: 0 };
    const share = (p) => Math.round((list.filter(p).length / n) * 100) / 100;
    const hit = list.reduce((s, r) => s + ((r.tokens && r.tokens.hit) || 0), 0), miss = list.reduce((s, r) => s + ((r.tokens && r.tokens.miss) || 0), 0);
    const firsts = list.filter((r) => r.kind === "first");
    return {
        runs: n,
        stepCap: share((r) => r.stopReason === "steps"),
        firstTryDone: firsts.length ? Math.round((firsts.filter((r) => r.status === "done").length / firsts.length) * 100) / 100 : null,
        cacheHit: hit + miss ? Math.round((hit / (hit + miss)) * 100) / 100 : null,
        avgSteps: Math.round(list.reduce((s, r) => s + (r.steps || 0), 0) / n)
    };
}

const get = (o, key) => key.split(".").reduce((v, k) => (v == null ? v : v[k]), o);
function set(o, key, value) { const ks = key.split("."); let t = o; for (const k of ks.slice(0, -1)) t = t[k] = t[k] || {}; t[ks[ks.length - 1]] = value; }
const clamp = (key, v) => Math.max(SETTINGS[key].min, Math.min(SETTINGS[key].max, Math.round(v)));

// The rules: signal off -> one bounded change and what should improve. Each returns null when it does not apply.
export const RULES = [
    (s, cfg) => s.stepCap >= 0.3 && (s.firstTryDone ?? 1) < 0.6 && {
        key: "delegate.defaultSteps", to: clamp("delegate.defaultSteps", (get(cfg, "delegate.defaultSteps") || 200) * 1.25),
        why: `koşuların %${Math.round(s.stepCap * 100)}'i adım sınırında durdu, ilk denemede biten %${Math.round((s.firstTryDone ?? 0) * 100)}`,
        expect: { metric: "stepCap", direction: "down" }
    },
    (s, cfg) => s.cacheHit !== null && s.cacheHit < 0.5 && s.avgSteps >= 20 && {
        key: "delegate.contextBudget", to: clamp("delegate.contextBudget", (get(cfg, "delegate.contextBudget") || 64000) * 1.25),
        why: `önbellek isabeti %${Math.round(s.cacheHit * 100)}: uzun koşularda sıkıştırma dönemi sık geliyor olabilir`,
        expect: { metric: "cacheHit", direction: "up" }
    }
];

export const loadHyp = (root) => readJson(hypFile(root), { trials: [] });

// What would be tried now (no write). The challenger refuses with too few runs or a trial still open.
export function propose(cfg, list = runs(cfg)) {
    const h = loadHyp(cfg.root);
    if (h.trials.some((t) => t.status === "trial")) return { proposal: null, why: "açık bir deneme var: önce o ölçülür (cv tune --evaluate)" };
    if (list.length < MIN_RUNS) return { proposal: null, why: `kanıt az: ${list.length} koşu (en az ${MIN_RUNS})` };
    const s = signals(list.slice(-20));
    const tried = new Set(h.trials.filter((t) => t.status === "rejected").map((t) => `${t.key}->${t.to}`));
    for (const rule of RULES) {
        const p = rule(s, cfg);
        if (!p || p.to === get(cfg, p.key) || tried.has(`${p.key}->${p.to}`)) continue;
        return { proposal: { ...p, from: get(cfg, p.key) ?? null, baseline: s }, why: p.why };
    }
    return { proposal: null, why: "sinyaller makul aralıkta: değişiklik önerilmiyor", signals: s };
}

// Applies a proposal to .evrim/config.json (the owner's file, only the whitelisted key) and opens a trial.
export function apply(cfg, p, now = new Date()) {
    if (!SETTINGS[p.key]) throw new Error(`öz-ayar bu ayara dokunamaz: ${p.key}`);
    const cfgFile = path.join(cfg.root, CONFIG_REL), own = readJson(cfgFile, null);
    if (!own) throw new Error("config okunamadı; öz-ayar yazmaz");
    set(own, p.key, p.to);
    writeJson(cfgFile, own);
    const h = loadHyp(cfg.root);
    h.trials.push({ id: `H-${now.toISOString().replace(/\D/g, "").slice(0, 12)}`, key: p.key, from: p.from, to: p.to, why: p.why, expect: p.expect, baseline: p.baseline, runsAtStart: runs(cfg).length, at: now.toISOString(), status: "trial" });
    writeJson(hypFile(cfg.root), h);
    return h.trials[h.trials.length - 1];
}

// Judges the open trial after K runs: kept, or reverted + lesson.
export function evaluate(cfg, list = runs(cfg), now = new Date()) {
    const h = loadHyp(cfg.root);
    const t = h.trials.find((x) => x.status === "trial");
    if (!t) return { result: null, why: "açık deneme yok" };
    const since = list.slice(t.runsAtStart);
    if (since.length < K) return { result: null, why: `denemeden beri ${since.length} koşu (ölçmek için ${K})` };
    const after = signals(since), before = t.baseline[t.expect.metric], now_ = after[t.expect.metric];
    const better = before == null || now_ == null ? false : t.expect.direction === "down" ? now_ < before : now_ > before;
    t.after = after; t.judgedAt = now.toISOString();
    if (better) {
        t.status = "kept";
        knowledge.note(cfg.root, { type: "kept-hypothesis", fact: `${t.key} ${t.from} -> ${t.to} işe yaradı: ${t.expect.metric} ${before} -> ${now_} (${t.why})`, provenance: [{ source: ".evrim/hypotheses.json", ref: t.id }], tags: ["öz-ayar"], now });
    } else {
        t.status = "rejected";
        const cfgFile = path.join(cfg.root, CONFIG_REL), own = readJson(cfgFile, null);
        if (own && get(own, t.key) === t.to) { set(own, t.key, t.from); writeJson(cfgFile, own); }
        knowledge.note(cfg.root, { type: "rejected-hypothesis", fact: `${t.key} ${t.from} -> ${t.to} işe yaramadı: ${t.expect.metric} ${before} -> ${now_}; varsayılan sebep (${t.why}) doğru değildi, kök neden başka yerde`, recommendation: "aynı değişikliği yeniden deneme; sinyali başka ayar ya da tarif düzeyinde ara", provenance: [{ source: ".evrim/hypotheses.json", ref: t.id }], tags: ["öz-ayar"], now });
    }
    writeJson(hypFile(cfg.root), h);
    return { result: t.status, trial: t };
}
