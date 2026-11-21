// ProMax M4: subtext engine (cv intent), stack choice and the Rust skeleton (cv stack), layer check, contrast,
// one-approval prerequisites, new skills reaching old projects. No network, no model. The real Rust build of
// the skeleton runs only with CV_TEMPLATE_BUILD=1 (minutes; verified 2026-11-21, core/stack/README.md).
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { eq, ok, test, tmpDir } from "./harness.js";
import { git, readJson, readText, run, writeJson, writeText } from "../core/lib/util.js";
import { loadConfig } from "../core/lib/config.js";
import { init } from "../core/cli/init.js";
import { card, classify, coverage, likeWhat, renderIntent } from "../core/intent/intent.js";
import { crateName, scaffold, suggest } from "../core/stack/stack.js";
import { contrastRatio, layersCheck, runChecks } from "../core/check/check.js";
import { install, missing, plan } from "../core/cli/prereq.js";
import { migrate, planUpdate } from "../core/cli/migrate.js";
import { main as cliMain } from "../bin/cv.js";

function project(label) {
    const dir = tmpDir(label);
    git(["init", "-q", "-b", "main"], dir);
    for (const [k, v] of [["user.email", "test@example.invalid"], ["user.name", "test"], ["commit.gpgsign", "false"]]) git(["config", k, v], dir);
    init(dir, { name: label });
    git(["add", "-A"], dir); git(["commit", "-qm", "init"], dir);
    return dir;
}
const quiet = async (argv) => { const o = console.log; const logs = []; console.log = (...a) => logs.push(a.join(" ")); try { return { code: await cliMain(argv), out: logs.join("\n") }; } finally { console.log = o; } };

test("intent: kısa istekten tür, söylenmeyen beklentiler, yalnız gerekli sorular; benzetme ayrı sorulur", () => {
    eq(classify("Obsidian gibi not uygulaması")[0].id, "notes");
    eq(classify("bütçe tablosu, excel gibi")[0].id, "table");
    eq(classify("xyz qqq"), []);
    eq([likeWhat("Obsidian gibi bir şey"), likeWhat("something like Notion"), likeWhat("sade bir araç")], ["Obsidian", "Notion", null]);
    const c = card("Obsidian gibi notlarım için program, her not ayrı dosya olsun");
    eq(c.kind, "notes");
    ok(c.expectations.some((e) => e.id === "no-data-loss") && c.expectations.some((e) => e.id === "search"), "ortak + türe özgü beklentiler");
    eq(c.questions.find((q) => q.id === "storage").answered, 0, "istekte söylenen soru sorulmaz");
    eq(c.questions.find((q) => q.id === "panes").answered, null, "benzetilen ad seçeneği cevaplamaz");
    eq(c.questions[0].id, "like", "benzetmenin hangi yanı soruluyor");
    ok(c.questions.length <= 7);
    eq(c.selfTestSteps.slice(0, 2), ["create", "search"]);
    const md = renderIntent(c, { panes: 1 });
    ok(md.includes("[E:no-data-loss]") && md.includes("Anladığım şu") && md.includes("Obsidian gibi çok panel ve sekme") && md.includes("(istekte söylendi, sorulmadı)"), md.slice(0, 400));
    eq(card("küçük bir dönüştürücü", { kind: "media" }).kind, "media", "sahibin seçtiği tür");
    eq(card("tamamen bilinmeyen bir şey").kind, "tool", "eşleşme yoksa araç");
});

test("intent: --apply INTENT.md + self-test adımları yazar (var olanı ezmez); kapsam [E:] maddelerini planda arar", async () => {
    const dir = project("intent");
    const cfgFile = path.join(dir, ".evrim/config.json"), c = readJson(cfgFile);
    c.finalForm.criteria = ["sahibin ölçütü"];
    writeJson(cfgFile, c);
    const r = await quiet(["intent", "görev listesi ve ajanda", "--apply", "--dir", dir]);
    eq(r.code, 0, r.out);
    ok(readText(path.join(dir, "docs/INTENT.md")).includes("[E:done-toggle]"));
    const after = readJson(cfgFile);
    eq([after.check.selfTest.steps.includes("toggle"), after.finalForm.criteria], [true, ["sahibin ölçütü"]], "boş olanı doldurur, sahibinkini bırakır");
    await quiet(["intent", "görev listesi", "--apply", "--dir", dir]);
    ok(fs.existsSync(path.join(dir, "docs/INTENT.md.new")), "ikinci kez: .new yanına");
    const cfg = loadConfig(dir);
    const before = coverage(cfg);
    ok(before.missing.length === before.ids.length && before.ids.length > 5);
    writeText(path.join(dir, "docs/ROADMAP.md"), "# Yol\n" + before.ids.map((id) => `- [ ] iş [E:${id}]`).join("\n") + "\n");
    eq(coverage(cfg).missing, []);
    eq((await quiet(["intent", "coverage", "--dir", dir])).code, 0);
});

