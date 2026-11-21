// ProMax M2: the cheap-model engine (fuzzy edit, read-before-write, cache-stable context, effort, locked
// acceptance test, API hand-off to the main model, code map, zero-token ref comparison). No network, no model.
import fs from "node:fs";
import path from "node:path";
import { eq, ok, test, throws, tmpDir } from "./harness.js";
import { git, readJson, readText, writeJson, writeText } from "../core/lib/util.js";
import { defaults, loadConfig, validate } from "../core/lib/config.js";
import { init } from "../core/cli/init.js";
import * as agent from "../core/delegate/agent.js";
import { applyEdit, countOccurrences, fuzzyFindText } from "../core/delegate/edit-diff.js";
import { compact, estimateTokens, headTail, headTailLines } from "../core/delegate/context.js";
import { needsScout, parseAcceptance } from "../core/delegate/spec.js";
import { verifyTask } from "../core/delegate/verify.js";
import * as choose from "../core/delegate/choose.js";
import * as lanes from "../core/delegate/lanes.js";
import { repoMap, symbolsOf } from "../core/delegate/repomap.js";
import { planUpdate, migrate } from "../core/cli/migrate.js";

function gitProject(label) {
    const dir = tmpDir(label);
    git(["init", "-q", "-b", "main"], dir);
    for (const [k, v] of [["user.email", "test@example.invalid"], ["user.name", "test"], ["commit.gpgsign", "false"]]) git(["config", k, v], dir);
    init(dir, { name: label });
    writeText(path.join(dir, "src/app.js"), "export function add(a, b) { return a + b; }\nexport const name = \u201cquoted\u201d;\n");
    git(["add", "-A"], dir);
    git(["commit", "-qm", "init"], dir);
    return loadConfig(dir);
}
const toolCtx = (cfg) => { const ctx = { cfg, wt: cfg.root, readRoot: cfg.root, plugins: [], track: { clock: 0, lastWrite: 0, seen: new Map() } }; ctx.kit = agent.makeTools(ctx); return ctx; };

test("token: bulanık düzenleme yalnız eşleşen yeri değiştirir; CRLF/BOM korunur; çakışan sayım; en yakın satır ipucu", () => {
    const file = "\uFEFFline one  \r\nconst s = \u201chi\u201d;\r\nend\r\n";
    const r = applyEdit(file, "line one\nconst s = \"hi\";", "line 1\nconst s = \"hi\";");
    eq([r.fuzzy, r.text], [true, "\uFEFFline 1\r\nconst s = \"hi\";\r\nend\r\n"], "boşluk/tırnak farkı tolere, satır sonu ve BOM aynı");
    eq(applyEdit("a\nb\n", "b", "c").fuzzy, false, "önce birebir");
    eq(countOccurrences("aaaa", "aaa"), 2, "çakışan eşleşmeler sayılır");
    throws(() => applyEdit("x = 1\nx = 1\n", "x = 1", "x = 2"), /2 times/, "benzersiz değilse reddet");
    throws(() => applyEdit("function total(items) {\n  return 0;\n}\n", "function totl(items) {", "x"), /closest line is 1/, "bulunamazsa en yakın satırı söyle");
    eq(fuzzyFindText("caf\u00e9", "cafe\u0301").found, true, "NFKC birleşik karakter");
});

test("token: okunmadan ya da okunduktan sonra değişmiş dosyaya yazılmaz; kilitli kabul testi yazılamaz", async () => {
    const cfg = gitProject("rbw");
    const ctx = toolCtx(cfg), t = ctx.kit.tools;
    let err = null;
    try { await t.edit_file.run({ path: "src/app.js", old_text: "a + b", new_text: "a - b" }); } catch (e) { err = e; }
    ok(err && /read src\/app\.js with read_file/.test(err.message), "okumadan düzenleme reddedilmeli");
    await t.read_file.run({ path: "src/app.js" });
    eq(await t.edit_file.run({ path: "src/app.js", old_text: "export const name = \"quoted\";", new_text: "export const name = \"q\";" }), "edited src/app.js (matched after normalizing whitespace/quotes/line endings)");
    eq(await t.edit_file.run({ path: "src/app.js", old_text: "a + b", new_text: "a * b" }), "edited src/app.js", "kendi yazdığından sonra yeniden okuma gerekmez");
    writeText(path.join(cfg.root, "src/app.js"), "changed outside\n");
    err = null;
    try { await t.write_file.run({ path: "src/app.js", content: "x" }); } catch (e) { err = e; }
    ok(err && /changed since you last read/.test(err.message), "dışarıdan değişen dosya bayat sayılmalı");
    eq(await t.write_file.run({ path: "src/new.js", content: "export {};\n" }), "written src/new.js", "yeni dosya serbest");
    ctx.locked = ["tests/accept/"];
    err = null;
    try { await t.write_file.run({ path: "tests/accept/T-1.test.js", content: "x" }); } catch (e) { err = e; }
    ok(err && /locked acceptance test/.test(err.message), "kabul testi kilitli");
});

