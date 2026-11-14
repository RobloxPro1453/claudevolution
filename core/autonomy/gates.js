// Limit gates. Pure functions: usage percentages in, a decision out.
//
//   5-hour window:  >= fiveHourNoNewStep (85)  -> KUCUK (finish the small thing in hand, start nothing new)
//                   >= fiveHourExit (90)       -> CIK   (stop now, sleep until the window resets)
//   weekly:         ceiling = weeklyBase + weeklySlope * f   (60 + 30·f; f = fraction of the week elapsed)
//                   usage >= ceiling           -> CIK   (the ceiling rises with time and reopens by itself)
//                   usage >= ceiling - margin  -> KUCUK
//
// Why so strict (universal lesson 8): at 100% the turn dies with an error, no wake-up can be scheduled,
// and the loop stays dead until the owner returns.

import { estimateQuota } from "../metrics/blocks.js";

const DEFAULT_AUTONOMY = {
    gates: {
        fiveHourNoNewStep: 85,
        fiveHourExit: 90,
        weeklyBase: 60,
        weeklySlope: 30,
        weeklyMargin: 5,
        paceWakeFloor: 15,
        paceWakeCeil: 180,
        paceWindowHours: 5
    },
    weeklyReset: { weekdayUtc: 6, hourUtc: 3 }
};

const WEEK_MS = 7 * 24 * 3600 * 1000;
const clamp01 = (x) => Math.max(0, Math.min(1, x));

// Fraction of the quota week that has passed. Prefer the reset time the usage tool reported;
// fall back to the configured weekly reset (weekday + hour, UTC).
export function weekFraction(now, weeklyReset, weekResetsAt) {
    if (weekResetsAt) {
        const t = new Date(weekResetsAt).getTime();
        if (Number.isFinite(t)) return clamp01(1 - (t - now.getTime()) / WEEK_MS);
    }
    const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), weeklyReset.hourUtc));
    let back = (now.getUTCDay() - weeklyReset.weekdayUtc + 7) % 7;
    if (back === 0 && now.getTime() < last.getTime()) back = 7;
    last.setUTCDate(last.getUTCDate() - back);
    return clamp01((now.getTime() - last.getTime()) / WEEK_MS);
}

// The start of the current quota week, rounded to the hour (the usage tool's reset time jitters by a second).
export function weekStartIso(now, weeklyReset, weekResetsAt) {
    const start = now.getTime() - weekFraction(now, weeklyReset, weekResetsAt) * WEEK_MS;
    return new Date(Math.round(start / 3600000) * 3600000).toISOString();
}

export const weeklyCeiling = (f, g) => g.weeklyBase + g.weeklySlope * clamp01(f);

// Sleep until a reset, in chunks of at most an hour, landing two minutes after it.
export function sleepUntil(now, resetsAt, fallback = 3600) {
    const t = resetsAt ? new Date(resetsAt).getTime() : NaN;
    if (!Number.isFinite(t)) return fallback;
    return Math.max(60, Math.min(3600, Math.ceil((t - now.getTime()) / 1000) + 120));
}

