// The quota guard (owner, 2026-11-21: "an unattended loop ran to 100% and died; control, tempo and quota
// must ALWAYS be in the system"). The gates (gates.js) were advice: the skill had to remember to call
// `cv gate`, and in a long step it did not. The guard does not depend on memory: a Claude Code hook runs it
// around every tool call, so the check happens whether the model thinks of it or not.
//
//   level    when (5-hour %, weekly vs ceiling)          what the model sees
//   ok       below the warning lines                     nothing (no tokens spent)
//   tempo    on course to fill the window before reset   one warning per warnEveryMinutes
//   kucuk    5h >= fiveHourNoNewStep, or near ceiling     "finish what is in hand, start nothing new"
//   cik      5h >= fiveHourExit, or weekly >= ceiling     autonomous: new work is BLOCKED (edit, write, agent,
//                                                        non-git shell); commit + sleep stay allowed.
//                                                        Owner at the keyboard: a warning only, never a block.
//
// Percent comes from calibrate.current(): last real reading plus local burn since, else calibrated local
// units, else the uncalibrated default (then the guard also asks, in autonomous mode, for one reading).
// Pure decision here; I/O in core/cli/guard.js.
import { weeklyCeiling, weekFraction } from "./gates.js";

export const NEW_WORK_TOOLS = /^(Edit|Write|MultiEdit|NotebookEdit|Agent|Task|Workflow)$|^mcp__.*__(computer|browser_batch|left_click|type)$/;
// Shell commands that only save, record or measure (allowed even at the exit line).
export const SAFE_SHELL = /^\s*(git\s|(\S*[\\/])?cv(\.cmd)?\s|(\S*[\\/])?\.evrim[\\/]cv(\.cmd)?\s|echo\s|cat\s|ls\b|pwd\b)/;

const G = { fiveHourNoNewStep: 85, fiveHourExit: 90, weeklyBase: 60, weeklySlope: 30, weeklyMargin: 5 };

// q: { five, week, source, trust, projectedPct, minutesLeft, fiveResetsAt, weekResetsAt }
export function level(q, gates = {}, now = new Date(), weeklyReset = { weekdayUtc: 6, hourUtc: 3 }) {
    const g = { ...G, ...gates };
    if (!q || typeof q.five !== "number") return { level: "bilinmiyor", reason: "kota okunamadı" };
    const f = weekFraction(now, weeklyReset, q.weekResetsAt || null);
    const ceiling = Math.round(weeklyCeiling(f, g) * 10) / 10;
    const week = typeof q.week === "number" ? q.week : 0;
    if (q.five >= g.fiveHourExit) return { level: "cik", ceiling, reason: `5 saatlik pencere %${q.five} (çıkış çizgisi %${g.fiveHourExit})` };
    if (week >= ceiling) return { level: "cik", ceiling, reason: `haftalık %${week}, bugünkü tavan %${ceiling}` };
    if (q.five >= g.fiveHourNoNewStep) return { level: "kucuk", ceiling, reason: `5 saatlik pencere %${q.five} (yeni iş çizgisi %${g.fiveHourNoNewStep})` };
    if (week >= ceiling - g.weeklyMargin) return { level: "kucuk", ceiling, reason: `haftalık %${week}, tavana ${Math.round((ceiling - week) * 10) / 10} puan` };
    // Tempo: the burn since the window opened, carried to its end, passes the exit line.
    if (typeof q.projectedPct === "number" && q.projectedPct >= g.fiveHourExit && q.five >= 30 && q.minutesLeft > 0) {
        const perMin = (q.projectedPct - q.five) / q.minutesLeft;
        const toExit = perMin > 0 ? Math.max(1, Math.round((g.fiveHourExit - q.five) / perMin)) : null;
        return { level: "tempo", ceiling, toExit, reason: `bu hızla 5 saatlik pencere ~${toExit} dk içinde %${g.fiveHourExit}'a varır (sıfırlanmaya ${q.minutesLeft} dk var)` };
    }
    return { level: "ok", ceiling, reason: `5s %${q.five}, haftalık %${week} / tavan %${ceiling}` };
}

// What to do with one hook event. ctx: { event: "pre"|"post", tool, command, autonomous, lastWarnAt, now,
// warnEveryMinutes, trust, source }. Returns { exit: 0|2, message, warned }.
export function verdict(lv, ctx) {
    const now = ctx.now || new Date();
    const every = (ctx.warnEveryMinutes ?? 10) * 60000;
    const quiet = ctx.lastWarnAt && now.getTime() - new Date(ctx.lastWarnAt).getTime() < every;
    const src = ctx.source ? ` [kaynak: ${ctx.source}]` : "";
    if (lv.level === "cik" && ctx.event === "pre" && ctx.autonomous) {
        const newWork = NEW_WORK_TOOLS.test(ctx.tool || "") || (ctx.tool === "Bash" || ctx.tool === "PowerShell") && !SAFE_SHELL.test(ctx.command || "");
        if (newWork) {
            return { exit: 2, warned: true, message: `KOTA_FRENI (DUR): ${lv.reason}${src}. Yeni iş engellendi. Elindekini commit et (WIP olabilir), "cv cycle end" ile kaydet, sonra pencere sıfırlanana kadar uyu (ScheduleWakeup / schedule). Yalnız git ve cv komutları açık.` };
        }
        return { exit: 0, warned: false };
    }
    if (ctx.event !== "post" || lv.level === "ok" || lv.level === "bilinmiyor") {
        if (lv.level === "bilinmiyor" && ctx.event === "post" && ctx.autonomous && !quiet) {
            return { exit: 2, warned: true, message: "KOTA_FRENI: kota okunamıyor ve yerel tahmin yok. get_usage (ya da [quota]) ile okuyup `cv gate --five .. --week ..` çalıştır; okuyamıyorsan tek küçük adım yap ve uyu." };
        }
        return { exit: 0, warned: false };
    }
    if (quiet && lv.level !== "cik") return { exit: 0, warned: false };
    const lowTrust = ctx.trust === "dusuk" && ctx.autonomous ? " Bu tahmin kalibre değil: bir kez get_usage okuyup `cv gate --five .. --week ..` çalıştır, bekçi kendini planına göre ayarlar." : "";
    const text = {
        tempo: `KOTA_TEMPO: ${lv.reason}${src}. Yavaşla: ağır işi (alt ajan, geniş okuma, büyük derleme) ertele, adımları küçült, çevrim sonunda daha uzun uyu.`,
        kucuk: `KOTA_FRENI (KUCUK): ${lv.reason}${src}. Elindeki küçük işi bitir ve commit et; yeni iş başlatma.`,
        cik: ctx.autonomous
            ? `KOTA_FRENI (DUR): ${lv.reason}${src}. Commit et ve uyu; yeni iş araçları kapalı.`
            : `KOTA_UYARI: ${lv.reason}${src}. Pencere dolmak üzere; şu adımı bitirip durmak iyi olur.`
    }[lv.level];
    return { exit: 2, warned: true, message: text + lowTrust };
}
