// init, config validation, gates, lock, share, memory, cycle, recover, doctor parsing.
import fs from "node:fs";
import path from "node:path";
import { test, tmpDir, eq, ok, throws } from "./harness.js";
import { git, readJson, readText, writeJson, writeText } from "../core/lib/util.js";
import { defaults, isForbidden, loadConfig, safeRel, validate, detect, VERSION } from "../core/lib/config.js";
import { init } from "../core/cli/init.js";
import { gate, weekFraction, weeklyCeiling, sleepUntil } from "../core/autonomy/gates.js";
import { acquire, lockInfo, release } from "../core/autonomy/lock.js";
import * as share from "../core/autonomy/share.js";
import * as memory from "../core/autonomy/memory.js";
import { begin, end, loadState } from "../core/autonomy/cycle.js";
import { find, fix } from "../core/autonomy/recover.js";
import { powerSetting } from "../core/cli/doctor.js";

function gitProject(label) {
    const dir = tmpDir(label);
    git(["init", "-q"], dir);
    git(["config", "user.email", "test@example.invalid"], dir);
    git(["config", "user.name", "test"], dir);
    git(["config", "commit.gpgsign", "false"], dir);
    return dir;
}
function commitAll(dir, msg = "c") { git(["add", "-A"], dir); const r = git(["commit", "-qm", msg], dir); ok(r.ok, "commit: " + r.text); }
function project(label = "proj") {
    const dir = gitProject(label);
    init(dir, { name: "deneme" });
    commitAll(dir, "init");
    return loadConfig(dir);
}
const AUT = defaults().autonomy;
const at = (iso) => new Date(iso);

// ---------------------------------------------------------------- init
test("init: boş klasörde tam iskelet kurar", () => {
    const dir = tmpDir("init");
    const r = init(dir, { name: "ornek" });
    for (const f of ["AGENTS.md", "CHANGELOG.md", "docs/VISION.md", "docs/PROGRESS.md", "docs/ROADMAP.md", "docs/CHECKUP.md", "docs/KNOWLEDGE.md", "docs/ARCHITECTURE.md", "docs/DEVELOPMENT.md", "docs/WORKER.md", "docs/tasks/README.md", "docs/tasks/TEMPLATE.md", ".evrim/config.json", ".evrim/version", ".evrim/otonom/DERSLER.md", ".evrim/otonom/GUNLUK.md", ".evrim/otonom/HATALAR.md", ".evrim/otonom/OZET.md", ".evrim/otonom/SORULAR.md", ".evrim/otonom/NOTLAR.md", ".claude/skills/durum/SKILL.md", ".claude/skills/calis/SKILL.md", ".claude/skills/otonom/SKILL.md", ".claude/skills/damit/SKILL.md", ".claude/skills/cv-init/SKILL.md", ".evrim/cv.cmd", ".evrim/cv", ".gitignore"]) {
        ok(fs.existsSync(path.join(dir, f)), "eksik: " + f);
    }
    eq(readText(path.join(dir, ".evrim/version")).trim(), VERSION);
    eq(readJson(path.join(dir, ".evrim/config.json")).project, "ornek");
    ok(readText(path.join(dir, "AGENTS.md")).startsWith("# Yapay zekâ"), "AGENTS başlığı");
    ok(!/\{\{\w+\}\}/.test(readText(path.join(dir, "AGENTS.md")) + readText(path.join(dir, "docs/tasks/TEMPLATE.md"))), "doldurulmamış yer tutucu kaldı");
    ok(readText(path.join(dir, ".claude/skills/otonom/SKILL.md")).includes(`<!-- claudevolution ${VERSION} -->`), "beceri sürüm damgası");
    ok(readText(path.join(dir, ".gitignore")).includes(".evrim/otonom/lock"), ".gitignore satırları");
    ok(r.created.length >= 25, "oluşturulan dosya sayısı");
    eq(validate(loadConfig(dir)).errors, []);
});

test("init: ikinci çalıştırma hiçbir şeyi değiştirmez", () => {
    const dir = tmpDir("init2");
    init(dir, {});
    const snapshot = (d) => { const out = {}; const walk = (p, rel) => { for (const e of fs.readdirSync(p, { withFileTypes: true })) { const r = rel ? rel + "/" + e.name : e.name; if (e.isDirectory()) walk(path.join(p, e.name), r); else out[r] = readText(path.join(p, e.name)); } }; walk(d, ""); return out; };
    const before = snapshot(dir);
    const r = init(dir, {});
    eq(r.created, []);
    eq(r.newFiles, []);
    eq(snapshot(dir), before, "dosyalar değişti");
});

