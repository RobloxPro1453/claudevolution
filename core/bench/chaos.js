// Tier B: autonomy chaos scenarios. Zero model tokens: a fake clock, fake usage numbers and a throwaway
// git project drive the real decision code (gates, lock, cycle begin/end, recovery). Rules that live only
// in skill text are guarded by "skill" scenarios: evolution may not silently drop them.
//
// Scenario file (bench/chaos/<id>.json):
//   { "id", "title", "kind": "gate" | "cycle" | "cycleEnd" | "skill", ... , "expect": { ... } }
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { git, readJson, writeText, writeJson } from "../lib/util.js";
import { PKG_ROOT, autonomyDir, loadConfig, stateDir } from "../lib/config.js";
import { init } from "../cli/init.js";
import { gate } from "../autonomy/gates.js";
import { begin, end } from "../autonomy/cycle.js";

export const CHAOS_DIR = path.join(PKG_ROOT, "bench", "chaos");

export function load(dir = CHAOS_DIR) {
    return fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort().map((f) => ({ file: f, ...readJson(path.join(dir, f), {}) }));
}

// A fresh project in a temp folder. Machine-wide state (lock, share registry) is sandboxed too:
// the bench must never touch the owner's real ~/.claudevolution.
function sandbox() {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), "cv-chaos-"));
    const dir = path.join(base, "proj");
    fs.mkdirSync(dir);
    git(["init", "-q", "-b", "main"], dir);
    for (const [k, v] of [["user.email", "bench@example.invalid"], ["user.name", "bench"], ["commit.gpgsign", "false"]]) git(["config", k, v], dir);
    init(dir, { name: "kaos" });
    git(["add", "-A"], dir); git(["commit", "-qm", "init"], dir);
    return { base, dir, cfg: loadConfig(dir) };
}

const at = (iso) => new Date(iso || "2026-11-11T12:00:00Z");
const minutesBefore = (now, m) => new Date(now.getTime() - m * 60000).toISOString();
const usageArgs = (u = {}) => {
    const a = {};
    if (u.five !== undefined) a.five = String(u.five);
    if (u.week !== undefined) a.week = String(u.week);
    if (u.fiveResetsAt) a["five-resets"] = u.fiveResetsAt;
    if (u.weekResetsAt) a["week-resets"] = u.weekResetsAt;
    return a;
};

// Apply a scenario's "setup" to the sandbox project.
function arrange(s, box, now) {
    const st = s.setup || {}, { cfg, dir } = box;
    if (st.lockAgeMin !== undefined) writeJson(path.join(autonomyDir(cfg), "lock"), { session: st.lockSession || "eski", at: minutesBefore(now, st.lockAgeMin) });
    if (st.notes) writeText(path.join(autonomyDir(cfg), "NOTLAR.md"), "# Notlar\n\n## Notlar\n\n" + st.notes.join("\n") + "\n");
    if (st.state) writeJson(path.join(stateDir(cfg), "cycle.json"), st.state);
    if (st.gitMarker) {
        const gd = git(["rev-parse", "--git-dir"], dir).out;
        writeText(path.join(path.resolve(dir, gd), st.gitMarker), "0000000000000000000000000000000000000000\n");
    }
    if (st.dirtyFile) writeText(path.join(dir, st.dirtyFile), "yarım iş\n");
}

function check(lines, decision, ex) {
    const text = lines.join("\n"), fails = [];
    if (ex.decision && decision !== ex.decision) fails.push(`karar ${decision}, beklenen ${ex.decision}`);
    for (const re of ex.contains || []) if (!new RegExp(re, "m").test(text)) fails.push(`çıktıda yok: /${re}/`);
    for (const re of ex.absent || []) if (new RegExp(re, "m").test(text)) fails.push(`çıktıda olmamalı: /${re}/`);
    return fails;
}

export function runOne(s) {
    const now = at(s.now);
    if (s.kind === "skill") {
        const fails = [];
        for (const f of s.files || []) {
            const text = fs.readFileSync(path.join(PKG_ROOT, f), "utf8");
            for (const re of s.expect.contains || []) if (!new RegExp(re, "mi").test(text)) fails.push(`${f}: kural yok /${re}/`);
        }
        return fails;
    }
    if (s.kind === "gate") {
        const box = sandbox();
        try {
            const g = gate(s.usage, box.cfg.autonomy, now);
            const fails = check([`NEDEN: ${g.reason}`, `UYKU: ${g.sleepSeconds}`], g.decision, s.expect);
            if (s.expect.sleepMin !== undefined && g.sleepSeconds < s.expect.sleepMin) fails.push(`uyku ${g.sleepSeconds} sn, en az ${s.expect.sleepMin} bekleniyordu`);
            if (s.expect.sleepMax !== undefined && g.sleepSeconds > s.expect.sleepMax) fails.push(`uyku ${g.sleepSeconds} sn, en çok ${s.expect.sleepMax} bekleniyordu`);
            return fails;
        } finally { fs.rmSync(box.base, { recursive: true, force: true }); }
    }
    if (s.kind === "cycle" || s.kind === "cycleEnd") {
        const box = sandbox();
        try {
            arrange(s, box, now);
            const b = begin(box.cfg, { ...usageArgs(s.usage), session: "yeni" }, now);
            if (s.kind === "cycle") return check(b.lines, b.decision, s.expect);
            const later = new Date(now.getTime() + 30 * 60000);
            const lines = end(box.cfg, { ...usageArgs(s.endUsage), id: b.id, did: "kaos", cost: "-", worth: "evet" }, later);
            return check(lines, null, s.expect);
        } finally { fs.rmSync(box.base, { recursive: true, force: true }); }
    }
    return [`bilinmeyen tür: ${s.kind}`];
}

// Runs every scenario. Returns { passed, total, failed: [{ id, fails }] }.
export function runAll(dir = CHAOS_DIR) {
    const prev = process.env.CV_STATE_HOME;
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "cv-chaos-home-"));
    process.env.CV_STATE_HOME = home;
    const failed = [];
    let total = 0;
    try {
        for (const s of load(dir)) {
            total++;
            let fails;
            try { fails = runOne(s); } catch (e) { fails = ["hata: " + e.message]; }
            if (fails.length) failed.push({ id: s.id || s.file, title: s.title, fails });
        }
    } finally {
        if (prev === undefined) delete process.env.CV_STATE_HOME; else process.env.CV_STATE_HOME = prev;
        fs.rmSync(home, { recursive: true, force: true });
    }
    return { passed: total - failed.length, total, failed };
}
