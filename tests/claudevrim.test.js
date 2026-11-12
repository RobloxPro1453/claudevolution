// claudevrim: the downloadable launcher, the machine home, two universal layers, the new-project flow.
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { test, tmpDir, eq, ok } from "./harness.js";
import { git, readJson, readText, writeJson, writeText } from "../core/lib/util.js";
import { PKG_ROOT, defaults } from "../core/lib/config.js";
import { lessonTarget, userUniversal } from "../core/lib/home.js";
import { keyOf, merged, projectLessons, render, writeProject } from "../core/evolve/merge.js";

// Run fn with CLAUDEVRIM_HOME pointing at a fresh temp home (never the real ~/.claudevrim).
async function withHome(fn, kur) {
    const home = tmpDir("cvhome"), before = process.env.CLAUDEVRIM_HOME;
    process.env.CLAUDEVRIM_HOME = home;
    if (kur) writeJson(path.join(home, "kurulum.json"), kur);
    try { return await fn(home); } finally { if (before === undefined) delete process.env.CLAUDEVRIM_HOME; else process.env.CLAUDEVRIM_HOME = before; }
}

test("claudevrim: evrensel dersler iki katmandan birleşir; aynı ders bir kez, hiçbiri kaybolmaz", async () => {
    await withHome(async () => {
        const pkg = tmpDir("pkg");
        writeText(path.join(pkg, "evolution/universal/DERSLER.md"), "# x\n\n- Ortak ders burada (2026-01-01)\n- Yalnız pakette\n");
        writeText(userUniversal("ders"), "# y\n\n- ortak  ders burada (2026-02-02)\n- Yalnız bu makinede (2026-02-03)\n");
        const m = merged({ pkg });
        eq(m.fromPkg.length, 2, "paket");
        eq(m.fromMachine, ["- Yalnız bu makinede (2026-02-03)"], "makineden yalnız yeni olan");
        eq(keyOf("- A  b (2026-01-01)"), "a b");
        const text = render(m);
        ok(text.includes("## Paket") && text.includes("## Bu makine") && text.includes("Yalnız pakette"), "iki bölüm");
        const root = tmpDir("proj");
        writeProject(root, { pkg });
        eq(projectLessons(root).length, 3, "projede 3 ders");
    });
});

test("claudevrim: geliştirici olmayan makinede cv lesson --evrensel makine katmanına yazar ve projeye yansır", async () => {
    await withHome(async () => {
        eq(lessonTarget(), "makine");
        const { init } = await import("../core/cli/init.js");
        const { run } = await import("../core/cli/lesson.js");
        const p = tmpDir("lproj");
        init(p, { name: "bazalt" });
        const code = await run({ _: ["Uzun komutu arka planda koş, bitişini bekle, yoklama yapma"], evrensel: true, dir: p });
        eq(code, 0);
        ok(readText(userUniversal("ders")).includes("Uzun komutu arka planda"), "makine katmanında");
        ok(readText(path.join(p, ".evrim/otonom/DERSLER.md")).includes("[evrensel→taşındı makine]"), "yerel işaret");
        ok(readText(path.join(p, ".evrim/evrensel.md")).includes("Uzun komutu arka planda"), "projeye yansıdı");
        eq(await run({ _: ["bazalt projesinde senkron bozuldu, düzelt"], evrensel: true, dir: p }), 1, "proje adı geçen ders reddedilir");
    }, { paket: PKG_ROOT, gelistirici: false });
    await withHome(async () => eq(lessonTarget(), "paket", "geliştirici makinesi pakete yazar"), { paket: PKG_ROOT, gelistirici: true });
    await withHome(async () => eq(lessonTarget(), "paket", "claudevrim kurulmamış: eski davranış"));
});

test("claudevrim init: yeni klasör git deposu olur, kurulum bekliyor, ilk commit yalnız kurulan dosyalar", async () => {
    await withHome(async () => {
        const { run } = await import("../core/cli/init.js");
        const p = tmpDir("bazalt");
        writeText(path.join(p, "benim-notum.txt"), "dokunma");
        await run({ _: [], dir: p, name: "bazalt", "no-doctor": true, "no-setup": true });
        ok(git(["rev-parse", "--git-dir"], p).ok, "git deposu");
        eq(readJson(path.join(p, ".evrim/config.json")).kurulum, "bekliyor");
        ok(fs.existsSync(path.join(p, ".evrim/evrensel.md")), "evrensel dersler");
        const head = git(["log", "--oneline", "-1"], p);
        if (head.ok) {
            const files = git(["show", "--name-only", "--format=", "HEAD"], p).out.split(/\r?\n/);
            ok(files.includes("AGENTS.md") && !files.includes("benim-notum.txt"), "sahibinin dosyası commit'e girmedi");
        }
        ok(readText(path.join(p, "AGENTS.md")).includes("## Oturumun ilk işi"), "ilk iş kuralı");
        ok(readText(path.join(p, ".gitignore")).includes(".evrim/evrensel.md"), "üretilmiş dosya git dışı");
    });
});

test("claudevrim: kısayollar Node ve Deno yoksa başlatıcıya düşer; başlatıcı yalnız node: kullanır; yayın iş akışı var", async () => {
    const { cvCmd } = await import("../core/cli/init.js");
    const t = cvCmd("C:\\p");
    ok(/:claudevrim\r\nclaudevrim %\*/.test(t) && !/\bcall\b/i.test(t), "cmd yedeği");
    const src = readText(path.join(PKG_ROOT, "bin/claudevrim.js"));
    eq([...src.matchAll(/^import .* from "([^"]+)"/gm)].map((m) => m[1]).filter((s) => !s.startsWith("node:")), [], "yalnız node: içe aktarımı");
    ok(src.includes("m.main(args)"), "paketi main ile çağırır");
    const { main } = await import("../bin/cv.js");
    eq(typeof main, "function");
    const wf = readText(path.join(PKG_ROOT, ".github/workflows/release.yml"));
    ok(wf.includes("deno compile") && wf.includes("claudevrim.exe") && wf.includes("gh release create"), "yayın");
    eq(defaults().kurulum, "bekliyor", "şablon yeni projeyi bekliyor işaretler");
    const uskill = readText(path.join(PKG_ROOT, "templates/user/claudevolution/SKILL.md"));
    ok(uskill.includes("bekliyor") && uskill.includes("cv-init"), "makine becerisi keşif görüşmesini başlatır");
    for (const s of ["tr", "en"]) {
        const ci = readText(path.join(PKG_ROOT, `skills/${s}/cv-init/SKILL.md`));
        ok(ci.includes("/loop başla") && ci.includes("delegate.policy") && ci.includes('"tamam"'), s + " cv-init: politika, kurulum tamam, /loop başla");
        ok(readText(path.join(PKG_ROOT, `skills/${s}/otonom/SKILL.md`)).includes("/loop başla"), s + " otonom: başla");
    }
});
