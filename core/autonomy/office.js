// Multi-layered autonomous Software Office brain:
//   1. Live window observation history & burn efficiency tracking
//   2. Self-tuning decrees (.evrim/otonom/KARARNAMELER.md + bounded .evrim/config.json adjustments)
//   3. Methodology & strategy-pivot critic (OFIS_MUHAKEMESI + ACIK_CERCEVE)
//   4. Final form completion gate (BITTI)
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { appendText, exists, lines, nowIso, readJson, readText, run, stamp, writeJson, writeText } from "../lib/util.js";
import { CONFIG_REL, autonomyDir } from "../lib/config.js";
import { paceReview, sameWindow } from "./gates.js";
import { find } from "./recover.js";

// The last counted `cv check` round (core/check/check.js layout), read without loading the checker.
function defaultLastRound(cfg) {
    const dir = path.join(cfg.root, ".evrim", "state", "checks");
    let rounds = [];
    try { rounds = fs.readdirSync(dir).filter((n) => /^round-\d+$/.test(n)).map((n) => Number(n.slice(6))).filter((n) => n > 0).sort((a, b) => a - b); } catch (_) { return null; }
    return rounds.length ? readJson(path.join(dir, `round-${rounds[rounds.length - 1]}`, "check.json"), null) : null;
}

const MAX_WINDOW_HISTORY = 120;
const MAX_TUNED_WINDOWS = 30;
const DECREE_HEADER = "# Kararnameler (Öz-Düzenleme ve Strateji Kaydı)\n\nOtonom yazılım ofisinin verimlilik, tempo, mimari ve strateji değişikliklerine dair kalıcı kararları.\n\n";

const stripComments = (text) => String(text || "").replace(/<!--[\s\S]*?-->/g, "");

export const decreeFile = (cfg) => path.join(autonomyDir(cfg), "KARARNAMELER.md");

export function readDecrees(cfg) {
    if (!cfg || !cfg.root) return [];
    const text = stripComments(readText(decreeFile(cfg), ""));
    return lines(text)
        .filter((l) => /^\s*-\s+\S/.test(l) && !/^\s*-\s*</.test(l))
        .map((l) => l.trim());
}

export function appendDecree(cfg, text, now = new Date()) {
    const file = decreeFile(cfg);
    const d = now instanceof Date ? now : new Date(now);
    const entry = `- [${stamp(d)}] ${String(text || "").trim()}`;
    if (!exists(file)) {
        writeText(file, DECREE_HEADER + entry + "\n");
    } else {
        const cur = readText(file, "");
        const prefix = cur && !cur.endsWith("\n") ? "\n" : "";
        appendText(file, prefix + entry + "\n");
    }
    return entry;
}

// Normalize a reset timestamp to 5-minute buckets so 1-2s jitter never defeats cooldown.
function windowKey(resets) {
    if (!resets) return null;
    const ms = Date.parse(resets);
    if (Number.isFinite(ms)) return new Date(Math.round(ms / 300000) * 300000).toISOString();
    return String(resets);
}

export function roadmapStats(cfg) {
    const rel = (cfg && cfg.docs && cfg.docs.roadmap) || "docs/ROADMAP.md";
    const file = cfg && cfg.root ? path.join(cfg.root, rel) : null;
    if (!file || !exists(file)) return { exists: false, path: file, openCount: 0, doneCount: 0, openItems: [], doneItems: [] };
    const text = stripComments(readText(file, ""));
    const all = lines(text);
    const openItems = all.filter((l) => /^\s*-\s*\[\s\]\s+\S/.test(l)).map((l) => l.trim());
    const doneItems = all.filter((l) => /^\s*-\s*\[[xX]\]\s+\S/.test(l) && !/^\s*-\s*\[[xX]\]\s*<madde/i.test(l)).map((l) => l.trim());
    return { exists: true, path: file, openCount: openItems.length, doneCount: doneItems.length, openItems, doneItems };
}

