// Benchmark 2026-11-21 (concrete request "make me an Obsidian-like app"): the setup skill forbade code and
// forced a mock-up, so the owner got a fake screen while a plain run delivered a working app. These tests lock
// the fix: a concrete request is done at once, rules are defaults, design guidance ships with every project.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, ok, tmpDir } from "./harness.js";

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => fs.readFileSync(path.join(PKG_ROOT, rel), "utf8");

test("esnek çekirdek: cv-init isteği okur, somut işte hemen yapar, maket kapısı yok (tr+en)", () => {
    const tr = read("skills/tr/cv-init/SKILL.md"), en = read("skills/en/cv-init/SKILL.md");
    ok(tr.includes("## 0b. Önce isteği oku") && tr.includes("**Somut iş**") && tr.includes("çalışan dikey dilim"), "tr yönlendirici");
    ok(en.includes("## 0b. Read the request first") && en.includes("**Concrete job**") && en.includes("working vertical slice"), "en yönlendirici");
    ok(!tr.includes("Kazma kürek (kod yazma) bu görüşmede yok") && !en.includes("No digging (code) in this conversation"), "kod yasağı kalktı");
    ok(tr.includes("maket asla \"teslim\" diye sunulmaz") && en.includes("never offered as a delivery"), "maket teslim değildir");
    ok(tr.includes("cv intent coverage --delivered") && en.includes("cv intent coverage --delivered"), "karşılama tablosu");
    ok(tr.includes("paketin kodunu okuma") && en.includes("do not read the package code"), "komut tablosu");
});

test("esnek çekirdek: şablonlar ve makine becerisi 'ilk mesaj ne olursa olsun' demez", () => {
    for (const rel of ["templates/project/AGENTS.md", "templates/project-en/AGENTS.md", "templates/user/claudevolution/SKILL.md"]) {
        const t = read(rel);
        ok(!/ne olursa olsun|whatever the (owner's )?first message is/.test(t), rel + " zorunlu görüşme dili kalmadı");
    }
});

test("tasarım: ölçütlü öz-denetim ve referans çıkarma (tr+en); serbest övgü yasak", () => {
    const tr = read("skills/tr/desktop-design/SKILL.md"), en = read("skills/en/desktop-design/SKILL.md");
    ok(tr.includes("madde madde evet/hayır") && en.includes("item by item, yes/no"), "puanlı kontrol");
    ok(tr.includes("hatayı yeniden üret") && en.includes("reproduce it"), "hatayı yeniden üret");
    ok(tr.includes("width_range") && en.includes("width_range"), "egui sabit panel ipucu");
});

test("tasarım kütüphanesi: yerleşik beceriler her projeye kurulur, lisansı yanında", async () => {
    ok(fs.existsSync(path.join(PKG_ROOT, "skills/library/frontend-design-anthropic/LICENSE.txt")), "Apache lisans metni");
    const { init } = await import("../core/cli/init.js");
    const p = tmpDir("lib");
    init(p, { name: "lib" });
    for (const s of ["design-foundations-tr", "beautiful-ui-builder-tr", "ui-design-review-tr", "frontend-design-anthropic"]) {
        ok(fs.existsSync(path.join(p, ".claude/skills", s, "SKILL.md")), s + " kuruldu");
    }
});