test("init: var olan farklı dosyayı ezmez, yanına .new bırakır", () => {
    const dir = tmpDir("init3");
    writeText(path.join(dir, "AGENTS.md"), "# Benim kurallarım\n");
    writeText(path.join(dir, ".gitignore"), "node_modules/\n");
    const r = init(dir, {});
    eq(readText(path.join(dir, "AGENTS.md")), "# Benim kurallarım\n");
    ok(fs.existsSync(path.join(dir, "AGENTS.md.new")), "AGENTS.md.new yok");
    ok(r.newFiles.includes("AGENTS.md.new"), "rapor .new dosyasını söylemeli");
    ok(readText(path.join(dir, ".gitignore")).startsWith("node_modules/\n"), ".gitignore başı korunmalı");
    const again = init(dir, {});
    eq(again.newFiles, [], "ikinci kez .new üretmemeli");
});

test("init: var olan config.json'a dokunmaz", () => {
    const dir = tmpDir("init4");
    const mine = { ...defaults(), project: "benim", build: ["make"] };
    writeJson(path.join(dir, ".evrim/config.json"), mine);
    init(dir, { name: "baska" });
    eq(readJson(path.join(dir, ".evrim/config.json")).project, "benim");
    ok(!fs.existsSync(path.join(dir, ".evrim/config.json.new")), "config için .new üretilmemeli");
});

test("detect: package.json'dan derleme ve test komutu", () => {
    const dir = tmpDir("detect");
    writeJson(path.join(dir, "package.json"), { name: "@x/uygulama", scripts: { build: "tsc", test: "vitest" } });
    fs.mkdirSync(path.join(dir, "src"));
    const d = detect(dir);
    eq([d.name, d.build, d.test, d.codePaths], ["uygulama", ["npm", "run", "build"], ["npm", "test"], ["src/"]]);
});

// ---------------------------------------------------------------- config
test("config: varsayılan şablon geçerli", () => {
    const v = validate({ ...defaults(), root: "." });
    eq(v.errors, []);
});

test("config: hatalı alanları yakalar", () => {
    const bad = (mut) => { const c = JSON.parse(JSON.stringify(defaults())); mut(c); return validate(c).errors.join(" | "); };
    ok(/build/.test(bad((c) => { c.build = "npm run build"; })), "build dizi olmalı");
    ok(/forbiddenWrite/.test(bad((c) => { c.forbiddenWrite = ["("]; })), "geçersiz regex");
    ok(/fiveHourExit en çok 95/.test(bad((c) => { c.autonomy.gates.fiveHourExit = 99; })), "çıkış eşiği tavanı");
    ok(/küçük olmalı/.test(bad((c) => { c.autonomy.gates.fiveHourNoNewStep = 92; })), "eşik sırası");
    ok(/weeklyBase \+ weeklySlope/.test(bad((c) => { c.autonomy.gates.weeklySlope = 40; })), "haftalık tavan");
    ok(/providers içinde yok/.test(bad((c) => { c.delegate.provider = "yok"; })), "sağlayıcı");
    ok(/ADI olmalı/.test(bad((c) => { c.delegate.providers.deepseek.keyEnv = "sk-abcdefghijklmnopqrstuvwxyz"; })), "keyEnv anahtar olamaz");
    ok(/anahtara benzeyen/.test(bad((c) => { c.delegate.intro = "key sk-abcdefghijklmnopqrstuvwxyz012345"; })), "config içinde anahtar");
    ok(/docs\.roadmap/.test(bad((c) => { delete c.docs.roadmap; })), "belge yolu");
});

test("config: proje listesi boş olsa da çekirdek yollar yasak", () => {
    const cfg = { ...defaults(), forbiddenWrite: [] };
    for (const p of [".git/config", ".evrim/config.json", ".claude/skills/otonom/SKILL.md"]) ok(isForbidden(cfg, p), p + " yasak olmalı");
    ok(!isForbidden(cfg, "src/app.js"), "src serbest olmalı");
});