export function recordWindowObservation(state, usage, commits = 0, now = new Date(), extra = {}) {
    if (!state || typeof state !== "object") return null;
    if (!Array.isArray(state.windowHistory)) state.windowHistory = [];
    if (!usage || typeof usage.five !== "number" || !Number.isFinite(usage.five)) return null;
    const d = now instanceof Date ? now : new Date(now);
    const row = {
        resets: usage.fiveResetsAt || extra.resets || null,
        five: Math.round(usage.five * 10) / 10,
        week: typeof usage.week === "number" && Number.isFinite(usage.week) ? Math.round(usage.week * 10) / 10 : null,
        mode: extra.mode || null,
        decision: extra.decision || null,
        commits: Number(commits) || 0,
        ...(extra.tasksDone !== undefined ? { tasksDone: Number(extra.tasksDone) || 0 } : {}),
        ...(extra.burn !== undefined && extra.burn !== null && Number.isFinite(extra.burn) ? { burn: Math.round(extra.burn * 10) / 10 } : {}),
        at: nowIso(d)
    };
    state.windowHistory.push(row);
    if (state.windowHistory.length > MAX_WINDOW_HISTORY) {
        state.windowHistory = state.windowHistory.slice(-MAX_WINDOW_HISTORY);
    }
    return row;
}

function summarizeExpiringWindow(rows, usage, exit, road) {
    const last = Math.max(Number(usage.five) || 0, ...rows.map((r) => Number(r.five) || 0));
    const turns = Math.max(1, rows.length);
    const commits = rows.reduce((s, r) => s + (Number(r.commits) || 0), 0);
    const tasksDone = rows.reduce((s, r) => s + (Number(r.tasksDone) || 0), 0);
    const workTotal = commits + tasksDone;
    const avgWorkPerTurn = Math.round((workTotal / turns) * 100) / 100;
    const wastedPct = Math.max(0, Math.round((100 - last) * 10) / 10);
    const highEff = rows.length > 0 && (avgWorkPerTurn >= 1.5 || (workTotal >= 3 && workTotal / Math.max(1, last / 10) >= 1));
    const status = highEff ? "high_efficiency_underutilized" : "underutilized";
    const efficiency = highEff ? "high" : (workTotal === 0 ? "low" : "moderate");
    const hint = highEff
        ? `pencere kapanmak üzere (%${last}, ${workTotal} iş, %${wastedPct} boş): yöntem verimli, kapasite artırılabilir`
        : `pencere kapanmak üzere (%${last} kullanıldı / %${wastedPct} boşa gidiyor, açık iş ${road.openCount}): tempoyu/paralelliği artır`;
    return { status, last, turns, slow: 0, fast: 0, out: 0, commits, tasksDone, avgWorkPerTurn, efficiency, wastedPct, resets: usage.fiveResetsAt, hint };
}

function applySafeConfigTune(cfg, status, opts = {}) {
    const gatesCfg = (cfg.autonomy && cfg.autonomy.gates) || {};
    const officeCfg = (cfg.autonomy && cfg.autonomy.office) || {};
    const delegateCfg = cfg.delegate || {};
    const maxLanes = Math.max(1, Number(officeCfg.maxLanes) || 4);
    const curBand = Number(gatesCfg.paceBand) || 8;
    const curLanes = Number(delegateCfg.lanes) || 3;
    let nextBand = curBand;
    let nextLanes = curLanes;

    if (status === "underutilized") {
        nextBand = Math.max(4, curBand - 2);
        nextLanes = Math.min(maxLanes, curLanes + 1);
    } else if (status === "high_efficiency_underutilized") {
        nextLanes = Math.min(maxLanes, curLanes + 1);
        nextBand = Math.max(4, curBand - 1);
    } else if (status === "saturated") {
        nextBand = Math.min(16, curBand + 2);
        nextLanes = Math.max(1, curLanes - 1);
    }

    const changes = [];
    if (nextBand !== curBand) changes.push(`paceBand ${curBand}→${nextBand}`);
    if (nextLanes !== curLanes) changes.push(`delegate.lanes ${curLanes}→${nextLanes}`);
    if (!changes.length) return changes;

    cfg.autonomy = cfg.autonomy || {};
    cfg.autonomy.gates = cfg.autonomy.gates || {};
    cfg.autonomy.gates.paceBand = nextBand;
    cfg.delegate = cfg.delegate || {};
    cfg.delegate.lanes = nextLanes;

    if (cfg.root && opts.writeConfig !== false) {
        const cfgFile = path.join(cfg.root, CONFIG_REL);
        if (exists(cfgFile)) {
            const raw = readJson(cfgFile, null);
            if (raw && typeof raw === "object") {
                raw.autonomy = raw.autonomy || {};
                raw.autonomy.gates = raw.autonomy.gates || {};
                raw.autonomy.gates.paceBand = nextBand;
                raw.delegate = raw.delegate || {};
                raw.delegate.lanes = nextLanes;
                writeJson(cfgFile, raw);
            }
        }
    }
    return changes;
}

