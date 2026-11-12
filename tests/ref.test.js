// cv ref (naming, index, side-by-side page) and cv probe (plugin, time limit, output cap, screenshot names).
import fs from "node:fs";
import path from "node:path";
import { test, tmpDir, eq, ok } from "./harness.js";
import { readJson, readText, writeText } from "../core/lib/util.js";
import { loadConfig } from "../core/lib/config.js";
import { init } from "../core/cli/init.js";
import * as ref from "../core/reference/ref.js";
import * as probe from "../core/probe/probe.js";

function project(label) {
    const dir = tmpDir(label);
    init(dir, { name: "ref" });
    return loadConfig(dir);
}
const touch = (p) => writeText(p, "x");

test("ref: ad kuralı (Türkçe harf, menü yolu, üç nokta)", () => {
    eq(ref.slug("Görüntü/Ayarlar/Düzeyler..."), "goruntu__ayarlar__duzeyler");
    eq(ref.slug("Image > Adjustments > Hue/Saturation…"), "image__adjustments__hue__saturation");
    eq(ref.slug("  Şekil  Çiz (İleri) "), "sekil_ciz_ileri");
    eq(ref.keyOf("dir/file__open-2.png"), "file__open");
});

test("ref: indeks ve yan yana sayfa; eksikler listelenir, ad kaçışlı", () => {
    const cfg = project("ref");
    const rd = path.join(cfg.root, cfg.reference.dir), od = path.join(cfg.root, cfg.reference.shotsDir);
    for (const f of ["file__open.png", "file__open-2.png", "edit__undo.jpg", "intro.mp4", "notes.txt"]) touch(path.join(rd, f));
    for (const f of ["file__open.png", "window__a&b.png"]) touch(path.join(od, f));
    const r = ref.index(cfg);
    eq(r.items.map((i) => [i.name, i.files.length, i.kind]), [["edit__undo", 1, "image"], ["file__open", 2, "image"], ["intro", 1, "video"]]);
    eq(readJson(r.file).items.length, 3);
    const c = ref.compare(cfg);
    eq([c.both, c.onlyRef, c.onlyOurs], [1, 2, 1]);
    const html = readText(c.out);
    ok(html.includes("<th>file__open</th>") && html.includes("<small>+1</small>"), "eşleşme satırı");
    ok(html.includes("window__a&amp;b") && !html.includes("window__a&b"), "ad kaçışlı");
    ok(/src="\.\.\/\.\.\/references\/shots\/file__open\.png"/.test(html), "göreli yol: " + (html.match(/src="[^"]+"/) || [""])[0]);
    ok(!fs.existsSync(path.join(cfg.root, ".evrim/state/references")), "görüntü kopyalanmaz");
});

test("probe: eklenti yoksa açık hata; varsa sonuç JSON, kesilir, zaman sınırı, ekran adı", async () => {
    const cfg = project("probe");
    let msg = "";
    try { await probe.probe(cfg, { preset: "x" }); } catch (e) { msg = e.message; }
    ok(/probe\.plugin/.test(msg), "eklentisiz hata: " + msg);
    writeText(path.join(cfg.root, ".evrim/plugins/probe.js"), `export default {
        name: "sahte", presets: { big: "uzun çıktı", slow: "asılır", shot: "ekran" },
        async run({ preset, script, args }, ctx) {
            if (preset === "big") return { s: "a".repeat(5000) };
            if (preset === "slow") return new Promise(() => {});
            if (preset === "shot") return { file: ctx.shot("Dosya/Aç...") };
            return { script, args };
        }
    };\n`);
    cfg.probe.plugin = ".evrim/plugins/probe.js";
    eq(Object.keys(await probe.presets(cfg)), ["big", "slow", "shot"]);
    const s = await probe.probe(cfg, { script: "return 1", args: { a: "b" } });
    eq(JSON.parse(s.text), { script: "return 1", args: { a: "b" } });
    const big = await probe.probe(cfg, { preset: "big", max: 100 });
    ok(big.truncated && big.text.includes("karakter kesildi") && big.text.length < 200, "kesildi");
    msg = "";
    try { await probe.probe(cfg, { preset: "slow", timeoutSeconds: 0.2 }); } catch (e) { msg = e.message; }
    ok(/zaman aşımı/.test(msg), "zaman sınırı: " + msg);
    const shot = JSON.parse((await probe.probe(cfg, { preset: "shot" })).text);
    ok(shot.file.replace(/\\/g, "/").endsWith(".evrim/state/shots/dosya__ac.png"), "ekran adı: " + shot.file);
    msg = "";
    try { await probe.probe(cfg, { preset: "yok" }); } catch (e) { msg = e.message; }
    ok(/bilinmeyen/.test(msg), "bilinmeyen hazır yoklama");
});