test("token: araç çıktısı baştan+sondan kesilir; bağlam yalnız bütçe aşılınca bir dönemde sıkışır, önek korunur", () => {
    const long = Array.from({ length: 200 }, (_, i) => `line ${i}`).join("\n");
    const ht = headTailLines(long, 15, 25);
    ok(ht.includes("line 0") && ht.includes("line 199") && ht.includes("160 lines cut"), "ilk hata ve son özet birlikte kalır");
    eq(headTail("x".repeat(9000), 6000), headTail("x".repeat(9000), 6000), "deterministik");

    const msgs = [{ role: "system", content: "rules" }, { role: "user", content: "spec" }];
    for (let i = 0; i < 30; i++) {
        msgs.push({ role: "assistant", content: "", reasoning_content: `think ${i}`, tool_calls: [{ id: `c${i}`, type: "function", function: { name: i % 2 ? "read_file" : "run", arguments: JSON.stringify(i % 2 ? { path: `src/f${i}.js` } : { command: "test" }) } }] });
        msgs.push({ role: "tool", tool_call_id: `c${i}`, content: (i % 2 ? "x" : "exit 1\nFAIL\n") + "y".repeat(3000) });
    }
    const small = compact([...msgs], { budgetTokens: 10 ** 7 });
    eq(small.changed, false, "bütçe altında hiçbir şey değişmez (önbellek öneki aynı)");
    const work = msgs.map((m) => ({ ...m }));
    const r = compact(work, { budgetTokens: 8000 });
    ok(r.changed && r.after < r.before && r.after <= 8000, `bütçenin altına iner (${r.before} -> ${r.after})`);
    eq([work[0], work[1]], [msgs[0], msgs[1]], "sistem ve tarif dokunulmaz");
    ok(/runner replaced your earlier steps/.test(work[2].content), "eski adımlar koşucu özetiyle değişir");
    const ids = new Set(work.filter((m) => m.role === "tool").map((m) => m.tool_call_id));
    ok(work.filter((m) => m.role === "assistant").every((m) => (m.tool_calls || []).every((c) => ids.has(c.id))), "her tutulan çağrının sonucu var");
    ok(work.filter((m) => m.role === "assistant").every((m) => /^think \d+$/.test(m.reasoning_content)), "reasoning_content sökülmez (E2)");
    eq(compact(work, { budgetTokens: 8000 }).changed, false, "ikinci dönem hemen gelmez");
    ok(estimateTokens(work) > 0);
});