// Detect closed or about-to-expire 5h windows, weigh work vs quota, self-tune bounds, and log decrees.
export function evaluateWindowAndTune(cfg, state, usage, now = new Date(), opts = {}) {
    const empty = { tuned: false, verdict: null, decree: null, changes: [], lines: [] };
    if (!cfg || !state || !usage || typeof usage.five !== "number" || !Number.isFinite(usage.five)) return empty;

    const nowDate = now instanceof Date ? now : new Date(now);
    const gatesCfg = (cfg.autonomy && cfg.autonomy.gates) || {};
    const officeCfg = (cfg.autonomy && cfg.autonomy.office) || {};
    const exit = Number.isFinite(gatesCfg.fiveHourExit) ? gatesCfg.fiveHourExit : 90;
    const history = Array.isArray(state.windowHistory) ? state.windowHistory : [];
    const road = roadmapStats(cfg);
    if (!Array.isArray(state.tunedWindows)) state.tunedWindows = [];
    const tunedSet = new Set(state.tunedWindows);

    const curResets = usage.fiveResetsAt || null;
    let cut = history.length;
    while (cut > 0 && curResets && sameWindow(history[cut - 1].resets, curResets)) cut--;
    const prevHistory = history.slice(0, cut).filter((r) => Boolean(r && r.resets));
    const curHistory = history.slice(cut);

    let verdict = null;
    let targetResets = null;
    let triggerKind = null;

    if (curResets && prevHistory.length > 0) {
        const rev = paceReview(prevHistory, { five: usage.five, resets: curResets }, gatesCfg, { openRoadmapItems: road.openCount });
        if (rev) {
            const k = windowKey(rev.resets);
            if (k && !tunedSet.has(k)) {
                verdict = rev;
                targetResets = k;
                triggerKind = "closed";
            }
        }
    }

    if (!verdict && curResets) {
        const resetsMs = Date.parse(curResets);
        const k = windowKey(curResets);
        if (Number.isFinite(resetsMs) && k && !tunedSet.has(k)) {
            const minutesLeft = Math.max(0, Math.round((resetsMs - nowDate.getTime()) / 60000));
            if (minutesLeft <= 15 && usage.five < exit - 15 && road.openCount > 0) {
                verdict = summarizeExpiringWindow(curHistory, usage, exit, road);
                targetResets = k;
                triggerKind = "expiring";
            }
        }
    }

    if (!verdict) return empty;

    // Record window key in cooldown list even for balanced windows so we never re-judge the same closed window.
    state.tunedWindows.push(targetResets);
    if (state.tunedWindows.length > MAX_TUNED_WINDOWS) {
        state.tunedWindows = state.tunedWindows.slice(-MAX_TUNED_WINDOWS);
    }

    const actionable = verdict.status === "underutilized" || verdict.status === "high_efficiency_underutilized" || verdict.status === "saturated";
    if (!actionable) {
        return {
            tuned: false,
            verdict,
            decree: null,
            changes: [],
            lines: [`GEÇEN_PENCERE: son %${verdict.last}, ${verdict.turns} tur (${verdict.commits} commit) → ${verdict.hint}`]
        };
    }

    const autoTune = officeCfg.autoTune !== false;
    const changes = autoTune ? applySafeConfigTune(cfg, verdict.status, opts) : [];
    const actionText = changes.length
        ? `Ayar: ${changes.join(", ")}`
        : (autoTune
            ? (verdict.status === "saturated" ? "Ayar sınırda; iş parçasını küçült" : "Ayar sınırda; iş ağırlığını ve görev grubunu büyüt")
            : "autoTune kapalı; öneri kaydedildi");
    const reasonPrefix = triggerKind === "expiring" ? "Pencere sıfırlanmak üzere" : "Pencere kapandı";
    const decreeBody = `**${verdict.status}** (${reasonPrefix}): %${verdict.last} kullanıldı (%${verdict.wastedPct} boş, ${verdict.turns} tur, ${verdict.commits} commit, açık iş: ${road.openCount}). ${actionText}.`;
    const decree = cfg.root ? appendDecree(cfg, decreeBody, nowDate) : decreeBody;

    const outLines = [
        `GEÇEN_PENCERE: son %${verdict.last}, ${verdict.turns} tur (${verdict.commits} commit, verim=${verdict.efficiency}) → ${verdict.hint}`,
        `KARARNAME: ${decree}`
    ];
    if (changes.length) outLines.push(`OFIS_AYAR: ${changes.join(", ")}`);

    return { tuned: changes.length > 0, verdict, decree, changes, lines: outLines };
}

