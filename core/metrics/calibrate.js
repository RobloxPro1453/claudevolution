// Quota calibration (H70-H73): turns local transcript counts into the plan meter's percent.
//
// Why: the plan meter (5-hour and weekly %) is only readable inside Claude Code (get_usage) or from a
// platform note ([quota] in Antigravity). Between readings, and on platforms without one, the local estimate
// (blocks.js) used fixed token limits that know nothing about the plan: on a small plan it said 5% while the
// meter was at 100%, and an unattended loop ran into the wall (the failure this file exists for).
//
// How: every real reading is paired with the local weighted units of the same moment. units / percent * 100
// is one sample of "units per full window". The limit is the median of the last samples (one odd sample from
// another machine or from claude.ai does not move it). A transcript line saying the limit was reached is a
// sample at 100% (H71). ccusage `--token-limit max` (highest previous block as the limit, H70) is the floor
// when nothing else is known: never below the busiest window that did not hit the limit.
//
// The file is per machine and per account (one meter): <state home>/kota.json. Never in a project, never in git.
import path from "node:path";
import { nowIso, readJson, writeJson } from "../lib/util.js";
import { stateHome } from "../autonomy/share.js";
import { estimateQuota } from "./blocks.js";

export const file = () => path.join(stateHome(), "kota.json");
export const MAX_SAMPLES = 8;
export const MIN_FIVE = 5;      // a reading below this is mostly rounding noise
export const MIN_WEEK = 3;
const WINDOW_SKEW_MS = 30 * 60 * 1000; // local block end vs reported reset: farther apart = different windows

const r6 = (x) => Math.round(x * 1e6) / 1e6;
const median = (xs) => {
    const s = xs.filter((x) => Number.isFinite(x) && x > 0).sort((a, b) => a - b);
    if (!s.length) return null;
    const m = Math.floor(s.length / 2);
    return r6(s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2);
};

export function load() {
    const d = readJson(file(), null);
    return d && typeof d === "object" ? { samples: [], hitsSeen: [], ...d } : { samples: [], hitsSeen: [], lastReading: null };
}

// Pure: the limits the samples give. { fiveUnits, weekUnits, source, n } or null.
export function limitsFrom(data) {
    const s = (data && data.samples) || [];
    const fiveUnits = median(s.map((x) => x.fiveUnits));
    const weekUnits = median(s.map((x) => x.weekUnits));
    if (!fiveUnits && !weekUnits) return null;
    const kinds = new Set(s.map((x) => x.kind));
    return { fiveUnits, weekUnits, source: kinds.has("reading") ? "kalibre" : "limit-izi", n: s.length };
}
export const limits = () => limitsFrom(load());

// Pure: one sample from a reading and the local estimate taken at the same moment, or null when it would lie.
export function sampleFrom(reading, est, now = new Date()) {
    if (!reading || !est) return null;
    const out = { at: nowIso(now), kind: "reading", five: reading.five, week: reading.week };
    const sameWindow = !reading.fiveResetsAt || !est.fiveResetsAt ||
        Math.abs(new Date(reading.fiveResetsAt).getTime() - new Date(est.fiveResetsAt).getTime()) <= WINDOW_SKEW_MS;
    if (typeof reading.five === "number" && reading.five >= MIN_FIVE && est.fiveWeighted > 0 && sameWindow) {
        out.fiveUnits = r6(est.fiveWeighted * 100 / reading.five);
    }
    if (typeof reading.week === "number" && reading.week >= MIN_WEEK && est.weekWeighted > 0) {
        out.weekUnits = r6(est.weekWeighted * 100 / reading.week);
    }
    return out.fiveUnits || out.weekUnits ? out : null;
}

// Pure: samples from "limit reached" lines not seen before. The block holding the hit was full at that moment.
export function hitSamples(est, seen = [], now = new Date()) {
    const out = [];
    const known = new Set(seen);
    for (const t of (est && est.limitHits) || []) {
        if (known.has(t)) continue;
        const b = (est.blocks || []).find((x) => !x.isGap && t >= x.startTime && t <= x.endTime);
        if (b && b.tokens && b.tokens.weighted > 0) out.push({ at: nowIso(now), kind: "limit-hit", hitAt: new Date(t).toISOString(), five: 100, fiveUnits: r6(b.tokens.weighted) });
        known.add(t);
    }
    return { samples: out, seen: [...known].slice(-50) };
}

