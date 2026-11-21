// Integration tests for Phase 2: multi-platform installer (Claude/Codex/Antigravity),
// office brain (pace metrics, self-tuning decrees, methodology audit, finalForm BITTI gate, safe notify),
// and cost/quota/license-aware council orchestration.
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { test, tmpDir, eq, ok } from "./harness.js";
import { git, readJson, readText, writeJson, writeText } from "../core/lib/util.js";
import { PKG_ROOT, loadConfig, validate } from "../core/lib/config.js";
import { setupAll, userSkillTargets } from "../core/cli/setup.js";
import { init, run as initRun } from "../core/cli/init.js";
import { apply as adoptApply, plan as adoptPlan } from "../core/cli/adopt.js";
import { run as councilRun } from "../core/cli/council.js";
import { pace } from "../core/autonomy/gates.js";
import {
    appendDecree,
    auditMethodology,
    checkFinalForm,
    decreeFile,
    evaluateWindowAndTune,
    readDecrees,
    recordWindowObservation,
} from "../core/autonomy/office.js";
import { notifyOwner } from "../core/autonomy/notify.js";
import * as cycle from "../core/autonomy/cycle.js";
import {
    detectPool,
    evaluateLicensePolicy,
    inferComplexity,
    planCouncil,
    runCouncil,
} from "../core/orchestrate/council.js";
import { choose, workerPool } from "../core/delegate/choose.js";

// Runtime string builder so literal test fixtures never trip privacy.js.
const J = (...parts) => parts.join("");

function makeGitProject(label, opts = {}) {
    const dir = tmpDir(label);
    git(["init", "-q", "-b", "main"], dir);
    for (const [k, v] of [["user.email", "test@example.invalid"], ["user.name", "test"], ["commit.gpgsign", "false"]]) {
        git(["config", k, v], dir);
    }
    init(dir, { name: label, ...(opts.initOpts || {}) });
    const cfgFile = path.join(dir, ".evrim/config.json");
    const c = readJson(cfgFile);
    c.delegate.worktreeRoot = "../" + path.basename(dir) + "-lanes";
    if (opts.kurulum !== undefined) c.kurulum = opts.kurulum;
    if (opts.finalForm) c.finalForm = { ...c.finalForm, ...opts.finalForm };
    writeJson(cfgFile, c);
    if (opts.roadmap !== undefined) writeText(path.join(dir, "docs/ROADMAP.md"), opts.roadmap);
    writeText(path.join(dir, "src/app.js"), "export const ok = true;\n");
    git(["add", "-A"], dir);
    ok(git(["commit", "-qm", "init"], dir).ok, "init commit");
    return loadConfig(dir);
}

function withEnv(vars, fn) {
    const prev = {};
    for (const k of Object.keys(vars)) {
        prev[k] = Object.prototype.hasOwnProperty.call(process.env, k) ? process.env[k] : undefined;
        if (vars[k] === undefined || vars[k] === null) delete process.env[k];
        else process.env[k] = String(vars[k]);
    }
    try {
        return fn();
    } finally {
        for (const k of Object.keys(vars)) {
            if (prev[k] === undefined) delete process.env[k];
            else process.env[k] = prev[k];
        }
    }
}

async function withEnvAsync(vars, fn) {
    const prev = {};
    for (const k of Object.keys(vars)) {
        prev[k] = Object.prototype.hasOwnProperty.call(process.env, k) ? process.env[k] : undefined;
        if (vars[k] === undefined || vars[k] === null) delete process.env[k];
        else process.env[k] = String(vars[k]);
    }
    try {
        return await fn();
    } finally {
        for (const k of Object.keys(vars)) {
            if (prev[k] === undefined) delete process.env[k];
            else process.env[k] = prev[k];
        }
    }
}