// Inspect recent cycle efficiency, idle streaks, high burn without commits, recovery, and active decrees.
export function auditMethodology(cfg, state, g, now = new Date(), opts = {}) {
    const out = [];
    if (g && g.pace && g.pace.summary) out.push(`TEMPO: ${g.pace.summary}`);
    else if (g && g.pace) out.push(`TEMPO: ${g.pace.mode} (hedef çizgi %${g.pace.target}, fark ${g.pace.diff})`);

    const officeCfg = (cfg && cfg.autonomy && cfg.autonomy.office) || {};
    const watchdog = (cfg && cfg.autonomy && cfg.autonomy.watchdog) || {};
    const pivotCycles = Math.max(1, Number(officeCfg.strategyPivotCycles) || Number(watchdog.idleCyclesChangeApproach) || 2);
    const idleCycles = Number(state && state.idleCycles) || 0;
    const history = Array.isArray(state && state.windowHistory) ? state.windowHistory : [];
    const recent = history.slice(-6);

    const recentCommits = recent.reduce((s, r) => s + (Number(r.commits) || 0), 0);
    let recentBurn = 0;
    for (let i = 1; i < recent.length; i++) {
        if (!recent[i].resets || !recent[i - 1].resets || sameWindow(recent[i].resets, recent[i - 1].resets)) {
            const d = (Number(recent[i].five) || 0) - (Number(recent[i - 1].five) || 0);
            if (d > 0) recentBurn += d;
        }
    }
    recentBurn = Math.round(recentBurn * 10) / 10;
    const burnPerCommit = recentCommits > 0 && recentBurn > 0 ? Math.round((recentBurn / recentCommits) * 10) / 10 : null;

    const rec = Array.isArray(opts.recovery) ? opts.recovery : (cfg && cfg.root ? find(cfg, now) : []);
    const nonDirtyRec = rec.filter((x) => x.id !== "kirli-agac");
    const activeDecrees = readDecrees(cfg);

    if (idleCycles >= pivotCycles || (recent.length >= 2 && recentBurn >= 12 && recentCommits === 0)) {
        out.push(
            `OFIS_MUHAKEMESI: YAKLASIM_DEGISTIR (${idleCycles} çevrimdir commit yok` +
            (recentBurn > 0 ? `, son yakım ~%${recentBurn}` : "") +
            "; mevcut yöntemde ısrar etme — kök nedene in, mimariyi/aracı değiştir ve kararını .evrim/otonom/KARARNAMELER.md'ye yaz)"
        );
    } else if (nonDirtyRec.length > 0) {
        out.push(`OFIS_MUHAKEMESI: kurtarma bekliyor (${nonDirtyRec.map((x) => x.id).join(", ")}); yeni işe geçmeden önce durumu temizle`);
    } else if (recent.length >= 2) {
        out.push(
            `OFIS_MUHAKEMESI: son ${recent.length} gözlemde ${recentCommits} commit` +
            (recentBurn > 0 ? `, yakım ~%${recentBurn}` : "") +
            (burnPerCommit !== null ? ` (commit başı ~%${burnPerCommit})` : "") +
            (activeDecrees.length ? `; aktif kararname: ${activeDecrees.length}` : "")
        );
    } else {
        out.push(
            `OFIS_MUHAKEMESI: çevrim ${(Number(state && state.total) || 0) + 1}, verimliliği commit/kota oranıyla izle` +
            (activeDecrees.length ? `; aktif kararname: ${activeDecrees.length}` : "")
        );
    }

    for (const d of activeDecrees.slice(-2)) out.push(`KARARNAME: ${d}`);
    out.push("ACIK_CERCEVE: Sadece yazılı kuralları izleme; mimari, tempo, araç eksikliği veya verimlilikte bulduğun her iyileştirmeyi inisiyatif alıp uygula ve kalıcı kararname olarak .evrim/otonom/KARARNAMELER.md'ye yaz.");
    return out;
}

