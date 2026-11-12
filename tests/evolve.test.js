// cv evolve on a throwaway package repo with a bare "remote" in the temp folder. Never touches the real origin.
// The bench is injected (running the real one here would recurse into this very suite).
import path from "node:path";
import { test, tmpDir, eq, ok, throws } from "./harness.js";
import { git, readJson, readText, writeJson, writeText } from "../core/lib/util.js";
import { evolve, bumpPatch } from "../core/evolve/evolve.js";
import { scanText } from "../core/evolve/privacy.js";

const BASE = { version: "1.0.0", A: { ok: true, passed: 10, total: 10 }, B: { passed: 20, total: 20, failed: [] }, sizes: { codeLines: 1000, skillLines: 100, templateLines: 100 } };
const same = () => structuredClone(BASE);

function pkgRepo() {
    const dir = tmpDir("evrim"), root = path.join(dir, "paket"), remote = path.join(dir, "uzak.git");
    git(["init", "-q", "--bare", remote], dir);
    git(["init", "-q", "-b", "main", root], dir);
    for (const [k, v] of [["user.email", "test@example.invalid"], ["user.name", "test"], ["commit.gpgsign", "false"]]) git(["config", k, v], root);
    writeJson(path.join(root, "package.json"), { name: "p", version: "1.0.0" });
    writeJson(path.join(root, "bench/baseline.json"), BASE);
    writeText(path.join(root, "evolution/CHANGELOG.md"), "# Evrim günlüğü\n\n");
    writeText(path.join(root, "skills/a.md"), "kural\n");
    git(["add", "-A"], root); git(["commit", "-qm", "ilk"], root);
    git(["remote", "add", "origin", remote], root); git(["push", "-q", "origin", "main"], root);
    return { root, remote };
}
function candidate(root, name, files) {
    git(["checkout", "-q", "-b", "evrim/" + name], root);
    for (const [f, t] of Object.entries(files)) writeText(path.join(root, f), t);
    git(["add", "-A"], root); git(["commit", "-qm", name], root);
    git(["checkout", "-q", "main"], root);
}
const remoteHead = (remote) => git(["rev-parse", "main"], remote).out;

test("evrim: iyi aday kabul, sürüm +1, CHANGELOG, temel çizgi, push", () => {
    const { root, remote } = pkgRepo();
    candidate(root, "kisa-kural", { "skills/a.md": "kısa kural\n" });
    const r = evolve({ root, branch: "evrim/kisa-kural", why: "kural kısaldı", bench: same });
    ok(r.accepted, r.lines.join("\n"));
    eq(readJson(path.join(root, "package.json")).version, "1.0.1");
    ok(/kisa-kural \(v1\.0\.1\) · kural kısaldı · .* · kabul/.test(readText(path.join(root, "evolution/CHANGELOG.md"))), "changelog");
    eq(readJson(path.join(root, "bench/baseline.json")).version, "1.0.1");
    eq(remoteHead(remote), git(["rev-parse", "main"], root).out, "uzak depo güncel");
});
test("evrim: bench/ değiştiren aday reddedilir (Goodhart), uzak depo değişmez", () => {
    const { root, remote } = pkgRepo();
    const before = remoteHead(remote);
    candidate(root, "hile", { "bench/chaos/x.json": "{}" });
    const r = evolve({ root, branch: "evrim/hile", bench: same });
    ok(!r.accepted && /bench/.test(r.why), r.why);
    ok(readText(path.join(root, "evolution/REJECTED.md")).includes("hile"), "ret kaydı");
    eq(readJson(path.join(root, "package.json")).version, "1.0.0");
    eq(remoteHead(remote), before);
});
test("evrim: kapı kırılırsa ret (senaryo kaybı, test silme)", () => {
    const { root } = pkgRepo();
    candidate(root, "zayif", { "skills/a.md": "x\n" });
    const r = evolve({ root, branch: "evrim/zayif", bench: () => ({ ...same(), B: { passed: 19, total: 20, failed: [{ id: "x", fails: ["y"] }] } }) });
    ok(!r.accepted && /Kat B/.test(r.why), r.why);
    candidate(root, "test-sil", { "skills/a.md": "y\n" });
    const t = evolve({ root, branch: "evrim/test-sil", bench: () => ({ ...same(), A: { ok: true, passed: 8, total: 8 } }) });
    ok(!t.accepted && /test sayısı azaldı/.test(t.why), t.why);
});
test("evrim: gizlilik taraması kişisel yolu ve e-postayı yakalar", () => {
    const { root } = pkgRepo();
    candidate(root, "sizinti", { "skills/b.md": "bkz C:\\Users\\ali\\proje\n" });
    const r = evolve({ root, branch: "evrim/sizinti", bench: same });
    ok(!r.accepted && /gizlilik/.test(r.why), r.why);
    eq(scanText("ali@gmail.com sk-0123456789abcdefghijKLMN /home/veli/x").map((f) => f.rule), ["anahtar", "e-posta", "kişisel yol"]);
    eq(scanText("noreply@anthropic.com test@example.invalid sk-abcdefghijklmnopqrstuvwxyz %USERPROFILE%\\x C:\\Users\\<ad>\\x"), []);
});
test("evrim: kirli ağaçta ya da yanlış dal adında çalışmaz; sürüm artırma", () => {
    const { root } = pkgRepo();
    writeText(path.join(root, "kirli.txt"), "x");
    throws(() => evolve({ root, branch: "evrim/x", bench: same }), /temiz değil/, "kirli");
    throws(() => evolve({ root, branch: "ozellik/x", bench: same }), /evrim\/<ad>/, "ad");
    eq([bumpPatch("1.0.9"), bumpPatch("0.1.0")], ["1.0.10", "0.1.1"]);
});