// ---------------------------------------------------------------- 1. Multi-platform installer & adopt
test("office: setupAll, init ve adopt tüm platformları (Claude, Codex, Antigravity) kapsar", async () => {
    const fakeHome = tmpDir("setup-home");
    const defaultEnv = { USERPROFILE: fakeHome, HOME: fakeHome };
    const defaultTargets = userSkillTargets(defaultEnv);
    eq(defaultTargets.map((t) => t.id), ["claude", "codex", "antigravity"]);
    ok(defaultTargets[0].file.endsWith(path.join(".claude", "skills", "claudevolution", "SKILL.md")), "claude hedef yolu");
    ok(defaultTargets[1].file.endsWith(path.join(".codex", "skills", "claudevolution", "SKILL.md")), "codex hedef yolu");
    ok(defaultTargets[2].file.endsWith(path.join(".gemini", "antigravity", "skills", "claudevolution", "SKILL.md")), "antigravity hedef yolu");

    const customClaude = path.join(fakeHome, "custom-claude");
    const customCodex = path.join(fakeHome, "custom-codex");
    const customAgy = path.join(fakeHome, "custom-agy");
    const customEnv = {
        USERPROFILE: fakeHome,
        HOME: fakeHome,
        CLAUDE_CONFIG_DIR: customClaude,
        CODEX_HOME: customCodex,
        ANTIGRAVITY_HOME: customAgy,
    };

    const first = setupAll({ env: customEnv });
    eq(first.length, 3);
    ok(first.every((r) => r.status === "yeni"), "ilk kurulum tüm hedeflerde yeni olmalı");
    for (const r of first) {
        ok(fs.existsSync(r.file), `dosya oluşmalı: ${r.file}`);
        const text = readText(r.file);
        ok(!text.includes("{{pkg}}"), "şablon yer tutucusu değişmiş olmalı");
        ok(!text.includes("\\"), "Windows ters eğik çizgi içermemeli");
    }

    const second = setupAll({ env: customEnv });
    ok(second.every((r) => r.status === "aynı"), "ikinci setupAll idempotent olmalı");

    // Change one file to verify stale skill update detection.
    writeText(first[1].file, "eski\n");
    const third = setupAll({ env: customEnv });
    eq(third.map((r) => r.status), ["aynı", "güncellendi", "aynı"]);

    // cv init places skills across .claude, .codex, .agent + .agent/workflows/loop.md + projectMode.
    const greenDir = tmpDir("green-init");
    init(greenDir, { name: "green-proj" });
    const greenCfg = loadConfig(greenDir);
    eq(greenCfg.projectMode, "greenfield");
    eq(validate(greenCfg).errors, []);

    for (const base of [".claude/skills", ".codex/skills", ".agent/skills"]) {
        for (const sk of ["durum", "calis", "otonom", "damit", "cv-init"]) {
            ok(fs.existsSync(path.join(greenDir, base, sk, "SKILL.md")), `eksik beceri: ${base}/${sk}`);
        }
    }
    const loopWf = path.join(greenDir, ".agent/workflows/loop.md");
    ok(fs.existsSync(loopWf), "Antigravity loop workflow yazılmalı");
    ok(readText(loopWf).includes("description:"), "loop.md YAML frontmatter taşımalı");
    ok(readText(loopWf).includes("<!-- claudevolution "), "loop.md sürüm damgası taşımalı");

    // cv init CLI run (isolated user targets, no external side effects)
    const cliDir = tmpDir("cli-init");
    await withEnvAsync({
        USERPROFILE: fakeHome,
        HOME: fakeHome,
        CLAUDE_CONFIG_DIR: path.join(fakeHome, "cli-claude"),
        CODEX_HOME: path.join(fakeHome, "cli-codex"),
        ANTIGRAVITY_HOME: path.join(fakeHome, "cli-agy"),
        CV_NO_NOTIFY: "1",
    }, async () => {
        const origLog = console.log;
        console.log = () => {};
        try {
            await initRun({ _: [], dir: cliDir, name: "cli-proj", lang: "en", "no-doctor": true });
        } finally {
            console.log = origLog;
        }
        ok(fs.existsSync(path.join(fakeHome, "cli-agy", "skills", "claudevolution", "SKILL.md")), "initRun agy makine becerisi");
        ok(fs.existsSync(path.join(cliDir, ".agent/workflows/loop.md")), "initRun loop.md");
        ok(readText(path.join(cliDir, ".agent/workflows/loop.md")).includes("cv cycle begin"), "en loop.md içeriği");
    });

    // adopt preserves existing .codex/.agent config, migrates KARARNAMELER, and sets projectMode: "adopted".
    const legacyDir = tmpDir("adopt-multi");
    writeText(path.join(legacyDir, ".codex/skills/calis/SKILL.md"), "# custom codex calis\n");
    writeText(path.join(legacyDir, ".codex/skills/my-codex-tool/SKILL.md"), "# domain tool\n");
    writeText(path.join(legacyDir, ".codex/config.toml"), "model = 'codex'\n");
    writeText(path.join(legacyDir, ".agent/skills/durum/SKILL.md"), "# custom agy durum\n");
    writeText(path.join(legacyDir, ".agent/workflows/loop.md"), "# custom loop\n");
    writeText(path.join(legacyDir, ".agent/settings.json"), '{"theme":"dark"}\n');
    writeText(path.join(legacyDir, "build/otonom/KARARNAMELER.md"), "# Eski Kararnameler\n- [2026-01-01] Kural 1\n");

    const p = adoptPlan(legacyDir);
    eq(p.cfg.projectMode, "adopted");
    ok(p.rows.some((r) => r.src === ".codex/skills/calis/" && r.action === "birleştir"), "adopt calis birleştir");
    ok(p.rows.some((r) => r.src === ".codex/skills/my-codex-tool/" && r.action === "kalır"), "adopt custom skill kalır");
    ok(p.rows.some((r) => r.src === ".codex/config.toml" && r.action === "kalır"), "adopt codex config kalır");
    ok(p.rows.some((r) => r.src === ".agent/workflows/loop.md" && r.action === "birleştir"), "adopt loop.md birleştir");
    ok(p.rows.some((r) => r.src === ".agent/settings.json" && r.action === "kalır"), "adopt agent settings kalır");
    ok(p.rows.some((r) => r.src === "build/otonom/KARARNAMELER.md" && r.target === ".evrim/otonom/KARARNAMELER.md" && r.action === "kopya"), "adopt KARARNAMELER kopya");

    const applied = adoptApply(p);
    const adoptedCfg = loadConfig(legacyDir);
    eq(adoptedCfg.projectMode, "adopted");
    eq(validate(adoptedCfg).errors, []);
    eq(readText(path.join(legacyDir, ".codex/skills/calis/SKILL.md")), "# custom codex calis\n");
    eq(readText(path.join(legacyDir, ".agent/workflows/loop.md")), "# custom loop\n");
    ok(applied.newFiles.includes(".codex/skills/calis/SKILL.md.new"), "applied newFiles codex calis.new");
    ok(applied.newFiles.includes(".agent/workflows/loop.md.new"), "applied newFiles loop.md.new");
    ok(!fs.existsSync(path.join(legacyDir, ".codex/skills/my-codex-tool/SKILL.md.new")), "projeye özgü beceriye .new yazılmamalı");
    ok(readText(path.join(legacyDir, ".evrim/otonom/KARARNAMELER.md")).includes("Kural 1"), "kopyalanan KARARNAMELER içeriği");

    // claudevrim.js non-TTY CLI smoke test (uses isolated CLAUDEVRIM_HOME, offline, never blocks on Enter).
    const cliHome = tmpDir("claudevrim-home");
    const cvEnv = {
        ...process.env,
        CLAUDEVRIM_HOME: cliHome,
        CLAUDEVRIM_OFFLINE: "1",
        USERPROFILE: cliHome,
        HOME: cliHome,
        CLAUDE_CONFIG_DIR: path.join(cliHome, ".claude"),
        CODEX_HOME: path.join(cliHome, ".codex"),
        ANTIGRAVITY_HOME: path.join(cliHome, ".gemini/antigravity"),
        CV_NO_NOTIFY: "1",
    };
    const devRes = spawnSync(
        process.execPath,
        [...(process.versions.deno ? ["run", "-A"] : []), path.join(PKG_ROOT, "bin/claudevrim.js"), "gelistirici", PKG_ROOT],
        { cwd: PKG_ROOT, encoding: "utf8", timeout: 10000, input: "", env: cvEnv }
    );
    eq(devRes.status, 0, `claudevrim gelistirici exit: ${devRes.stderr || devRes.stdout}`);
    const cvRes = spawnSync(
        process.execPath,
        [...(process.versions.deno ? ["run", "-A"] : []), path.join(PKG_ROOT, "bin/claudevrim.js"), "kur", "--no-path"],
        { cwd: PKG_ROOT, encoding: "utf8", timeout: 10000, input: "", env: cvEnv }
    );
    eq(cvRes.status, 0, `claudevrim kur exit: ${cvRes.stderr || cvRes.stdout}`);
    ok(cvRes.stdout.includes("Her şey tamamlandı, başlamaya hazırsınız!"), "kurulum bitiş mesajı görünmeli");
    ok(cvRes.stdout.includes("zaten en güncel sürüm kurulu"), "aynı sürümde güncel mesajı vermeli");
    ok(fs.existsSync(path.join(cliHome, ".codex/skills/claudevolution/SKILL.md")), "claudevrim codex skill");
    ok(fs.existsSync(path.join(cliHome, ".gemini/antigravity/skills/claudevolution/SKILL.md")), "claudevrim agy skill");

    // Version upgrade check: 1.0.20 (outdated gelistirici clone) -> local bare repo package upgrade + idempotent 2nd run.
    const upgRoot = tmpDir("cv-upgrade-check");
    const oldClone = path.join(upgRoot, "old-clone");
    const remoteRepo = path.join(upgRoot, "remote.git");
    const seedWork = path.join(upgRoot, "seed");
    const upgHome = path.join(upgRoot, "cv-home");

    writeJson(path.join(oldClone, "package.json"), { name: "claudevolution", version: "1.0.20" });
    writeText(path.join(oldClone, "bin/cv.js"), "export async function main() { return 0; }\n");

    git(["init", "-q", "--bare", remoteRepo], upgRoot);
    git(["symbolic-ref", "HEAD", "refs/heads/main"], remoteRepo);
    git(["init", "-q", "-b", "main", seedWork], upgRoot);
    for (const [k, v] of [["user.email", "test@example.invalid"], ["user.name", "test"], ["commit.gpgsign", "false"]]) git(["config", k, v], seedWork);
    const currentPkg = readJson(path.join(PKG_ROOT, "package.json"));
    const curVer = String(currentPkg.version || "1.0.21");
    const [maj, min, pat] = curVer.split(".").map((n) => parseInt(n, 10) || 0);
    const upgradedVer = `${maj}.${min}.${pat + 1}`;
    writeJson(path.join(seedWork, "package.json"), { ...currentPkg, version: upgradedVer });
    for (const rel of ["bin/cv.js", "core/lib/config.js", "core/lib/util.js", "core/lib/process.js", "core/lib/secrets.js", "core/cli/setup.js", "templates/user/claudevolution/SKILL.md", "templates/project/.evrim/config.json"]) {
        writeText(path.join(seedWork, rel), readText(path.join(PKG_ROOT, rel)));
    }
    git(["add", "-A"], seedWork);
    ok(git(["commit", "-qm", "seed"], seedWork).ok, "seed bare remote commit");
    ok(git(["remote", "add", "origin", remoteRepo], seedWork).ok, "add remote");
    ok(git(["push", "-q", "origin", "main"], seedWork).ok, "push bare remote");

    writeJson(path.join(upgHome, "kurulum.json"), { repo: remoteRepo, paket: oldClone, gelistirici: true });
    const upgEnv = {
        ...process.env,
        CLAUDEVRIM_HOME: upgHome,
        CLAUDEVRIM_REPO: remoteRepo,
        USERPROFILE: upgHome,
        HOME: upgHome,
        CLAUDE_CONFIG_DIR: path.join(upgHome, ".claude"),
        CODEX_HOME: path.join(upgHome, ".codex"),
        ANTIGRAVITY_HOME: path.join(upgHome, ".gemini/antigravity"),
        CV_NO_NOTIFY: "1",
    };
    delete upgEnv.CLAUDEVRIM_OFFLINE;

    const upgRes = spawnSync(
        process.execPath,
        [...(process.versions.deno ? ["run", "-A"] : []), path.join(PKG_ROOT, "bin/claudevrim.js"), "kur", "--no-path"],
        { cwd: PKG_ROOT, encoding: "utf8", timeout: 15000, input: "", env: upgEnv }
    );
    eq(upgRes.status, 0, `claudevrim upgrade exit: ${upgRes.stderr || upgRes.stdout}`);
    ok(upgRes.stdout.includes(`v1.0.20 → v${upgradedVer}`), `yükseltme sürüm bilgisi bekleniyordu:\n${upgRes.stdout}`);
    ok(upgRes.stdout.includes(`Sürüm güncellendi: v1.0.20 → v${upgradedVer}`), "banner yükseltme bilgisi göstermeli");
    eq(readJson(path.join(upgHome, "kurulum.json")).gelistirici, false, "eski geliştirici klonundan standart pakete geçmeli");

    // Re-running now must detect already-latest installed version.
    const sameRes = spawnSync(
        process.execPath,
        [...(process.versions.deno ? ["run", "-A"] : []), path.join(PKG_ROOT, "bin/claudevrim.js"), "kur", "--no-path"],
        { cwd: PKG_ROOT, encoding: "utf8", timeout: 15000, input: "", env: upgEnv }
    );
    eq(sameRes.status, 0, `claudevrim idempotent exit: ${sameRes.stderr || sameRes.stdout}`);
    ok(sameRes.stdout.includes(`Zaten güncel sürüm kurulu (v${upgradedVer})`), `ikinci çalıştırma güncel demeli:\n${sameRes.stdout}`);

    // Newer installed version (9.9.9) must be preserved when older/lower installer runs offline.
    writeJson(path.join(upgHome, "paket/package.json"), { ...currentPkg, version: "9.9.9" });
    const newerRes = spawnSync(
        process.execPath,
        [...(process.versions.deno ? ["run", "-A"] : []), path.join(PKG_ROOT, "bin/claudevrim.js"), "kur", "--no-path"],
        { cwd: PKG_ROOT, encoding: "utf8", timeout: 15000, input: "", env: { ...upgEnv, CLAUDEVRIM_OFFLINE: "1" } }
    );
    eq(newerRes.status, 0, `claudevrim newer installed exit: ${newerRes.stderr || newerRes.stdout}`);
    ok(newerRes.stdout.includes("kurulu sürüm (v9.9.9)") && newerRes.stdout.includes("daha güncel"), `kurulu yüksek sürüm korunmalı:\n${newerRes.stdout}`);
});

