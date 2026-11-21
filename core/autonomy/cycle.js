// One autonomous cycle: begin (lock, turn, gate, memory digest) and end (journal, counters, unlock).
// The skill calls these two commands; all arithmetic and bookkeeping lives here so the skill stays short.
import path from "node:path";
import { git, nowIso, num, readJson, stamp, writeJson } from "../lib/util.js";
import { autonomyDir, stateDir } from "../lib/config.js";
import { gate, pace, sameWindow, weekStartIso } from "./gates.js";
import { acquire, release } from "./lock.js";
import * as share from "./share.js";
import * as memory from "./memory.js";
import { find } from "./recover.js";
import { projectLessons } from "../evolve/merge.js";
import { auditMethodology, checkFinalForm, evaluateWindowAndTune, recordWindowObservation } from "./office.js";
import { notifyOwner } from "./notify.js";
import * as calibrate from "../metrics/calibrate.js";

const cycleState = (cfg) => path.join(stateDir(cfg), "cycle.json");
const quotaFile = (cfg) => path.join(stateDir(cfg), "quota.json");
const fresh = () => ({ total: 0, idleCycles: 0, sinceDistill: 0, lastDistillAt: null, unknownStreak: 0, wasted: 0, open: null, windowHistory: [], tunedWindows: [] });
export const loadState = (cfg) => ({ ...fresh(), ...readJson(cycleState(cfg), {}) });
export const lastQuota = (cfg) => readJson(quotaFile(cfg), null);

export function parseUsage(args) {
    const five = num(args.five), week = num(args.week);
    if (five === null || week === null) return null;
    return { five, week, fiveResetsAt: typeof args["five-resets"] === "string" ? args["five-resets"] : null, weekResetsAt: typeof args["week-resets"] === "string" ? args["week-resets"] : null };
}
// A real reading (not the local estimate) also calibrates the guard's local meter for this account (H73).
export function rememberQuota(cfg, usage, now = new Date(), opts = {}) {
    if (!usage) return;
    writeJson(quotaFile(cfg), { ...usage, at: nowIso(now) });
    if (usage.source !== "local-blocks" && opts.calibrate !== false) calibrate.observe(cfg, usage, now, opts);
}

// Is a distillation due? Every distillEveryCycles working cycles, or once a day, if there is anything new.
export function distillDue(cfg, state, now = new Date()) {
    if (state.sinceDistill >= cfg.evolution.distillEveryCycles) return true;
    const last = state.lastDistillAt ? new Date(state.lastDistillAt).getTime() : 0;
    return state.sinceDistill > 0 && now.getTime() - last > 24 * 3600 * 1000 && state.total >= 3;
}