test("stack: öneri sahibin sözüne uyar; iskelet yer tutucuları doldurur, var olan dosyaya dokunmaz", () => {
    eq(suggest("basit zamanlayıcı").stack, "rust-egui");
    eq(suggest("içinde web sayfası gösteren html editörü").stack, "rust-tauri");
    eq(suggest("web sayfası gösteren ama egui ile olsun").stack, "rust-egui", "söz varsayılandan üstün");
    eq([crateName("Deneme Notlar!"), crateName("Işık Ölçer"), crateName("2048")], ["deneme-notlar", "isik-olcer", "app-2048"]);
    const dir = tmpDir("scaffold");
    writeText(path.join(dir, "src/engine.rs"), "// sahibinin dosyası\n");
    const r = scaffold("rust-egui", dir, { name: "Deneme Notlar", title: "Deneme Notlar" });
    eq([r.crate, r.kept], ["deneme_notlar", ["src/engine.rs"]]);
    eq(readText(path.join(dir, "src/engine.rs")), "// sahibinin dosyası\n");
    const cargo = readText(path.join(dir, "Cargo.toml")), main = readText(path.join(dir, "src/main.rs"));
    ok(cargo.includes('name = "deneme_notlar"') && cargo.includes('default-run = "deneme_notlar"') && !/\{\{/.test(cargo + main), "yer tutucu kalmadı");
    ok(main.includes('windows_subsystem = "windows"') && main.includes("--self-test") && main.includes("with_active(false)") && readText(path.join(dir, ".cargo/config.toml")).includes("+crt-static"));
});

test("check: katman sınırı (motorda pencere/disk yok, arayüzde disk yok) ve WCAG kontrastı", () => {
    const dir = tmpDir("layers");
    eq(layersCheck(dir), null, "motor dosyası yoksa denetim yok");
    writeText(path.join(dir, "src/engine.rs"), "// egui::Context burada yorum\npub fn add() {}\n");
    writeText(path.join(dir, "src/ui.rs"), "use eframe::egui;\n");
    eq(layersCheck(dir).passed, true);
    writeText(path.join(dir, "src/engine/io.rs"), "pub fn save() { std::fs::write(\"a\", \"b\").unwrap(); }\n");
    writeText(path.join(dir, "src/ui.rs"), "fn x() { let _ = std::fs::read(\"a\"); }\n");
    const r = layersCheck(dir);
    eq([r.passed, r.claims.filter((c) => !c.passed).map((c) => c.title.split(":")[0])], [false, ["src/engine/io.rs", "src/ui.rs"]]);
    eq([contrastRatio("#000000", "#ffffff"), contrastRatio("#ffffff", "#000000")], [21, 21]);
    ok(contrastRatio("#777777", "#ffffff") < 4.5 && contrastRatio("#595959", "#ffffff") >= 7, "gri metin sınırları");
});

test("prereq: eksik araç planı tek soru; --yes olmadan hiçbir şey kurulmaz; Rust yoksa C++ araçları da", async () => {
    const dir = tmpDir("prereq");
    writeText(path.join(dir, "Cargo.toml"), "[package]\nname = \"x\"\n[dependencies]\ntauri = \"2\"\n");
    const items = missing(dir, {}, { have: (c) => c === "git", webview2: () => false, platform: "win32" });
    eq(items.map((i) => i.id), ["rust", "vs-build-tools", "webview2"]);
    ok(/Şunlar eksik \(3\), senin yerine kurayım mı\?/.test(plan(items)) && plan(items).includes("--install-deps --yes"));
    eq(plan([]), "Eksik araç yok: her şey kurulu.");
    eq(missing(dir, {}, { have: () => true, webview2: () => true, platform: "win32" }), []);
    const calls = [];
    const res = install(items.slice(0, 1), { runner: (cmd, args) => { calls.push([cmd, ...args].join(" ")); return { ok: true, code: 0, text: "" }; } });
    if (process.platform === "win32") eq([res[0].ok, calls[1]], [true, "winget install --id Rustlang.Rustup -e --silent --accept-package-agreements --accept-source-agreements"]);
    else ok(!res[0].ok && /elle kurun/.test(res[0].note));
});

test("göç: M4 becerileri (desktop-design, clean-architecture, rust-desktop) eski projeye üç platformda eklenir, sahibinkiler kalır", () => {
    const dir = project("mig-m4");
    for (const base of [".claude/skills", ".codex/skills", ".agent/skills"]) for (const s of ["desktop-design", "clean-architecture", "rust-desktop"]) fs.rmSync(path.join(dir, base, s), { recursive: true, force: true });
    writeText(path.join(dir, ".claude/skills/benim/SKILL.md"), "---\nname: benim\n---\nbenim\n");
    git(["add", "-A"], dir); git(["commit", "-qm", "old"], dir);
    const p = planUpdate(dir);
    for (const base of [".claude/skills", ".codex/skills", ".agent/skills"]) ok(p.items.some((i) => i.rel === `${base}/rust-desktop/SKILL.md` && i.kind === "yeni"), base);
    ok(p.kept.some((k) => k.includes("benim")));
    migrate(dir, p);
    ok(fs.existsSync(path.join(dir, ".agent/skills/desktop-design/SKILL.md")) && readText(path.join(dir, ".claude/skills/benim/SKILL.md")).includes("benim"));
});

test("şablon gerçek derleme (yalnız CV_TEMPLATE_BUILD=1): cargo build + cv check GEÇTİ", async () => {
    if (process.env.CV_TEMPLATE_BUILD !== "1") return;
    const dir = project("tmpl-build");
    scaffold("rust-egui", dir, { name: "Tmpl Deneme" });
    const c = readJson(path.join(dir, ".evrim/config.json"));
    Object.assign(c, { build: ["cargo", "build", "--release"], finalForm: { ...c.finalForm, deliverable: `target/release/tmpl_deneme${process.platform === "win32" ? ".exe" : ""}` } });
    c.check.selfTest = { steps: ["create", "save", "reopen", "search"] };
    writeJson(path.join(dir, ".evrim/config.json"), c);
    ok(run("cargo", ["test", "--release"], { cwd: dir, timeoutMs: 20 * 60000 }).ok, "cargo test");
    const r = await runChecks(loadConfig(dir));
    ok(r.passed, JSON.stringify(r.results.map((x) => [x.id, x.passed, x.note])));
});
