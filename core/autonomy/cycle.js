// One autonomous cycle: begin (lock, turn, gate, memory digest) and end (journal, counters, unlock).
// The skill calls these two commands; all arithmetic and bookkeeping lives here so the skill stays short.
import path from "node:path";
import { git, nowIso, num, readJson, stamp, writeJson } from "../lib/util.js";
import { autonomyDir, stateDir } from "../lib/config.js";
import { gate, weekStartIso } from "./gates.js";
import { acquire, release } from "./lock.js";
import * as share from "./share.js";
import * as memory from "./memory.js";
import { find } from "./recover.js";
import { projectLessons } from "../evolve/merge.js";

const cycleState = (cfg) => path.join(stateDir(cfg), "cycle.json");
const quotaFile = (cfg) => path.join(stateDir(cfg), "quota.json");
const fresh = () => ({ total: 0, idleCycles: 0, sinceDistill: 0, lastDistillAt: null, unknownStreak: 0, wasted: 0, open: null });
export const loadState = (cfg) => ({ ...fresh(), ...readJson(cycleState(cfg), {}) });
export const lastQuota = (cfg) => readJson(quotaFile(cfg), null);

export function parseUsage(args) {
    const five = num(args.five), week = num(args.week);
    if (five === null || week === null) return null;
    return { five, week, fiveResetsAt: typeof args["five-resets"] === "string" ? args["five-resets"] : null, weekResetsAt: typeof args["week-resets"] === "string" ? args["week-resets"] : null };
}
export function rememberQuota(cfg, usage, now = new Date()) {
    if (usage) writeJson(quotaFile(cfg), { ...usage, at: nowIso(now) });
}

// Is a distillation due? Every distillEveryCycles working cycles, or once a day, if there is anything new.
export function distillDue(cfg, state, now = new Date()) {
    if (state.sinceDistill >= cfg.evolution.distillEveryCycles) return true;
    const last = state.lastDistillAt ? new Date(state.lastDistillAt).getTime() : 0;
    return state.sinceDistill > 0 && now.getTime() - last > 24 * 3600 * 1000 && state.total >= 3;
}

// Returns { decision, lines[] }. Decisions: GO, KUCUK, CIK, MESGUL, DUR, SIRA_DEGIL.
export function begin(cfg, args, now = new Date()) {
    const out = [];
    const state = loadState(cfg);
    const id = typeof args.session === "string" ? args.session : "c" + now.getTime().toString(36);
    const done = (decision, extra = []) => ({ decision, id, lines: [`KARAR: ${decision}`, ...extra, ...out] });

    const notes = memory.notes(cfg);
    if (notes.stop) return done("DUR", ["NEDEN: sahibi NOTLAR.md'ye DUR yazmış; o satır silinene kadar çalışılmaz"]);

    const lockFile = path.join(autonomyDir(cfg), "lock");
    const mine = acquire(lockFile, id, cfg.autonomy.lockStaleMinutes, now);
    if (!mine.ok) return done("MESGUL", [`NEDEN: oturum ${mine.holder.session} ${mine.holder.ageMin} dakikadır çalışıyor`]);
    if (mine.takenOver) out.push(`KURTARMA: önceki çevrim (${mine.holder.session}) kilidi bırakmadan ölmüş; kilit devralındı`);
    const machine = acquire(share.machineLock(), cfg.project + ":" + id, cfg.autonomy.lockStaleMinutes, now, cfg.project);
    if (!machine.ok) { release(lockFile, id); return done("MESGUL", [`NEDEN: bu makinede başka bir proje çevrimde (${machine.holder.note || machine.holder.session})`]); }
    const unlock = () => { release(lockFile, id); release(share.machineLock(), cfg.project + ":" + id); };

    const usage = parseUsage(args);
    const t = share.turn(cfg.root, cfg.project, cfg.autonomy.share.weight, now, weekStartIso(now, cfg.autonomy.weeklyReset, usage && usage.weekResetsAt));
    if (!t.ok) { unlock(); return done("SIRA_DEGIL", [`NEDEN: kota payı sırası başka projede (${t.active.map((p) => `${p.name} ${p.used}/${p.weight}`).join(", ")})`]); }

    // Gate. Unknown usage: allow one small step; three unknowns in a row -> wait.
    let g;
    if (usage) { state.unknownStreak = 0; rememberQuota(cfg, usage, now); g = gate(usage, cfg.autonomy, now); }
    else {
        state.unknownStreak += 1;
        g = state.unknownStreak >= 3
            ? { decision: "CIK", sleepSeconds: 3600, reason: "kota üç kez üst üste okunamadı; bekleniyor" }
            : { decision: "KUCUK", sleepSeconds: 1800, reason: "kota okunamadı; yalnız tek küçük adım" };
    }
    out.push(`NEDEN: ${g.reason}`, `UYKU: ${g.sleepSeconds}`, `KIMLIK: ${id}`);
    if (g.ceiling !== undefined) out.push(`HAFTALIK_TAVAN: %${g.ceiling} (haftanın %${Math.round(g.f * 100)}'i geçti)`);

    if (g.decision === "CIK") { writeJson(cycleState(cfg), state); unlock(); return done("CIK"); }

    const head = git(["rev-parse", "HEAD"], cfg.root);
    // Every branch tip, so work committed in another worktree/branch of the same repo counts too.
    const tips = git(["for-each-ref", "--format=%(objectname)", "refs/heads"], cfg.root);
    state.open = { id, startedAt: nowIso(now), head: head.ok ? head.out : null, tips: tips.ok ? [...new Set(tips.out.split(/\s+/).filter(Boolean))] : null, usage };
    writeJson(cycleState(cfg), state);

    const w = cfg.autonomy.watchdog;
    out.push(`CEVRIM: ${state.total + 1}. çevrim; üst üste commit'siz çevrim: ${state.idleCycles}` +
        (state.idleCycles >= w.idleCyclesSleep ? " → takıldın: OZET'e yaz, bu çevrimi uyku olarak kapat" : state.idleCycles >= w.idleCyclesChangeApproach ? " → yaklaşımı değiştir (işi küçült ya da sıradakine geç)" : ""));
    out.push(`DAMITMA: ${g.decision === "GO" && distillDue(cfg, state, now) ? "evet" : "hayır"}`);
    for (const f of find(cfg, now).filter((x) => x.id !== "kirli-agac" || g.decision === "GO")) out.push(`KURTARMA: ${f.text}${f.fixable ? " (cv recover --fix düzeltir)" : ""}`);

    if (notes.unread.length) out.push("", "SAHIBININ OKUNMAMIS NOTLARI:", ...notes.unread.map((l) => "  " + l));
    const q = memory.answered(cfg);
    if (q.answered.length) out.push("", "CEVAPLANMIS SORULAR:", ...q.answered.map((a) => `  ${a.question} → ${a.answer}`));
    const ls = memory.lessons(cfg);
    out.push("", `DERSLER (${ls.length}/${cfg.evolution.lessonsMax}):`, ...(ls.length ? ls.map((l) => "  " + l) : ["  (henüz yok)"]));
    if (ls.length > cfg.evolution.lessonsMax) out.push("  ! sınır aşıldı: benzerleri birleştir, eskimişi sil");
    const uni = projectLessons(cfg.root);
    if (uni.length) out.push("", `EVRENSEL DERSLER (paket + bu makine, .evrim/evrensel.md, ${uni.length}):`, ...uni.map((l) => "  " + l));
    out.push("", "GUNLUK (son satırlar):", ...(memory.journalTail(cfg) || "(boş)").split("\n").map((l) => "  " + l));
    return done(g.decision);
}