function splitCmd(cmd) {
    if (Array.isArray(cmd) && cmd.length > 0) return [String(cmd[0]), cmd.slice(1).map(String)];
    if (typeof cmd === "string" && cmd.trim()) {
        const tokens = (cmd.match(/"[^"]*"|'[^']*'|\S+/g) || []).map((t) =>
            (t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'")) ? t.slice(1, -1) : t
        );
        if (tokens.length > 0) return [tokens[0], tokens.slice(1)];
    }
    return null;
}

// Verify if the project reached its final form (BITTI): kurulum === "tamam", ROADMAP done >= 1 & open === 0,
// deliverable exists on disk (if configured), and verifyCmd succeeds (if configured).
export function checkFinalForm(cfg, _state = null, opts = {}) {
    const base = { done: false, reason: "", deliverable: null, deliverablePath: null, verifyOk: null, openCount: 0, doneCount: 0, criteria: [] };
    if (!cfg || !cfg.root) return { ...base, reason: "proje yapılandırması yok" };
    if (cfg.kurulum !== "tamam") return { ...base, reason: `kurulum henüz tamamlanmadı (${cfg.kurulum || "bekliyor"})` };

    const road = roadmapStats(cfg);
    if (!road.exists) return { ...base, reason: "yol haritası dosyası bulunamadı" };
    if (road.openCount > 0) return { ...base, openCount: road.openCount, doneCount: road.doneCount, reason: `yol haritasında ${road.openCount} açık madde var` };
    if (road.doneCount < 1) return { ...base, openCount: 0, doneCount: 0, reason: "yol haritasında tamamlanmış (- [x]) madde yok" };

    const ff = (cfg.finalForm && typeof cfg.finalForm === "object") ? cfg.finalForm : {};
    const criteria = Array.isArray(ff.criteria) ? ff.criteria : [];
    let deliverable = null;
    let deliverablePath = cfg.root;

    if (typeof ff.deliverable === "string" && ff.deliverable.trim()) {
        deliverable = ff.deliverable.trim();
        deliverablePath = path.resolve(cfg.root, deliverable);
        if (!exists(deliverablePath)) {
            return { ...base, openCount: 0, doneCount: road.doneCount, deliverable, deliverablePath, verifyOk: false, criteria, reason: `nihai çıktı bulunamadı: ${deliverable}` };
        }
    }

    // A desktop app with self-test steps is done only when its last `cv check` round passed (M4 done contract).
    const ck = cfg.check || {};
    if (ck.enabled !== false && ck.selfTest && Array.isArray(ck.selfTest.steps) && ck.selfTest.steps.length && !opts.skipCheck) {
        const last = (opts.lastRound || defaultLastRound)(cfg);
        if (!last || !last.passed) return { ...base, openCount: 0, doneCount: road.doneCount, deliverable, deliverablePath, verifyOk: false, criteria, reason: last ? `son cv check turu (${last.round}) geçmedi` : "cv check henüz koşmadı (pencere + --self-test)" };
    }

    let verifyOk = null;
    const parts = splitCmd(ff.verifyCmd);
    if (parts) {
        if (opts.skipVerify) {
            verifyOk = null;
        } else {
            const runFn = typeof opts.run === "function" ? opts.run : run;
            const timeoutMs = (Number(cfg.testMinutes) || 5) * 60000;
            let r = runFn(parts[0], parts[1], { cwd: cfg.root, timeoutMs });
            if (r && r.missing && process.platform === "win32" && !/\.(cmd|exe|bat)$/i.test(parts[0])) {
                r = runFn(parts[0] + ".cmd", parts[1], { cwd: cfg.root, timeoutMs });
            }
            if (!r || !r.ok) {
                const detail = r ? (r.timedOut ? "zaman aşımı" : `çıkış ${r.code}`) : "çalıştırılamadı";
                return { ...base, openCount: 0, doneCount: road.doneCount, deliverable, deliverablePath, verifyOk: false, criteria, reason: `finalForm doğrulaması başarısız (${detail})` };
            }
            verifyOk = true;
        }
    }

    return {
        done: true,
        reason: `yol haritası tamamlandı (${road.doneCount} madde` + (deliverable ? `, çıktı: ${deliverable}` : "") + ")",
        deliverable,
        deliverablePath,
        verifyOk,
        openCount: 0,
        doneCount: road.doneCount,
        criteria
    };
}
