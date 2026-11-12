// The cheap-model agent with a scripted (offline) model: tools, forbidden paths, loop guard, pricing, lanes.
import fs from "node:fs";
import path from "node:path";
import { test, tmpDir, eq, ok } from "./harness.js";
import { git, readJson, readText, writeJson, writeText } from "../core/lib/util.js";
import { loadConfig } from "../core/lib/config.js";
import { init } from "../core/cli/init.js";
import * as agent from "../core/delegate/agent.js";
import { split, statusText } from "../core/delegate/lanes.js";
import crlf from "../core/delegate/plugins/crlf.js";

function project() {
    const dir = tmpDir("del");
    git(["init", "-q"], dir);
    for (const [k, v] of [["user.email", "test@example.invalid"], ["user.name", "test"], ["commit.gpgsign", "false"]]) git(["config", k, v], dir);
    init(dir, { name: "deneme" });
    const cfgFile = path.join(dir, ".evrim/config.json"), c = readJson(cfgFile);
    c.delegate.worktreeRoot = "../" + path.basename(dir) + "-lanes"; // keep lanes inside the test sandbox
    writeJson(cfgFile, c);
    writeText(path.join(dir, "src/a.js"), "export const a = 1;\n");
    writeText(path.join(dir, "docs/tasks/T-001.md"), "# T-001: b ekle\n\nStatus: ready\nBudget: $0.50\nSteps: 20\n\n## Goal\n\nsrc/b.js eklensin.\n");
    git(["add", "-A"], dir); git(["commit", "-qm", "init"], dir);
    return loadConfig(dir);
}
// A model that replays a fixed list of tool calls, one per step.
function scripted(calls) {
    let i = 0;
    return async () => {
        const c = calls[Math.min(i++, calls.length - 1)];
        return { message: { content: "", tool_calls: [{ id: "c" + i, function: { name: c[0], arguments: JSON.stringify(c[1]) } }] }, cost: 0.01, tokens: { hit: 10, miss: 5, out: 3 } };
    };
}
const silent = () => {};

test("ajan: görev baştan sona (dal, commit, rapor, durum kaydı)", async () => {
    const cfg = project();
    const ctx = await agent.newCtx(cfg, 1, silent);
    await agent.ensureLane(ctx);
    eq(await agent.syncForTask(ctx, "T-001"), false, "yeni iş: devam değil");
    const r = await agent.runTask(ctx, "T-001", null, { key: "test", chat: scripted([
        ["read_file", { path: "src/a.js" }],
        ["write_file", { path: "src/b.js", content: "export const b = 2;\n" }],
        ["run", { command: "build" }],
        ["run", { command: "test" }],
        ["finish", { status: "done", report: "Added src/b.js.\nChecked with build and test." }]
    ]) });
    eq([r.status, r.stopReason], ["done", "finish"]);
    const branch = git(["rev-parse", "--abbrev-ref", "HEAD"], ctx.wt).out;
    eq(branch, "cv/T-001");
    eq(git(["rev-list", "--count", `${cfg.baseBranch}..cv/T-001`], cfg.root).out, "1");
    ok(readText(path.join(ctx.wt, "src/b.js")).includes("b = 2"), "dosya yazılmalı");
    ok(readText(path.join(ctx.wt, "docs/tasks/T-001.report.md")).includes("Status: done"), "rapor");
    ok(!fs.existsSync(path.join(cfg.root, "src/b.js")), "ana klasöre dokunulmamalı");
    const state = readJson(path.join(cfg.root, cfg.delegate.stateDir, "T-001.json"));
    eq([state.status, state.runs.length, state.runs[0].steps, state.summary.testsBy, state.summary.files], ["done", 1, 5, "agent", ["src/b.js +1 -0"]]);
    ok(Math.abs(state.cost - 0.05) < 1e-9, "maliyet toplamı");
    ok(statusText(cfg).includes("cv/T-001 (+1)"), "bekleyen dal durumda görünmeli");
    // Yarım kalmış dal sıfırlanmaz, sürdürülür.
    await ctx.git(["checkout", "--detach"]);
    eq(await agent.syncForTask(ctx, "T-001"), true, "ilerideki dal sürdürülmeli");
});

test("ajan: yasak yola yazamaz, aynı hatada döngü durdurulur", async () => {
    const cfg = project();
    const ctx = await agent.newCtx(cfg, 2, silent);
    await agent.ensureLane(ctx);
    await agent.syncForTask(ctx, "T-001");
    const { tools } = ctx.kit;
    for (const p of ["AGENTS.md", ".evrim/config.json", ".git/config", "docs/VISION.md", "docs/tasks/T-002.md"]) {
        let err = ""; try { await tools.write_file.run({ path: p, content: "x" }); } catch (e) { err = e.message; }
        ok(/not allowed/.test(err), p + " reddedilmeli: " + err);
    }
    let err = ""; try { await tools.write_file.run({ path: "../disari.txt", content: "x" }); } catch (e) { err = e.message; }
    ok(/stay inside/.test(err), "proje dışı reddedilmeli");
    ok(readText(path.join(ctx.wt, "AGENTS.md")).startsWith("# Yapay"), "AGENTS değişmemeli");

    const r = await agent.runTask(ctx, "T-001", null, { key: "test", chat: scripted([["edit_file", { path: "AGENTS.md", old_text: "a", new_text: "b" }]]) });
    eq([r.status, r.stopReason], ["blocked", "loop"]);
    eq(readJson(path.join(cfg.root, cfg.delegate.stateDir, "T-001.json")).runs[0].steps, 4, "4. aynı hatada durmalı");
});

