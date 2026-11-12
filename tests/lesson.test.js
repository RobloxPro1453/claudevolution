// cv lesson --evrensel: a universal lesson reaches the package (and its remote) at once.
// Throwaway package repo with a bare "remote"; the bench is injected (as in evolve.test.js).
import fs from "node:fs";
import path from "node:path";
import { test, tmpDir, eq, ok, throws } from "./harness.js";
import { git, isWindows, readJson, readText, run, writeJson, writeText } from "../core/lib/util.js";
import { promote, problems, slug } from "../core/evolve/lesson.js";
import { cvCmd } from "../core/cli/init.js";
import { PKG_ROOT } from "../core/lib/config.js";

const BASE = { version: "1.0.0", A: { ok: true, passed: 10, total: 10 }, B: { passed: 20, total: 20, failed: [] }, sizes: { codeLines: 1000, skillLines: 100, templateLines: 100 } };
const same = () => structuredClone(BASE);

function pkgRepo() {
    const dir = tmpDir("ders"), root = path.join(dir, "paket"), remote = path.join(dir, "uzak.git");
    git(["init", "-q", "--bare", remote], dir);
    git(["init", "-q", "-b", "main", root], dir);
    for (const [k, v] of [["user.email", "test@example.invalid"], ["user.name", "test"], ["commit.gpgsign", "false"]]) git(["config", k, v], root);
    writeJson(path.join(root, "package.json"), { name: "p", version: "1.0.0" });
    writeJson(path.join(root, "bench/baseline.json"), BASE);
    writeText(path.join(root, "evolution/CHANGELOG.md"), "# Evrim günlüğü\n\n");
    writeText(path.join(root, "evolution/universal/DERSLER.md"), "# Evrensel dersler\n\n");
    git(["add", "-A"], root); git(["commit", "-qm", "ilk"], root);
    git(["remote", "add", "origin", remote], root); git(["push", "-q", "origin", "main"], root);
    return { root, remote };
}

test("ders: evrensel ders hemen pakete girer, sürüm +1, uzak depoya gider, dal silinir", () => {
    const { root, remote } = pkgRepo();
    const r = promote({ root, text: "Test koşarken derleme başlatma: çıktı dosyası kilitli kalır", source: "deneme", bench: same, stamp: 123456 });
    ok(r.accepted, r.lines.join("\n"));
    eq(readJson(path.join(root, "package.json")).version, "1.0.1");
    ok(/Test koşarken derleme başlatma.*\(deneme \d{4}-\d{2}-\d{2}\)/.test(readText(path.join(root, "evolution/universal/DERSLER.md"))), "satır eklendi");
    eq(git(["rev-parse", "main"], remote).out, git(["rev-parse", "main"], root).out, "uzak depo güncel");
    eq(git(["branch", "--list", "evrim/*"], root).out, "", "aday dalı silindi");
    eq(git(["rev-parse", "--abbrev-ref", "HEAD"], root).out, "main");
});

test("ders: hata türü HATALAR.md'ye başlıkla gider (dosya yoksa açılır)", () => {
    const { root } = pkgRepo();
    const r = promote({ root, text: "Sarmalayıcı .cmd başka .cmd'yi call ile çağırınca argümandaki yüzde işaretleri ikinci kez açılır", kind: "hata", bench: same });
    ok(r.accepted, r.lines.join("\n"));
    ok(/^## Sarmalayıcı \.cmd/m.test(readText(path.join(root, "evolution/universal/HATALAR.md"))), "başlık");
});

test("ders: proje adı, kişisel yol, kirli ağaç ya da yanlış dal reddedilir; paket değişmez", () => {
    const { root } = pkgRepo();
    const J = (...p) => p.join("");
    ok(problems("dukkan rapor ekranı iki kez çiziliyor, bekle", { projectWords: ["dukkan"] }).some((p) => /proje adı/.test(p)), "proje adı");
    ok(problems(J("bkz C:\\", "Users\\ali\\x dosyası her zaman bozuk"), {}).some((p) => /gizlilik/.test(p)), "kişisel yol");
    throws(() => promote({ root, text: "kısa", bench: same }), /çok kısa/, "kısa");
    writeText(path.join(root, "kirli.txt"), "x");
    throws(() => promote({ root, text: "Uzun çıktıyı okumak kotayı yiyor, kes", bench: same }), /temiz değil/, "kirli");
    fs.rmSync(path.join(root, "kirli.txt"));
    eq(readJson(path.join(root, "package.json")).version, "1.0.0");
    eq(slug("Test koşarken derleme: exe kilitli!"), "test-kosarken-derleme-exe-kilitli");
});

test("ders: ölçüm kapısı kırılırsa ret; yerel dal kalmaz, main temiz", () => {
    const { root } = pkgRepo();
    const r = promote({ root, text: "Her zaman şunu yap: önce testleri koş, sonra derle", bench: () => ({ ...same(), B: { passed: 19, total: 20, failed: [{ id: "x", fails: ["y"] }] } }) });
    ok(!r.accepted && /Kat B/.test(r.why), r.why);
    eq(git(["branch", "--list", "evrim/*"], root).out, "");
    eq(git(["status", "--porcelain"], root).out, "");
});

test("cv.cmd sarmalayıcısı call kullanmaz; yüzde işaretli argüman bozulmadan geçer", () => {
    const text = cvCmd(PKG_ROOT);
    eq(/\bcall\b/i.test(text), false, "call yok");
    if (!isWindows) return;
    const dir = tmpDir("shim");
    const shim = path.join(dir, "cv.cmd");
    writeText(shim, text);
    const r = run("cmd.exe", ["/d", "/c", shim, "version", "--x", "%34->%39"], { timeoutMs: 60000 });
    ok(r.ok, r.text);
    // The version command ignores extra flags; what matters is that cmd did not expand %3.
    const echo = path.join(dir, "echo.cmd");
    // Both launch lines (Node and the Deno fallback) print their arguments instead.
    writeText(echo, text.replace(/^(node|deno run -A --quiet) "%CV_PKG%\\bin\\cv\.js" %\*(?=\r?$)/gm, "echo %*"));
    ok((readText(echo).match(/^echo %\*/gm) || []).length === 2, "iki satır da echo oldu");
    // As cv cycle end gets it: a quoted value with spaces ("5s %34->%39, 0 $").
    const e = run("cmd.exe", ["/d", "/c", echo, "cycle", "end", "--cost", "5s %34->%39, 0 $"], { timeoutMs: 60000 });
    ok(e.out.includes("%34->%39"), "yüzde korunmalı: " + e.out);
});