// usage: { five, week } in percent (numbers or "unknown"), optional fiveResetsAt / weekResetsAt (ISO), optional state.
export function gate(usage, autonomy, now = new Date(), opts = {}) {
    const baseAuto = autonomy || DEFAULT_AUTONOMY;
    const g = { ...DEFAULT_AUTONOMY.gates, ...(baseAuto.gates || {}) };
    const resetCfg = { ...DEFAULT_AUTONOMY.weeklyReset, ...(baseAuto.weeklyReset || {}) };
    const nowDate = now instanceof Date ? now : new Date(now);
    const hasNumbers = usage && typeof usage.five === "number" && Number.isFinite(usage.five) && typeof usage.week === "number" && Number.isFinite(usage.week);
    const state = (usage && usage.state) || (opts && opts.state) || null;

    if (!hasNumbers) {
        const allowFallback = (opts?.autoFallback === true || usage?.autoFallback === true) && !opts?.noLocalFallback;
        if (allowFallback) {
            const q = estimateQuota(opts.root || (opts.cfg && opts.cfg.root) || ".", opts.cfg || {}, nowDate.getTime(), opts.quotaOpts || {});
            if (q.available) {
                if (state && typeof state === "object") state.unknownStreak = 0;
                const resolved = {
                    five: q.fivePct,
                    week: q.weekPct ?? 0,
                    fiveResetsAt: q.fiveResetsAt || (usage && usage.fiveResetsAt) || null,
                    weekResetsAt: (usage && usage.weekResetsAt) || null
                };
                const f = weekFraction(nowDate, resetCfg, resolved.weekResetsAt);
                const ceiling = Math.round(weeklyCeiling(f, g) * 10) / 10;
                const base = {
                    f: Math.round(f * 1000) / 1000,
                    ceiling,
                    five: resolved.five,
                    week: resolved.week,
                    fiveResetsAt: resolved.fiveResetsAt,
                    quotaSource: "local-blocks",
                    burnRate: q.burnRate,
                    projectedTokens: q.projectedTokens,
                    subagentCount: q.subagentCount,
                    subagentTokens: q.subagentTokens
                };
                if (resolved.five >= g.fiveHourExit) {
                    return { ...base, decision: "CIK", sleepSeconds: sleepUntil(nowDate, resolved.fiveResetsAt), reason: `5 saatlik yerel blok tahmini %${resolved.five} (çıkış eşiği %${g.fiveHourExit})` };
                }
                if (resolved.week >= ceiling) {
                    return { ...base, decision: "CIK", sleepSeconds: 3600, reason: `haftalık yerel tahmin %${resolved.week}, tavan %${ceiling}` };
                }
                if (resolved.five >= g.fiveHourNoNewStep) {
                    return { ...base, decision: "KUCUK", sleepSeconds: sleepUntil(nowDate, resolved.fiveResetsAt), reason: `5 saatlik yerel blok tahmini %${resolved.five} (yeni adım eşiği %${g.fiveHourNoNewStep})` };
                }
                if (resolved.week >= ceiling - g.weeklyMargin) {
                    return { ...base, decision: "KUCUK", sleepSeconds: 3600, reason: `haftalık yerel tahmin %${resolved.week}, tavana ${Math.round((ceiling - resolved.week) * 10) / 10} puan kaldı` };
                }
                const p = pace(resolved, g, nowDate, (g.paceWindowHours || 5) * 3600, g.paceBand || 8, (opts && opts.paceHistory) || []);
                if (q.approachingCap) {
                    return {
                        ...base,
                        decision: "KISITLI",
                        sleepSeconds: 1800,
                        pace: p,
                        reason: `yerel 5s blok tahmini tavanı zorluyor (${q.projectedTokens}/${q.tokenLimit} token, yakma hızı ${q.burnRate} tok/dk); kısıtlı çalışma`
                    };
                }
                return {
                    ...base,
                    decision: "GO",
                    sleepSeconds: p ? p.wakeSeconds : 90,
                    pace: p,
                    reason: `yerel blok tahmini uygun (5s %${resolved.five}, haftalık %${resolved.week} / tavan %${ceiling}, hız ${q.burnRate} tok/dk)` + (p ? `; tempo ${p.mode}: hedef çizgi %${p.target}` : "")
                };
            }
        }
        if (state && typeof state === "object") {
            state.unknownStreak = (state.unknownStreak || 0) + 1;
            if (state.unknownStreak >= 3) {
                return { decision: "CIK", sleepSeconds: 3600, five: usage?.five ?? "unknown", week: usage?.week ?? "unknown", reason: "kota üç kez üst üste okunamadı; bekleniyor" };
            }
        }
        return { decision: "KUCUK", sleepSeconds: 1800, five: usage?.five ?? "unknown", week: usage?.week ?? "unknown", reason: "kota okunamadı; yalnız tek küçük adım" };
    }

    const f = weekFraction(nowDate, resetCfg, usage.weekResetsAt);
    const ceiling = Math.round(weeklyCeiling(f, g) * 10) / 10;
    const base = { f: Math.round(f * 1000) / 1000, ceiling, five: usage.five, week: usage.week };
    if (usage.five >= g.fiveHourExit) {
        return { ...base, decision: "CIK", sleepSeconds: sleepUntil(nowDate, usage.fiveResetsAt), reason: `5 saatlik pencere %${usage.five} (çıkış eşiği %${g.fiveHourExit})` };
    }
    if (usage.week >= ceiling) {
        return { ...base, decision: "CIK", sleepSeconds: 3600, reason: `haftalık %${usage.week}, tavan %${ceiling} (tavan zamanla yükselir)` };
    }
    if (usage.five >= g.fiveHourNoNewStep) {
        return { ...base, decision: "KUCUK", sleepSeconds: sleepUntil(nowDate, usage.fiveResetsAt), reason: `5 saatlik pencere %${usage.five} (yeni adım eşiği %${g.fiveHourNoNewStep})` };
    }
    if (usage.week >= ceiling - g.weeklyMargin) {
        return { ...base, decision: "KUCUK", sleepSeconds: 3600, reason: `haftalık %${usage.week}, tavana ${Math.round((ceiling - usage.week) * 10) / 10} puan kaldı` };
    }
    const p = pace(usage, g, nowDate, (g.paceWindowHours || 5) * 3600, g.paceBand || 8, (opts && opts.paceHistory) || []);
    return { ...base, decision: "GO", sleepSeconds: p ? p.wakeSeconds : 90, pace: p, reason: `kota uygun (5s %${usage.five}, haftalık %${usage.week} / tavan %${ceiling})` + (p ? `; tempo ${p.mode}: hedef çizgi %${p.target}` : "") };
}