// ---------------------------------------------------------------- 2. pace() rich metrics & summary
test("office: pace() zengin metrikler (minutesLeft, avgTurnBurn, projectedEndPct, summary) doğru hesaplar", () => {
    const now = new Date("2026-11-14T15:00:00Z");
    const resetsAt = new Date(now.getTime() + 14 * 60000).toISOString(); // 14 min left -> target = round(90 * 286 / 300) = 86

    // Boundary check: with default band=8, five=78 gives diff=-8 (NORMAL); with band=6, five=78 gives HIZLAN.
    const normalBoundary = pace({ five: 78, fiveResetsAt: resetsAt }, { fiveHourExit: 90, paceBand: 8 }, now);
    eq(normalBoundary.mode, "NORMAL");
    eq(normalBoundary.target, 86);
    eq(normalBoundary.minutesLeft, 14);

    const hizlanBand6 = pace({ five: 78, fiveResetsAt: resetsAt }, { fiveHourExit: 90, paceBand: 6 }, now);
    eq(hizlanBand6.mode, "HIZLAN");
    eq(hizlanBand6.target, 86);
    eq(hizlanBand6.wakeSeconds, 300);
    ok(
        hizlanBand6.summary.startsWith("HIZLAN (%78 kullanıldı / hedef çizgi %86; pencere 14 dakika sonra sıfırlanıyor"),
        `beklenen summary başlangıcı değil: ${hizlanBand6.summary}`
    );

    // With intra-window history + stale prior window entry (ignored in avgTurnBurn & projectedEndPct).
    const history = [
        { resets: "2026-11-14T09:00:00Z", five: 95, at: "2026-11-14T08:50:00Z" },
        { resets: resetsAt, five: 62, at: "2026-11-14T14:20:00Z" },
        { resets: resetsAt, five: 70, at: "2026-11-14T14:40:00Z" },
        { resets: resetsAt, five: 76, at: "2026-11-14T14:55:00Z" },
    ];
    const rich = pace({ five: 76, fiveResetsAt: resetsAt }, { fiveHourExit: 90, paceBand: 8 }, now, 5 * 3600, 8, history);
    eq(rich.mode, "HIZLAN");
    eq(rich.target, 86);
    eq(rich.diff, -10);
    eq(rich.minutesLeft, 14);
    eq(rich.avgTurnBurn, 7); // deltas: +8 and +6 -> avg 7
    // spanMin = 35 (14:20..14:55), gain = 14 -> 76 + (14/35)*14 = 81.6
    eq(rich.projectedEndPct, 81.6);
    ok(rich.summary.includes("ort. tur yakımı ~%7"), `ort. tur yakımı eksik: ${rich.summary}`);

    // Ahead of target -> YAVAS
    const midResets = new Date(now.getTime() + 150 * 60000).toISOString(); // elapsed 0.5 -> target 45
    const yavas = pace({ five: 72, fiveResetsAt: midResets }, { fiveHourExit: 90, paceBand: 8 }, now);
    eq(yavas.mode, "YAVAS");
    eq(yavas.target, 45);
    eq(yavas.wakeSeconds, 1800);
    ok(yavas.summary.includes("pencere sonu tahmini ~%100"), `tahmin eksik: ${yavas.summary}`);
});

