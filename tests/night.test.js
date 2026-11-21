// ProMax M5: the night factory's plumbing. Cross-process lock (tested with real separate processes), Windows
// program launching and log redaction, the merge train (bisect, fix notes, test side effects), owner notes to
// running work, receipts bound to their check commands, Telegram (done once, one chat, shutdown only with a
// one-time code), the done gate needing cv check, and STATUS.md reasons. No network, no model, no shutdown.
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { eq, ok, test, throws, tmpDir } from "./harness.js";
import { git, readJson, readText, writeJson, writeText } from "../core/lib/util.js";
import { loadConfig } from "../core/lib/config.js";
import { init } from "../core/cli/init.js";
import { LockBusyError, acquire, release, withFileLock } from "../core/lib/filelock.js";
import { launchTarget, parseNpmShim, printableCommand, redact, variableShim } from "../core/lib/process.js";
import { train } from "../core/delegate/train.js";
import * as agent from "../core/delegate/agent.js";
import { verifyTask } from "../core/delegate/verify.js";
import * as telegram from "../core/autonomy/telegram.js";
import { checkFinalForm } from "../core/autonomy/office.js";
import { statusDoc } from "../core/autonomy/livestatus.js";
import { recordHandoff } from "../core/delegate/choose.js";

const nodeArgs = (code) => [process.execPath, process.versions.deno ? "eval" : "-e", code];
function project(label, { test: testCmd = null } = {}) {
    const dir = tmpDir(label);
    git(["init", "-q", "-b", "main"], dir);
    for (const [k, v] of [["user.email", "test@example.invalid"], ["user.name", "test"], ["commit.gpgsign", "false"]]) git(["config", k, v], dir);
    init(dir, { name: label });
    const c = readJson(path.join(dir, ".evrim/config.json"));
    c.test = testCmd; c.build = null; c.kurulum = "tamam";
    writeJson(path.join(dir, ".evrim/config.json"), c);
    git(["add", "-A"], dir); git(["commit", "-qm", "init"], dir);
    return loadConfig(dir);
}

test("gece: süreçler arası kilit — 4 ayrı süreç 25'er artırım, kayıp yok; bayat kilit devralınır; meşgul kilit sınırlı bekler", async () => {
    const dir = tmpDir("lock"), file = path.join(dir, "counter.json");
    writeJson(file, { n: 0 });
    const lockUrl = pathToFileURL(path.resolve("core/lib/filelock.js")).href, utilUrl = pathToFileURL(path.resolve("core/lib/util.js")).href;
    const code = `const { withFileLock } = await import(${JSON.stringify(lockUrl)}); const { readJson, writeJson } = await import(${JSON.stringify(utilUrl)}); for (let i = 0; i < 25; i++) withFileLock(${JSON.stringify(file)}, () => { const c = readJson(${JSON.stringify(file)}, { n: 0 }); writeJson(${JSON.stringify(file)}, { n: c.n + 1 }); });`;
    const child = () => new Promise((res) => { const p = spawn(process.execPath, [...(process.versions.deno ? ["eval"] : ["--input-type=module", "-e"]), code], { stdio: "ignore" }); p.on("close", res); });
    await Promise.all([child(), child(), child(), child()]);
    eq(readJson(file, {}).n, 100, "ayrı süreçlerin yazmaları birbirini ezmemeli");

    const held = acquire(file);
    throws(() => acquire(file, { timeoutMs: 120, alive: () => true }), /holds the lock/, "canlı sahibin kilidi beklenir, sonsuza dek değil");
    const taken = acquire(file, { timeoutMs: 3000, alive: () => false });
    ok(taken.token !== held.token, "ölü sahibin kilidi devralınır");
    release(held);
    ok(fs.existsSync(`${file}.lock`), "başkasının kilidi silinmez (token farklı)");
    release(taken);
    eq(withFileLock(file, () => 7), 7);
    ok(LockBusyError.name === "LockBusyError");
});

test("gece: Windows kısayolları (.cmd) yorumlayıcıyla başlar; komut ve günlük gizli bilgiyi göstermez", () => {
    eq(parseNpmShim('@ECHO off\r\nSETLOCAL\r\nSET "_prog=node"\r\n"%_prog%"  "%dp0%\\node_modules\\x\\bin\\cli.js" %*\r\n'), { interpreter: "node", target: "node_modules\\x\\bin\\cli.js" });
    eq(parseNpmShim('@echo off\r\n"C:\\Tools\\codex.exe" %*\r\n'), { interpreter: null, target: "C:\\Tools\\codex.exe" });
    const dir = tmpDir("shim");
    writeText(path.join(dir, "node.exe"), "x"); writeText(path.join(dir, "cli.js"), "x");
    const npmStyle = 'SET "NODE_EXE=%~dp0\\node.exe"\r\nIF NOT EXIST "%NODE_EXE%" (\r\n  SET "NODE_EXE=node"\r\n)\r\nSET "CLI_JS=%~dp0\\cli.js"\r\n"%NODE_EXE%" "%CLI_JS%" %*\r\n';
    eq(variableShim(npmStyle, dir), [path.join(dir, "node.exe"), path.join(dir, "cli.js")]);
    writeText(path.join(dir, "tool.cmd"), npmStyle);
    if (process.platform === "win32") eq(launchTarget(path.join(dir, "tool.cmd"), ["a"]), [path.join(dir, "node.exe"), path.join(dir, "cli.js"), "a"]);
    eq(printableCommand("tool", ["--api-key", "abc", "--token=xyz", "x".repeat(300)]), "tool --api-key <hidden> --token=<hidden> <300 characters left out>");
    const fake = ["sk-", "abcdefghijklmnopqrstuvwx"].join("");
    eq(redact(`key ${fake} and 123456789:${"A".repeat(35)}`), "key <hidden> and <hidden>");
});