// Returns { decision, id, quotaSource, lines[] }. Decisions: GO, KUCUK, KISITLI, CIK, MESGUL, DUR, SIRA_DEGIL, BITTI.
export function begin(cfg, args = {}, now = new Date(), opts = {}) {
    args = args || {};
    const out = [];
    const state = loadState(cfg);
    const id = typeof args.session === "string" ? args.session : "c" + now.getTime().toString(36);
    let quotaSource = null;
    const done = (decision, extra = []) => ({
        decision,
        id,
        ...(quotaSource ? { quotaSource } : {}),
        lines: [`KARAR: ${decision}`, ...extra, ...out]
    });

    const notes = memory.notes(cfg);
    if (notes.stop) return done("DUR", ["NEDEN: sahibi NOTLAR.md'ye DUR yazmış; o satır silinene kadar çalışılmaz"]);

    const lockFile = path.join(autonomyDir(cfg), "lock");
    const mine = acquire(lockFile, id, cfg.autonomy.lockStaleMinutes, now);
    if (!mine.ok) return done("MESGUL", [`NEDEN: oturum ${mine.holder.session} ${mine.holder.ageMin} dakikadır çalışıyor`]);
    if (mine.takenOver) out.push(`KURTARMA: önceki çevrim (${mine.holder.session}) kilidi bırakmadan ölmüş; kilit devralındı`);
    const machine = acquire(share.machineLock(), cfg.project + ":" + id, cfg.autonomy.lockStaleMinutes, now, cfg.project);
    if (!machine.ok) { release(lockFile, id); return done("MESGUL", [`NEDEN: bu makinede başka bir proje çevrimde (${machine.holder.note || machine.holder.session})`]); }
    const unlock = () => { release(lockFile, id); release(share.machineLock(), cfg.project + ":" + id); };

    if (!args["ignore-final"] && !opts.ignoreFinal && !notes.unread.length) {
        const finalCheck = checkFinalForm(cfg, state, { skipVerify: Boolean(args["skip-verify"] || opts.skipVerify) });
        if (finalCheck.done) {
            unlock();
            if (!opts.noNotify) {
                notifyOwner(cfg, {
                    deliverablePath: finalCheck.deliverablePath,
                    deliverable: finalCheck.deliverable,
                    criteria: finalCheck.criteria,
                    silent: opts.silentNotify,
                    now
                });
            }
            return done("BITTI", [
                `NEDEN: ${finalCheck.reason}`,
                `DELIVERABLE: ${finalCheck.deliverablePath}`,
                "UYKU: 0",
                `KIMLIK: ${id}`
            ]);
        }
    }

    const usage = parseUsage(args);
    const t = share.turn(cfg.root, cfg.project, cfg.autonomy.share.weight, now, weekStartIso(now, cfg.autonomy.weeklyReset, usage && usage.weekResetsAt));
    if (!t.ok) { unlock(); return done("SIRA_DEGIL", [`NEDEN: kota payı sırası başka projede (${t.active.map((p) => `${p.name} ${p.used}/${p.weight}`).join(", ")})`]); }

    // Gate. Unknown usage: try local-blocks fallback when explicit unknown or --auto (unless disabled); otherwise three unknowns -> wait.
    let g;
    const paceHistory = state.windowHistory || [];
    const tryLocalFallback = !usage && !opts.noLocalFallback && !args["no-local-fallback"] &&
        (opts.autoFallback === true || args.auto === true || (args.five === "unknown" && args.week === "unknown"));
    if (usage) {
        quotaSource = "args";
        state.unknownStreak = 0;
        rememberQuota(cfg, usage, now);
        g = gate(usage, cfg.autonomy, now, { ...opts, paceHistory });
    } else if (tryLocalFallback) {
        g = gate({ five: "unknown", week: "unknown", state }, cfg.autonomy, now, { ...opts, autoFallback: true, root: cfg.root, cfg, paceHistory });
        if (g.quotaSource === "local-blocks") {
            quotaSource = "local-blocks";
            rememberQuota(cfg, { five: g.five, week: g.week, fiveResetsAt: g.fiveResetsAt || null, weekResetsAt: null, source: "local-blocks" }, now);
            out.push(`KOTA_KAYNAGI: local-blocks (5s %${g.five}, hafta %${g.week}, yakma hızı ${g.burnRate} tok/dk, alt ajan ${g.subagentCount})`);
        }
    } else {
        state.unknownStreak += 1;
        g = state.unknownStreak >= 3
            ? { decision: "CIK", sleepSeconds: 3600, reason: "kota üç kez üst üste okunamadı; bekleniyor" }
            : { decision: "KUCUK", sleepSeconds: 1800, reason: "kota okunamadı; yalnız tek küçük adım" };
    }
    const openUsage = usage || (quotaSource === "local-blocks" ? { five: g.five, week: g.week, fiveResetsAt: g.fiveResetsAt || null, weekResetsAt: null, source: "local-blocks" } : null);
    const tune = openUsage ? evaluateWindowAndTune(cfg, state, openUsage, now, opts) : { tuned: false, lines: [] };
    if (tune.tuned && openUsage && g.pace) {
        const gatesCfg = cfg.autonomy.gates;
        g.pace = pace(openUsage, gatesCfg, now, (gatesCfg.paceWindowHours || 5) * 3600, gatesCfg.paceBand || 8, paceHistory);
        if (g.decision === "GO" && g.pace) g.sleepSeconds = g.pace.wakeSeconds;
    }

    out.push(`NEDEN: ${g.reason}`, `UYKU: ${g.sleepSeconds}`, `KIMLIK: ${id}`);
    if (g.ceiling !== undefined) out.push(`HAFTALIK_TAVAN: %${g.ceiling} (haftanın %${Math.round(g.f * 100)}'i geçti)`);
    if (tune.lines.length) out.push(...tune.lines);

    if (g.decision === "CIK") { writeJson(cycleState(cfg), state); unlock(); return done("CIK"); }

    const head = git(["rev-parse", "HEAD"], cfg.root);
    // Every branch tip, so work committed in another worktree/branch of the same repo counts too.
    const tips = git(["for-each-ref", "--format=%(objectname)", "refs/heads"], cfg.root);
    state.open = { id, startedAt: nowIso(now), head: head.ok ? head.out : null, tips: tips.ok ? [...new Set(tips.out.split(/\s+/).filter(Boolean))] : null, usage: openUsage };
    writeJson(cycleState(cfg), state);

    const w = cfg.autonomy.watchdog;
    out.push(`CEVRIM: ${state.total + 1}. çevrim; üst üste commit'siz çevrim: ${state.idleCycles}` +
        (state.idleCycles >= w.idleCyclesSleep ? " → takıldın: OZET'e yaz, bu çevrimi uyku olarak kapat" : state.idleCycles >= w.idleCyclesChangeApproach ? " → yaklaşımı değiştir (işi küçült ya da sıradakine geç)" : ""));
    out.push(`DAMITMA: ${g.decision === "GO" && distillDue(cfg, state, now) ? "evet" : "hayır"}`);
    const rec = find(cfg, now);
    for (const f of rec.filter((x) => x.id !== "kirli-agac" || g.decision === "GO")) out.push(`KURTARMA: ${f.text}${f.fixable ? " (cv recover --fix düzeltir)" : ""}`);
    out.push(...auditMethodology(cfg, state, g, now, { recovery: rec }));

    if (notes.unread.length) out.push("", "SAHIBININ OKUNMAMIS NOTLARI:", ...notes.unread.map((l) => "  " + l));
    const q = memory.answered(cfg);
    if (q.answered.length) out.push("", "CEVAPLANMIS SORULAR:", ...q.answered.map((a) => `  ${a.question} → ${a.answer}`));
    // Wake-up diet: with a known task the cycle reads only the lessons that match it and the last 5 journal
    // lines (each cycle's output goes into the main model's context; the whole list cost Opus quota every
    // cycle). --all brings the full lists back.
    const taskFilter = typeof args.task === "string" ? args.task.trim() : "";
    const dieted = taskFilter && !args.all;
    if (taskFilter) {
        const splitCsv = (v) => (v === undefined || v === true ? [] : [].concat(v)).flatMap((x) => String(x).split(",")).map((x) => x.trim()).filter(Boolean);
        const primed = memory.primeLessons(cfg, {
            task: taskFilter,
            files: splitCsv(args.files),
            keywords: splitCsv(args.keywords),
            errors: splitCsv(args.errors),
            limit: Number(args.limit) || 12
        });
        out.push("", `ONCELIKLI DERSLER (görev: ${taskFilter}, ${primed.length}):`, ...(primed.length ? primed.map((l) => `  [${l.source}:${l.score}] ${l.text}`) : ["  (eşleşen ders yok)"]));
    }
    if (!dieted) {
        const ls = memory.lessons(cfg);
        out.push("", `DERSLER (${ls.length}/${cfg.evolution.lessonsMax}):`, ...(ls.length ? ls.map((l) => "  " + l) : ["  (henüz yok)"]));
        if (ls.length > cfg.evolution.lessonsMax) out.push("  ! sınır aşıldı: benzerleri birleştir, eskimişi sil");
        const uni = projectLessons(cfg.root);
        if (uni.length) out.push("", `EVRENSEL DERSLER (paket + bu makine, .evrim/evrensel.md, ${uni.length}):`, ...uni.map((l) => "  " + l));
    }
    out.push("", "GUNLUK (son satırlar):", ...(memory.journalTail(cfg, dieted ? 5 : undefined) || "(boş)").split("\n").map((l) => "  " + l));
    if (dieted) out.push("", "(göreve göre süzüldü; bütün dersler ve günlük: --all)");
    return done(g.decision);
}