// Close the cycle: journal entry, idle/distill counters, share charge, unlock. Returns lines[].
export function end(cfg, args, now = new Date(), { sleepOnly = false } = {}) {
    const state = loadState(cfg);
    const open = state.open || {};
    const id = typeof args.id === "string" ? args.id : open.id;
    const usage = parseUsage(args);
    rememberQuota(cfg, usage, now);
    const quota = usage ? `kota 5s %${usage.five} / hafta %${usage.week}` : "kota okunamadı";
    let commits = 0;
    if (open.head) { const r = git(["rev-list", "--count", `${open.head}..HEAD`], cfg.root); if (r.ok) commits = parseInt(r.out, 10) || 0; }
    if (open.tips && open.tips.length) {
        const r = git(["rev-list", "--count", "--branches", "--not", ...open.tips], cfg.root);
        if (r.ok) commits = Math.max(commits, parseInt(r.out, 10) || 0);
    }

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
    state.open = null;
    writeJson(cycleState(cfg), state);
    const lockFile = path.join(autonomyDir(cfg), "lock");
    release(lockFile, id, true);
    release(share.machineLock(), cfg.project + ":" + id);

    const g = usage ? gate(usage, cfg.autonomy, now) : { decision: "KUCUK", sleepSeconds: 1800, reason: "kota okunamadı" };
    const out = [`KAPANDI: ${sleepOnly ? "uyku çevrimi" : `çevrim ${state.total}, ${commits} commit`}`, `UYKU: ${g.sleepSeconds}`, `SONRAKI_KAPI: ${g.decision} (${g.reason})`];
    if (!sleepOnly && open.usage && usage) {
        const spent = Math.round((usage.five - open.usage.five) * 10) / 10;
        const gates = cfg.autonomy.gates;
        if (spent > gates.stepShareAlarm) out.push(`UYARI: bu çevrim pencerenin %${spent}'ini yedi (alarm eşiği %${gates.stepShareAlarm}); sebebini bul ve DERSLER'e yaz`);
        else if (spent > gates.cycleShareMax) out.push(`UYARI: bu çevrim pencerenin %${spent}'ini yedi (hedef ≤ %${gates.cycleShareMax}); sonraki çevrimi küçült`);
    }
    return out;
}

export function markDistilled(cfg, now = new Date()) {
    const state = loadState(cfg);
    state.sinceDistill = 0;
    state.lastDistillAt = nowIso(now);
    writeJson(cycleState(cfg), state);
}