test("gece: birleştirme treni bozan dalı ikiye bölerek bulur, not bırakır, kalanları birleştirir; testin depoyu değiştirmesini yakalar", async () => {
    const check = "const fs=require('fs');if(fs.existsSync('broken.txt'))process.exit(1)";
    const cfg = project("train", { test: nodeArgs(check) });
    const branch = (t, file, text) => { git(["checkout", "-qb", `cv/${t}`, "main"], cfg.root); writeText(path.join(cfg.root, file), text); git(["add", "-A"], cfg.root); git(["commit", "-qm", t], cfg.root); git(["checkout", "-q", "main"], cfg.root); };
    branch("T-001", "a.txt", "a\n"); branch("T-002", "broken.txt", "x\n"); branch("T-003", "c.txt", "c\n"); branch("T-004", "d.txt", "d\n");
    const r = await train(cfg, ["T-001", "T-002", "T-003", "T-004"]);
    eq([r.merged, r.dropped.map((d) => d.task), r.moved], [["T-001", "T-003", "T-004"], ["T-002"], true]);
    ok(fs.existsSync(path.join(cfg.root, "a.txt")) && fs.existsSync(path.join(cfg.root, "d.txt")) && !fs.existsSync(path.join(cfg.root, "broken.txt")), "ana dal ilerledi, bozan dal dışarıda");
    ok(/test kırmızı/.test(readText(path.join(cfg.root, cfg.delegate.stateDir, "T-002.train-fix.md"))), "bozan işe not");
    eq(git(["worktree", "list"], cfg.root).out.split("\n").length, 1, "geçici çalışma kopyası temizlendi");

    const dirty = project("train-fx", { test: nodeArgs("require('fs').appendFileSync('AGENTS.md','x')") });
    git(["checkout", "-qb", "cv/T-001", "main"], dirty.root); writeText(path.join(dirty.root, "e.txt"), "e\n"); git(["add", "-A"], dirty.root); git(["commit", "-qm", "e"], dirty.root); git(["checkout", "-q", "main"], dirty.root);
    const fx = await train(dirty, ["T-001"]);
    ok(fx.dropped.length === 1 && /izlenen dosyaları değiştirdi: AGENTS\.md/.test(fx.dropped[0].reason), JSON.stringify(fx));
});

test("gece: sahip notu çalışan işin sonraki adımına bir kez verilir; makbuz ölçüldüğü komutlara bağlıdır", async () => {
    const cfg = project("note");
    agent.addOwnerNote(cfg, "T-001", "renkleri değiştirme");
    agent.addOwnerNote(cfg, "all", "kaydetmeyi bozma");
    eq(agent.takeOwnerNotes(cfg, "T-001").split("\n").map((l) => l.replace(/^- \S+ /, "")), ["renkleri değiştirme", "kaydetmeyi bozma"]);
    eq(agent.takeOwnerNotes(cfg, "T-001"), "", "bir kez");
    agent.addOwnerNote(cfg, "T-009", "x");
    const ctx = { cfg, wt: cfg.root, readRoot: cfg.root, plugins: [], task: "T-009", track: { clock: 0, lastWrite: 0, seen: new Map() } };
    ctx.kit = agent.makeTools(ctx);
    const msgs = [{ role: "system", content: "s" }, { role: "user", content: "u" }];
    await agent.loop(ctx, msgs, "k", ctx.kit.taskTools, 2, 1, "finish", async () => ({ message: { content: "", tool_calls: [{ id: "f", type: "function", function: { name: "finish", arguments: "{\"status\":\"blocked\",\"report\":\"x\"}" } }] }, cost: 0, tokens: { hit: 0, miss: 0, out: 0 } }));
    ok(msgs.some((m) => m.role === "user" && /<owner_note>/.test(m.content)), "not mesaja girdi");

    const v = project("digest", { test: nodeArgs("process.exit(0)") });
    writeText(path.join(v.root, "docs/tasks/T-001.md"), "# T-001\n\nScope: src/x.js\n");
    git(["add", "-A"], v.root); git(["commit", "-qm", "spec"], v.root);
    git(["checkout", "-qb", "cv/T-001"], v.root); writeText(path.join(v.root, "src/x.js"), "x\n"); git(["add", "-A"], v.root); git(["commit", "-qm", "x"], v.root); git(["checkout", "-q", "main"], v.root);
    const first = await verifyTask(v.root, "T-001", { cfg: v });
    ok(first.ok && readJson(path.join(v.root, ".evrim/receipts/T-001.json")).checkDigest, "makbuzda komut özeti");
    eq((await verifyTask(v.root, "T-001", { cfg: v, skipRun: true })).checks.receipt.fresh, true);
    const other = await verifyTask(v.root, "T-001", { cfg: { ...v, test: nodeArgs("process.exit(3)") }, skipRun: true });
    ok(!other.ok && other.findings.some((f) => f.category === "stale_receipt" && /other commands/.test(f.description)), "başka komutla ölçülmüş makbuz kanıt değil");
});

