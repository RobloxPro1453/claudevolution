// Tests for the 8-repo upgrade: atomic FS & extractJson, forbidden/symlink/privacy hardening,
// cv adopt kept-docs fix, 5h local blocks & autoFallback, primeLessons & cv cycle prime,
// agent stagnation/failover/safeStage, independent verifyTask + treeSha receipt, DAG waves & priority/reservoir slots.
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { test, tmpDir, eq, ok, throws } from "./harness.js";
import { extractJson, git, readJson, readText, writeJson, writeText } from "../core/lib/util.js";
import { defaults, isForbidden, loadConfig, realInside, SECRET_RES, validate } from "../core/lib/config.js";
import { allowFakeKey, isSensitiveFile, scan, scanFile, scanText } from "../core/evolve/privacy.js";
import { init } from "../core/cli/init.js";
import { apply as adoptApply, plan as adoptPlan } from "../core/cli/adopt.js";
import { collectClaudeDirs, computeBurnRate, estimateQuota, floorToHour, identifySessionBlocks, projectBlockUsage } from "../core/metrics/blocks.js";
import { measureRound } from "../core/metrics/round.js";
import { gate } from "../core/autonomy/gates.js";
import * as memory from "../core/autonomy/memory.js";
import * as cycle from "../core/autonomy/cycle.js";
import * as agent from "../core/delegate/agent.js";
import * as lanes from "../core/delegate/lanes.js";
import * as slots from "../core/delegate/slots.js";
import { inspectTestQuality, parseDeclaredScope, scanDiffSecrets, verifyTask } from "../core/delegate/verify.js";
import { main as cliMain } from "../bin/cv.js";

// Runtime string builder so literal key/path/email fixtures do not trigger privacy.js on this file.
const J = (...parts) => parts.join("");

function makeGitProject(label, { build = null, testCmd = null } = {}) {
    const dir = tmpDir(label);
    git(["init", "-q", "-b", "main"], dir);
    for (const [k, v] of [["user.email", "test@example.invalid"], ["user.name", "test"], ["commit.gpgsign", "false"]]) {
        git(["config", k, v], dir);
    }
    init(dir, { name: label });
    const cfgFile = path.join(dir, ".evrim/config.json");
    const c = readJson(cfgFile);
    c.delegate.worktreeRoot = "../" + path.basename(dir) + "-lanes";
    c.build = build;
    c.test = testCmd;
    writeJson(cfgFile, c);
    writeText(path.join(dir, "src/app.js"), "export const val = 1;\n");
    git(["add", "-A"], dir);
    ok(git(["commit", "-qm", "init"], dir).ok, "init commit");
    return loadConfig(dir);
}

// ---------------------------------------------------------------- 1. Atomic FS, .corrupt backup, extractJson
test("upgrade: atomik writeJson/writeText, .corrupt yedekleme ve extractJson", () => {
    const dir = tmpDir("atomic");
    const txtPath = path.join(dir, "note.txt");
    const jsonPath = path.join(dir, "state.json");
    writeText(txtPath, "hello\n");
    writeJson(jsonPath, { ok: true, count: 2 });
    eq(readText(txtPath), "hello\n");
    eq(readJson(jsonPath, null), { ok: true, count: 2 });
    const leftoverTmp = fs.readdirSync(dir).filter((f) => f.includes(".tmp."));
    eq(leftoverTmp, [], "geçici .tmp.* dosyası kalmamalı");

    const brokenPath = path.join(dir, "broken.json");
    writeText(brokenPath, "{not-valid-json");
    eq(readJson(brokenPath, { fb: 1 }), { fb: 1 }, "bozuk JSON fallback döner");
    ok(fs.existsSync(brokenPath + ".corrupt"), ".corrupt yedeği oluşturulmalı");
    eq(readText(brokenPath + ".corrupt"), "{not-valid-json");

    const emptyPath = path.join(dir, "empty.json");
    writeText(emptyPath, "   \n");
    eq(readJson(emptyPath, { fb: 2 }), { fb: 2 });
    ok(!fs.existsSync(emptyPath + ".corrupt"), "boş dosyadan .corrupt üretilmemeli");

    eq(extractJson('{"a":1,"b":[2,3]}'), { a: 1, b: [2, 3] }, "ham JSON");
    eq(extractJson("```json\n{\"v\":1}\n```\ntext\n```json\n{\"v\":2}\n```"), { v: 2 }, "son ```json bloğu");
    eq(extractJson('prefix {"msg":"hi } \\" { world","ok":true} suffix'), { msg: 'hi } " { world', ok: true }, "dengeli tarama ve kaçış");
    eq(extractJson("sadece metin [bozuk"), null, "geçersiz metin null");
    eq(extractJson('"yalniz-metin"'), null, "ilkel değer değil nesne/dizi");
});