// Close the cycle: journal entry, idle/distill counters, share charge, unlock. Returns lines[].
export function end(cfg, args = {}, now = new Date(), opts = {}) {
    args = args || {};
    opts = opts || {};
    const sleepOnly = Boolean(opts.sleepOnly);
    const state = loadState(cfg);
    const open = state.open || {};
    const id = typeof args.id === "string" ? args.id : open.id;
    const usage = parseUsage(args);
    const paceHistory = state.windowHistory || [];
    const tryLocalFallback = !usage && !opts.noLocalFallback && !args["no-local-fallback"] &&
        (opts.autoFallback === true || args.auto === true || (args.five === "unknown" && args.week === "unknown"));
    let resolvedUsage = usage;
    let fallbackGate = null;
    if (!usage && tryLocalFallback) {
        const fg = gate({ five: "unknown", week: "unknown" }, cfg.autonomy, now, { ...opts, autoFallback: true, root: cfg.root, cfg, paceHistory });
        if (fg.quotaSource === "local-blocks") {
            fallbackGate = fg;
            resolvedUsage = { five: fg.five, week: fg.week, fiveResetsAt: fg.fiveResetsAt || null, weekResetsAt: null, source: "local-blocks" };
        }
    }
    rememberQuota(cfg, resolvedUsage, now);
    const quota = usage
        ? `kota 5s %${usage.five} / hafta %${usage.week}`
        : (fallbackGate ? `kota 5s %${fallbackGate.five} / hafta %${fallbackGate.week} (local-blocks)` : "kota okunamadı");
    let commits = 0;
    if (open.head) { const r = git(["rev-list", "--count", `${open.head}..HEAD`], cfg.root); if (r.ok) commits = parseInt(r.out, 10) || 0; }
    if (open.tips && open.tips.length) {
        const r = git(["rev-list", "--count", "--branches", "--not", ...open.tips], cfg.root);
        if (r.ok) commits = Math.max(commits, parseInt(r.out, 10) || 0);
    }

    const cycleBurn = (!sleepOnly && open.usage && resolvedUsage && (!open.usage.fiveResetsAt || !resolvedUsage.fiveResetsAt || sameWindow(open.usage.fiveResetsAt, resolvedUsage.fiveResetsAt)))
        ? Math.round((resolvedUsage.five - open.usage.five) * 10) / 10
        : null;

    if (sleepOnly) memory.appendJournal(cfg, `${stamp(now)} · uyku · ${quota}`, [String(args.reason || "kapı kapalı")]);
    else {
        const worth = String(args.worth || "").toLowerCase();
        memory.appendJournal(cfg, `${stamp(now)} · ${quota}`, [
            `Yaptım: ${args.did || "(yazılmadı)"}`,
            `Maliyet: ${args.cost || "(yazılmadı)"} · commit: ${commits} · Değdi: ${worth === "hayir" || worth === "hayır" ? "hayır" : "evet"}`,
            args.next ? `Sıradaki: ${args.next}` : ""
        ]);
        state.total += 1;
        state.sinceDistill += 1;
        if (commits > 0) state.idleCycles = 0; else { state.idleCycles += 1; state.wasted += 1; }
        share.charge(cfg.root, now);
    }

    const g = usage
        ? gate(usage, cfg.autonomy, now, { ...opts, paceHistory })
        : (fallbackGate || { decision: "KUCUK", sleepSeconds: 1800, reason: "kota okunamadı" });

    if (resolvedUsage) {
        recordWindowObservation(state, resolvedUsage, sleepOnly ? 0 : commits, now, {
            mode: g.pace ? g.pace.mode : null,
            decision: g.decision,
            burn: cycleBurn,
            sleepOnly
        });
    }
    const tune = resolvedUsage ? evaluateWindowAndTune(cfg, state, resolvedUsage, now, opts) : { tuned: false, lines: [] };
    if (tune.tuned && g.pace && resolvedUsage) {
        const gatesCfg = cfg.autonomy.gates;
        g.pace = pace(resolvedUsage, gatesCfg, now, (gatesCfg.paceWindowHours || 5) * 3600, gatesCfg.paceBand || 8, state.windowHistory || []);
        if (g.decision === "GO" && g.pace) g.sleepSeconds = g.pace.wakeSeconds;
    }

    state.open = null;
    writeJson(cycleState(cfg), state);
    const lockFile = path.join(autonomyDir(cfg), "lock");
    release(lockFile, id, true);
    release(share.machineLock(), cfg.project + ":" + id);

    const notes = memory.notes(cfg);
    const finalCheck = (!sleepOnly && !args["ignore-final"] && !opts.ignoreFinal && !notes.unread.length && !notes.stop)
        ? checkFinalForm(cfg, state, { skipVerify: Boolean(args["skip-verify"] || opts.skipVerify) })
        : { done: false };
    if (finalCheck.done && !opts.noNotify) {
        notifyOwner(cfg, {
            deliverablePath: finalCheck.deliverablePath,
            deliverable: finalCheck.deliverable,
            criteria: finalCheck.criteria,
            silent: opts.silentNotify,
            now
        });
    }

    const out = [
        `KAPANDI: ${sleepOnly ? "uyku çevrimi" : `çevrim ${state.total}, ${commits} commit`}`,
        ...(fallbackGate ? [`KOTA_KAYNAGI: local-blocks (${quota})`] : []),
        `UYKU: ${finalCheck.done ? 0 : g.sleepSeconds}`,
        `SONRAKI_KAPI: ${finalCheck.done ? `BITTI (${finalCheck.reason})` : `${g.decision} (${g.reason})`}`,
        ...(finalCheck.done ? [`DELIVERABLE: ${finalCheck.deliverablePath}`] : []),
        ...(g.pace && g.pace.summary ? [`TEMPO: ${g.pace.summary}`] : []),
        ...tune.lines
    ];
    if (cycleBurn !== null) {
        const gates = cfg.autonomy.gates;
        if (cycleBurn > gates.stepShareAlarm) out.push(`UYARI: bu çevrim pencerenin %${cycleBurn}'ini yedi (alarm eşiği %${gates.stepShareAlarm}); sebebini bul ve DERSLER'e yaz`);
        else if (cycleBurn > gates.cycleShareMax) out.push(`UYARI: bu çevrim pencerenin %${cycleBurn}'ini yedi (hedef ≤ %${gates.cycleShareMax}); sonraki çevrimi küçült`);
    }
    return out;
}