test("gece: Telegram yalnız bitince bir kez; yalnız yetkili sohbet; kapatma yalnız tek kullanımlık kodla", async () => {
    const cfg = project("tg");
    eq(telegram.settings(cfg, {}).ready, false);
    writeJson(telegram.CONFIG_FILE(cfg), { chatId: "42" });
    const env = { CV_TELEGRAM_TOKEN: "test-token" };
    const sent = [];
    let inbox = [];
    const fetch = async (url, init) => {
        const method = url.split("/").pop(), body = JSON.parse(init.body);
        if (method === "sendMessage") { sent.push(body); return { json: async () => ({ ok: true, result: {} }) }; }
        if (method === "getUpdates") { const r = inbox.filter((u) => u.update_id >= body.offset); return { json: async () => ({ ok: true, result: r }) }; }
        return { json: async () => ({ ok: false }) };
    };
    eq((await telegram.notifyDone(cfg, { deliverablePath: "app.exe" }, { env, fetch })).sent, true);
    eq((await telegram.notifyDone(cfg, { deliverablePath: "app.exe" }, { env, fetch })).sent, false, "aynı teslim için ikinci haber yok");
    ok(/hazır ✓/.test(sent[0].text) && sent[0].chat_id === "42");

    let shut = 0;
    inbox = [{ update_id: 1, message: { chat: { id: 99 }, text: "kapat" } }, { update_id: 2, message: { chat: { id: 42 }, text: "yeni: koyu tema ekle" } }, { update_id: 3, message: { chat: { id: 42 }, text: "kapat" } }];
    const r1 = await telegram.poll(cfg, { env, fetch, shutdown: () => shut++, statusText: () => "ok" });
    eq([r1.handled, r1.ignored, r1.actions], [2, 1, ["job", "ask-code"]], "yabancı sohbet yok sayılır");
    ok(readText(path.join(cfg.root, ".evrim/otonom/NOTLAR.md")).includes("- ÖNCE: koyu tema ekle"));
    const code = sent[sent.length - 1].text.match(/kapat (\d{4})/)[1];
    inbox = [{ update_id: 4, message: { chat: { id: 42 }, text: "kapat 0000" } }, { update_id: 5, message: { chat: { id: 42 }, text: `kapat ${code}` } }];
    const r2 = await telegram.poll(cfg, { env, fetch, shutdown: () => shut++, statusText: () => "ok" });
    eq([r2.actions, shut], [["bad-code", "shutdown"], 1], "yanlış kodla kapanmaz, doğru kodla bir kez");
    eq(telegram.handle(cfg, `kapat ${code}`).action, "bad-code", "kod tek kullanımlık");
    eq(telegram.handle(cfg, "kapat", { now: new Date(Date.now()) }).action, "ask-code");
    const late = telegram.handle(cfg, `kapat ${readJson(path.join(cfg.root, ".evrim/state/telegram.json")).shutdownCode}`, { now: new Date(Date.now() + 11 * 60000) });
    eq(late.action, "bad-code", "süresi dolan kod geçmez");
});

test("gece: BITTI cv check geçmeden gelmez; STATUS.md bekleme nedenini sade söyler", () => {
    const cfg = project("done");
    writeText(path.join(cfg.root, cfg.docs.roadmap), "# Yol\n- [x] iş\n");
    eq(checkFinalForm(cfg, null, { skipVerify: true }).done, true, "self-test adımı yoksa eskisi gibi");
    cfg.check = { ...cfg.check, selfTest: { steps: ["create"] } };
    eq(checkFinalForm(cfg, null, { skipVerify: true }).reason, "cv check henüz koşmadı (pencere + --self-test)");
    eq(checkFinalForm(cfg, null, { skipVerify: true, lastRound: () => ({ round: 2, passed: false }) }).done, false);
    eq(checkFinalForm(cfg, null, { skipVerify: true, lastRound: () => ({ round: 3, passed: true }) }).done, true);

    recordHandoff(cfg, { kind: "billing", task: "T-1" });
    const doc = statusDoc(cfg, { now: new Date(Date.UTC(2026, 10, 18, 7, 0)), alive: [{ lane: 1, alive: true, current: "T-2", done: [] }] });
    ok(/Yoğun \(pahalı\) saat: ucuz model \d\d:\d\d'de/.test(doc) && /API bakiyesi bitti/.test(doc) && /Şerit 1: çalışıyor, şu an T-2/.test(doc), doc);
});
