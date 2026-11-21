// Lossless update of a real v1.0.24-shaped project (owner decision #21): tests/fixtures/v1.0.24-proje is a
// project as that version left it (owner's own values, memory, metrics, a task, an old skill copy, a skill of
// the owner's own, no Codex/Antigravity copies yet). No network, no model.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { eq, ok, test, throws, tmpDir } from "./harness.js";
import { git, readJson, readText, writeText } from "../core/lib/util.js";
import { VERSION, loadConfig, validate } from "../core/lib/config.js";
import { applyPlan, fillMissing, listBackups, migrate, planUpdate, rollback, upgradeDoc } from "../core/cli/migrate.js";
import { main as cliMain } from "../bin/cv.js";

const FIXTURE = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "v1.0.24-proje");

function copyDir(src, dst) {
    fs.mkdirSync(dst, { recursive: true });
    for (const e of fs.readdirSync(src, { withFileTypes: true })) {
        const s = path.join(src, e.name), d = path.join(dst, e.name);
        if (e.isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
    }
}
function snapshot(root) {
    const out = {};
    const walk = (dir, rel) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const r = rel ? rel + "/" + e.name : e.name;
            if (r === ".git" || r === ".evrim/backups") continue;
            if (e.isDirectory()) walk(path.join(dir, e.name), r); else out[r] = fs.readFileSync(path.join(dir, e.name)).toString("base64");
        }
    };
    walk(root, "");
    return out;
}
function oldProject(label) {
    const root = tmpDir(label);
    copyDir(FIXTURE, root);
    git(["init", "-q", "-b", "main"], root);
    git(["config", "user.email", "t@example.com"], root);
    git(["config", "user.name", "t"], root);
    git(["add", "-A"], root);
    git(["commit", "-qm", "v1.0.24 project"], root);
    return root;
}
const OWNER_DATA = [".evrim/otonom/DERSLER.md", ".evrim/otonom/GUNLUK.md", ".evrim/metrics.jsonl", "docs/tasks/T-001.md", ".claude/skills/benim-becerim/SKILL.md"];

test("migrate: v1.0.24 projesi veri kaybı olmadan güncellenir, config onarılır, --rollback eski hâli birebir geri getirir", async () => {
    const root = oldProject("mig-124");
    const before = snapshot(root);

    // Preview: nothing written; config repair, new platform copies, owner data listed as kept.
    const p = planUpdate(root);
    eq([p.blocked, p.from, p.to], [null, "1.0.24", VERSION]);
    eq(snapshot(root), before, "önizleme hiçbir şey yazmamalı");
    const cfgItem = p.items.find((i) => i.rel === ".evrim/config.json");
    ok(cfgItem && cfgItem.kind === "onarım", "config onarım olarak planlanmalı");
    for (const k of ["projectMode", "licensePolicy", "finalForm", "autonomy.office"]) ok(cfgItem.added.includes(k), `eksik ayar eklenmeli: ${k}`);
    eq(cfgItem.repaired.map((r) => r.id), ["forbidden-platform-dirs", "forbidden-scripts-lesson-30"]);
    for (const base of [".claude/skills", ".codex/skills", ".agent/skills"]) ok(p.items.some((i) => i.rel === `${base}/otonom/SKILL.md`), `${base} becerileri planlanmalı`);
    ok(p.items.some((i) => i.rel === ".agent/workflows/loop.md"), "Antigravity loop iş akışı planlanmalı");
    ok(p.kept.includes(".evrim/otonom/") && p.kept.includes("docs/") && p.kept.some((k) => k.includes("benim-becerim")), "sahibin verileri korunanlarda görünmeli");
    ok(!p.items.some((i) => OWNER_DATA.includes(i.rel) || i.rel.includes("benim-becerim")), "sahibin verisi planda olmamalı");

    // Apply.
    const res = migrate(root, p);
    for (const rel of OWNER_DATA) eq(fs.readFileSync(path.join(root, rel)).toString("base64"), before[rel], `korunmalı: ${rel}`);
    eq(readText(path.join(root, ".evrim/version")).trim(), VERSION);
    const own = readJson(path.join(root, ".evrim/config.json"), null);
    eq([own.project, own.kurulum, own.autonomy.gates.fiveHourExit, own.delegate.dailyBudget, own.delegate.providers.deepseek.model, own.build],
        ["ornek-notlar", "tamam", 88, 2.5, "deepseek-flash", ["cargo", "build"]], "sahibin değerleri aynen kalmalı (model adı dahil, E1)");
    ok(own.forbiddenWrite.includes("^gizli-veri/") && own.forbiddenWrite.includes("^\\.codex/") && own.forbiddenWrite.includes("^\\.agent/") && own.forbiddenWrite.includes("^scripts/"), "yasak liste yalnız büyümeli");
    eq([own.projectMode, own.licensePolicy, own.autonomy.office.maxLanes], ["greenfield", "auto", 4], "yeni bloklar varsayılanlarıyla");
    eq(validate(loadConfig(root)).errors, [], "göç sonrası config geçerli");
    ok(fs.existsSync(path.join(root, ".codex/skills/durum/SKILL.md")) && fs.existsSync(path.join(root, ".agent/workflows/loop.md")), "tüm platform becerileri yazılmalı");
    ok(readText(path.join(root, ".claude/skills/durum/SKILL.md")).includes(`claudevolution ${VERSION}`), "eski beceri kopyası yenilenmeli");
    ok(fs.existsSync(path.join(res.backup.dir, "files/.evrim/config.json")) && fs.existsSync(path.join(res.backup.dir, "manifest.json")), "yedek ve manifest");
    ok(res.backup.id.startsWith(`pre-1.0.24-to-${VERSION}-`), "yedek adı pre-<eski>-to-<yeni>-<zaman>");

    // Idempotent: a second look finds nothing to do.
    eq(planUpdate(root).items, [], "ikinci güncelleme boş olmalı");

    // Rollback: every byte as before, files the update created removed.
    const rb = rollback(root);
    eq(snapshot(root), before, "geri alma eski hâli birebir getirmeli");
    ok(rb.removed.includes(".codex/skills/durum/SKILL.md"), "güncellemenin eklediği dosya kaldırılmalı");
    ok(listBackups(root)[0].manifest.rolledBackAt, "yedek geri alındı olarak işaretlenmeli");
    throws(() => rollback(root), /geri alınacak yedek yok/, "aynı yedek iki kez geri alınmaz");
});

