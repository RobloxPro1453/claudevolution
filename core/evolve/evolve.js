// Universal evolution: a candidate change on branch evrim/<ad> enters the package only if it measures
// at least as well as the baseline. Flow (docs/STANDARD.md):
//   clean main → candidate must not touch bench/ (Goodhart) → measure the candidate's own code in a temp
//   worktree (tiers A+B, C with --live) → hard gates + baseline comparison → privacy scan →
//   merge into main, bump the patch version, evolution/CHANGELOG.md, new baseline → push (no force).
// A rejected candidate gets one line in evolution/REJECTED.md; main is never left half-changed.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { appendText, git, readJson, run, today, writeJson } from "../lib/util.js";
import { compare } from "../bench/bench.js";
import { scan } from "./privacy.js";

const MAIN = "main";

// Default bench runner: the candidate's own `cv bench --json` in its worktree (its code, its scenarios).
export function childBench(wt, { live = false } = {}) {
    const isDeno = typeof globalThis.Deno !== "undefined";
    const args = [...(isDeno ? ["run", "-A"] : []), path.join(wt, "bin", "cv.js"), "bench", "--json", "--no-save", ...(live ? ["--live"] : [])];
    const r = run(process.execPath, args, { cwd: wt, timeoutMs: 20 * 60000 });
    const last = r.out.split(/\r?\n/).filter(Boolean).pop() || "";
    try { return JSON.parse(last); } catch (_) { throw new Error("aday ölçülemedi (bench çıktısı okunamadı):\n" + r.text.slice(-800)); }
}

export function bumpPatch(v) {
    const [a, b, c] = String(v || "0.0.0").split(".").map((x) => parseInt(x, 10) || 0);
    return `${a}.${b}.${c + 1}`;
}

function reject(root, name, why, lines) {
    appendText(path.join(root, "evolution", "REJECTED.md"), `- ${today()} · ${name} · ${why}\n`);
    git(["add", "evolution/REJECTED.md"], root);
    git(["commit", "-qm", `evrim: ${name} reddedildi (${why.slice(0, 60)})`], root);
    return { accepted: false, why, lines: [...lines, `RED: ${why}`] };
}

// opts: { root, branch, why, live, push, remote, bench } — bench(wt, {live}) is injectable for tests.
export function evolve({ root, branch, why = "", live = false, push = true, remote = "origin", bench = childBench }) {
    const lines = [];
    const name = branch.replace(/^evrim\//, "");
    if (!/^evrim\/[a-z0-9][a-z0-9._-]*$/i.test(branch)) throw new Error(`aday dalı "evrim/<ad>" biçiminde olmalı: ${branch}`);
    if (git(["rev-parse", "--abbrev-ref", "HEAD"], root).out !== MAIN) throw new Error(`önce ${MAIN} dalına geçin`);
    if (git(["status", "--porcelain"], root).out) throw new Error("çalışma ağacı temiz değil; önce commit edin ya da geri alın");
    if (!git(["rev-parse", "--verify", branch], root).ok) throw new Error(`dal yok: ${branch}`);
    const ahead = git(["rev-list", "--count", `${MAIN}..${branch}`], root).out;
    if (ahead === "0") throw new Error(`${branch} ${MAIN}'den ileride değil; değişiklik yok`);

    const changed = git(["diff", "--name-only", `${MAIN}...${branch}`], root).out.split(/\r?\n/).filter(Boolean);
    lines.push(`aday: ${branch} (${ahead} commit, ${changed.length} dosya)`);
    if (changed.some((f) => f.startsWith("bench/"))) return reject(root, name, "ölçüm takımına (bench/) dokunuyor; ölçüm değişikliği ayrı yapılır ve sahibine bildirilir", lines);

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cv-evolve-")), wt = path.join(tmp, "aday");
    const add = git(["worktree", "add", "--detach", wt, branch], root);
    if (!add.ok) throw new Error("geçici çalışma ağacı açılamadı: " + add.text);
    let result, leaks;
    try {
        result = bench(wt, { live });
        leaks = scan(wt);
    } finally {
        git(["worktree", "remove", "--force", wt], root);
        fs.rmSync(tmp, { recursive: true, force: true });
    }
    const baseline = readJson(path.join(root, "bench", "baseline.json"), null);
    if (!baseline) throw new Error("bench/baseline.json yok; önce: cv bench --baseline");
    const cmp = compare(result, baseline);
    for (const g of cmp.gates) lines.push("KAPI ✗ " + g);
    for (const w of cmp.worse) lines.push("kötü   " + w);
    for (const b of cmp.better) lines.push("iyi    " + b);
    if (!cmp.ok) return reject(root, name, cmp.gates.join("; "), lines);
    if (leaks.length) return reject(root, name, `gizlilik taraması: ${leaks.slice(0, 3).map((l) => `${l.file}:${l.line} ${l.rule}`).join(", ")}`, lines);

    // Accept: merge, version, changelog, baseline — one commit on top of the merge.
    const m = git(["merge", "--no-ff", "-m", `evrim: ${name}`, branch], root);
    if (!m.ok) { git(["merge", "--abort"], root); return reject(root, name, "main ile çakışıyor; adayı main üzerine yeniden kurun", lines); }
    const pkgFile = path.join(root, "package.json"), pkg = readJson(pkgFile, {});
    pkg.version = bumpPatch(pkg.version);
    writeJson(pkgFile, pkg);
    const delta = [...cmp.better, ...cmp.worse.map((w) => "kötü: " + w)].join("; ") || "ölçüler eşit";
    appendText(path.join(root, "evolution", "CHANGELOG.md"), `- ${today()} · ${name} (v${pkg.version}) · ${why || "(gerekçe yazılmadı)"} · ${delta} · kabul\n`);
    writeJson(path.join(root, "bench", "baseline.json"), { ...result, version: pkg.version });
    git(["add", "package.json", "evolution/CHANGELOG.md", "bench/baseline.json"], root);
    git(["commit", "-qm", `evrim: ${name} kabul (v${pkg.version})`], root);
    lines.push(`KABUL: v${pkg.version}`);

    if (push) {
        if (!git(["remote", "get-url", remote], root).ok) lines.push(`push yok: "${remote}" uzak deposu tanımlı değil`);
        else {
            const p = git(["push", remote, MAIN], root, 120000);
            lines.push(p.ok ? `push: ${remote}/${MAIN}` : `push başarısız (yerelde kabul edildi; elle: git push ${remote} ${MAIN}): ${p.text.trim().split("\n").pop()}`);
        }
    }
    return { accepted: true, version: pkg.version, lines };
}