// ---------------------------------------------------------------- 2. ALWAYS_FORBIDDEN, realInside, SECRET_RES & privacy
test("upgrade: büyük-küçük harfe duyarsız ALWAYS_FORBIDDEN, realInside symlink koruması, gizli desenler", () => {
    const cfg = { ...defaults(), forbiddenWrite: [] };
    for (const p of [
        ".EVRIM/config.json",
        ".GIT/HEAD",
        "Agents.md",
        "CLAUDE.MD",
        "docs/vision.md",
        "DOCS/TASKS/T-001.md",
        ".env",
        ".ENV.local",
        "sub/.npmrc",
        ".netrc",
        "id_rsa",
        "keys/id_ed25519.pub",
        "cert.PEM",
        "secret.key",
        "bundle.p12",
        "store.pfx",
    ]) {
        ok(isForbidden(cfg, p), p + " yasak olmalı (forbiddenWrite boş olsa bile)");
    }
    for (const p of [".env.example", ".env.sample", ".env.template", "docs/tasks/T-001.report.md", "src/index.js"]) {
        ok(!isForbidden(cfg, p), p + " serbest olmalı");
    }

    const base = tmpDir("sym");
    const root = path.join(base, "proj");
    const outside = path.join(base, "outside");
    const extMods = path.join(base, "ext-mods");
    writeText(path.join(root, "src/a.js"), "ok\n");
    writeText(path.join(outside, "secret.txt"), "top-secret\n");
    writeText(path.join(extMods, "pkg/index.js"), "export default 1;\n");

    ok(realInside(root, "src/a.js"), "proje içi mevcut dosya");
    ok(realInside(root, "src/new-sub/b.js"), "proje içi henüz yazılmamış yol");
    eq(realInside(root, "../outside/secret.txt"), false, "üst klasör kaçışı");
    eq(realInside(root, "src/\0bad.js"), false, "null bayt");

    fs.symlinkSync(outside, path.join(root, "escape-link"), "junction");
    fs.symlinkSync(extMods, path.join(root, "node_modules"), "junction");
    eq(realInside(root, "escape-link/secret.txt"), false, "symlink/junction kaçışı engellenmeli");
    eq(realInside(root, "node_modules/pkg/index.js"), false, "izin verilmeden linkDir dışı sayılır");
    ok(realInside(root, "node_modules/pkg/index.js", ["node_modules"]), "allowedLinkDirs içindeki node_modules izinli");

    const samples = [
        J("sk-", "proj_1234567890abcdefGHIJKL"),
        J("ghp_", "0123456789abcdefghijKLMNOP"),
        J("github_pat_", "0123456789abcdefghijKLMN"),
        J("AKIA", "1234567890ABCDEF"),
        J("xoxb-", "1234567890-abcdefghij"),
        J("AIza", "SyA1234567890abcdefghijKLMNOPQRSTUV"),
        J("-----BEGIN ", "RSA PRIVATE KEY-----"),
    ];
    for (const s of samples) {
        ok(SECRET_RES.some((r) => r.test(s)), "SECRET_RES yakalamalı: " + s.slice(0, 8));
        ok(scanText(s).some((f) => f.rule === "anahtar"), "privacy.scanText yakalamalı: " + s.slice(0, 8));
        const badCfg = JSON.parse(JSON.stringify(defaults()));
        badCfg.delegate.intro = s;
        ok(validate(badCfg).errors.some((e) => /anahtar/.test(e)), "validate reddetmeli");
    }

    ok(isSensitiveFile(".env") && isSensitiveFile(".env.production") && isSensitiveFile(".envrc") && isSensitiveFile(".envrc.local") && isSensitiveFile("a/b/.npmrc") && isSensitiveFile("id_ed25519") && isSensitiveFile("keys/id_rsa.pub") && isSensitiveFile("k.pem"));
    ok(!isSensitiveFile(".env.example") && !isSensitiveFile("src/app.js"));
    ok(allowFakeKey(J("sk-abcdefghij", "1234567890abcdef")) && !allowFakeKey(J("sk-", "proj_1234567890abcdefGHIJKL")));

    // Directory-walk fallback when .git is absent: skips refs, node_modules, .evrim
    const nogit = tmpDir("nogit");
    writeText(path.join(nogit, "src/leak.js"), J("const t = '", "ghp_", "0123456789abcdefghijKLMNOP';\n"));
    writeText(path.join(nogit, "config/.env"), "PORT=3000\n");
    writeText(path.join(nogit, "refs/ignored/leak.txt"), J("AKIA", "1234567890ABCDEF\n"));
    writeText(path.join(nogit, "node_modules/mod/leak.txt"), J("AKIA", "1234567890ABCDEF\n"));
    writeText(path.join(nogit, ".evrim/tmp.txt"), J("AKIA", "1234567890ABCDEF\n"));
    const findings = scan(nogit);
    ok(findings.some((f) => f.file === "src/leak.js" && f.rule === "anahtar"), "git yokken src taranmalı");
    ok(findings.some((f) => f.file === "config/.env" && f.rule === "hassas dosya"), "hassas dosya adı yakalanmalı");
    eq(findings.filter((f) => /^(refs|node_modules|\.evrim)\//.test(f.file)), [], "refs/node_modules/.evrim atlanmalı");
    eq(scanFile(nogit, "src/leak.js").length, 1);
});

// ---------------------------------------------------------------- 3. cv adopt kept-docs .new bug fix
test("upgrade: cv adopt kalır işaretli mevcut belgeler için .new üretmez", () => {
    const dir = tmpDir("adopt-kept");
    git(["init", "-q"], dir);
    writeText(path.join(dir, "AGENTS.md"), "# Mevcut ajan kuralları\n");
    writeText(path.join(dir, "docs/VISION.md"), "# Projeye özel vizyon\n");
    writeText(path.join(dir, "docs/PROGRESS.md"), "# Projeye özel ilerleme\n");
    writeText(path.join(dir, "docs/tasks/README.md"), "# Eski ajan görev kuralları\n");
    writeText(path.join(dir, "docs/tasks/TEMPLATE.md"), "# Özel tarif şablonu\n");
    writeText(path.join(dir, ".claude/skills/durum/SKILL.md"), "# Eski durum\n");

    const p = adoptPlan(dir);
    const act = (src) => (p.rows.find((r) => r.src === src) || {}).action;
    eq(act("docs/VISION.md"), "kalır");
    eq(act("docs/PROGRESS.md"), "kalır");
    eq(act("docs/tasks/TEMPLATE.md"), "kalır");
    eq(act("AGENTS.md"), "birleştir");

    const res = adoptApply(p);
    ok(!fs.existsSync(path.join(dir, "docs/VISION.md.new")), "kalır belgesi VISION.md.new üretmemeli");
    ok(!fs.existsSync(path.join(dir, "docs/PROGRESS.md.new")), "kalır belgesi PROGRESS.md.new üretmemeli");
    ok(!fs.existsSync(path.join(dir, "docs/tasks/TEMPLATE.md.new")), "kalır şablon TEMPLATE.md.new üretmemeli");
    ok(!res.newFiles.some((f) => /VISION\.md\.new|PROGRESS\.md\.new|TEMPLATE\.md\.new/.test(f)), "newFiles içinde kalır belgesi olmamalı");
    ok(fs.existsSync(path.join(dir, "AGENTS.md.new")), "birleştirilen AGENTS.md.new üretilmeli");
    ok(fs.existsSync(path.join(dir, "docs/tasks/README.md.new")), "birleştirilen docs/tasks/README.md.new üretilmeli");
    ok(fs.existsSync(path.join(dir, ".claude/skills/durum/SKILL.md.new")), "birleştirilen beceri .new üretilmeli");
});

// ---------------------------------------------------------------- 4. blocks.js, round.js subagents, gates/cycle autoFallback
test("upgrade: blocks.js 5s blok/burnRate/projeksiyon, round alt-ajan sayımı ve gates/cycle autoFallback", async () => {
    const t0 = Date.parse("2026-11-14T10:15:00Z");
    const floor = floorToHour(t0);
    eq(floor, Date.parse("2026-11-14T10:00:00Z"));

    const cfgHome = tmpDir("claude-env");
    const projDir = path.join(cfgHome, "projects");
    fs.mkdirSync(projDir, { recursive: true });
    eq(collectClaudeDirs({ CLAUDE_CONFIG_DIR: cfgHome }), [projDir]);

    const entries = [
        { tsMs: t0, input: 500, output: 500, cacheCreation: 0, cacheRead: 0, model: "claude-sonnet-5-5", id: "e1" },
        { tsMs: t0 + 15 * 60000, input: 1000, output: 1000, cacheCreation: 0, cacheRead: 0, model: "claude-opus-5-5", id: "e2", isSidechain: true, agentId: "sub1" },
        // > 5h gap triggers gap block + new block
        { tsMs: t0 + 7 * 3600000, input: 200, output: 300, cacheCreation: 0, cacheRead: 0, model: "claude-opus-5-5", id: "e3" },
    ];
    const nowActive = t0 + 7 * 3600000 + 30 * 60000;
    const blocks = identifySessionBlocks(entries, 5, nowActive);
    eq(blocks.length, 3, "ilk blok + boşluk + aktif blok");
    eq([blocks[0].isGap, blocks[0].isActive, blocks[0].tokens.total, blocks[0].subagentCount, blocks[0].subagentTokens], [false, false, 3000, 1, 2000]);
    eq(blocks[1].isGap, true);
    eq([blocks[2].isGap, blocks[2].isActive, blocks[2].tokens.total], [false, true, 500]);

    // Block starting at 10:00:00Z with entry at 10:30:00Z -> 30 min active span
    const bStart = Date.parse("2026-11-14T10:00:00Z");
    const bEntries = [{ tsMs: bStart, input: 1500, output: 0, cacheCreation: 0, cacheRead: 0, id: "x1" }, { tsMs: bStart + 30 * 60000, input: 1500, output: 0, cacheCreation: 0, cacheRead: 0, id: "x2" }];
    const bList = identifySessionBlocks(bEntries, 5, bStart + 60 * 60000);
    const activeB = bList[0];
    const rate = computeBurnRate(activeB, bStart + 60 * 60000);
    eq(rate, 100, "3000 token / 30 dk = 100 tok/dk");
    const proj = projectBlockUsage(activeB, rate, bStart + 60 * 60000);
    eq(proj, { remainingMinutes: 240, projectedTokens: 3000 + 240 * 100 });

    // Local JSONL + subagents scan in estimateQuota and round.js
    const cfg = makeGitProject("quota-proj");
    const claudeLogs = path.join(tmpDir("qlogs"), "proj");
    cfg.metrics.claudeProjectDir = claudeLogs;
    const ts1 = "2026-11-14T10:05:00Z", ts2 = "2026-11-14T10:35:00Z";
    const mkLine = (id, ts, model, out, inp) => JSON.stringify({ type: "assistant", sessionId: "sess1", timestamp: ts, message: { id, model, usage: { output_tokens: out, input_tokens: inp, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } });
    writeText(path.join(claudeLogs, "sess1.jsonl"), mkLine("m1", ts1, "claude-opus-5-5", 200, 800) + "\n");
    writeText(path.join(claudeLogs, "sess1/subagents/agent-1.jsonl"), [
        mkLine("sm1", ts1, "claude-haiku-4-5", 100, 400),
        mkLine("sm2", ts2, "claude-haiku-4-5", 100, 400),
    ].join("\n") + "\n");
    writeJson(path.join(claudeLogs, "sess1/subagents/agent-1.meta.json"), { agentType: "Explore" });

    const qNow = Date.parse("2026-11-14T11:00:00Z");
    const est = estimateQuota(cfg.root, cfg, qNow, { quota: { fiveHourTokenLimit: 10000, weeklyTokenLimit: 100000, burnRateWarnShare: 0.85 }, skipMtimePrune: true });
    eq([est.available, est.quotaSource, est.fivePct, est.subagentCount, est.subagentTokens], [true, "local-blocks", 20, 1, 1000]);
    ok(est.burnRate > 0 && est.projectedTokens > 2000, "yakma hızı ve projeksiyon hesaplanmalı");

    // round.js subagent metrics
    const rm = measureRound(cfg, {}, "2026-11-14T09:00:00Z", "2026-11-14T12:00:00Z", "HEAD", "HEAD", 1);
    eq([rm.subagentCount, rm.subagentCalls, rm.subagentTokens, rm.claude.subagentTypes.Explore], [1, 2, 1000, 1]);

    // Direct gate unknown streak contract preserved (no autoFallback)
    const streak = { unknownStreak: 0 };
    eq(gate({ five: "unknown", week: "unknown", state: streak }, cfg.autonomy, new Date(qNow)).decision, "KUCUK");
    eq(gate({ five: "unknown", week: "unknown", state: streak }, cfg.autonomy, new Date(qNow)).decision, "KUCUK");
    eq(gate({ five: "unknown", week: "unknown", state: streak }, cfg.autonomy, new Date(qNow)).decision, "CIK");

    // autoFallback populates local-blocks and triggers KISITLI when projection approaches cap
    const stAuto = { unknownStreak: 2 };
    const gOk = gate({ five: "unknown", week: "unknown", state: stAuto }, cfg.autonomy, new Date(qNow), {
        autoFallback: true,
        root: cfg.root,
        cfg,
        quotaOpts: { quota: { fiveHourTokenLimit: 100000, weeklyTokenLimit: 1000000 }, skipMtimePrune: true }
    });
    eq([gOk.decision, gOk.quotaSource, stAuto.unknownStreak], ["GO", "local-blocks", 0]);

    const gTight = gate({ five: "unknown", week: "unknown", state: {} }, cfg.autonomy, new Date(qNow), {
        autoFallback: true,
        root: cfg.root,
        cfg,
        quotaOpts: { quota: { fiveHourTokenLimit: 10000, weeklyTokenLimit: 100000, burnRateWarnShare: 0.85 }, skipMtimePrune: true }
    });
    eq([gTight.decision, gTight.quotaSource], ["KISITLI", "local-blocks"]);

    // cycle.begin & cycle.end local fallback + noLocalFallback opt-out
    process.env.CV_STATE_HOME = path.join(tmpDir("cyc-auto-home"), "home");
    const cycQuotaOpts = { quota: { fiveHourTokenLimit: 100000, weeklyTokenLimit: 1000000 }, skipMtimePrune: true };
    const b1 = cycle.begin(cfg, { five: "unknown", week: "unknown", session: "sb1" }, new Date(qNow), { quotaOpts: cycQuotaOpts });
    eq([b1.decision, b1.quotaSource], ["GO", "local-blocks"]);
    ok(b1.lines.some((l) => l.includes("KOTA_KAYNAGI: local-blocks")), "KOTA_KAYNAGI satırı basılmalı");
    const e1 = cycle.end(cfg, { id: "sb1", did: "ok", five: "unknown", week: "unknown" }, new Date(qNow), { quotaOpts: cycQuotaOpts });
    ok(e1.some((l) => l.startsWith("KOTA_KAYNAGI: local-blocks")), "cycle.end local-blocks yedeğini kullanmalı");
    ok(e1.some((l) => l.startsWith("SONRAKI_KAPI: GO ")), "cycle.end local-blocks gate kararı eşleşmeli");
    eq(cycle.lastQuota(cfg).source, "local-blocks", "quota.json local-blocks kaynağını saklamalı");
    ok(memory.journalTail(cfg).includes("(local-blocks)"), "günlük satırı local-blocks göstermeli");

    const bNo = cycle.begin(cfg, { five: "unknown", week: "unknown", session: "sb2" }, new Date(qNow), { noLocalFallback: true });
    eq([bNo.decision, bNo.quotaSource], ["KUCUK", undefined]);
    const eNo = cycle.end(cfg, { id: "sb2", did: "skip", five: "unknown", week: "unknown" }, new Date(qNow), { noLocalFallback: true });
    ok(!eNo.some((l) => l.startsWith("KOTA_KAYNAGI:")), "noLocalFallback iken local-blocks çalışmamalı");
    ok(eNo.some((l) => l.startsWith("SONRAKI_KAPI: KUCUK")), "noLocalFallback sonrası kapı KUCUK olmalı");
    ok(memory.journalTail(cfg).includes("kota okunamadı"), "noLocalFallback günlüğe kota okunamadı yazmalı");

    // cv gate --auto CLI
    writeJson(path.join(cfg.root, ".evrim/config.json"), { ...readJson(path.join(cfg.root, ".evrim/config.json")), metrics: { ...cfg.metrics, claudeProjectDir: claudeLogs }, quota: { fiveHourTokenLimit: 100000, weeklyTokenLimit: 1000000 } });
    // Ensure timestamps fall within recent 8d window of real clock when CLI runs without explicit now
    const nowIsoStr = new Date(Date.now() - 10 * 60000).toISOString();
    writeText(path.join(claudeLogs, "sess-cli.jsonl"), mkLine("c1", nowIsoStr, "claude-opus-5-5", 100, 400) + "\n");
    const logs = [];
    const origLog = console.log;
    console.log = (...a) => logs.push(a.join(" "));
    try { eq(await cliMain(["gate", "--auto", "--dir", cfg.root]), 0); } finally { console.log = origLog; }
    ok(logs.join("\n").includes("KOTA_KAYNAGI: local-blocks"), "cv gate --auto çıktı");

    // cv status shows active 5h block burnRate and subagent count when available
    const statusLogs = [];
    console.log = (...a) => statusLogs.push(a.join(" "));
    try { eq(await cliMain(["status", "--dir", cfg.root]), 0); } finally { console.log = origLog; }
    ok(statusLogs.join("\n").includes("yakma hızı:"), "cv status yerel blok telemetrisi göstermeli");
});

// ---------------------------------------------------------------- 5. primeLessons & cv cycle prime
test("upgrade: primeLessons göreve göre ders puanlar ve cv cycle prime bağlamı yeniler", async () => {
    process.env.CV_STATE_HOME = path.join(tmpDir("prime-home"), "home");
    const cfg = makeGitProject("prime");
    writeText(path.join(cfg.root, "docs/tasks/T-010.md"), "# T-010\n\nFix `core/metrics/round.js` parser timeout error.\n");
    fs.appendFileSync(path.join(cfg.root, ".evrim/otonom/DERSLER.md"), [
        "- UI button color tweak for dark theme",
        "- KRİTİK: core/metrics/round.js timeout hatasında alt-ajan dosyasını atla",
        "- Always keep parser bounded to prevent memory spike"
    ].join("\n") + "\n");
    fs.appendFileSync(path.join(cfg.root, ".evrim/otonom/NOTLAR.md"), "ÖNCE: timeout düzelt\n");

    const ranked = memory.primeLessons(cfg, { task: "T-010", files: ["core/metrics/round.js"], errors: ["timeout"], limit: 2 });
    eq(ranked.length, 2, "limit=2 sınırı");
    ok(ranked[0].text.includes("round.js"), "dosya + anahtar kelime eşleşen ders en üstte: " + ranked[0].text);
    ok(ranked[0].score > ranked[1].score, "ilgili ders skoru daha yüksek");

    const pr = cycle.prime(cfg, { task: "T-010", files: "core/metrics/round.js" });
    ok(pr.lines.some((l) => l.startsWith("ASAMA:")), "ASAMA satırı");
    ok(pr.lines.some((l) => l === "GOREV: T-010"), "GOREV satırı");
    ok(pr.blockers.some((b) => b.includes("okunmamış sahip notu")), "engelleyici listesi");

    const logs = [];
    const origLog = console.log;
    console.log = (...a) => logs.push(a.join(" "));
    try { eq(await cliMain(["cycle", "prime", "--dir", cfg.root, "--task", "T-010"]), 0); } finally { console.log = origLog; }
    ok(logs.join("\n").includes("ENGELLEYICILER"), "cv cycle prime CLI çıktısı");
});

// ---------------------------------------------------------------- 6. agent.js stagnation, backoff/failover, safeStage, receipt, XML prior_work
test("upgrade: agent.js durgunluk kesici, üstel yedekleme/failover, güvenli evreleme ve makbuz", async () => {
    const sg = agent.stagnationGuard();
    eq(sg("test", "diff1", "exit 1\nfail").stalled, false);
    eq(sg("test", "diff1", "exit 0\nok").stalled, false, "başarılı çalışma takılma sayılmaz");
    eq(sg("test", "diff2", "exit 1\nfail").stalled, false, "fark değişti");
    eq(sg("test", "diff1", "exit 1\nfail").stalled, true, "A<->B salınımı yakalanmalı");

    eq([
        agent.backoffDelay(0, 1000, 60000, () => 0),
        agent.backoffDelay(1, 1000, 60000, () => 0),
        agent.backoffDelay(2, 1000, 60000, () => 1),
        agent.backoffDelay(10, 1000, 5000, () => 1),
    ], [1000, 2000, 5000, 5000], "üstel backoff + jitter + tavan");

    // chat() exponential backoff + failover ladder
    const baseCfg = defaults();
    baseCfg.root = tmpDir("chat-root");
    const sleeps = [];
    let calls = 0;
    const fakeFetch = async (_url, req) => {
        const body = JSON.parse(req.body);
        calls++;
        if (body.model === "deepseek-flash" && calls === 1) return { status: 429, ok: false, text: async () => "rate limit" };
        if (body.model === "deepseek-flash" && calls === 2) return { status: 404, ok: false, text: async () => "model not found" };
        return {
            status: 200,
            ok: true,
            json: async () => ({
                choices: [{ message: { content: "ok", tool_calls: [] } }],
                usage: { prompt_tokens: 100, completion_tokens: 20 }
            })
        };
    };
    const res = await agent.chat(baseCfg, [{ role: "user", content: "hi" }], "test-key", [], {
        fetch: fakeFetch,
        sleep: async (ms) => { sleeps.push(ms); },
        backoffBaseMs: 100,
        maxRetries: 2,
        rand: () => 0,
        fallbackModels: ["backup-coder"]
    });
    eq([res.model, sleeps], ["backup-coder", [100]], "429'da üstel bekle, 404'te yedek modele düş");

    // Stagnation circuit breaker + safeStage + receipt + <prior_work> in runTask
    const cfg = makeGitProject("agent-upg", {
        testCmd: [process.execPath, "eval", "console.log('FAIL_ALWAYS'); process.exit(1)"]
    });
    writeText(path.join(cfg.root, "docs/tasks/T-001.md"), "# T-001\n\nSteps: 10\nBudget: $1.00\n\n## Goal\nEdit src/app.js.\n");
    git(["add", "docs/tasks/T-001.md"], cfg.root);
    ok(git(["commit", "-qm", "spec"], cfg.root).ok);

    writeJson(path.join(cfg.root, ".evrim/lanes/blackboard.json"), {
        tasks: { "T-000": { status: "done", files: ["src/base.js"], summary: "added base" } }
    });

    const ctx = await agent.newCtx(cfg, 1, () => {});
    await agent.ensureLane(ctx);
    await agent.syncForTask(ctx, "T-001");

    // Pre-drop a sensitive file in worktree to verify safeStage filters it out while staging src/app.js
    writeText(path.join(ctx.wt, ".env"), "SECRET=123\n");
    ok(agent.isSensitivePath(".envrc") && agent.isSensitivePath("keys/id_rsa.pub"), "isSensitivePath privacy.js kurallarını yeniden ihraç etmeli");

    // Plugin mutation updates ctx.track.lastWrite & inside() denies symlink escape
    const outsideDir = tmpDir("agent-out");
    writeText(path.join(outsideDir, "x.txt"), "x\n");
    fs.symlinkSync(outsideDir, path.join(ctx.wt, "bad-link"), "junction");
    throws(() => agent.inside(ctx.wt, "bad-link/x.txt"), /symlink|junction|inside/i, "agent.inside symlink kaçışını reddetmeli");
    fs.rmSync(path.join(ctx.wt, "bad-link"), { recursive: true, force: true });

    const plCtx = {
        cfg,
        wt: ctx.wt,
        readRoot: ctx.wt,
        lane: 1,
        log: () => {},
        track: { step: 0, clock: 0, lastWrite: 0, lastBuildOk: 0, lastTestOk: 0, lastTestTail: "" },
        plugins: [{
            name: "mut",
            tools: { mutate_file: { description: "m", parameters: { type: "object", properties: {} }, run: async (_a, c) => { writeText(path.join(c.wt, "src/plug.js"), "export const p = 1;\n"); return "ok"; } } },
            taskTools: ["mutate_file"],
            askTools: []
        }]
    };
    const plKit = agent.makeTools(plCtx);
    await plKit.tools.mutate_file.run({});
    ok(plCtx.track.lastWrite > 0, "eklenti dosya değişikliği ctx.track.lastWrite'ı güncellemeli");
    fs.rmSync(path.join(ctx.wt, "src/plug.js"), { force: true });

    let seenPriorWork = false;
    let stepIdx = 0;
    const script = [
        ["write_file", { path: "src/app.js", content: "export const val = 2;\n" }],
        ["run", { command: "test" }],
        ["run", { command: "test" }],
        ["finish", { status: "done", report: "should not reach" }]
    ];
    const r = await agent.runTask(ctx, "T-001", null, {
        key: "test",
        chat: async (_c, messages) => {
            if (messages[1].content.includes("<prior_work>") && messages[1].content.includes("T-000")) seenPriorWork = true;
            const c = script[Math.min(stepIdx++, script.length - 1)];
            return { message: { content: "", tool_calls: [{ id: "id" + stepIdx, function: { name: c[0], arguments: JSON.stringify(c[1]) } }] }, cost: 0.01, tokens: { hit: 0, miss: 10, out: 5 } };
        }
    });
    ok(seenPriorWork, "blackboard'dan <prior_work> enjekte edilmeli");
    ok(agent.systemPrompt(cfg).includes("SMALLEST surgical change"), "SCOPE_DISCIPLINE sistem isteminde");
    eq([r.status, r.stopReason], ["blocked", "stagnation"], "aynı başarısız testte durgunluk kesicisi durdurmalı");

    // Verify .env was NOT committed while src/app.js and report WERE committed
    const committedFiles = git(["diff", "--name-only", "main..cv/T-001"], cfg.root).out.split(/\r?\n/);
    ok(committedFiles.includes("src/app.js"), "izinli dosya commit edilmeli");
    ok(!committedFiles.includes(".env"), "hassas .env safeStage ile dışlanmalı");
    const receipt = readJson(path.join(cfg.root, ".evrim/receipts/T-001.json"), null);
    ok(receipt && typeof receipt.treeSha === "string" && receipt.treeSha.length >= 40, "makbuz treeSha taşımalı");
});

// ---------------------------------------------------------------- 7. verify.js & cv delegate verify
test("upgrade: verifyTask kapsam, gizli sızıntı, test kalitesi, treeSha tazelik ve CLI", async () => {
    const passCmd = [process.execPath, "eval", "process.exit(0)"];
    const cfg = makeGitProject("verify-proj", { build: passCmd, testCmd: passCmd });
    writeText(path.join(cfg.root, "docs/tasks/T-001.md"), "# T-001\n\nScope: src/feature.js, tests/feature.test.js\n\n## Goal\nImplement feature.\n");
    git(["add", "docs/tasks/T-001.md"], cfg.root);
    ok(git(["commit", "-qm", "spec"], cfg.root).ok);

    // Passing branch
    ok(git(["checkout", "-qb", "cv/T-001"], cfg.root).ok);
    writeText(path.join(cfg.root, "src/feature.js"), "export const feat = (x) => x + 1;\n");
    writeText(path.join(cfg.root, "tests/feature.test.js"), "import { eq } from './harness.js';\ntest('feat', () => { eq(1 + 1, 2); });\n");
    git(["add", "src/feature.js", "tests/feature.test.js"], cfg.root);
    ok(git(["commit", "-qm", "implement"], cfg.root).ok);
    ok(git(["checkout", "-q", "main"], cfg.root).ok);

    const passRes = await verifyTask(cfg.root, "T-001", { cfg });
    eq([passRes.ok, passRes.verdict, passRes.checks.scope.ok, passRes.checks.secrets.ok, passRes.checks.testQuality.ok], [true, "PASS", true, true, true]);
    const rec = readJson(path.join(cfg.root, ".evrim/receipts/T-001.json"), null);
    eq(rec.treeSha, passRes.treeSha, "makbuz treeSha güncel");

    // Stale receipt when branch moves and skipRun=true
    ok(git(["checkout", "-q", "cv/T-001"], cfg.root).ok);
    writeText(path.join(cfg.root, "src/feature.js"), "export const feat = (x) => x + 2;\n");
    git(["add", "src/feature.js"], cfg.root);
    ok(git(["commit", "-qm", "update"], cfg.root).ok);
    ok(git(["checkout", "-q", "main"], cfg.root).ok);

    const staleRes = await verifyTask(cfg.root, "T-001", { cfg, skipRun: true });
    eq(staleRes.verdict, "FAIL");
    ok(staleRes.findings.some((f) => f.category === "stale_receipt"), "bayat treeSha makbuzu yakalanmalı");

    // Scope violation + secret leak + trivial/skipped test on branch
    ok(git(["checkout", "-q", "cv/T-001"], cfg.root).ok);
    writeText(path.join(cfg.root, "src/outside.js"), J("export const k = '", "ghp_", "0123456789abcdefghijKLMNOP';\n"));
    writeText(path.join(cfg.root, "tests/feature.test.js"), "test.skip('x', () => { ok(true); });\n");
    git(["add", "src/outside.js", "tests/feature.test.js"], cfg.root);
    ok(git(["commit", "-qm", "bad"], cfg.root).ok);
    ok(git(["checkout", "-q", "main"], cfg.root).ok);

    const failRes = await verifyTask(cfg.root, "T-001", { cfg, skipRun: true });
    eq(failRes.verdict, "FAIL");
    const cats = new Set(failRes.findings.map((f) => f.category));
    ok(cats.has("scope_violation"), "kapsam dışı dosya yakalanmalı");
    ok(cats.has("secret_leak"), "diff gizli anahtar sızıntısı yakalanmalı");
    ok(cats.has("test_quality"), "skip/önemsiz test yakalanmalı");

    // CLI cv delegate verify + non-test inspectTestQuality guard + scanDiffSecrets fake-key allowlist
    eq(parseDeclaredScope("Scope: src/a.js, tests/a.test.js"), ["src/a.js", "tests/a.test.js"]);
    const fakeKeyDiff = `+++ b/src/example.js\n@@ -1,0 +1,1 @@\n+const demo = '${J("sk-abcdefghij", "1234567890abcdef")}';\n`;
    eq(scanDiffSecrets(fakeKeyDiff), [], "scanDiffSecrets test sahte anahtarına (sk-abcdefghij...) izin vermeli");
    eq(scanDiffSecrets(J("+const x = '", "AIza", "SyA1234567890abcdefghijKLMNOPQRSTUV';")).length, 1);

    const nonTestDiff = [
        "+++ b/core/delegate/verify.js",
        "@@ -1,0 +1,2 @@",
        "+const ex = 'test.skip(\"x\", () => { ok(true); });';",
        "+++ b/docs/METHOD.md",
        "@@ -1,0 +1,2 @@",
        "+Example: `it('empty', () => {})` and `ok(true)`",
    ].join("\n");
    eq(inspectTestQuality(nonTestDiff, ["docs/OLD.md"]), [], "test dışı .js/.md dosyalarında yanlış pozitif olmamalı");
    const realTestDiff = "+++ b/tests/real.test.js\n@@ -1,0 +1,1 @@\n+test.skip('x', () => { ok(true); });\n";
    ok(inspectTestQuality(realTestDiff).length >= 2, "gerçek test dosyasında skip/ok(true) yakalanmalı");
    eq(inspectTestQuality("", ["tests/old.test.js"]).length, 1);

    // Multi-perspective rubric review (--review) via extractJson
    writeText(path.join(cfg.root, "docs/tasks/T-002.md"), "# T-002\n\nScope: src/clean.js\n\n## Goal\nAdd helper.\n");
    git(["add", "docs/tasks/T-002.md"], cfg.root);
    ok(git(["commit", "-qm", "spec2"], cfg.root).ok);
    ok(git(["checkout", "-qb", "cv/T-002"], cfg.root).ok);
    writeText(path.join(cfg.root, "src/clean.js"), "export const clean = (n) => n * 2;\n");
    git(["add", "src/clean.js"], cfg.root);
    ok(git(["commit", "-qm", "clean impl"], cfg.root).ok);
    ok(git(["checkout", "-q", "main"], cfg.root).ok);

    let sawXmlPrompt = false;
    const passReview = await verifyTask(cfg.root, "T-002", {
        cfg,
        review: true,
        chat: async (_c, msgs) => {
            sawXmlPrompt = msgs[1].content.includes("<spec>") && msgs[1].content.includes("</spec>") && msgs[1].content.includes("<diff>");
            return {
                message: {
                    content: "Verdict below:\n```json\n" + JSON.stringify({
                        verdict: "PASS",
                        perspectives: { security: "PASS", correctness: "PASS", scope: "PASS" },
                        findings: []
                    }) + "\n```"
                }
            };
        }
    });
    ok(sawXmlPrompt, "--review <spec> ve <diff> XML yalıtımı kullanmalı");
    eq([passReview.verdict, passReview.checks.review.ok, passReview.checks.review.perspectives.security], ["PASS", true, "PASS"]);

    const failReview = await verifyTask(cfg.root, "T-002", {
        cfg,
        skipRun: true,
        review: true,
        chat: async () => ({
            message: {
                content: "Found blocker:\n```json\n" + JSON.stringify({
                    verdict: "FAIL",
                    perspectives: { security: "FAIL", correctness: "PASS", scope: "PASS" },
                    findings: [{ perspective: "security", severity: "critical", blocker: true, file: "src/clean.js", line: 1, description: "unsanitized input" }]
                }) + "\n```"
            }
        })
    });
    eq([failReview.ok, failReview.verdict, failReview.checks.review.ok, failReview.checks.review.perspectives.security], [false, "FAIL", false, "FAIL"]);
    ok(failReview.findings.some((f) => f.category === "review_security" && f.file === "src/clean.js" && f.line === 1 && f.blocker === true), "review_security bulgusu aktarılmalı");

    const logs = [];
    const origLog = console.log;
    console.log = (...a) => logs.push(a.join(" "));
    let cliCode;
    try { cliCode = await cliMain(["delegate", "verify", "T-001", "--dir", cfg.root, "--skip-run"]); } finally { console.log = origLog; }
    eq(cliCode, 1, "FAIL durumunda CLI çıkış kodu 1 olmalı");
    ok(logs.join("\n").startsWith("FAIL T-001"), "CLI FAIL çıktısı");
});

// ---------------------------------------------------------------- 8. lanes.js DAG waves & blackboard, slots.js priority FIFO & reservoir
test("upgrade: lanes.js DAG dalgaları, hata yalıtımı, blackboard ve slots.js öncelik FIFO + rezervuar", async () => {
    const specs = {
        "T-001": "# T-001\nRoot\n",
        "T-002": "# T-002\nDepends-On: T-001\n",
        "T-003": "# T-003\nBağımlılık: T-001\n",
        "T-004": "# T-004\nDepends-On: T-002, T-003\n",
        "T-005": "# T-005\nIndependent\n",
    };
    const dag = lanes.buildDagWaves(tmpDir("dag"), ["T-004", "T-002", "T-001", "T-003", "T-005"], { specs });
    eq(dag.waves, [["T-001", "T-005"], ["T-002", "T-003"], ["T-004"]], "topolojik dalga sırası");

    throws(() => lanes.buildDagWaves(tmpDir("cyc"), ["A", "B"], {
        specs: { A: "Depends-On: B\n", B: "Depends-On: A\n" }
    }), /döngü|cycle/i, "döngü algılanmalı");

    // Failure isolation + <prior_work> blackboard across waves in runDag
    const cfg = makeGitProject("dag-run");
    const runSpecs = {
        A: "# A\n",
        B: "# B\nDepends-On: A\n",
        C: "# C\n",
        D: "# D\nDepends-On: C\n",
        E: "# E\nDepends-On: B\n"
    };
    const seenPrior = {};
    const ran = [];
    const dagOut = await lanes.runDag(cfg, ["A", "B", "C", "D", "E"], {
        specs: runSpecs,
        ctx: { cfg, wt: cfg.root, readRoot: cfg.root, lane: 1, log: () => {}, track: {} },
        spentToday: () => 0,
        auto: async (_ctx, task, deps) => {
            ran.push(task);
            if (deps && deps.priorWork) seenPrior[task] = deps.priorWork;
            if (task === "C") return { status: "error" };
            return { status: "done", summaryText: { summary: `${task} built`, files: [`src/${task}.js`] } };
        }
    });
    eq(dagOut.ok, false, "C başarısız ve D engellendiği için batch ok=false");
    ok(!ran.includes("D"), "başarısız C'nin bağımlısı D çalışmamalı");
    ok(ran.includes("B") && ran.includes("E"), "bağımsız ve sağlam dal çalışmalı");
    ok(seenPrior.B && seenPrior.B.includes("A"), "B <prior_work> içinde A'yı görmeli");
    eq(dagOut.blackboard.tasks.D.status, "blocked");
    eq(dagOut.blackboard.tasks.D.blockedBy, ["C"]);

    // slots.js priority FIFO + expiresMs + checkReservoir
    const sdir = path.join(tmpDir("prio-slots"), "slots");
    const holder = await slots.acquire("build", 1, 10, { dir: sdir, pollMs: 5, staleMs: 1e9 });
    const order = [];
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const pLow = slots.withSlot("build", 1, 10, async () => { order.push("pri8"); }, { dir: sdir, pollMs: 5, staleMs: 1e9, priority: 8 });
    await sleep(15);
    const pHigh = slots.withSlot("build", 1, 10, async () => { order.push("pri2"); }, { dir: sdir, pollMs: 5, staleMs: 1e9, priority: 2 });
    await sleep(15);
    const pMid = slots.withSlot("build", 1, 10, async () => { order.push("pri5"); }, { dir: sdir, pollMs: 5, staleMs: 1e9, priority: 5 });
    await sleep(25);
    slots.release(holder);
    await Promise.all([pLow, pHigh, pMid]);
    eq(order, ["pri2", "pri5", "pri8"], "düşük sayı yüksek öncelik olarak önce yuva almalı");

    // expiresMs
    const hold2 = await slots.acquire("test", 1, 10, { dir: sdir, pollMs: 5, staleMs: 1e9 });
    let expiredErr = "";
    try {
        await slots.acquire("test", 1, 10, { dir: sdir, pollMs: 10, staleMs: 1e9, expiresMs: 40 });
    } catch (e) {
        expiredErr = e.message;
    }
    slots.release(hold2);
    ok(/expired/i.test(expiredErr), "expiresMs aşımında hata vermeli");
    eq(fs.readdirSync(sdir).filter((f) => f.endsWith(".ticket")), [], "süresi dolan bilet silinmeli");

    // checkReservoir
    const rRoot = tmpDir("reservoir");
    const baseT = 1_700_000_000_000;
    const r1 = slots.checkReservoir(rRoot, "api", 2, 60000, { now: baseT });
    const r2 = slots.checkReservoir(rRoot, "api", 2, 60000, { now: baseT + 1000 });
    const r3 = slots.checkReservoir(rRoot, "api", 2, 60000, { now: baseT + 2000 });
    const r4 = slots.checkReservoir(rRoot, "api", 2, 60000, { now: baseT + 61000 });
    eq([r1.allowed, r1.remaining, r2.allowed, r2.remaining], [true, 1, true, 0]);
    eq(r3.allowed, false, "limit aşılınca rezervuar reddetmeli");
    ok(r3.retryAfterMs > 0, "retryAfterMs pozitif olmalı");
    eq(r4.allowed, true, "pencere geçince yeniden izin vermeli");
});