test("ajan: bütçe dolunca durur", async () => {
    const cfg = project();
    const ctx = await agent.newCtx(cfg, 3, silent);
    await agent.ensureLane(ctx);
    await agent.syncForTask(ctx, "T-001");
    const pricey = async () => ({ message: { content: "", tool_calls: [{ id: "x", function: { name: "list_files", arguments: "{\"path\":\"\"}" } }] }, cost: 0.2, tokens: { hit: 0, miss: 0, out: 0 } });
    const r = await agent.runTask(ctx, "T-001", null, { key: "test", chat: pricey });
    eq([r.status, r.stopReason], ["blocked", "budget"]);
    eq(readJson(path.join(cfg.root, cfg.delegate.stateDir, "T-001.json")).runs[0].steps, 3, "0.50 $ bütçe, adım başına 0.20 $");
});

test("ajan: yoğun saat penceresi ve fiyat", () => {
    const p = { peakUtc: "01:00-04:00,06:00-10:00", offpeakFactor: 0.5, price: { input: 0.3, cached: 0.006, output: 1.2 } };
    const at = (iso) => new Date(iso);
    eq(agent.peakUntil(p, at("2026-11-12T02:30:00Z")).toISOString(), "2026-11-12T04:00:00.000Z"); // Perşembe
    eq(agent.peakUntil(p, at("2026-11-12T04:00:00Z")), null);
    eq(agent.peakUntil(p, at("2026-11-12T09:59:00Z")).toISOString(), "2026-11-12T10:00:00.000Z");
    eq(agent.peakUntil(p, at("2026-11-14T02:30:00Z")), null, "Cumartesi yoğun saat yok");
    const tokens = { hit: 1e6, miss: 1e6, out: 1e6 };
    eq(Math.round(agent.costOf(p, tokens, at("2026-11-12T02:30:00Z")) * 1000) / 1000, 1.506);
    eq(Math.round(agent.costOf(p, tokens, at("2026-11-12T12:00:00Z")) * 1000) / 1000, 0.753);
});

test("şerit: işler şeritlere sırayla dağılır; CRLF eklentisi", () => {
    eq(split(["a", "b", "c", "d", "e"], 2), [["a", "c", "e"], ["b", "d"]]);
    eq(split(["a"], 5), [["a"]]);
    eq(crlf.beforeEdit("x\r\ny\r\nz\r\n", "x\ny", "x\nq"), { old_text: "x\r\ny", new_text: "x\r\nq" });
    eq(crlf.beforeEdit("x\ny\n", "x\ny", "x\nq"), { old_text: "x\ny", new_text: "x\nq" });
});

// --- fallback when the cheap-model key is missing (owner decision 2026-11-12)
import * as choose from "../core/delegate/choose.js";
import { validate as validateCfg } from "../core/lib/config.js";
test("yedek: anahtar varsa API, yoksa claude-subagent, liste boşsa self", () => {
    const cfg = project();
    eq(choose.choose(cfg, { DEEPSEEK_API_KEY: "x" }).mode, "api", "anahtar var");
    const fb = choose.choose(cfg, {});
    eq([fb.mode, fb.model], ["claude-subagent", "haiku"], "anahtar yok");
    ok(/^SAGLAYICI: claude-subagent \(haiku\) - DEEPSEEK_API_KEY ortamda yok$/.test(choose.line(fb)), "satır: " + choose.line(fb));
    eq(choose.choose({ ...cfg, delegate: { ...cfg.delegate, fallback: ["self"] } }, {}).mode, "self", "yalnız self");
    eq(choose.choose({ ...cfg, delegate: { ...cfg.delegate, fallback: [] } }, {}).mode, "self", "boş liste");
});
test("yedek: brief aynı kuralları, yasak yolları, testi ve tarifi taşır", () => {
    const cfg = project(), b = choose.brief(cfg, "T-001");
    for (const s of ["## Kurallar", "Yazması yasak", "evrim", "Test kırmızıysa", "cv/T-001", "src/b.js eklensin", cfg.delegate.commitTrailer]) ok(b.includes(s), "briefte yok: " + s);
    let threw = false; try { choose.brief(cfg, "T-999"); } catch (_) { threw = true; } ok(threw, "olmayan tarif");
});
test("yedek: config yanlış fallback değerini reddeder", () => {
    const cfg = project();
    const bad = { ...cfg, delegate: { ...cfg.delegate, fallback: ["gpt"] } };
    const msg = validateCfg(bad).errors.join(" | ");
    ok(/delegate\.fallback/.test(msg), "hata metni: " + msg);
    eq(validateCfg(cfg).errors.filter((e) => /fallback|subagent/.test(e)), [], "şablon geçerli");
});
