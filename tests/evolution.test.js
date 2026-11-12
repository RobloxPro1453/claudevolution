// distill helper and update plan.
import fs from "node:fs";
import path from "node:path";
import { test, tmpDir, eq, ok } from "./harness.js";
import { git, readText, writeText } from "../core/lib/util.js";
import { loadConfig, VERSION } from "../core/lib/config.js";
import { init } from "../core/cli/init.js";
import { classify, measures, pending } from "../core/cli/distill.js";
import { plan } from "../core/cli/update.js";

function project() {
    const dir = tmpDir("evo");
    git(["init", "-q"], dir);
    init(dir, { name: "dukkan" });
    return loadConfig(dir);
}

test("damıtma: ders sınıflama ipuçları", () => {
    const cfg = project();
    eq(classify("- Test koşarken derleme düşüyor → bekle [evrensel]", cfg), "aday");
    eq(classify("- Stok tablosu yavaş [yerel]", cfg), "yerel");
    eq(classify("- dukkan'ın rapor ekranı iki kez çiziliyor", cfg), "yerel?");
    eq(classify("- menu_map.json çakışınca iki tarafı tut", cfg), "yerel?");
    eq(classify("- Uzun çıktıyı okumak kotayı yiyor → kes", cfg), "aday?");
    eq(classify("- eski ders [evrensel→taşındı]", cfg), "taşındı");
});

test("damıtma: ölçüler tur ve çevrim kayıtlarından", () => {
    const cfg = project();
    eq(measures(cfg)["is-basina-kota"], null, "veri yokken null");
    writeText(path.join(cfg.root, cfg.metrics.file), [
        { round: 1, quotaStart: 10, quotaEnd: 14, delegate: { tasks: 10, firstTryDone: 6, endedDone: 8 } },
        { round: 2, quotaStart: 14, quotaEnd: 16, delegate: { tasks: 10, firstTryDone: 9, endedDone: 10 } }
    ].map((r) => JSON.stringify(r)).join("\n") + "\n");
    writeText(path.join(cfg.root, ".evrim/state/cycle.json"), JSON.stringify({ total: 8, wasted: 2 }));
    fs.appendFileSync(path.join(cfg.root, ".evrim/otonom/NOTLAR.md"), "Bu rengi beğenmedim\n");
    const m = measures(cfg);
    eq([m["is-basina-kota"], m["ilk-deneme-orani"], m["bosa-cevrim"], m["sahip-itirazi"]], [0.33, 0.75, 0.25, 1]);
});

test("damıtma: bekleyen evrim kayıtları", () => {
    const text = "# Evrim günlüğü\n- 2026-11-12 · tohum · — · — · tohum\n- 2026-11-13 · calis: test yalıtımı kuralı · ölçü: ilk-deneme-orani 0.75 · K=5 · sonuç: bekliyor\n- 2026-11-10 · x · sonuç: tuttu\n";
    eq(pending(text).length, 1);
});

test("update: taze kurulum günceldir; değişen beceri farkta görünür", () => {
    const cfg = project();
    eq(plan(cfg), []);
    const skill = path.join(cfg.root, ".claude/skills/durum/SKILL.md");
    writeText(skill, readText(skill).replace(`<!-- claudevolution ${VERSION} -->`, "<!-- claudevolution 0.0.1 -->"));
    eq(plan(cfg), [], "yalnız damga farkı güncelleme sayılmaz");
    writeText(skill, readText(skill) + "\neski bir satır\n");
    const p = plan(cfg);
    eq([p.length, p[0].rel, p[0].kind, p[0].removed], [1, ".claude/skills/durum/SKILL.md", "değişti", 1]);
    fs.rmSync(path.join(cfg.root, ".claude/skills/damit"), { recursive: true });
    ok(plan(cfg).some((i) => i.kind === "yeni" && i.rel.includes("damit")), "eksik beceri 'yeni' olarak görünmeli");
});