// Records a real reading (get_usage / [quota] / --five --week). Never throws: calibration must not break a gate.
export function observe(cfg, reading, now = new Date(), opts = {}) {
    try {
        const est = opts.est || estimateQuota(cfg.root, cfg, now.getTime(), opts.quotaOpts || {});
        const data = load();
        const s = sampleFrom(reading, est, now);
        const h = hitSamples(est, data.hitsSeen, now);
        data.samples = [...data.samples, ...h.samples, ...(s ? [s] : [])].slice(-MAX_SAMPLES);
        data.hitsSeen = h.seen;
        data.lastReading = {
            at: nowIso(now), five: reading.five, week: reading.week,
            fiveResetsAt: reading.fiveResetsAt || est.fiveResetsAt || null, weekResetsAt: reading.weekResetsAt || null,
            fiveWeighted: est.fiveWeighted || 0, weekWeighted: est.weekWeighted || 0
        };
        data.updatedAt = nowIso(now);
        writeJson(file(), data);
        return { sample: s, hits: h.samples.length, limits: limitsFrom(data) };
    } catch (_) { return null; }
}

// Pure: the best "percent used now". Order: a fresh reading plus what was burned since (exact in the same
// window), then calibrated local units, then the uncalibrated default (marked as such: low trust).
export function currentFrom(est, data, now = new Date(), maxReadingAgeMin = 60) {
    const lim = limitsFrom(data);
    const r = data && data.lastReading;
    const fresh = r && (now.getTime() - new Date(r.at).getTime()) / 60000 <= maxReadingAgeMin &&
        (!r.fiveResetsAt || new Date(r.fiveResetsAt).getTime() > now.getTime());
    const base = {
        fiveResetsAt: (est && est.fiveResetsAt) || (r && r.fiveResetsAt) || null,
        projectedPct: est && est.projectedPct, minutesLeft: est && est.minutesLeft, burnRate: est && est.burnRate
    };
    if (fresh && lim && lim.fiveUnits && est && est.available) {
        const five = Math.round((r.five + Math.max(0, est.fiveWeighted - r.fiveWeighted) * 100 / lim.fiveUnits) * 10) / 10;
        const week = lim.weekUnits ? Math.round((r.week + Math.max(0, est.weekWeighted - r.weekWeighted) * 100 / lim.weekUnits) * 10) / 10 : r.week;
        return { ...base, five: Math.min(100, five), week: Math.min(100, week), source: "okuma+yerel", trust: "yuksek", fiveResetsAt: r.fiveResetsAt || base.fiveResetsAt };
    }
    if (fresh && !(est && est.available)) return { ...base, five: r.five, week: r.week, source: "okuma", trust: "yuksek", fiveResetsAt: r.fiveResetsAt };
    if (est && est.available) {
        return { ...base, five: est.fivePct, week: est.weekPct, source: est.calibration === "default" ? "varsayilan" : est.calibration, trust: est.calibration === "default" ? "dusuk" : "orta" };
    }
    return { ...base, five: null, week: null, source: "yok", trust: "yok" };
}

// The floor of ccusage "max" (H70): when uncalibrated, the busiest finished window that did not hit the limit
// tells the limit is at least that big. Only used to say "this default looks too small", never to relax a gate.
export function maxBlockUnits(est) {
    let m = 0;
    for (const b of (est && est.blocks) || []) if (!b.isGap && !b.isActive && b.tokens && b.tokens.weighted > m) m = b.tokens.weighted;
    return r6(m);
}

export function current(cfg, now = new Date(), opts = {}) {
    const data = load();
    const lim = limitsFrom(data);
    const est = estimateQuota(cfg.root, cfg, now.getTime(), { ...(lim ? { calibrated: lim } : {}), ...(opts.quotaOpts || {}) });
    return { ...currentFrom(est, data, now), limits: lim, est };
}