// ---------------------------------------------------------------- 3. evaluateWindowAndTune() self-tuning
test("office: evaluateWindowAndTune() %30 düşük çıktıya öz-ayar + kararname yazar, yüksek verimi korur", () => {
    // Subcase A: %30 quota + 0 work -> underutilized, tunes config, writes KARARNAMELER.md, enforces cooldown
    const cfgLow = makeGitProject("tune-low", {
        roadmap: "# Yol Haritası\n\n- [ ] Açık görev 1\n- [ ] Açık görev 2\n",
    });
    const win1 = "2026-11-14T15:00:00Z";
    const win2 = "2026-11-14T20:00:00Z";
    const stateLow = { total: 3, idleCycles: 0, sinceDistill: 0, unknownStreak: 0, windowHistory: [], tunedWindows: [] };

    recordWindowObservation(stateLow, { five: 18, week: 10, fiveResetsAt: win1 }, 0, new Date("2026-11-14T12:00:00Z"), { mode: "NORMAL", decision: "GO", tasksDone: 0 });
    recordWindowObservation(stateLow, { five: 30, week: 11, fiveResetsAt: win1 }, 0, new Date("2026-11-14T14:50:00Z"), { mode: "HIZLAN", decision: "GO", tasksDone: 0 });

    const resLow = evaluateWindowAndTune(cfgLow, stateLow, { five: 2, week: 11, fiveResetsAt: win2 }, new Date("2026-11-14T15:05:00Z"));
    eq(resLow.tuned, true, "düşük kullanımda öz-ayar çalışmalı");
    eq(resLow.verdict.status, "underutilized");
    eq(resLow.verdict.last, 30);
    eq(resLow.verdict.efficiency, "low");
    ok(resLow.changes.includes("paceBand 8→6"), `paceBand düşmeli: ${resLow.changes}`);
    ok(resLow.changes.includes("delegate.lanes 3→4"), `şerit artmalı: ${resLow.changes}`);
    eq(cfgLow.autonomy.gates.paceBand, 6);
    eq(cfgLow.delegate.lanes, 4);

    const diskCfgLow = readJson(path.join(cfgLow.root, ".evrim/config.json"));
    eq(diskCfgLow.autonomy.gates.paceBand, 6);
    eq(diskCfgLow.delegate.lanes, 4);

    ok(fs.existsSync(decreeFile(cfgLow)), "KARARNAMELER.md yazılmalı");
    const decreesLow = readDecrees(cfgLow);
    eq(decreesLow.length, 1);
    ok(/^-\s*\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}\]/.test(decreesLow[0]), `zaman damgalı kararname: ${decreesLow[0]}`);
    ok(decreesLow[0].includes("underutilized"), decreesLow[0]);

    // Cooldown: calling again for the same transition does not re-tune or duplicate decree.
    const repeat = evaluateWindowAndTune(cfgLow, stateLow, { five: 4, week: 11, fiveResetsAt: win2 }, new Date("2026-11-14T15:20:00Z"));
    eq(repeat.tuned, false);
    eq(repeat.verdict, null);
    eq(readDecrees(cfgLow).length, 1, "aynı pencere ikinci kez yargılanmamalı");

    // Subcase B: %30 quota + high work output -> high_efficiency_underutilized, does NOT treat method as faulty
    const cfgHigh = makeGitProject("tune-high", {
        roadmap: "# Yol Haritası\n\n- [x] Biten\n- [ ] Açık görev\n",
    });
    const stateHigh = { total: 2, idleCycles: 0, sinceDistill: 0, unknownStreak: 0, windowHistory: [], tunedWindows: [] };
    recordWindowObservation(stateHigh, { five: 16, week: 8, fiveResetsAt: win1 }, 2, new Date("2026-11-14T13:00:00Z"), { mode: "NORMAL", decision: "GO", tasksDone: 1 });
    recordWindowObservation(stateHigh, { five: 30, week: 9, fiveResetsAt: win1 }, 1, new Date("2026-11-14T14:55:00Z"), { mode: "NORMAL", decision: "GO", tasksDone: 1 });

    const resHigh = evaluateWindowAndTune(cfgHigh, stateHigh, { five: 1, week: 9, fiveResetsAt: win2 }, new Date("2026-11-14T15:05:00Z"));
    eq(resHigh.tuned, true);
    eq(resHigh.verdict.status, "high_efficiency_underutilized");
    eq(resHigh.verdict.efficiency, "high");
    ok(resHigh.verdict.hint.includes("yöntem verimli"), `yüksek verim tanınmalı: ${resHigh.verdict.hint}`);
    eq(cfgHigh.autonomy.gates.paceBand, 7);
    eq(cfgHigh.delegate.lanes, 4);

    // Methodology audit on the productive run must NOT suggest YAKLASIM_DEGISTIR.
    const auditHigh = auditMethodology(cfgHigh, stateHigh, { pace: null }, new Date("2026-11-14T15:05:00Z"), { recovery: [] });
    ok(auditHigh.every((l) => !l.includes("YAKLASIM_DEGISTIR")), `verimli yönteme YAKLASIM_DEGISTIR basılmamalı: ${auditHigh.join("\n")}`);

    // Subcase C: expiring window trigger (<= 15 min left, five=30 < exit-15) also tunes proactively.
    const cfgExp = makeGitProject("tune-exp", {
        roadmap: "# Yol Haritası\n\n- [ ] Kalan iş\n",
    });
    const expNow = new Date("2026-11-14T14:50:00Z");
    const expState = { total: 1, idleCycles: 0, sinceDistill: 0, unknownStreak: 0, windowHistory: [], tunedWindows: [] };
    const expRes = evaluateWindowAndTune(cfgExp, expState, { five: 30, week: 12, fiveResetsAt: win1 }, expNow);
    eq(expRes.tuned, true);
    eq(expRes.verdict.status, "underutilized");
    ok(expRes.decree.includes("Pencere sıfırlanmak üzere"), expRes.decree);
});