export function markDistilled(cfg, now = new Date()) {
    const state = loadState(cfg);
    state.sinceDistill = 0;
    state.lastDistillAt = nowIso(now);
    writeJson(cycleState(cfg), state);
}

// Re-inject compact context after compaction: current phase, blockers, and task-relevant lessons.
export function prime(cfg, args = {}, now = new Date()) {
    args = args || {};
    const splitCsv = (v) => (v === undefined || v === true ? [] : [].concat(v)).flatMap((x) => String(x).split(",")).map((x) => x.trim()).filter(Boolean);
    const task = typeof args.task === "string" ? args.task.trim() : "";
    const state = loadState(cfg);
    const notes = memory.notes(cfg);
    const qAns = memory.answered(cfg);
    const quota = lastQuota(cfg);
    const recovery = find(cfg, now);
    const summary = memory.summaryNow(cfg);

    const phase = {
        project: cfg.project,
        totalCycles: state.total,
        idleCycles: state.idleCycles,
        sinceDistill: state.sinceDistill,
        openCycle: state.open ? state.open.id : null,
        summary: summary || null,
        task: task || null
    };

    const blockers = [];
    if (notes.stop) blockers.push("NOTLAR.md içinde DUR satırı var");
    if (notes.unread.length) blockers.push(`okunmamış sahip notu: ${notes.unread.length}`);
    if (qAns.answered.length) blockers.push(`cevaplanmış soru: ${qAns.answered.length}`);
    if (qAns.openCount > 0) blockers.push(`açık soru: ${qAns.openCount}`);
    const w = cfg.autonomy && cfg.autonomy.watchdog;
    if (w && state.idleCycles >= w.idleCyclesSleep) blockers.push(`üst üste ${state.idleCycles} commit'siz çevrim (uyku eşiği ${w.idleCyclesSleep})`);
    else if (w && state.idleCycles >= w.idleCyclesChangeApproach) blockers.push(`üst üste ${state.idleCycles} commit'siz çevrim (yaklaşım değiştir)`);
    for (const f of recovery) blockers.push(`${f.text}${f.fixable ? " (cv recover --fix)" : ""}`);

    const primed = memory.primeLessons(cfg, {
        task,
        files: splitCsv(args.files),
        keywords: splitCsv(args.keywords),
        errors: splitCsv(args.errors),
        limit: Number(args.limit) || 12
    });

    const lines = [
        `ASAMA: ${cfg.project} · çevrim ${state.total}${state.open ? ` (açık: ${state.open.id})` : ""} · commit'siz: ${state.idleCycles}`,
        ...(task ? [`GOREV: ${task}`] : []),
        ...(summary ? [`OZET: ${summary}`] : []),
        ...(quota ? [`SON_KOTA: 5s %${quota.five}, hafta %${quota.week} (${String(quota.at).slice(0, 16)}Z)`] : ["SON_KOTA: yok"]),
        "",
        `ENGELLEYICILER (${blockers.length}):`,
        ...(blockers.length ? blockers.map((b) => "  - " + b) : ["  (yok)"]),
        ...(notes.unread.length ? ["", "SAHIBININ NOTLARI:", ...notes.unread.map((l) => "  " + l)] : []),
        ...(qAns.answered.length ? ["", "CEVAPLANMIS SORULAR:", ...qAns.answered.map((a) => `  ${a.question} → ${a.answer}`)] : []),
        "",
        `DERSLER (${primed.length}):`,
        ...(primed.length ? primed.map((l) => `  [${l.source}:${l.score}] ${l.text}`) : ["  (yok)"]),
        "",
        "GUNLUK (son):",
        ...(memory.journalTail(cfg, 6) || "(boş)").split("\n").map((l) => "  " + l)
    ];

    return { phase, blockers, lessons: primed, lines };
}