test("token: istekler adım adım önbellek önekini uzatır (OMK spec 051); thinking'de temperature yok, effort gider", async () => {
    const cfg = gitProject("cache");
    cfg.delegate.contextBudget = 10 ** 6;
    const ctx = toolCtx(cfg);
    const sent = [];
    let n = 0;
    const fake = async (_c, messages) => {
        sent.push(JSON.stringify(messages));
        n++;
        if (n < 4) return { message: { content: "", reasoning_content: "r", tool_calls: [{ id: "t" + n, type: "function", function: { name: "read_file", arguments: JSON.stringify({ path: "src/app.js", start_line: n }) } }] }, cost: 0, tokens: { hit: 0, miss: 0, out: 0 } };
        return { message: { content: "", tool_calls: [{ id: "f", type: "function", function: { name: "finish", arguments: JSON.stringify({ status: "blocked", report: "x" }) } }] }, cost: 0, tokens: { hit: 0, miss: 0, out: 0 } };
    };
    await agent.loop(ctx, [{ role: "system", content: "s" }, { role: "user", content: "u" }], "k", ctx.kit.taskTools, 10, 1, "finish", fake);
    for (let i = 1; i < sent.length; i++) ok(sent[i].startsWith(sent[i - 1].slice(0, -1)), `istek ${i} öncekinin önekini korumalı`);

    let body = null;
    const fetchOk = async (_u, init) => { body = JSON.parse(init.body); return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "x" } }], usage: {} }) }; };
    const c2 = { root: cfg.root, delegate: { provider: "p", stateDir: "s", providers: { p: { apiBase: "http://x", model: "m", thinking: true, price: { input: 0, cached: 0, output: 0 } } } } };
    await agent.chat(c2, [{ role: "user", content: "hi" }], "k", [], { fetch: fetchOk, effort: "low" });
    eq(["temperature" in body, body.reasoning_effort, body.thinking], [false, "low", { type: "enabled" }]);
    c2.delegate.providers.p.thinking = false;
    await agent.chat(c2, [{ role: "user", content: "hi" }], "k", [], { fetch: fetchOk, effort: "low" });
    eq([body.temperature, "reasoning_effort" in body], [0.2, false], "düşünme kapalıyken effort gönderilmez");
    eq([agent.effortFor(defaults().delegate ? { delegate: defaults().delegate } : {}, "scout"), agent.effortFor({ delegate: {} }, "run")], ["low", null]);
});

test("token: tarif başlıkları (Acceptance, keşif gereği); doğrulayıcı kabul testinin kilidini ve kırmızı→yeşili denetler", async () => {
    eq(parseAcceptance("Acceptance: tests/accept/T-1.test.js\nAcceptance-Cmd: node tests/accept/T-1.test.js\n"), { files: ["tests/accept/T-1.test.js"], cmd: ["node", "tests/accept/T-1.test.js"] });
    eq(parseAcceptance("Kabul: -\n"), { files: [], cmd: null });
    eq(parseAcceptance('Acceptance-Cmd: "C:/Program Files/node.exe" t.js\n').cmd, ["C:/Program Files/node.exe", "t.js"], "tırnaklı yol bölünmez");
    eq([needsScout("Scope: -\n"), needsScout("Scope: src/a.js\n## Known facts\n- src/a.js:12 add()\n## Steps\n"), needsScout("Scope: src/a.js\n## Known facts\n\n## Steps")], [true, false, true]);

    const cfg = gitProject("accept");
    const accRel = "tests/accept/T-001.test.js";
    const node = (code) => [process.execPath, process.versions.deno ? "eval" : "-e", code];
    writeText(path.join(cfg.root, accRel), "check add\n");
    writeText(path.join(cfg.root, "docs/tasks/T-001.md"), `# T-001\n\nScope: src/app.js\nAcceptance: ${accRel}\nAcceptance-Cmd: ${JSON.stringify([process.execPath, ...(process.versions.deno ? ["run", "-A"] : []), "check.mjs"])}\n`);
    writeText(path.join(cfg.root, "check.mjs"), "import fs from 'node:fs'; process.exit(fs.readFileSync('src/app.js','utf8').includes('a - b') ? 0 : 1);\n");
    git(["add", "-A"], cfg.root); git(["commit", "-qm", "spec + acceptance"], cfg.root);
    git(["checkout", "-qb", "cv/T-001"], cfg.root);
    writeText(path.join(cfg.root, "src/app.js"), "export function add(a, b) { return a - b; }\n");
    git(["add", "-A"], cfg.root); git(["commit", "-qm", "impl"], cfg.root);
    git(["checkout", "-q", "main"], cfg.root);
    const good = await verifyTask(cfg.root, "T-001", { cfg: { ...cfg, build: null, test: node("process.exit(0)") } });
    eq([good.checks.acceptance.ok, good.checks.acceptance.green, good.checks.acceptance.red], [true, true, true], JSON.stringify(good.findings));

    git(["checkout", "-q", "cv/T-001"], cfg.root);
    writeText(path.join(cfg.root, accRel), "weakened\n");
    git(["add", "-A"], cfg.root); git(["commit", "-qm", "tamper"], cfg.root);
    git(["checkout", "-q", "main"], cfg.root);
    const bad = await verifyTask(cfg.root, "T-001", { cfg: { ...cfg, build: null, test: null }, skipRun: true });
    ok(bad.findings.some((f) => f.category === "acceptance_tampered" && f.blocker), "kabul testine dokunan iş FAIL");
});