// ---------------------------------------------------------------- 4. auditMethodology()
test("office: auditMethodology() takılan döngüde strateji değişimi ve ACIK_CERCEVE üretir", () => {
    const cfg = makeGitProject("audit-pivot");
    appendDecree(cfg, "Mimariyi sadeleştir", new Date("2026-11-14T10:00:00Z"));
    const win = "2026-11-14T18:00:00Z";
    const stalledState = {
        total: 4,
        idleCycles: 2,
        windowHistory: [
            { resets: win, five: 20, commits: 0, at: "2026-11-14T14:00:00Z" },
            { resets: win, five: 28, commits: 0, at: "2026-11-14T14:15:00Z" },
            { resets: win, five: 36, commits: 0, at: "2026-11-14T14:30:00Z" },
        ],
    };

    const g = {
        pace: pace({ five: 36, fiveResetsAt: win }, cfg.autonomy.gates, new Date("2026-11-14T14:30:00Z")),
    };
    const lines = auditMethodology(cfg, stalledState, g, new Date("2026-11-14T14:30:00Z"), { recovery: [] });
    ok(lines.some((l) => l.startsWith("TEMPO: ")), "TEMPO satırı olmalı");
    const pivot = lines.find((l) => l.startsWith("OFIS_MUHAKEMESI: "));
    ok(pivot && pivot.includes("YAKLASIM_DEGISTIR"), `yaklaşım değişimi bekleniyordu: ${pivot}`);
    ok(pivot.includes("yakım ~%16"), `son yakım raporlanmalı: ${pivot}`);
    ok(lines.some((l) => l.startsWith("KARARNAME: ") && l.includes("Mimariyi sadeleştir")), "aktif kararname enjekte edilmeli");
    ok(lines.some((l) => l.startsWith("ACIK_CERCEVE: ") && l.includes("Sadece yazılı kuralları izleme")), "ACIK_CERCEVE satırı olmalı");
});

