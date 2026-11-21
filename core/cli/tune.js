// cv tune [--apply] [--evaluate] [--json]
// Hypothesis-driven self-tuning, layer 1 (core/autonomy/autotune.js): signals from the cheap model's runs,
// at most one bounded trial of one whitelisted setting, judged after K runs (kept or reverted + lesson).
import { project } from "./_project.js";
import { apply, evaluate, loadHyp, propose, runs, signals } from "../autonomy/autotune.js";

export async function run(args) {
    const cfg = project(args);
    if (args.evaluate) {
        const e = evaluate(cfg);
        console.log(e.result ? `DENEME ${e.trial.id}: ${e.result === "kept" ? "TUTULDU" : "GERİ ALINDI (ders yazıldı)"} — ${e.trial.key} ${e.trial.from} → ${e.trial.to}` : `Ölçülecek deneme yok: ${e.why}`);
        if (!args.apply) return 0;
    }
    const list = runs(cfg), p = propose(cfg, list);
    if (args.json) { console.log(JSON.stringify({ signals: signals(list.slice(-20)), proposal: p.proposal, why: p.why, trials: loadHyp(cfg.root).trials })); return 0; }
    const s = signals(list.slice(-20));
    console.log(`Sinyaller (son ${Math.min(20, list.length)} koşu): ${s.runs ? `adım sınırında duran %${Math.round(s.stepCap * 100)}, ilk denemede biten ${s.firstTryDone === null ? "-" : "%" + Math.round(s.firstTryDone * 100)}, önbellek isabeti ${s.cacheHit === null ? "-" : "%" + Math.round(s.cacheHit * 100)}, ortalama ${s.avgSteps} adım` : "koşu yok"}`);
    if (!p.proposal) { console.log(`Öneri yok: ${p.why}`); return 0; }
    console.log(`HİPOTEZ: ${p.proposal.key} ${p.proposal.from} → ${p.proposal.to} çünkü ${p.why}; beklenen: ${p.proposal.expect.metric} ${p.proposal.expect.direction === "down" ? "azalır" : "artar"}.`);
    if (!args.apply) { console.log("Denemeyi başlatmak için: cv tune --apply (K koşu sonra cv tune --evaluate)"); return 0; }
    const t = apply(cfg, p.proposal);
    console.log(`Deneme başladı: ${t.id} (.evrim/hypotheses.json); config güncellendi.`);
    return 0;
}
