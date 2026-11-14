// Tier C (live): the cheap-model agent works the mini project's four tasks (bug fix, feature, refactor,
// one trap) in a throwaway copy; the hidden checker in bench/checks scores the result. Paid, so:
// only with `cv bench --live`, a hard dollar cap for the whole run, never in the peak-price window,
// and only through the API agent (a Claude subagent cannot be driven or metered from here).
// Over the cap, or no key: status "olculemedi" — and evolve does not accept an unmeasured change.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { git, num, readJson, readText, writeJson, writeText } from "../lib/util.js";
import { PKG_ROOT, loadConfig } from "../lib/config.js";
import { init } from "../cli/init.js";
import * as agent from "../delegate/agent.js";
import { choose } from "../delegate/choose.js";
import { checks, tasks } from "../../bench/checks/mini.js";

export const DEFAULT_CAP = 0.10;

function copyDir(src, dst) {
    fs.mkdirSync(dst, { recursive: true });
    for (const e of fs.readdirSync(src, { withFileTypes: true })) {
        const s = path.join(src, e.name), d = path.join(dst, e.name);
        if (e.isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
    }
}

// The project the agent sees: the fixture + claudevolution's own skeleton + the four specs. No checker.
export function setup(capUsd) {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), "cv-live-")), dir = path.join(base, "mini");
    copyDir(path.join(PKG_ROOT, "bench", "fixtures", "mini"), dir);
    git(["init", "-q", "-b", "main"], dir);
    for (const [k, v] of [["user.email", "bench@example.invalid"], ["user.name", "bench"], ["commit.gpgsign", "false"]]) git(["config", k, v], dir);
    init(dir, { name: "mini", lang: "en" });
    const cfgFile = path.join(dir, ".evrim", "config.json"), c = readJson(cfgFile, {});
    const runner = typeof globalThis.Deno !== "undefined" ? [process.execPath, "run", "-A", "test.js"] : [process.execPath, "test.js"];
    Object.assign(c, { build: runner, test: runner, baseBranch: "main", codePaths: ["src/", "test.js"] });
    c.delegate = { ...(c.delegate || {}), worktreeRoot: path.join(base, "lanes").replace(/\\/g, "/"), lanes: 1 };
    writeJson(cfgFile, c);
    const per = Math.max(0.005, Math.round((capUsd / tasks.length) * 1000) / 1000);
    for (const t of tasks) {
        const spec = readText(path.join(PKG_ROOT, "bench", "tasks", "mini", t + ".md")).replace(/^Budget:.*$/m, `Budget: $${per}`);
        writeText(path.join(dir, "docs", "tasks", t + ".md"), spec);
    }
    git(["add", "-A"], dir); git(["commit", "-qm", "mini project"], dir);
    return { base, dir };
}

// deps (tests only): { chat, key, env, now } — a scripted model, so the harness is checked without spending.
export async function run({ cap, deps = {}, log = () => {} } = {}) {
    const capUsd = num(cap, DEFAULT_CAP);
    const total = tasks.length;
    const box = setup(capUsd);
    try {
        const cfg = loadConfig(box.dir);
        if (!deps.chat) {
            const who = choose(cfg, deps.env || process.env);
            if (who.mode !== "api") return { status: "olculemedi", reason: `ücretli kat yalnız API modeliyle ölçülür (${who.reason})`, total };
            const until = agent.peakUntil(agent.provider(cfg), deps.now || new Date());
            if (until && !process.env.CV_PEAK_OK) return { status: "olculemedi", reason: `yoğun saat (${until.toISOString().slice(11, 16)} UTC'ye kadar)`, total };
        }
        let spent = 0, solved = 0, trapViolations = 0;
        const perTask = [];
        for (const t of tasks) {
            if (spent >= capUsd) return { status: "olculemedi", reason: `tavan $${capUsd} doldu (${perTask.length}/${total} iş)`, total, spent: Math.round(spent * 1000) / 1000, perTask };
            const ctx = await agent.newCtx(cfg, 1, log);
            await agent.ensureLane(ctx);
            await agent.syncForTask(ctx, t);
            const r = await agent.runTask(ctx, t, null, { key: deps.key, chat: deps.chat });
            const st = readJson(path.join(agent.stateDir(cfg), t + ".json"), { cost: 0 });
            spent += st.cost || 0;
            const c = await checks[t](ctx.wt, r.status);
            if (c.solved) solved++;
            if (c.trap) trapViolations++;
            perTask.push({ task: t, status: r.status, solved: c.solved, trap: c.trap, cost: Math.round((st.cost || 0) * 1000) / 1000 });
        }
        if (spent > capUsd) return { status: "olculemedi", reason: `tavan $${capUsd} aşıldı ($${spent.toFixed(3)})`, total, perTask };
        return { status: "tamam", total, solved, trapViolations, cost: `$${spent.toFixed(3)}`, perTask };
    } finally {
        try { git(["worktree", "prune"], box.dir); fs.rmSync(box.base, { recursive: true, force: true }); } catch (_) { /* temp cleanup is best effort */ }
    }
}
