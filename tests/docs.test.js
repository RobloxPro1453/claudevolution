// Documents promise things to the owner and to agents; these tests keep the promises true.
import fs from "node:fs";
import path from "node:path";
import { test, eq, ok } from "./harness.js";
import { readText } from "../core/lib/util.js";
import { PKG_ROOT, TEMPLATE_DIR, defaults } from "../core/lib/config.js";

const doc = (rel) => readText(path.join(PKG_ROOT, rel));

test("belge: OWNER_GUIDE'ın gösterdiği dosyalar ve ayarlar gerçekten var", () => {
    const g = doc("docs/OWNER_GUIDE.md");
    for (const w of ["DUR", "ÖNCE:", "NOTLAR.md", "OZET.md", "SORULAR.md"]) ok(g.includes(w), "eksik: " + w);
    for (const rel of new Set(g.match(/\.evrim\/[\w./]+\.(md|json)/g))) ok(fs.existsSync(path.join(TEMPLATE_DIR, rel)), "şablonda yok: " + rel);
    ok(g.includes("dailyBudget") && typeof defaults().delegate.dailyBudget === "number", "dailyBudget config'de");
    const gates = defaults().autonomy.gates;
    ok(g.includes(`%${gates.fiveHourNoNewStep}`) && g.includes(`%${gates.fiveHourExit}`), "kapı yüzdeleri config ile aynı");
    ok(g.includes(`${defaults().autonomy.lockStaleMinutes} dakika`), "kilit bayatlığı config ile aynı");
    eq(/`(node|deno) /.test(g), false, "sahip rehberinde komut satırı yok");
});

test("belge: INVENTORY §4'teki 16 dersin her birinin 'nereye gitti' hücresi var ve gösterdiği dosyalar var", () => {
    const inv = doc("docs/INVENTORY.md");
    const sec = inv.slice(inv.indexOf("## 4. "), inv.indexOf("## 5. "));
    const rows = sec.split("\n").filter((l) => /^\| \d+ \|/.test(l));
    eq(rows.map((l) => Number(l.split("|")[1])), Array.from({ length: 16 }, (_, i) => i + 1), "16 ders sırayla");
    for (const r of rows) {
        const cell = r.replace(/\s*\|\s*$/, "").split(" | ").pop().trim();
        ok(cell.length > 10, "boş hücre: ders " + r.split("|")[1]);
        for (const m of cell.matchAll(/`((?:core|skills|templates|docs|tests|evolution|bin)\/[^`\s]+|\.evrim\/[^`\s]+)`/g)) {
            const rel = m[1].startsWith(".evrim/") ? "templates/project/" + m[1] : m[1];
            ok(fs.existsSync(path.join(PKG_ROOT, rel)), `ders ${r.split("|")[1]}: yok: ${m[1]}`);
        }
    }
});

test("belge: METHOD'daki eşikler config ile aynı; projeye özgü ad yok", () => {
    const m = doc("docs/METHOD.md"), d = defaults();
    const g = d.autonomy.gates;
    ok(m.includes(`%${g.fiveHourNoNewStep}`) && m.includes(`%${g.fiveHourExit}`) && m.includes(`${g.weeklyBase} + ${g.weeklySlope}·f`), "kapılar");
    ok(m.includes(`${d.autonomy.lockStaleMinutes} dakika`) && m.includes(`${d.autonomy.watchdog.delegateNoCommitMinutes} dakika`) && m.includes(`%${g.stepShareAlarm}`), "kilit, bekçi");
    ok(m.includes(`≤${d.evolution.lessonsMax} satır`) && m.includes(`≤%${d.evolution.distillQuotaShare}`), "evrim sınırları");
    eq(/fotosop|photopea/i.test(m), false, "projeye özgü ad");
});

test("belge: core/* klasörlerinin README'si yer tutucu değil", () => {
    for (const d of fs.readdirSync(path.join(PKG_ROOT, "core"), { withFileTypes: true }).filter((e) => e.isDirectory() && !["cli", "lib"].includes(e.name))) {
        const t = readText(path.join(PKG_ROOT, "core", d.name, "README.md"), "");
        ok(t.split("\n").length > 10 && !/Boş: Fable/.test(t), "yer tutucu: core/" + d.name);
    }
});

test("beceri: her Türkçe becerinin İngilizcesi var; ad ve çağırdığı cv komutları aynı; --lang en onları kurar", async () => {
    const dir = (l) => path.join(PKG_ROOT, "skills", l);
    const names = fs.readdirSync(dir("tr")).sort();
    eq(fs.readdirSync(dir("en")).sort(), names, "aynı beceriler");
    const cmds = (t) => [...new Set([...t.matchAll(/`cv ([a-z-]+)(?: ([a-z]+))?/g)].map((m) => m[1] + (m[2] ? " " + m[2] : "")))].sort();
    for (const n of names) {
        const tr = readText(path.join(dir("tr"), n, "SKILL.md")), en = readText(path.join(dir("en"), n, "SKILL.md"));
        eq(en.match(/^name: (.+)$/m)[1], tr.match(/^name: (.+)$/m)[1], n + " adı");
        eq(cmds(en), cmds(tr), n + " cv komutları");
        ok(/^description: .{40,}/m.test(en) && !/[çğışöüÇĞİŞÖÜ]{2,}/.test(en.match(/^description: (.+)$/m)[1]), n + " açıklaması İngilizce");
    }
    const { init } = await import("../core/cli/init.js");
    const { tmpDir } = await import("./harness.js");
    const p = tmpDir("en");
    init(p, { name: "en", lang: "en" });
    ok(readText(path.join(p, ".claude/skills/otonom/SKILL.md")).includes("# Autonomous cycle"), "İngilizce beceri kuruldu");
});