test("ajan: yasak yol denetimi ve proje dışına çıkma", () => {
    const cfg = defaults();
    for (const p of ["AGENTS.md", "docs/VISION.md", "docs/tasks/T-001.md", ".gitignore", "build/out.js", "node_modules/x/index.js", ".\\.evrim\\config.json"]) ok(isForbidden(cfg, p), p + " yasak olmalı");
    for (const p of ["src/a.js", "tests/a.test.js", "docs/tasks/T-001.report.md", "README.md"]) ok(!isForbidden(cfg, p), p + " serbest olmalı");
    throws(() => safeRel("../baska/proje.js"), /stay inside/, "üst klasör");
    throws(() => safeRel("src/../../x"), /stay inside/, "iç ..");
    throws(() => safeRel("C:\\Windows\\x"), /stay inside/, "sürücü harfi");
    throws(() => safeRel(""), /stay inside/, "boş yol");
    eq(safeRel("./src\\a.js"), "src/a.js");
});

// ---------------------------------------------------------------- gates
test("kapı: haftalık tavan 60 + 30·f", () => {
    const g = AUT.gates;
    eq([weeklyCeiling(0, g), weeklyCeiling(0.5, g), weeklyCeiling(1, g), weeklyCeiling(2, g)], [60, 75, 90, 90]);
});

test("kapı: haftanın geçen kesri (sıfırlanma Cumartesi 03:00 UTC)", () => {
    const wr = AUT.weeklyReset; // weekday 6, hour 3
    eq(weekFraction(at("2026-11-14T03:00:00Z"), wr), 0);
    eq(weekFraction(at("2026-11-17T15:00:00Z"), wr), 0.5);
    eq(weekFraction(at("2026-11-14T02:00:00Z"), wr), (7 * 24 - 1) / (7 * 24));
    // The reset time reported by the usage tool wins over the configured weekday.
    eq(weekFraction(at("2026-11-12T03:00:00Z"), wr, "2026-11-14T03:00:00Z"), 5 / 7);
});

test("kapı: 5 saatlik eşikler %85 / %90", () => {
    const now = at("2026-11-17T15:00:00Z"); // f = 0.5, tavan 75
    const d = (five, week) => gate({ five, week, fiveResetsAt: "2026-11-17T16:00:00Z" }, AUT, now);
    eq(d(84, 10).decision, "GO");
    eq(d(85, 10).decision, "KUCUK");
    eq(d(89.9, 10).decision, "KUCUK");
    eq(d(90, 10).decision, "CIK");
    eq(d(90, 10).sleepSeconds, 3600); // one hour to the reset + 2 min, capped at an hour
    eq(gate({ five: 95, week: 10, fiveResetsAt: "2026-11-17T15:10:00Z" }, AUT, now).sleepSeconds, 720);
});

test("kapı: haftalık tavan ve 5 puanlık pay", () => {
    const now = at("2026-11-17T15:00:00Z"); // tavan 75
    const d = (week) => gate({ five: 10, week }, AUT, now);
    eq(d(69.9).decision, "GO");
    eq(d(70).decision, "KUCUK");
    eq(d(74.9).decision, "KUCUK");
    eq(d(75).decision, "CIK");
    eq(d(75).ceiling, 75);
    // Hafta başında %61 kapalı, hafta sonunda aynı kullanım açık: tavan zamanla yükselir.
    eq(gate({ five: 10, week: 61 }, AUT, at("2026-11-14T04:00:00Z")).decision, "CIK");
    eq(gate({ five: 10, week: 61 }, AUT, at("2026-11-20T03:00:00Z")).decision, "GO");
});

test("kapı: uyku süresi sınırları", () => {
    const now = at("2026-11-17T15:00:00Z");
    eq(sleepUntil(now, "2026-11-17T19:00:00Z"), 3600);
    eq(sleepUntil(now, "2026-11-17T14:00:00Z"), 60);
    eq(sleepUntil(now, null), 3600);
});

