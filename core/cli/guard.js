// cv guard [--event pre|post]   (Claude Code hook; reads the hook JSON on stdin)
// cv guard --show                (what the guard sees now, for the owner and the skills)
//
// Runs around every tool call, so it must be cheap and must never break a session: the quota is computed at
// most once per autonomy.guard.everySeconds (cached in .evrim/state/guard.json), any error means "allow".
// Exit 2 + stderr is how a Claude Code hook speaks to the model (pre: the call is blocked; post: a note).
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { readJson, writeJson, nowIso } from "../lib/util.js";
import { autonomyDir, stateDir } from "../lib/config.js";
import { lockInfo } from "../autonomy/lock.js";
import { project } from "./_project.js";
import { level, verdict } from "../autonomy/guard.js";

const GUARD_DEFAULTS = { enabled: true, everySeconds: 60, warnEveryMinutes: 10, maxReadingAgeMinutes: 60 };

async function readStdin(ms = 400) {
    if (process.stdin.isTTY) return "";
    return await new Promise((resolve) => {
        let buf = "";
        const done = () => { try { process.stdin.pause(); } catch (_) { /* closed */ } resolve(buf); };
        const t = setTimeout(done, ms);
        try {
            process.stdin.setEncoding("utf8");
            process.stdin.on("data", (c) => { buf += c; });
            process.stdin.on("end", () => { clearTimeout(t); done(); });
            process.stdin.on("error", () => { clearTimeout(t); done(); });
        } catch (_) { clearTimeout(t); resolve(""); }
    });
}

// A project without .evrim (or with a broken config) is none of the guard's business: allow silently.
function loadProject(root) {
    if (!fs.existsSync(path.join(root, ".evrim", "config.json"))) return null;
    try { return project({ dir: root }); } catch (_) { return null; }
}

export function isAutonomous(cfg, now = new Date()) {
    if (process.env.CV_AUTONOMOUS === "1") return true;
    try {
        const l = lockInfo(path.join(autonomyDir(cfg), "lock"), cfg.autonomy.lockStaleMinutes || 90, now);
        return l.held && !l.stale;
    } catch (_) { return false; }
}

// The guard state: cached quota and when the model was last warned. Pure enough to test with a fake clock.
export async function evaluate(cfg, ev, now = new Date(), opts = {}) {
    const conf = { ...GUARD_DEFAULTS, ...((cfg.autonomy && cfg.autonomy.guard) || {}) };
    if (conf.enabled === false) return { exit: 0, skipped: "kapalı" };
    const sf = path.join(stateDir(cfg), "guard.json");
    const st = readJson(sf, {});
    let q = st.q || null;
    const age = st.at ? (now.getTime() - new Date(st.at).getTime()) / 1000 : Infinity;
    if (!q || age >= conf.everySeconds || opts.fresh) {
        const cal = await import("../metrics/calibrate.js");
        const c = cal.current(cfg, now, opts);
        q = { five: c.five, week: c.week, source: c.source, trust: c.trust, projectedPct: c.projectedPct, minutesLeft: c.minutesLeft, fiveResetsAt: c.fiveResetsAt };
        st.q = q; st.at = nowIso(now);
    }
    const lv = level(q, cfg.autonomy && cfg.autonomy.gates, now, cfg.autonomy && cfg.autonomy.weeklyReset);
    const tool = ev.tool_name || ev.tool || "";
    const command = (ev.tool_input && (ev.tool_input.command || ev.tool_input.script)) || "";
    const v = verdict(lv, {
        event: ev.event || (/pre/i.test(ev.hook_event_name || "") ? "pre" : "post"),
        tool, command, now, autonomous: opts.autonomous ?? isAutonomous(cfg, now),
        lastWarnAt: st.lastWarnAt, warnEveryMinutes: conf.warnEveryMinutes, trust: q.trust, source: q.source
    });
    if (v.warned) { st.lastWarnAt = nowIso(now); st.lastLevel = lv.level; }
    try { writeJson(sf, st); } catch (_) { /* a cache, not a record */ }
    return { ...v, level: lv.level, reason: lv.reason, q };
}

export async function run(args) {
    try {
        const root = path.resolve(typeof args.dir === "string" ? args.dir : (process.env.CLAUDE_PROJECT_DIR || process.cwd()));
        const cfg = loadProject(root);
        if (!cfg) { if (args.show) console.log("BEKCI: bu klasörde .evrim yok"); return 0; }
        if (args.show) {
            const r = await evaluate(cfg, { event: "show" }, new Date(), { fresh: true });
            const q = r.q || {};
            console.log([
                `BEKCI: ${r.level} — ${r.reason}`,
                `KAYNAK: ${q.source} (güven: ${q.trust})`,
                ...(typeof q.projectedPct === "number" ? [`PENCERE_SONU_TAHMINI: %${q.projectedPct} (${q.minutesLeft} dk kaldı)`] : []),
                `OTONOM: ${isAutonomous(cfg) ? "evet (çıkış çizgisinde yeni iş engellenir)" : "hayır (yalnız uyarı)"}`
            ].join("\n"));
            return 0;
        }
        const raw = await readStdin();
        let ev = {};
        try { ev = raw ? JSON.parse(raw) : {}; } catch (_) { ev = {}; }
        if (typeof args.event === "string") ev.event = args.event;
        const v = await evaluate(cfg, ev);
        if (v.exit === 2 && v.message) process.stderr.write(v.message + "\n");
        return v.exit || 0;
    } catch (e) {
        if (process.env.CV_DEBUG) console.error(e.stack);
        return 0; // never break the session
    }
}
