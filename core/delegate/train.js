// The merge train: approved task branches go into the base branch together, only if the whole set builds
// and passes its tests. Branches green one by one break together (calis skill step 4); the train finds out
// before the base branch does. In a temporary worktree from the base: merge every branch, build, test. Green:
// the base moves to the result (fast-forward only). Red: find the first branch whose addition breaks it by
// halving the list (bisect, each try 0 tokens), leave that task a `<task>.train-fix.md` note (agent.auto
// starts its next run from it: the failing checks and the fix to make), drop it, and run again with the rest.
// A merge conflict drops that branch the same way. Tests that change tracked files are reported and undone
// (LoopTroop finalTest/fileEffectsAudit idea, MIT): a test must not edit the repository it tests.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { git, writeJson, writeText } from "../lib/util.js";
import { runProgram } from "../check/check.js";
import { branchOf, stateDir } from "./agent.js";

const tail = (t, n = 12) => String(t).trim().split(/\r?\n/).slice(-n).join("\n");

export function trainWorktree(cfg) {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), "cv-train-"));
    const wt = path.join(base, "wt");
    const add = git(["worktree", "add", "--detach", wt, cfg.baseBranch], cfg.root, 120000);
    if (!add.ok) { fs.rmSync(base, { recursive: true, force: true }); throw new Error("tren çalışma kopyası açılamadı:\n" + add.text); }
    for (const dir of (cfg.delegate && cfg.delegate.linkDirs) || []) {
        const src = path.join(cfg.root, dir), dst = path.join(wt, dir);
        if (fs.existsSync(src) && !fs.existsSync(dst)) { try { fs.symlinkSync(src, dst, "junction"); } catch (_) { /* optional */ } }
    }
    return { wt, cleanup: () => { git(["worktree", "remove", "--force", wt], cfg.root, 120000); fs.rmSync(base, { recursive: true, force: true }); } };
}

// Merge `branches` on a fresh base in `wt`, then build and test. { ok, failedAt?, reason, sha?, effects }
export async function tryMerge(cfg, wt, branches, { run = runProgram } = {}) {
    const g = (args) => git(args, wt, 300000);
    g(["reset", "--hard", "-q", cfg.baseBranch]);
    g(["clean", "-fdq"]);
    for (const b of branches) {
        const m = g(["merge", "--no-ff", "--no-edit", "-q", b]);
        if (!m.ok) { g(["merge", "--abort"]); return { ok: false, failedAt: b, reason: `birleştirme çakışması:\n${tail(m.text, 8)}`, conflict: true, effects: [] }; }
    }
    const sha = g(["rev-parse", "HEAD"]).out;
    for (const [kind, cmd, minutes] of [["build", cfg.build, cfg.buildMinutes || 10], ["test", cfg.test, cfg.testMinutes || 15]]) {
        if (!cmd) continue;
        const r = await run(cmd[0], cmd.slice(1), { cwd: wt, seconds: minutes * 60 });
        // .text, not .out: .out is trimmed, which eats the first line's leading status column ("AGENTS.md" became "GENTS.md").
        const dirty = g(["status", "--porcelain", "--untracked-files=no"]).text.replace(/\s+$/, "");
        const effects = dirty ? dirty.split(/\r?\n/).map((l) => l.slice(3)) : [];
        if (effects.length) g(["checkout", "--", "."]);
        if (r.code !== 0) return { ok: false, reason: `${kind} kırmızı (exit ${r.code}${r.timedOut ? ", süre doldu" : ""}):\n${tail(r.text)}`, effects };
        if (effects.length) return { ok: false, reason: `${kind} izlenen dosyaları değiştirdi: ${effects.join(", ")} (test depoyu değiştirmemeli)`, effects };
    }
    return { ok: true, sha, effects: [] };
}

// The first branch whose addition turns the set red: the shortest failing prefix, found by halving.
export async function findCulprit(cfg, wt, branches, opts = {}) {
    let lo = 1, hi = branches.length, last = null; // prefix length lo..hi; the full list is known red
    while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        const r = await tryMerge(cfg, wt, branches.slice(0, mid), opts);
        if (r.ok) lo = mid + 1; else { hi = mid; last = r; }
    }
    return { branch: branches[lo - 1], result: last };
}

// One train run. tasks: task ids in merge order. Returns { merged, dropped: [{ task, reason }], sha, moved }.
export async function train(cfg, tasks, opts = {}) {
    const { wt, cleanup } = (opts.worktree || trainWorktree)(cfg);
    const dropped = [];
    let left = [...tasks], final = null;
    try {
        while (left.length) {
            const branches = left.map((t) => branchOf(cfg, t));
            const r = await tryMerge(cfg, wt, branches, opts);
            if (r.ok) { final = r; break; }
            let culprit = r.failedAt ? { branch: r.failedAt, result: r } : left.length === 1 ? { branch: branches[0], result: r } : await findCulprit(cfg, wt, branches, opts);
            const task = left[branches.indexOf(culprit.branch)];
            const reason = (culprit.result && culprit.result.reason) || r.reason;
            dropped.push({ task, reason });
            writeText(path.join(stateDir(cfg), `${task}.train-fix.md`), `Merged with ${cfg.baseBranch} and the other approved branches (${branches.filter((b) => b !== culprit.branch).join(", ") || "none"}), this branch broke the combined result:\n\n${reason}\n\nMake the combined build and the full test pass with your change; keep the other branches' behaviour.\n`);
            left = left.filter((t) => t !== task);
        }
        let moved = false;
        if (final && left.length) {
            const head = git(["symbolic-ref", "--short", "-q", "HEAD"], cfg.root).out;
            const clean = !git(["status", "--porcelain", "--untracked-files=no"], cfg.root).out;
            if (head === cfg.baseBranch && clean) moved = git(["merge", "--ff-only", "-q", final.sha], cfg.root).ok;
            else if (head !== cfg.baseBranch) {
                const old = git(["rev-parse", cfg.baseBranch], cfg.root).out;
                moved = git(["update-ref", `refs/heads/${cfg.baseBranch}`, final.sha, old], cfg.root).ok;
            }
        }
        const out = { at: new Date().toISOString(), merged: final ? left : [], dropped, sha: final ? final.sha : null, moved };
        writeJson(path.join(stateDir(cfg), "train.json"), out);
        return out;
    } finally { cleanup(); }
}