// ---------------------------------------------------------------- 5. Council orchestration & workerPool
test("council: planCouncil(), cv council ve choose.workerPool maliyet/kota/lisans duyarlılığı", async () => {
    const cfg = makeGitProject("council-proj");

    // inferComplexity baseline & Turkish/Unicode inflection cases
    eq(inferComplexity("typo fix in button label"), "low");
    eq(inferComplexity("tek dosya renk uyumu"), "low");
    eq(inferComplexity("basit metin düzelt"), "low");
    eq(inferComplexity("küçük yazım hatası"), "low");
    eq(inferComplexity("distributed system architecture refactor"), "high");
    eq(inferComplexity("mimari tasarim ve orkestrasyon"), "high");
    eq(inferComplexity("çoklu ajan"), "high");
    eq(inferComplexity("ölçekleme"), "high");
    eq(inferComplexity("göç"), "high");
    eq(inferComplexity("İleri ölçekleme ve mimariye dönüşüm"), "high");
    eq(inferComplexity(""), "medium");

    // 1. Low complexity -> solo (no wasted council tokens)
    const soloPlan = planCouncil(cfg, {
        topic: "basit metin typo duzeltmesi",
        quota: { five: 20, week: 15 },
        checkCmd: () => false,
        env: {},
    });
    eq(soloPlan.complexity, "low");
    eq(soloPlan.mode, "solo");
    eq(soloPlan.seats.length, 0);
    eq(soloPlan.costBenefit.worthwhile, false);

    // 2. Tight quota / Pro plan without external API -> cost-aware light (no Opus drain)
    const tightPlan = planCouncil(cfg, {
        topic: "distributed system architecture design",
        plan: "pro",
        quota: { five: 78, week: 55 },
        checkCmd: () => false,
        env: {},
    });
    eq(tightPlan.complexity, "high");
    eq(tightPlan.mode, "light");
    eq(tightPlan.seats.length, 2);
    ok(tightPlan.seats.every((s) => s.tier !== "opus" && s.model !== "opus"), "sıkı Pro kotada Opus koltuğu olmamalı");
    ok(tightPlan.costBenefit.reason.includes("kotayı yakmamak"), tightPlan.costBenefit.reason);

    // 3. Healthy Max plan + diverse CLI/API pool -> deep 4 seats across engines
    const dsKey = J("test", "-", "ds", "-", "token");
    const mockEnv = { DEEPSEEK_API_KEY: dsKey };
    const deepPlan = planCouncil(cfg, {
        topic: "system architecture and risk analysis",
        plan: "max",
        quota: { five: 15, week: 20 },
        licensePolicy: "commercial",
        checkCmd: (cmd) => cmd === "claude" || cmd === "codex" || cmd === "agy",
        env: mockEnv,
    });
    eq(deepPlan.mode, "deep");
    eq(deepPlan.seats.length, 4);
    eq(deepPlan.license.policy, "commercial");
    eq(deepPlan.license.restricted, true);
    ok(deepPlan.license.allowedLicenses.includes("MIT"));
    const engines = new Set(deepPlan.seats.map((s) => s.engine));
    ok(engines.has("codex") && engines.has("agy") && engines.has("deepseek"), `çeşitli havuz kullanılmalı: ${[...engines]}`);
    ok(deepPlan.seats[0].prompt.includes("GPL/AGPL"), "ticari lisans uyarısı koltuk istemine girmeli");

    // 4. Personal license policy -> unrestricted clean-room research
    const personal = evaluateLicensePolicy("personal", cfg);
    eq(personal.policy, "personal");
    eq(personal.restricted, false);
    eq(personal.allowedLicenses, null);
    ok(personal.guidance.includes("clean-room"));

    // 5. runCouncil writes MECLIS.md with blind synthesis protocol
    const rc = await runCouncil(cfg, {
        topic: "system architecture review",
        plan: "max",
        quota: { five: 10, week: 10 },
        licensePolicy: "personal",
        checkCmd: (cmd) => cmd === "claude" || cmd === "codex",
        env: {},
    });
    ok(fs.existsSync(rc.mdPath), "MECLIS.md oluşmalı");
    const md = readText(rc.mdPath);
    ok(md.includes("## Kör Sentez Protokolü") && md.includes("<license_policy mode=\"personal\" restricted=\"false\">"));

    // 6. cv council CLI (--json + uninitialized directory fallback)
    const bareDir = tmpDir("council-bare");
    const cliLogs = [];
    const origLog = console.log;
    console.log = (...a) => cliLogs.push(a.join(" "));
    try {
        await councilRun({ _: [], dir: bareDir, topic: "typo fix", "no-write": true, json: true }, { env: {} });
        await councilRun({ _: [], dir: bareDir, topic: "distributed system architecture", license: "commercial", plan: "pro", "no-write": true, json: true }, { env: {} });
    } finally {
        console.log = origLog;
    }
    const soloJson = JSON.parse(cliLogs[0]);
    eq(soloJson.plan.mode, "solo");
    const commercialJson = JSON.parse(cliLogs[1]);
    eq(commercialJson.plan.license.policy, "commercial");
    ok(["light", "deep"].includes(commercialJson.plan.mode));

    // 7. choose.workerPool & local-cli preference
    const fakeCfg = {
        delegate: {
            provider: "deepseek",
            policy: "api-yoksa-subagent",
            subagentModel: "haiku",
            localCli: "before-subagent",
            localCliOrder: ["codex", "agy", "gemini"],
            providers: { deepseek: { model: "deepseek-chat", keyEnv: "DEEPSEEK_API_KEY" } },
        },
    };
    const pool = workerPool(fakeCfg, mockEnv, { checkCmd: (c) => c === "codex" || c === "gemini" });
    eq(pool.api.available, true);
    eq(pool.availableClis, ["codex", "gemini"]);
    const picked = choose(fakeCfg, {}, { checkCmd: (c) => c === "agy" });
    eq(picked, { mode: "local-cli", name: "agy", cli: "agy", reason: "DEEPSEEK_API_KEY ortamda yok; yerel CLI mevcut: agy" });
});

