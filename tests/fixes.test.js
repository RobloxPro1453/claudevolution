// The verified v1.0.24 bugs (ProMax M1): each fix is pinned by a check that fails if it comes back. No network.
import fs from "node:fs";
import path from "node:path";
import { eq, ok, test, tmpDir } from "./harness.js";
import { git, readText, writeText } from "../core/lib/util.js";
import { forbiddenRegexes, runnerScripts } from "../core/lib/config.js";
import * as agent from "../core/delegate/agent.js";
import { planLanes, scopesOverlap } from "../core/delegate/lanes.js";
import { inspectTestQuality } from "../core/delegate/verify.js";
import { isOwnRepoRoot } from "../core/cli/init.js";
import { journalTail } from "../core/autonomy/memory.js";
import { KNOWN_API_PROVIDERS } from "../core/orchestrate/council.js";

test("fix: thinking modunda giden istek API'nin kabul edeceği biçimde (reasoning_content, eşleşmesiz araç çağrısı, boş mesaj, boş tools)", async () => {
    const history = [
        { role: "system", content: "s" },
        { role: "user", content: "u" },
        { role: "assistant", content: "", tool_calls: [{ id: "a", type: "function", function: { name: "read_file", arguments: "{}" } }, { id: "b", type: "function", function: { name: "run", arguments: "{}" } }] },
        { role: "tool", tool_call_id: "a", content: "ok" },
        { role: "user", content: "devam" },
        { role: "assistant", content: "" },
        { role: "assistant", content: "düşünmeden yazılmış", reasoning_content: "kept" }
    ];
    const out = agent.prepareMessages(history, { thinking: true });
    eq(out.filter((m) => m.role === "assistant").map((m) => m.reasoning_content), ["", "kept"], "her asistan mesajında alan olmalı, var olan silinmez (E2)");
    eq(out.slice(3, 5).map((m) => [m.role, m.tool_call_id]), [["tool", "a"], ["tool", "b"]], "kesilen çağrıya 'not run' sonucu eklenmeli");
    ok(/not run/.test(out[4].content));
    eq(out.length, 7, "içeriksiz ve çağrısız asistan mesajı düşmeli");
    eq(agent.prepareMessages(history, { thinking: true }), out, "deterministik (önbellek öneki bozulmaz)");
    ok(!("reasoning_content" in agent.prepareMessages(history)[2]), "düşünme kapalıyken alan eklenmez");

    let body = null;
    const fetchOk = async (_u, init) => { body = JSON.parse(init.body); return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "x" } }], usage: {} }) }; };
    const cfg = { root: tmpDir("chat"), delegate: { provider: "p", stateDir: "s", providers: { p: { apiBase: "http://x", model: "m", thinking: true, price: { input: 0, cached: 0, output: 0 } } } } };
    await agent.chat(cfg, history, "k", [], { fetch: fetchOk });
    ok(!("tools" in body), "boş araç listesi gönderilmez");
    eq(body.messages.filter((m) => m.role === "assistant").every((m) => typeof m.reasoning_content === "string"), true);
});

test("fix: bakiye/anahtar hatası beklemeden yedeğe geçer, 429 Retry-After'a uyar (en çok 60 sn), hata türü taşınır", async () => {
    eq(["billing", "auth", "rate", "transient", "unavailable", "config"], [
        agent.classifyFailure(402, "Insufficient Balance"), agent.classifyFailure(401, ""), agent.classifyFailure(429, "slow down"),
        agent.classifyFailure(503, "overloaded"), agent.classifyFailure(404, ""), agent.classifyFailure(400, "bad field")]);
    eq(agent.classifyFailure(429, "insufficient_quota"), "billing", "kota bitti 429 da beklenmez");
    eq([agent.retryAfterMs("7"), agent.retryAfterMs(null, "please retry after 2 s"), agent.retryAfterMs("9999"), agent.retryAfterMs(null, "x")], [7000, 2000, 60000, null]);

    const calls = [], sleeps = [];
    const fake = async (_u, init) => {
        const m = JSON.parse(init.body).model;
        calls.push(m);
        if (m === "main") return { ok: false, status: 402, text: async () => "Insufficient Balance", headers: { get: () => null } };
        if (m === "busy" && calls.filter((x) => x === "busy").length === 1) return { ok: false, status: 429, text: async () => "rate", headers: { get: (h) => (h === "retry-after" ? "3" : null) } };
        return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: "ok" } }], usage: {} }) };
    };
    const cfg = { root: tmpDir("ladder"), delegate: { provider: "p", stateDir: "s", providers: { p: { apiBase: "http://x", model: "main", price: { input: 0, cached: 0, output: 0 } } } } };
    const r = await agent.chat(cfg, [{ role: "user", content: "hi" }], "k", [], { fetch: fake, sleep: async (ms) => sleeps.push(ms), fallbackModels: ["busy"], maxRetries: 2 });
    eq([r.model, calls, sleeps], ["busy", ["main", "busy", "busy"], [3000]], "402 -> beklemeden sonraki basamak; 429 -> Retry-After");

    const dead = async () => ({ ok: false, status: 402, text: async () => "Insufficient Balance", headers: { get: () => null } });
    let err = null;
    try { await agent.chat(cfg, [{ role: "user", content: "hi" }], "k", [], { fetch: dead, sleep: async () => { throw new Error("beklememeli"); }, fallbackModels: [] }); } catch (e) { err = e; }
    eq(err && err.kind, "billing", "çağıran ana modele devri (K25) türüne göre seçebilmeli");
});