// ---------------------------------------------------------------- lock
test("kilit: ikinci oturum giremez, 90 dakikada bayatlar", () => {
    const file = path.join(tmpDir("lock"), "lock");
    const t0 = at("2026-11-12T10:00:00Z");
    eq(acquire(file, "a", 90, t0).ok, true);
    const second = acquire(file, "b", 90, at("2026-11-12T11:29:00Z"));
    eq([second.ok, second.holder.session], [false, "a"]);
    eq(lockInfo(file, 90, at("2026-11-12T11:29:00Z")).stale, false);
    eq(lockInfo(file, 90, at("2026-11-12T11:30:00Z")).stale, true);
    const takeover = acquire(file, "b", 90, at("2026-11-12T11:30:00Z"));
    eq([takeover.ok, takeover.takenOver], [true, true]);
    eq(lockInfo(file, 90, at("2026-11-12T11:31:00Z")).session, "b");
});

test("kilit: yalnız sahibi bırakır; aynı oturum yeniden alabilir", () => {
    const file = path.join(tmpDir("lock"), "lock");
    const t0 = at("2026-11-12T10:00:00Z");
    acquire(file, "a", 90, t0);
    eq(acquire(file, "a", 90, t0).ok, true);
    eq(release(file, "b").ok, false);
    ok(fs.existsSync(file), "başkası bırakamaz");
    eq(release(file, "a").ok, true);
    ok(!fs.existsSync(file), "kilit silinmeli");
    eq(lockInfo(file, 90).held, false);
    eq(release(file, "a").ok, true); // yokken bırakmak hata değil
});

// ---------------------------------------------------------------- share
test("pay: iki proje sırayla çalışır, ağırlık payı belirler", () => {
    process.env.CV_STATE_HOME = path.join(tmpDir("share"), "home");
    const now = at("2026-11-12T10:00:00Z"), week = "2026-11-07T03:00:00.000Z";
    const a = tmpDir("pa"), b = tmpDir("pb");
    eq(share.turn(a, "a", 1, now, week).ok, true);
    eq(share.turn(b, "b", 1, now, week).ok, true);
    share.charge(a, now); share.charge(a, now);
    eq(share.turn(a, "a", 1, now, week).ok, false, "a iki çevrim önde: sıra b'de");
    eq(share.turn(b, "b", 1, now, week).ok, true);
    share.charge(b, now);
    eq(share.turn(a, "a", 1, now, week).ok, true, "fark bir çevrime indi");
    // 48 saat görünmeyen proje sırayı tutmaz.
    eq(share.turn(a, "a", 1, at("2026-11-12T10:00:00Z"), week).ok, true);
    share.charge(a, now); share.charge(a, now);
    eq(share.turn(a, "a", 1, at("2026-11-14T11:00:00Z"), week).ok, true, "b 48 saattir yok");
    // Yeni hafta: sayaçlar sıfırlanır.
    eq(share.turn(a, "a", 1, at("2026-11-14T11:00:00Z"), "2026-11-14T03:00:00.000Z").mine.used, 0);
});

// ---------------------------------------------------------------- memory
test("hafıza: notlar, DUR, ÖNCE, cevaplanmış sorular, dersler", () => {
    const cfg = project("mem");
    const dir = path.join(cfg.root, ".evrim/otonom");
    eq(memory.notes(cfg), { stop: false, unread: [], first: [], objections: 0 });
    fs.appendFileSync(path.join(dir, "NOTLAR.md"), "[okundu 2026-11-12] eski not\nMenü rengini beğenmedim, geri al\nÖNCE: kayıt hatasını düzelt\n");
    const n = memory.notes(cfg);
    eq([n.stop, n.unread.length, n.first.length, n.objections], [false, 2, 1, 1]);
    fs.appendFileSync(path.join(dir, "NOTLAR.md"), "DUR\n");
    eq(memory.notes(cfg).stop, true);

    eq(memory.answered(cfg), { answered: [], openCount: 0 });
    const q = readText(path.join(dir, "SORULAR.md")).replace("## Kapananlar", "### 2026-11-12 · Yazı tipi indirilsin mi?\nNeden: ...\n**Cevap:** Hayır, sistem yazı tipi kalsın.\n\n### 2026-11-12 · İkinci soru\n**Cevap:** (sahibi buraya yazar)\n\n## Kapananlar");
    writeText(path.join(dir, "SORULAR.md"), q);
    const a = memory.answered(cfg);
    eq([a.openCount, a.answered.length, a.answered[0].answer], [2, 1, "Hayır, sistem yazı tipi kalsın."]);

    eq(memory.lessons(cfg), [], "şablondaki örnek ders sayılmamalı");
    fs.appendFileSync(path.join(dir, "DERSLER.md"), "- X yapınca Y oldu → Z (GUNLUK: 2026-11-12 10:00) [evrensel]\n");
    eq(memory.lessons(cfg).length, 1);
    eq(memory.journalTail(cfg), "", "şablon açıklaması günlük sayılmamalı");
});

