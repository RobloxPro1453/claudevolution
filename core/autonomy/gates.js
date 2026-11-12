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

// usage: { five, week } in percent (numbers), optional fiveResetsAt / weekResetsAt (ISO).
export function gate(usage, autonomy, now = new Date()) {
    const g = autonomy.gates;
    const f = weekFraction(now, autonomy.weeklyReset, usage.weekResetsAt);
    const ceiling = Math.round(weeklyCeiling(f, g) * 10) / 10;
    const base = { f: Math.round(f * 1000) / 1000, ceiling, five: usage.five, week: usage.week };
    if (usage.five >= g.fiveHourExit) {
        return { ...base, decision: "CIK", sleepSeconds: sleepUntil(now, usage.fiveResetsAt), reason: `5 saatlik pencere %${usage.five} (çıkış eşiği %${g.fiveHourExit})` };
    }
    if (usage.week >= ceiling) {
        return { ...base, decision: "CIK", sleepSeconds: 3600, reason: `haftalık %${usage.week}, tavan %${ceiling} (tavan zamanla yükselir)` };
    }
    if (usage.five >= g.fiveHourNoNewStep) {
        return { ...base, decision: "KUCUK", sleepSeconds: sleepUntil(now, usage.fiveResetsAt), reason: `5 saatlik pencere %${usage.five} (yeni adım eşiği %${g.fiveHourNoNewStep})` };
    }
    if (usage.week >= ceiling - g.weeklyMargin) {
        return { ...base, decision: "KUCUK", sleepSeconds: 3600, reason: `haftalık %${usage.week}, tavana ${Math.round((ceiling - usage.week) * 10) / 10} puan kaldı` };
    }
    return { ...base, decision: "GO", sleepSeconds: 90, reason: `kota uygun (5s %${usage.five}, haftalık %${usage.week} / tavan %${ceiling})` };
}
