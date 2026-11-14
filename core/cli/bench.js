// cv bench [--live] [--baseline] [--no-save] [--json]
// Package benchmark (run inside the claudevolution checkout). Tiers A + B: zero model tokens.
// --live adds tier C (cheap model on a fake project, hard spending cap). --baseline accepts the result as the new baseline.
import path from "node:path";
import process from "node:process";
import * as bench from "../bench/bench.js";

export async function run(args) {
    const result = bench.measure();
    if (args.live) {
        const live = await import("../bench/live.js");
        result.C = await live.run({ cap: args.cap });
    }
    const base = bench.loadBaseline();
    const cmp = bench.compare(result, base);
    if (args.json) { console.log(JSON.stringify(result)); return cmp.ok ? 0 : 1; }
    console.log(`claudevolution ${result.version} · ölçüm ${result.date}`);
    if (result.A) console.log(`  Kat A  testler    ${result.A.passed}/${result.A.total} (${result.A.seconds} sn)`);
    console.log(`  Kat B  kaos       ${result.B.passed}/${result.B.total}`);
    for (const f of result.B.failed) console.log(`         ✗ ${f.id}: ${f.fails.join("; ")}`);
    if (result.C) console.log(`  Kat C  canlı      ${result.C.status === "tamam" ? `${result.C.solved}/${result.C.total} iş, tuzak ihlali ${result.C.trapViolations}, ${result.C.cost}` : "ölçülemedi: " + result.C.reason}`);
    else console.log("  Kat C  canlı      koşmadı (--live ile; ücretli)");
    console.log(`  boyut  kod ${result.sizes.codeLines} · beceri ${result.sizes.skillLines} · şablon ${result.sizes.templateLines} satır`);
    if (!base) console.log("  temel çizgi yok (cv bench --baseline ile kaydet)");
    for (const g of cmp.gates) console.log("  KAPI ✗ " + g);
    for (const w of cmp.worse) console.log("  kötü   " + w);
    for (const b of cmp.better) console.log("  iyi    " + b);
    console.log(cmp.ok ? "SONUÇ: GEÇTİ" : "SONUÇ: KALDI");
    if (!args["no-save"]) console.log("  kayıt: " + path.relative(process.cwd(), bench.save(result)));
    if (args.baseline) {
        if (!cmp.ok) { console.log("Kapılar kırmızıyken temel çizgi yazılmaz."); return 1; }
        bench.writeBaseline(result);
        console.log("  temel çizgi güncellendi: bench/baseline.json");
    }
    return cmp.ok ? 0 : 1;
}
