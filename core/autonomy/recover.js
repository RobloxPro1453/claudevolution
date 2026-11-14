// Stuck-state recovery. find() only looks; fix() does the safe, reversible repairs:
// remove a stale lock, abort a half-done merge/rebase/cherry-pick, drop records of dead lane processes.
// It never deletes work: uncommitted changes are reported, not reset.
import fs from "node:fs";
import path from "node:path";
import { exists, git, pidAlive, readJson, run } from "../lib/util.js";
import { autonomyDir, stateDir } from "../lib/config.js";
import { lockInfo, release } from "./lock.js";

export function find(cfg, now = new Date()) {
    const root = cfg.root, out = [];
    const add = (id, text, fixable, extra = {}) => out.push({ id, text, fixable, ...extra });

    const lockFile = path.join(autonomyDir(cfg), "lock");
    const lock = lockInfo(lockFile, cfg.autonomy.lockStaleMinutes, now);
    if (lock.held && lock.stale) add("bayat-kilit", `kilit ${lock.ageMin} dakikadır duruyor (oturum ${lock.session}); sahibi ölmüş sayılır`, true, { lockFile });

    const gd = git(["rev-parse", "--git-dir"], root);
    if (gd.ok) {
        const gitDir = path.resolve(root, gd.out);
        for (const [marker, name, abort] of [["MERGE_HEAD", "birleştirme", ["merge", "--abort"]], ["CHERRY_PICK_HEAD", "cherry-pick", ["cherry-pick", "--abort"]], ["REVERT_HEAD", "revert", ["revert", "--abort"]], ["rebase-merge", "rebase", ["rebase", "--abort"]], ["rebase-apply", "rebase", ["rebase", "--abort"]]]) {
            if (exists(path.join(gitDir, marker))) add("yarim-" + name, `yarım kalmış ${name} var`, true, { abort });
        }
        if (exists(path.join(gitDir, "index.lock"))) add("git-index-kilidi", "git index.lock duruyor (asılı ya da ölmüş bir git süreci)", false);
        const unmerged = git(["diff", "--name-only", "--diff-filter=U"], root);
        if (unmerged.ok && unmerged.out) add("cakisma", "çakışma işaretli dosyalar: " + unmerged.out.split(/\r?\n/).join(", "), false);
        const dirty = git(["status", "--porcelain"], root);
        if (dirty.ok && dirty.out) add("kirli-agac", `commit edilmemiş ${dirty.out.split(/\r?\n/).length} değişiklik var (önce yarım işi tamamla ya da WIP commit et)`, false);
    } else add("git-yok", "burası bir git deposu değil", false);

    // Lane records whose process is gone (lesson 1: lanes are detached processes; their pid files outlive them).
    const lanesDir = path.join(cfg.root, cfg.delegate.stateDir, "lanes");
    let entries = [];
    try { entries = fs.readdirSync(lanesDir).filter((f) => f.endsWith(".json")); } catch (_) { /* no lanes yet */ }
    for (const f of entries) {
        const lane = readJson(path.join(lanesDir, f), null);
        if (lane && lane.state === "running" && !pidAlive(lane.pid)) add("olu-serit", `şerit ${lane.lane} kaydı "çalışıyor" diyor ama süreci yok (${(lane.tasks || []).join(", ")})`, true, { laneFile: path.join(lanesDir, f) });
    }
    return out;
}

export function fix(cfg, findings) {
    const done = [];
    for (const f of findings.filter((x) => x.fixable)) {
        if (f.id === "bayat-kilit") { release(f.lockFile, null, true); done.push("bayat kilit silindi"); }
        else if (f.abort) { const r = git(f.abort, cfg.root); done.push(`git ${f.abort.join(" ")}: ${r.ok ? "tamam" : "olmadı (" + r.text.trim().slice(0, 120) + ")"}`); }
        else if (f.id === "olu-serit") {
            const lane = readJson(f.laneFile, {});
            fs.writeFileSync(f.laneFile, JSON.stringify({ ...lane, state: "dead" }, null, 2) + "\n");
            done.push(`şerit ${lane.lane} "öldü" olarak işaretlendi (yarım işi dalında duruyor)`);
        }
    }
    return done;
}

// Does the build pass? Used at the end of a cycle and by doctor. Bounded by buildMinutes.
export function buildOk(cfg) {
    if (!cfg.build) return { skipped: true };
    const r = run(cfg.build[0], cfg.build.slice(1), { cwd: cfg.root, timeoutMs: cfg.buildMinutes * 60000 });
    return { ok: r.ok, timedOut: r.timedOut, missing: r.missing, tail: r.text.trim().split(/\r?\n/).slice(-5).join("\n") };
}
export { stateDir };
