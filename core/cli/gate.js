// cv gate --five N --week N [--five-resets ISO] [--week-resets ISO]
// Prints the decision for the current usage and remembers it as the last known quota.
// Each call is also logged (tempo.jsonl) so the pacing itself is measured: when a 5-hour window has closed,
// the next call prints how it ended (last %, how many YAVAS / HIZLAN turns) and a tuning hint.
import fs from "node:fs";
import path from "node:path";
import { project } from "./_project.js";
import { gate, paceReview } from "../autonomy/gates.js";
import { parseUsage, rememberQuota } from "../autonomy/cycle.js";

export async function run(args) {
    const cfg = project(args);
    const usage = parseUsage(args);
    if (!usage) { console.log("KARAR: KUCUK\nNEDEN: kota verilmedi ya da okunamadı (--five N --week N); yalnız tek küçük adım\nUYKU: 1800"); return 0; }
    rememberQuota(cfg, usage);
    const g = gate(usage, cfg.autonomy);
    console.log(`KARAR: ${g.decision}\nNEDEN: ${g.reason}\nUYKU: ${g.sleepSeconds}\nHAFTALIK_TAVAN: %${g.ceiling} (haftanın %${Math.round(g.f * 100)}'i geçti)`);
    if (g.pace) console.log(`TEMPO: ${g.pace.mode} (5s %${usage.five}, hedef çizgi %${g.pace.target}, fark ${g.pace.diff}); YAVAS = hafif iş, HIZLAN = ağır iş serbest`);
    const log = path.join(cfg.root, ".evrim", "state", "tempo.jsonl");
    let rows = [];
    try { rows = fs.readFileSync(log, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { /* first call */ }
    const row = { at: new Date().toISOString(), five: usage.five, week: usage.week, resets: usage.fiveResetsAt || null, decision: g.decision, mode: g.pace ? g.pace.mode : null };
    try { fs.mkdirSync(path.dirname(log), { recursive: true }); fs.appendFileSync(log, JSON.stringify(row) + "\n"); } catch { /* logging must never block the gate */ }
    const r = paceReview(rows, row, cfg.autonomy.gates);
    if (r) console.log(`GEÇEN_PENCERE: son %${r.last}, ${r.turns} tur (YAVAS ${r.slow}, HIZLAN ${r.fast}, CIK ${r.out}) → ${r.hint}`);
    return 0;
}