test("migrate: bozuk ya da daha yeni şemalı config'e dokunulmaz; yarıda kalan yazma geri döner", async () => {
    const root = oldProject("mig-guard");
    const cfgPath = path.join(root, ".evrim/config.json");
    const good = readText(cfgPath);

    writeText(cfgPath, good.slice(0, 200));
    const broken = planUpdate(root);
    ok(broken.blocked && /bozuk JSON/.test(broken.blocked), "bozuk config planı durdurmalı");
    throws(() => migrate(root, broken), /bozuk JSON/);
    eq(readText(cfgPath), good.slice(0, 200), "bozuk dosya varsayılanlarla ezilmemeli");

    writeText(cfgPath, good.replace('"schema": 1', '"schema": 9'));
    ok(/daha yeni|en yeni/.test(planUpdate(root).blocked || ""), "yeni şema reddedilmeli");
    writeText(cfgPath, good);

    // A write that fails half way puts back what it wrote.
    const p = planUpdate(root);
    const before = snapshot(root);
    let n = 0;
    throws(() => applyPlan(root, p, { write: (file, text) => { if (++n === 3) throw new Error("disk dolu"); writeText(file, text); } }), /eski hâline döndü/);
    eq(snapshot(root), before, "başarısız uygulama hiçbir iz bırakmamalı");

    // A file changed after the plan: nothing written.
    writeText(path.join(root, ".claude/skills/durum/SKILL.md"), "sahip değiştirdi\n");
    throws(() => applyPlan(root, p), /plan yapıldıktan sonra değişti/);

    // Versioned steps (H1): in order, from the document's version; out of range refused.
    const seen = [];
    eq(upgradeDoc({}, 1, 1, [() => seen.push("a"), () => seen.push("b")]), 3);
    eq(seen, ["a", "b"]);
    throws(() => upgradeDoc({}, 0, 1, []), /eski/);
    // fillMissing never changes the owner's values; comments travel only with new keys.
    const own = { a: 1, o: { x: 2 } };
    eq(fillMissing(own, { a: 9, b: 2, _comment_b: "c", o: { x: 0, y: 3 } }), ["b", "o.y"]);
    eq(own, { a: 1, o: { x: 2, y: 3 }, _comment_b: "c", b: 2 });
});

test("migrate: cv update önizler, --apply yedekleyip uygular, --rollback geri alır (CLI)", async () => {
    const root = oldProject("mig-cli");
    const logs = [], orig = console.log;
    console.log = (...a) => logs.push(a.join(" "));
    let c1, c2, c3;
    try {
        c1 = await cliMain(["update", "--dir", root]);
        c2 = await cliMain(["update", "--apply", "--dir", root]);
        c3 = await cliMain(["update", "--rollback", "--dir", root]);
    } finally { console.log = orig; }
    const out = logs.join("\n");
    eq([c1, c2, c3], [0, 0, 0]);
    ok(/Verileriniz silinmez/.test(out) && /onarım\s+\.evrim\/config\.json/.test(out) && /Dokunulmayacak/.test(out), "önizleme sade ve açık olmalı");
    ok(/Yedek: \.evrim\/backups\/pre-1\.0\.24-to-/.test(out) && /Geri alındı/.test(out), "uygulama yedeği ve geri alma bildirilmeli");
    eq(readText(path.join(root, ".evrim/version")).trim(), "1.0.24");
    ok(readText(path.join(root, ".gitignore"), "").includes(".evrim/backups/"), "yedek klasörü git dışı");
});