// ---------------------------------------------------------------- cycle
test("çevrim: begin → iş → end; sayaçlar, günlük, kilit", () => {
    process.env.CV_STATE_HOME = path.join(tmpDir("cyc"), "home");
    const cfg = project("cycle");
    const now = at("2026-11-17T15:00:00Z");
    const b = begin(cfg, { five: "40", week: "30", session: "s1" }, now);
    eq(b.decision, "GO");
    ok(b.lines.some((l) => l === "KIMLIK: s1"), "kimlik satırı");
    ok(b.lines.some((l) => l === "DAMITMA: hayır"), "damıtma satırı");
    ok(fs.existsSync(path.join(cfg.root, ".evrim/otonom/lock")), "kilit alınmalı");
    eq(begin(cfg, { five: "40", week: "30", session: "s2" }, now).decision, "MESGUL");

    writeText(path.join(cfg.root, "src/a.js"), "export const a = 1;\n");
    git(["add", "-A"], cfg.root); git(["commit", "-qm", "iş"], cfg.root);
    const e = end(cfg, { id: "s1", did: "a.js eklendi", cost: "%3 kota, 0 $", worth: "evet", five: "43", week: "31", next: "b.js" }, now);
    ok(e[0].includes("1 commit"), "commit sayısı: " + e[0]);
    ok(!fs.existsSync(path.join(cfg.root, ".evrim/otonom/lock")), "kilit bırakılmalı");
    const s = loadState(cfg);
    eq([s.total, s.idleCycles, s.sinceDistill, s.open], [1, 0, 1, null]);
    const journal = readText(path.join(cfg.root, ".evrim/otonom/GUNLUK.md"));
    ok(journal.includes("Yaptım: a.js eklendi") && journal.includes("kota 5s %43 / hafta %31") && journal.includes("Sıradaki: b.js"), "günlük kaydı");
    ok(memory.journalTail(cfg).includes("a.js eklendi"), "günlük kuyruğu");

    // Commit'siz çevrim sayılır; pahalı çevrim uyarılır.
    begin(cfg, { five: "43", week: "31", session: "s3" }, now);
    const e2 = end(cfg, { id: "s3", did: "araştırma", five: "60", week: "33" }, now);
    ok(e2.some((l) => /UYARI: bu çevrim pencerenin %17/.test(l)), "pahalı çevrim uyarısı: " + e2.join(" / "));
    eq([loadState(cfg).idleCycles, loadState(cfg).wasted], [1, 1]);
});

test("çevrim: kapı kapalıyken kilit tutulmaz; DUR her şeyin önünde", () => {
    process.env.CV_STATE_HOME = path.join(tmpDir("cyc"), "home");
    const cfg = project("cycle2");
    const now = at("2026-11-17T15:00:00Z");
    const b = begin(cfg, { five: "91", week: "30", "five-resets": "2026-11-17T15:30:00Z" }, now);
    eq(b.decision, "CIK");
    ok(b.lines.includes("UYKU: 1920"), "sıfırlanmaya kadar + 2 dk: " + b.lines.join(" / "));
    ok(!fs.existsSync(path.join(cfg.root, ".evrim/otonom/lock")), "CIK kararında kilit kalmamalı");
    eq(begin(cfg, { five: "86", week: "30" }, now).decision, "KUCUK");
    end(cfg, { did: "küçük iş", five: "87", week: "30" }, now);

    // Kota okunamıyor: iki kez küçük adım, üçüncüde bekle.
    eq(begin(cfg, { five: "unknown", week: "unknown" }, now).decision, "KUCUK"); end(cfg, {}, now);
    eq(begin(cfg, {}, now).decision, "KUCUK"); end(cfg, {}, now);
    eq(begin(cfg, {}, now).decision, "CIK");
    eq(begin(cfg, { five: "10", week: "10" }, now).decision, "GO"); end(cfg, { five: "11", week: "10" }, now);

    fs.appendFileSync(path.join(cfg.root, ".evrim/otonom/NOTLAR.md"), "DUR\n");
    eq(begin(cfg, { five: "10", week: "10" }, now).decision, "DUR");
    ok(!fs.existsSync(path.join(cfg.root, ".evrim/otonom/lock")), "DUR kararında kilit alınmamalı");
});