// ---------------------------------------------------------------- 6. checkFinalForm, KARAR: BITTI gate, safe notifyOwner
test("office: checkFinalForm(), KARAR: BITTI kapısı ve güvenli notifyOwner() toast açmadan çalışır", () => {
    const verifyScript = "export const ok = true;\n";

    // Gate 1: kurulum === "bekliyor" blocks finalForm
    const cfgWait = makeGitProject("ff-wait", {
        kurulum: "bekliyor",
        roadmap: "# Yol Haritası\n\n- [x] Hazır\n",
        finalForm: { deliverable: "dist/out.txt", verifyCmd: null, criteria: ["tam"] },
    });
    writeText(path.join(cfgWait.root, "dist/out.txt"), verifyScript);
    const rWait = checkFinalForm(cfgWait);
    eq(rWait.done, false);
    ok(rWait.reason.includes("kurulum henüz tamamlanmadı"));

    // Gate 2: open roadmap items block BITTI
    const cfgOpen = makeGitProject("ff-open", {
        kurulum: "tamam",
        roadmap: "# Yol Haritası\n\n- [x] İlk\n- [ ] Kalan\n",
        finalForm: { deliverable: "dist/out.txt", verifyCmd: null },
    });
    writeText(path.join(cfgOpen.root, "dist/out.txt"), verifyScript);
    const rOpen = checkFinalForm(cfgOpen);
    eq(rOpen.done, false);
    eq(rOpen.openCount, 1);

    // Gate 3: missing deliverable blocks BITTI
    const cfgNoOut = makeGitProject("ff-no-out", {
        kurulum: "tamam",
        roadmap: "# Yol Haritası\n\n- [x] Bitti\n",
        finalForm: { deliverable: "dist/missing.exe", verifyCmd: null },
    });
    const rNoOut = checkFinalForm(cfgNoOut);
    eq(rNoOut.done, false);
    eq(rNoOut.verifyOk, false);
    ok(rNoOut.reason.includes("nihai çıktı bulunamadı"));

    // Gate 4: failing verifyCmd blocks BITTI
    const cfgFailCmd = makeGitProject("ff-fail-cmd", {
        kurulum: "tamam",
        roadmap: "# Yol Haritası\n\n- [x] Bitti\n",
        finalForm: { deliverable: "dist/out.txt", verifyCmd: "fake-verify --strict" },
    });
    writeText(path.join(cfgFailCmd.root, "dist/out.txt"), verifyScript);
    const rFail = checkFinalForm(cfgFailCmd, null, { run: () => ({ ok: false, code: 2, timedOut: false, out: "" }) });
    eq(rFail.done, false);
    eq(rFail.verifyOk, false);
    ok(rFail.reason.includes("finalForm doğrulaması başarısız"));

    // Gate 5: passing finalForm with real verifyCmd (using deno/node runtime, no mocked run)
    const passVerifyCmd = process.versions.deno
        ? [process.execPath, "eval", "console.log('ok')"]
        : [process.execPath, "-e", "process.exit(0)"];
    const cfgReady = makeGitProject("ff-ready", {
        kurulum: "tamam",
        roadmap: "# Yol Haritası\n\n- [x] Ana özellik\n- [x] Doğrulama\n",
        finalForm: {
            deliverable: "dist/app.js",
            verifyCmd: passVerifyCmd,
            criteria: ["Tüm görevler kapalı", "Çıktı dosyası doğrulanıyor"],
        },
    });
    writeText(path.join(cfgReady.root, "dist/app.js"), verifyScript);
    git(["add", "dist/app.js"], cfgReady.root);
    ok(git(["commit", "-qm", "deliverable ready"], cfgReady.root).ok);

    const rReady = checkFinalForm(cfgReady);
    eq(rReady.done, true);
    eq(rReady.verifyOk, true);
    eq(rReady.doneCount, 2);
    eq(rReady.deliverablePath, path.resolve(cfgReady.root, "dist/app.js"));

    // Cycle begin returns KARAR: BITTI when ready, unless unread owner note blocks it.
    withEnv({ CV_NO_NOTIFY: "1" }, () => {
        const now = new Date("2026-11-14T16:00:00Z");
        // Unread note prevents immediate BITTI so agent reads owner feedback first.
        writeText(path.join(cfgReady.root, ".evrim/otonom/NOTLAR.md"), "## Notlar\n\n- Son kontrol ekle\n");
        const blockedByNote = cycle.begin(cfgReady, { five: "10", week: "10", "five-resets": "2026-11-14T21:00:00Z" }, now, { silentNotify: true });
        eq(blockedByNote.decision, "GO");
        // Close that cycle cleanly without closing ROADMAP blocking -> mark note read & verify end() hits BITTI!
        writeText(path.join(cfgReady.root, ".evrim/otonom/NOTLAR.md"), "## Notlar\n\n- [okundu] Son kontrol ekle\n");
        const endRes = cycle.end(cfgReady, { five: "12", week: "10", "five-resets": "2026-11-14T21:00:00Z", did: "not işlendi" }, now, { silentNotify: true });
        ok(endRes.some((l) => l.startsWith("SONRAKI_KAPI: BITTI")), `SONRAKI_KAPI BITTI bekleniyordu: ${endRes.join(" | ")}`);
        ok(endRes.includes("UYKU: 0"));
        ok(endRes.includes(`DELIVERABLE: ${path.resolve(cfgReady.root, "dist/app.js")}`));

        const bittiBegin = cycle.begin(cfgReady, { five: "12", week: "10" }, new Date("2026-11-14T16:05:00Z"), { silentNotify: true });
        eq(bittiBegin.decision, "BITTI");
        ok(bittiBegin.lines.includes("KARAR: BITTI"));
        ok(bittiBegin.lines.includes("UYKU: 0"));
        ok(bittiBegin.lines.includes(`DELIVERABLE: ${path.resolve(cfgReady.root, "dist/app.js")}`));
    });

    // Safe notifyOwner tests: silent, CV_NO_NOTIFY=1, and mocked Windows toast (zero real OS popup)
    const notifyCfg = makeGitProject("notify-safe", { kurulum: "tamam", finalForm: { deliverable: "dist/app.js" } });
    writeText(path.join(notifyCfg.root, "dist/app.js"), verifyScript);

    let spawnCalls = 0;
    const silentRes = notifyOwner(notifyCfg, {
        silent: true,
        spawn: () => { spawnCalls++; return null; },
        criteria: ["Kriter A"],
        now: new Date("2026-11-14T16:10:00Z"),
    });
    eq(silentRes.ok, true);
    eq(silentRes.ozetUpdated, true);
    eq(silentRes.notified, false);
    eq(silentRes.method, "silent");
    eq(spawnCalls, 0);

    // Repeat call refreshes banner without duplicating "## Tamamlandı (BITTI)"
    notifyOwner(notifyCfg, { silent: true, now: new Date("2026-11-14T16:12:00Z") });
    const ozet = readText(silentRes.ozetPath);
    eq(ozet.match(/## Tamamlandı \(BITTI\)/g)?.length || 0, 1, "BITTI bloğu yinelenmemeli");
    ok(ozet.includes(path.resolve(notifyCfg.root, "dist/app.js")));

    // CV_NO_NOTIFY=1 suppresses OS toast even when NODE_ENV is unset
    withEnv({ CV_NO_NOTIFY: "1", NODE_ENV: undefined }, () => {
        const envSilent = notifyOwner(notifyCfg, {
            spawn: () => { spawnCalls++; return null; },
        });
        eq(envSilent.notified, false);
        eq(envSilent.method, "silent");
        eq(spawnCalls, 0);
    });

    // Mocked spawn confirms win32 powershell balloon arguments without launching powershell
    withEnv({ CV_NO_NOTIFY: undefined, NODE_ENV: undefined }, () => {
        const calls = [];
        const winRes = notifyOwner(notifyCfg, {
            platform: "win32",
            spawn: (cmd, args, opts) => {
                calls.push({ cmd, args, opts });
                return { on() {}, unref() {} };
            },
        });
        eq(winRes.notified, true);
        eq(winRes.method, "powershell-balloon");
        eq(calls.length, 1);
        eq(calls[0].cmd, "powershell");
        ok(calls[0].args.includes("-WindowStyle") && calls[0].args.includes("Hidden"));
        eq(calls[0].opts.windowsHide, true);
        ok(calls[0].opts.env.CV_NOTIFY_TITLE.includes("BITTI"));
    });

    // Antigravity platform self-awareness in cv-init, durum, otonom, AGENTS.md, and .agent/workflows/loop.md
    for (const lang of ["tr", "en"]) {
        const cvInitDoc = readText(path.join(PKG_ROOT, `skills/${lang}/cv-init/SKILL.md`));
        const durumDoc = readText(path.join(PKG_ROOT, `skills/${lang}/durum/SKILL.md`));
        const otonomDoc = readText(path.join(PKG_ROOT, `skills/${lang}/otonom/SKILL.md`));
        ok(cvInitDoc.includes("Antigravity") && cvInitDoc.includes("/goal") && cvInitDoc.includes("/schedule"), `${lang} cv-init: Antigravity komutlari`);
        ok(cvInitDoc.includes("/loop başla"), `${lang} cv-init: Claude Code /loop başla korunmali`);
        ok(durumDoc.includes("[quota]") && durumDoc.includes("/goal") && durumDoc.includes("/schedule"), `${lang} durum: Antigravity kotasi ve komutlari`);
        ok(otonomDoc.includes("schedule(DurationSeconds:") && otonomDoc.includes("manage_task") && otonomDoc.includes("[quota]"), `${lang} otonom: Antigravity schedule/manage_task/[quota]`);
    }
    const tplAgents = readText(path.join(PKG_ROOT, "templates/project/AGENTS.md"));
    ok(tplAgents.includes("/goal") && tplAgents.includes("/schedule") && tplAgents.includes("/loop başla"), "AGENTS şablonu tum platformlari kapsar");
    const agyWf = readText(path.join(cfgReady.root, ".agent/workflows/loop.md"));
    ok(agyWf.includes("schedule") && agyWf.includes("manage_task") && agyWf.includes("[quota]"), ".agent/workflows/loop.md Antigravity araclari");
});