export function sameWindow(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    const ta = Date.parse(a), tb = Date.parse(b);
    return Number.isFinite(ta) && Number.isFinite(tb) && Math.abs(ta - tb) <= 5 * 60 * 1000;
}

// Pace the 5-hour window so it reaches fiveHourExit just before it resets (owner, 2026-11-14: "sıfırlamaya
// 10 dakika kala %90"). Target line = exit * elapsed fraction of the window. Ahead of the line by more than
// the band -> YAVAS (light work, long sleep); behind -> HIZLAN (heavy work allowed, short sleep); else NORMAL.
export function pace(usage, g, now = new Date(), windowSeconds = 5 * 3600, band = (g && g.paceBand) || 8, history = []) {
    const t = usage && usage.fiveResetsAt ? new Date(usage.fiveResetsAt).getTime() : NaN;
    if (!Number.isFinite(t)) return null;
    const nowDate = now instanceof Date ? now : new Date(now);
    const left = Math.max(0, (t - nowDate.getTime()) / 1000);
    const minutesLeft = Math.max(0, Math.round(left / 60));
    const elapsed = Math.min(1, Math.max(0, 1 - left / windowSeconds));
    const exit = (g && Number.isFinite(g.fiveHourExit)) ? g.fiveHourExit : 90;
    const target = Math.round(exit * elapsed);
    const diff = usage.five - target;
    const mode = diff > band ? "YAVAS" : diff < -band ? "HIZLAN" : "NORMAL";
    const wakeSeconds = mode === "YAVAS" ? 1800 : mode === "HIZLAN" ? 300 : 900;

    const res = usage.fiveResetsAt || null;
    const pts = [];
    for (const item of Array.isArray(history) ? history : []) {
        if (typeof item === "number" && Number.isFinite(item)) {
            pts.push({ five: item, atMs: NaN });
            continue;
        }
        if (!item || typeof item !== "object") continue;
        if (typeof item.five !== "number" || !Number.isFinite(item.five)) continue;
        if (res && item.resets && !sameWindow(item.resets, res)) continue;
        const atMs = item.at ? Date.parse(item.at) : NaN;
        pts.push({ five: item.five, atMs });
    }
    let avgTurnBurn = null;
    if (pts.length >= 2) {
        const deltas = [];
        for (let i = 1; i < pts.length; i++) {
            const d = pts[i].five - pts[i - 1].five;
            if (d > 0) deltas.push(d);
        }
        if (deltas.length > 0) {
            avgTurnBurn = Math.round((deltas.reduce((a, b) => a + b, 0) / deltas.length) * 10) / 10;
        }
    }

    let projectedEndPct = null;
    const timed = pts.filter((p) => Number.isFinite(p.atMs));
    if (timed.length >= 2) {
        const spanMin = (timed[timed.length - 1].atMs - timed[0].atMs) / 60000;
        const gain = timed[timed.length - 1].five - timed[0].five;
        if (spanMin >= 5 && gain > 0) {
            projectedEndPct = Math.min(100, Math.round((usage.five + (gain / spanMin) * minutesLeft) * 10) / 10);
        }
    }
    if (projectedEndPct === null) {
        projectedEndPct = elapsed >= 0.01
            ? Math.min(100, Math.round((usage.five / elapsed) * 10) / 10)
            : Math.min(100, Math.round(usage.five * 10) / 10);
    }

    const usedStr = Math.round(usage.five * 10) / 10;
    const timeStr = minutesLeft > 0 ? `pencere ${minutesLeft} dakika sonra sıfırlanıyor` : "pencere sıfırlanmak üzere";
    const burnStr = avgTurnBurn !== null
        ? `; ort. tur yakımı ~%${avgTurnBurn}`
        : (projectedEndPct !== null ? `; pencere sonu tahmini ~%${projectedEndPct}` : "");
    const advice = mode === "HIZLAN"
        ? "→ iş ağırlığını / paralel şeritleri artır"
        : mode === "YAVAS"
            ? "→ hafif iş ve uzun uyku (pencere erken dolmasın)"
            : "→ tempoyu koru";
    const summary = `${mode} (%${usedStr} kullanıldı / hedef çizgi %${target}; ${timeStr}${burnStr} ${advice})`;

    return { mode, target, diff: Math.round(diff), wakeSeconds, minutesLeft, avgTurnBurn, projectedEndPct, summary };
}