test("çevrim: damıtma her N çalışan çevrimde bir", () => {
    process.env.CV_STATE_HOME = path.join(tmpDir("cyc"), "home");
    const cfg = project("cycle3");
    cfg.evolution.distillEveryCycles = 2;
    const now = at("2026-11-17T15:00:00Z");
    for (let i = 0; i < 2; i++) { begin(cfg, { five: "10", week: "10" }, now); end(cfg, { five: "11", week: "10" }, now); }
    ok(begin(cfg, { five: "10", week: "10" }, now).lines.includes("DAMITMA: evet"), "iki çevrim sonra damıtma zamanı");
});

// ---------------------------------------------------------------- recover
test("kurtarma: bayat kilit ve yarım birleştirme bulunur, düzeltilir", () => {
    const cfg = project("rec");
    eq(find(cfg).map((f) => f.id), []);
    const lock = path.join(cfg.root, ".evrim/otonom/lock");
    acquire(lock, "olu", 90, at("2020-01-01T00:00:00Z"));
    // İki dalda aynı satır değişir → çakışan birleştirme yarım kalır.
    const base = git(["symbolic-ref", "--short", "HEAD"], cfg.root).out;
    writeText(path.join(cfg.root, "f.txt"), "a\n"); commitAll(cfg.root, "f");
    git(["checkout", "-qb", "yan"], cfg.root); writeText(path.join(cfg.root, "f.txt"), "yan\n"); commitAll(cfg.root, "yan");
    git(["checkout", "-q", base], cfg.root); writeText(path.join(cfg.root, "f.txt"), "ana\n"); commitAll(cfg.root, "ana");
    ok(!git(["merge", "yan"], cfg.root).ok, "birleştirme çakışmalı");
    const found = find(cfg);
    const ids = found.map((f) => f.id);
    ok(ids.includes("bayat-kilit") && ids.includes("yarim-birleştirme") && ids.includes("cakisma"), "bulgular: " + ids.join(","));
    fix(cfg, found);
    eq(find(cfg).map((f) => f.id), [], "düzeltme sonrası temiz");
    eq(readText(path.join(cfg.root, "f.txt")), "ana\n", "iş kaybolmamalı");
});

// ---------------------------------------------------------------- doctor
test("doctor: powercfg çıktısı dilden bağımsız okunur", () => {
    const text = `
  Alt Grup GUID'si: 238c9fa8-0aad-41ed-83f4-97be242c8f20  (Uyku)
    Güç Ayarı GUID'si: 29f6c1db-86da-48c5-9fdb-f2b67b1f44da  (Şu süreden sonra uyu)
      Olası En Düşük Ayar: 0x00000000
      Olası En Yüksek Ayar: 0xffffffff
      Geçerli AC Güç Ayarı Dizini: 0x00000000
      Geçerli DC Güç Ayarı Dizini: 0x00000384

    Güç Ayarı GUID'si: 9d7815a6-7ee4-497e-8888-515a05f02364  (Şu süreden sonra hazırda beklet)
      Geçerli AC Güç Ayarı Dizini: 0x00002a30
      Geçerli DC Güç Ayarı Dizini: 0x00002a30
    Güç Ayarı GUID'si: 5ca83367-6e45-459f-a27b-476b1d01c936  (Kapak kapatma eylemi)
      Olası Ayar Dizini: 000
      Geçerli AC Güç Ayarı Dizini: 0x00000001
      Geçerli DC Güç Ayarı Dizini: 0x00000001`;
    eq(powerSetting(text, "29f6c1db-86da-48c5-9fdb-f2b67b1f44da"), { ac: 0, dc: 900 });
    eq(powerSetting(text, "9d7815a6-7ee4-497e-8888-515a05f02364"), { ac: 10800, dc: 10800 });
    eq(powerSetting(text, "5ca83367-6e45-459f-a27b-476b1d01c936"), { ac: 1, dc: 1 });
    eq(powerSetting(text, "00000000-0000-0000-0000-000000000000"), null);
});