test("fix: döngü bekçisi 'exit 1' tekrarını ve değişmeyen dosyada aynı okumayı yakalar; durgunluk süre/PID gürültüsüne takılmaz", () => {
    const g = agent.loopGuard();
    eq([1, 2, 3].map(() => g("run", { command: "test" }, "exit 1\nFAIL x (12 ms) pid 4411", 5).n), [1, 2, 3], "çıkış kodu hatası sayılmalı");
    eq(g("run", { command: "test" }, "exit 1\nFAIL x (97 ms) pid 9", 5), { n: 4, kind: "fail" }, "süre/PID farkı aynı hata sayılmalı");
    eq([1, 2, 3].map(() => g("read_file", { path: "a.js" }, "1\tx", 7).n), [1, 2, 3]);
    eq(g("read_file", { path: "a.js" }, "1\ty", 8).n, 1, "bir yazmadan sonra okuma sayacı sıfırlanır");
    eq(g("run", { command: "test" }, "exit 0\nok", 8).n, 0, "başarı sayılmaz");

    const s = agent.stagnationGuard();
    ok(!s("test", "diff", "exit 1\nfail at 2026-11-21T10:00:01Z after 1.2s").stalled);
    ok(s("test", "diff", "exit 1\nfail at 2026-11-21T10:05:44Z after 3.9s").stalled, "zaman damgası farkı durgunluğu gizlememeli");
    eq(agent.normalizeOutput("D:\\build\\Temp\\cv-1\\a.txt /var/tmp/cv-2/b.log 0x7ffde1234567"), "<tmp> <tmp> <addr>");
});

test("fix: şerit planı bağımlıları ve aynı dosyaya dokunanları aynı şeride, sırayla koyar", () => {
    const order = ["T-1", "T-2", "T-3", "T-4", "T-5"];
    const lanes = planLanes(order, 3, { deps: { "T-3": ["T-1"] }, scopes: { "T-2": ["src/ui/"], "T-4": ["src/ui/panel.rs"], "T-5": ["docs/x.md"] } });
    const laneOf = (t) => lanes.findIndex((l) => l.includes(t));
    eq(laneOf("T-1"), laneOf("T-3"), "bağımlı aynı şeritte");
    ok(lanes[laneOf("T-3")].indexOf("T-1") < lanes[laneOf("T-3")].indexOf("T-3"), "önkoşul önce");
    eq(laneOf("T-2"), laneOf("T-4"), "örtüşen kapsam aynı şeritte (E9)");
    eq(lanes.length, 3);
    eq([scopesOverlap(["src/a.js"], ["src/a.jsx"]), scopesOverlap(["src/**"], ["src/b.js"]), scopesOverlap(null, ["x"])], [false, true, false]);
});

test("fix: doğrulayıcı test bildirimini doğrulama saymaz; derleme/test betikleri ucuz modele yasak (ders 30)", () => {
    const noAssert = "+++ b/tests/a.test.js\n@@ -1,0 +1,1 @@\n+test('a', () => { run(); });\n";
    ok(inspectTestQuality(noAssert).some((f) => f.category === "test_quality"), "doğrulamasız test yakalanmalı");
    eq(inspectTestQuality("+++ b/tests/a.test.js\n@@ -1,0 +1,1 @@\n+test('a', () => { eq(add(1, 2), 3); });\n"), []);

    const cfg = { build: ["powershell", "-File", "build.ps1"], test: ["node", "tests/run.js"], forbiddenWrite: [] };
    eq(runnerScripts(cfg), ["^build\\.ps1$", "^tests/run\\.js$"]);
    const re = forbiddenRegexes(cfg);
    ok(re.some((r) => r.test("tests/run.js")) && !re.some((r) => r.test("tests/other.test.js")), "yalnız koşucu betiği yasak");
    eq(runnerScripts({ test: [process.execPath, "-e", "x"] }), [], "mutlak yol ve kod parçası betik sayılmaz");
});

test("fix: cv init üst klasördeki başka bir depoya commit atmaz; journalTail satır sayısı; council model adı", () => {
    const outer = tmpDir("outer-repo");
    git(["init", "-q"], outer);
    const inner = path.join(outer, "yeni-proje");
    fs.mkdirSync(inner);
    eq([isOwnRepoRoot(outer), isOwnRepoRoot(inner)], [true, false], "iç klasör kendi deposu değil");

    const root = tmpDir("journal");
    const cfg = { root, autonomy: { dir: ".evrim/otonom" }, evolution: { journalTailLines: 10 } };
    writeText(path.join(root, ".evrim/otonom/GUNLUK.md"), "# G\n\n" + Array.from({ length: 12 }, (_, i) => `## ${i}\n- satır ${i}`).join("\n") + "\n");
    eq([journalTail(cfg).split("\n").length, journalTail(cfg, 6).split("\n").length], [10, 6]);
    eq(KNOWN_API_PROVIDERS.deepseek.model, "deepseek-flash", "E1: güncel ad");
    ok(readText(path.join(root, ".evrim/otonom/GUNLUK.md")).length > 0);
});