// The pacing measured: when the newest log row belongs to a new window, judge the window that just closed
// by weighing both quota % and work accomplished (commits, tasksDone).
export function paceReview(rows, current, g, opts = {}) {
    if (!current || !current.resets || !Array.isArray(rows) || !rows.length) return null;
    const prev = rows[rows.length - 1];
    if (!prev.resets || sameWindow(prev.resets, current.resets)) return null;
    const win = rows.filter((r) => sameWindow(r.resets, prev.resets));
    const last = Math.max(...win.map((r) => Number(r.five) || 0));
    const count = (m) => win.filter((r) => r.mode === m || r.decision === m).length;
    const slow = count("YAVAS"), fast = count("HIZLAN"), out = count("CIK");
    const commits = win.reduce((s, r) => s + (Number(r.commits) || 0), 0);
    const tasksDone = win.reduce((s, r) => s + (Number(r.tasksDone) || 0), 0);
    const workTotal = commits + tasksDone;
    const avgWorkPerTurn = Math.round((workTotal / win.length) * 100) / 100;
    const hasWorkTelemetry = win.some((r) => typeof r.commits === "number" || typeof r.tasksDone === "number");
    const exit = (g && Number.isFinite(g.fiveHourExit)) ? g.fiveHourExit : 90;
    const wastedPct = Math.max(0, Math.round((100 - last) * 10) / 10);
    const hasOpenWork = opts.openRoadmapItems === undefined ? true : opts.openRoadmapItems > 0;

    let status, efficiency, hint;
    if (out > 2) {
        status = "saturated";
        efficiency = hasWorkTelemetry && workTotal === 0 ? "low" : "mixed";
        hint = "erken doldu (CIK turları): bandı genişlet ya da HIZLAN uykusunu uzat";
    } else if (last < exit - 15) {
        if (!hasOpenWork) {
            status = "idle_complete";
            efficiency = workTotal > 0 ? "good" : "neutral";
            hint = `düşük kullanım (%${last}), açık yol haritası maddesi yok`;
        } else if (hasWorkTelemetry && (avgWorkPerTurn >= 1.5 || (workTotal >= 3 && workTotal / Math.max(1, last / 10) >= 1))) {
            status = "high_efficiency_underutilized";
            efficiency = "high";
            hint = `yavaş kaldı (%${wastedPct} boşa gitti, %${last} ile ${workTotal} iş): yöntem verimli, kapasite/paralellik ölçeklenebilir`;
        } else {
            status = "underutilized";
            efficiency = hasWorkTelemetry && workTotal === 0 ? "low" : "moderate";
            hint = `yavaş kaldı (%${exit - last} hedef altı / %${wastedPct} boşa gitti): bandı daralt ya da HIZLAN'da daha ağır iş ver`;
        }
    } else {
        status = "balanced";
        efficiency = hasWorkTelemetry && workTotal === 0 ? "low" : "good";
        hint = "iyi (hedefe yakın kapandı)";
    }
    return { status, last, turns: win.length, slow, fast, out, commits, tasksDone, avgWorkPerTurn, efficiency, wastedPct, resets: prev.resets, hint };
}
