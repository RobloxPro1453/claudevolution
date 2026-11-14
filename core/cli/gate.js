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
    let g, rowFive, rowWeek, rowResets = null, source = "args";
    if (usage) {
        rememberQuota(cfg, usage);
        g = gate(usage, cfg.autonomy);
        rowFive = usage.five;
        rowWeek = usage.week;
        rowResets = usage.fiveResetsAt || null;
    } else if (args.auto) {
        g = gate({ five: "unknown", week: "unknown" }, cfg.autonomy, new Date(), { autoFallback: true, root: cfg.root, cfg });
        if (g.quotaSource === "local-blocks") {
            source = "local-blocks";
            rowFive = g.five;
            rowWeek = g.week;
            rowResets = g.fiveResetsAt || null;
            rememberQuota(cfg, { five: g.five, week: g.week, fiveResetsAt: rowResets, weekResetsAt: null, source: "local-blocks" });
        } else {
            console.log(`KARAR: ${g.decision}\nNEDEN: ${g.reason} (yerel Claude oturum bloğu bulunamadı)\nUYKU: ${g.sleepSeconds}`);
            return 0;
        }
    } else {
        console.log("KARAR: KUCUK\nNEDEN: kota verilmedi ya da okunamadı (--five N --week N ya da --auto); yalnız tek küçük adım\nUYKU: 1800");
        return 0;
    }

    const lines = [
        `KARAR: ${g.decision}`,
        `NEDEN: ${g.reason}`,
        `UYKU: ${g.sleepSeconds}`,
        ...(source === "local-blocks" ? [
            `KOTA_KAYNAGI: local-blocks`,
            `YAKMA_HIZI: ${g.burnRate} tok/dk (tahmini blok sonu: ${g.projectedTokens} token, alt ajan: ${g.subagentCount})`
        ] : []),
        `HAFTALIK_TAVAN: %${g.ceiling} (haftanın %${Math.round(g.f * 100)}'i geçti)`
    ];
    console.log(lines.join("\n"));
    if (g.pace) console.log(`TEMPO: ${g.pace.mode} (5s %${rowFive}, hedef çizgi %${g.pace.target}, fark ${g.pace.diff}); YAVAS = hafif iş, HIZLAN = ağır iş serbest`);
    const log = path.join(cfg.root, ".evrim", "state", "tempo.jsonl");
    let rows = [];
    try { rows = fs.readFileSync(log, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)); } catch { /* first call */ }
    const row = { at: new Date().toISOString(), five: rowFive, week: rowWeek, resets: rowResets, decision: g.decision, mode: g.pace ? g.pace.mode : null, source };
    try { fs.mkdirSync(path.dirname(log), { recursive: true }); fs.appendFileSync(log, JSON.stringify(row) + "\n"); } catch { /* logging must never block the gate */ }
    const r = paceReview(rows, row, cfg.autonomy.gates);
    if (r) console.log(`GEÇEN_PENCERE: son %${r.last}, ${r.turns} tur (YAVAS ${r.slow}, HIZLAN ${r.fast}, CIK ${r.out}) → ${r.hint}`);
    return 0;
}