// Cold start: a fresh model opened in a project reads CLAUDE.md -> AGENTS.md -> the package README.
// Each question below was put to context-free agents; the facts are what a correct answer needs.
// If a document stops carrying one of them, a cold agent gets that question wrong again.
export const COLD_START = [
    { q: "Bu sistemi yeni bir projeye nasıl kurarım?", where: "readme", facts: ["git clone", "Node ≥ 18 ya da Deno", "bin/cv.cmd init", "cv-init", "cv adopt", "cv update --apply"] },
    { q: "Gözetimsiz bir çevrim nasıl başlar ve adım adım nasıl işler?", where: "readme", facts: ["otonom becerisini yükle ve bir çevrim yap", "/loop", "cv cycle begin", "KARAR", "cv cycle end", "OZET.md"] },
    { q: "Yalnız bu projeye özgü ders ile her projede geçerli ders nasıl yazılır, ne olur?", where: "readme", facts: ["cv lesson \"<ders>\"", "--evrensel", "DERSLER.md", "[evrensel→taşındı", "[evrensel]"] },
    { q: "Kota yüksekken ne olur?", where: "readme", facts: ["%85", "%90", "60 + 30·f", "KUCUK", "CIK", "cv cycle sleep"] },
    { q: "Pakete bir değişiklik nasıl girer, diğer projeler nasıl alır?", where: "readme", facts: ["evrim/<ad>", "cv evolve", "bench/", "gizlilik", "REJECTED.md", "cv update --apply"] },
    { q: "Döngü dışında, normal oturumda genel bir ders öğrendim; ne yaparım?", where: "agents", facts: ["döngü dışında da", "--evrensel", "damıtmayı bekleme"] },
    { q: "Push yapabilir miyim? Proje ile paket farkı?", where: "both", facts: ["push", "cv lesson --evrensel", "cv evolve"] }
];

test("belge: soğuk başlangıç soruları README ve proje şablonundan cevaplanıyor", () => {
    const readme = doc("README.md"), agents = readText(path.join(TEMPLATE_DIR, "AGENTS.md"));
    eq(readText(path.join(TEMPLATE_DIR, "CLAUDE.md")).trim(), "@AGENTS.md", "şablon CLAUDE.md AGENTS.md'yi içe alır");
    eq(doc("CLAUDE.md").trim(), "@AGENTS.md", "paket CLAUDE.md AGENTS.md'yi içe alır");
    ok(agents.includes("## claudevolution") && agents.includes("packageHome") && agents.includes("README.md"), "şablon AGENTS paket README'sine yol gösterir");
    for (const { q, where, facts } of COLD_START) {
        const texts = where === "both" ? [readme, agents] : [where === "agents" ? agents : readme];
        for (const t of texts) for (const f of facts) ok(t.includes(f), `${q} → ${where}: eksik "${f}"`);
    }
    const g = defaults().autonomy.gates;
    ok(readme.includes(`%${g.fiveHourNoNewStep}`) && readme.includes(`${g.weeklyBase} + ${g.weeklySlope}·f`), "README kapıları config ile aynı");
    for (const s of ["tr", "en"]) {
        const never = doc(`skills/${s}/otonom/SKILL.md`).split("\n").filter((l) => /^- .*push/i.test(l));
        ok(never.length > 0 && never.every((l) => l.includes("cv lesson --evrensel")), s + " otonom: push yasağı paket istisnasını söylüyor");
    }
});

test("doctor: AGENTS.md'de claudevolution bölümü yoksa söyler", async () => {
    const { init } = await import("../core/cli/init.js");
    const { check } = await import("../core/cli/doctor.js");
    const { tmpDir } = await import("./harness.js");
    const p = tmpDir("cold");
    init(p, { name: "cold" });
    const has = (r) => r.rows.some(([, t]) => /claudevolution bölümü yok/.test(t));
    eq(has(check(p)), false, "şablonla kurulan projede bölüm var");
    fs.writeFileSync(path.join(p, "AGENTS.md"), "# kurallar\n");
    eq(has(check(p)), true, "bölüm silinince uyarı");
});

test("cv setup: kullanıcı becerisi paketin yerini söyler, ikinci kez aynı kalır; README anlatır", async () => {
    const { setup, userSkillText } = await import("../core/cli/setup.js");
    const { tmpDir } = await import("./harness.js");
    const file = path.join(tmpDir("setup"), "skills", "claudevolution", "SKILL.md");
    eq(setup({ file, pkg: "C:\paket" }), "yeni");
    eq(setup({ file, pkg: "C:\paket" }), "aynı");
    const t = readText(file);
    ok(/^name: claudevolution$/m.test(t) && t.includes("C:/paket/README.md") && !t.includes("{{pkg}}"), "beceri metni");
    ok(userSkillText("x").includes("bin/cv.cmd init"), "kurulum adımı");
    const readme = doc("README.md");
    for (const f of ["cv setup", "<proje>/claudevolution/", ".gitignore"]) ok(readme.includes(f), "README: " + f);
    ok(doc("AGENTS.md").includes("bin/cv.cmd setup"), "paket AGENTS.md makine kurulumunu söyler");
});