test("token: API bakiyesi biterse şerit devreder, choose ana modele geçer, api-ok geri açar (K25)", async () => {
    const cfg = gitProject("handoff");
    const env = { DEEPSEEK_API_KEY: "x" };
    eq(choose.choose(cfg, env).mode, "api");
    const logs = [];
    const fakeAuto = async () => ({ status: "blocked", stopReason: "api", apiKind: "billing" });
    for (const t of ["T-001", "T-002", "T-003"]) writeText(path.join(cfg.root, `docs/tasks/${t}.md`), `# ${t}\n`);
    await lanes.runLane(cfg, 1, ["T-001", "T-002", "T-003"], { auto: fakeAuto, ctx: { cfg }, spentToday: () => 0, sleep: async () => {}, log: (l) => logs.push(l) });
    const h = choose.readHandoff(cfg);
    eq([h && h.kind, h && h.task], ["billing", "T-001"]);
    const bb = lanes.loadBlackboard(cfg);
    eq([bb.tasks["T-002"].status, bb.tasks["T-003"].status], ["handoff", "handoff"], "kalan işler ana modele bırakılır");
    const picked = choose.choose(cfg, env);
    ok(picked.mode !== "api" && /bakiye bitti/.test(picked.reason), "anahtar olsa da API seçilmez");
    eq(choose.choose(cfg, env, { now: new Date(Date.now() + 13 * 3600e3) }).mode, "api", "12 saat sonra kendiliğinden yeniden dener");
    eq(choose.recordHandoff(cfg, { kind: "rate" }), null, "hız sınırı devir değildir");
    choose.clearHandoff(cfg);
    eq(choose.choose(cfg, env).mode, "api");
});

test("token: kod haritası, cycle diyeti için yeni ayarlar ve M2 göçü (contextBudget/effort eski projeye eklenir)", () => {
    eq(symbolsOf("a.rs", "pub fn open() {}\nstruct Doc;\nimpl Doc {}\n"), ["open", "Doc"]);
    eq(symbolsOf("a.py", "def run():\nclass X:\n"), ["run", "X"]);
    const cfg = gitProject("map");
    const m = repoMap(cfg, { cache: false });
    ok(/src\/app\.js: add/.test(m), m);
    eq(repoMap(cfg), repoMap(cfg), "önbellekli");
    ok(!/\.evrim|AGENTS/.test(m), "yalnız codePaths");

    const def = defaults();
    eq([def.delegate.contextBudget, def.delegate.effort], [64000, { scout: "low", ask: "low" }]);
    eq(validate({ ...loadConfig(cfg.root), delegate: { ...loadConfig(cfg.root).delegate, contextBudget: 10 } }).errors.some((e) => /contextBudget/.test(e)), true);

    // A project from v1.0.25 (M1) has no contextBudget/effort: the update adds them, keeps the rest.
    const own = readJson(path.join(cfg.root, ".evrim/config.json"));
    delete own.delegate.contextBudget; delete own.delegate.effort; delete own.delegate._comment_contextBudget;
    own.delegate.dailyBudget = 3;
    writeJson(path.join(cfg.root, ".evrim/config.json"), own);
    const p = planUpdate(cfg.root);
    const item = p.items.find((i) => i.rel === ".evrim/config.json");
    ok(item && item.added.includes("delegate.contextBudget") && item.added.includes("delegate.effort"), JSON.stringify(item && item.added));
    migrate(cfg.root, p);
    const after = readJson(path.join(cfg.root, ".evrim/config.json"));
    eq([after.delegate.contextBudget, after.delegate.dailyBudget], [64000, 3]);
    ok(readText(path.join(cfg.root, ".evrim/config.json")).includes("_comment_contextBudget"), "açıklaması da gelir");
    ok(fs.existsSync(path.join(cfg.root, ".evrim/backups")));
});
