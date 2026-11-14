// cv round: Claude logs, cheap-model records and git measured into one metrics.jsonl row.
import fs from "node:fs";
import path from "node:path";
import { test, tmpDir, eq, ok, throws } from "./harness.js";
import { git, readText, writeJson, writeText } from "../core/lib/util.js";
import { loadConfig } from "../core/lib/config.js";
import { init } from "../core/cli/init.js";
import * as round from "../core/metrics/round.js";

function project(label) {
    const dir = tmpDir(label);
    git(["init", "-q"], dir);
    git(["config", "user.email", "test@example.invalid"], dir);
    git(["config", "user.name", "test"], dir);
    git(["config", "commit.gpgsign", "false"], dir);
    init(dir, { name: "olcum" });
    git(["add", "-A"], dir); git(["commit", "-qm", "init"], dir);
    const cfg = loadConfig(dir);
    cfg.codePaths = ["src/"];
    cfg.metrics.claudeProjectDir = tmpDir("claude-logs");
    return cfg;
}
const commit = (dir, file, text, msg) => { writeText(path.join(dir, file), text); git(["add", "-A"], dir); ok(git(["commit", "-qm", msg], dir).ok, "commit"); };
const usage = (id, ts, model, out, rd, extra = {}) => JSON.stringify({ type: "assistant", sessionId: "s1", timestamp: ts, message: { id, model, usage: { output_tokens: out, cache_read_input_tokens: rd, cache_creation_input_tokens: 0, input_tokens: 0 } }, ...extra });

test("tur: start → iş → end tek satır yazar; Claude, ucuz model ve git ölçülür", () => {
    const cfg = project("round");
    const t0 = new Date(Date.now() - 3600e3), mid = new Date(Date.now() - 1800e3).toISOString(), old = new Date(Date.now() - 7200e3).toISOString();
    const open = round.start(cfg, { quota: "10", type: "ozellik" }, t0);
    eq(open.round, 1);
    throws(() => round.start(cfg, {}), /zaten açık/, "ikinci start");
    ok(round.show(cfg).includes("açık: tur 1"), "show açık turu gösterir");

    commit(cfg.root, "src/a.js", "1\n2\n3\n", "claude kodu");
    commit(cfg.root, "src/b.js", "1\n2\n", "ajan kodu\n\n" + cfg.delegate.commitTrailer);
    commit(cfg.root, "docs/tasks/T-001.md", "a\nb\nc\nd\n", "tarif");

    // The same message id twice (repeated log entries) counts once; an entry outside the window not at all.
    writeText(path.join(cfg.metrics.claudeProjectDir, "s1.jsonl"), [
        usage("m1", mid, "claude-opus-5-5", 1000, 100000),
        usage("m1", mid, "claude-opus-5-5", 1000, 100000),
        usage("m2", mid, "claude-sonnet-5-5", 500, 0, { isSidechain: true }),
        usage("m0", old, "claude-opus-5-5", 9999, 0),
        "bozuk satır"
    ].join("\n"));
    const sd = path.join(cfg.root, cfg.delegate.stateDir);
    writeJson(path.join(sd, "T-001.json"), { task: "T-001", runs: [{ startedAt: mid, at: new Date(Date.now() - 1700e3).toISOString(), kind: "first", status: "done", steps: 12, cost: 0.05, tokens: { hit: 10, miss: 5, out: 3 } }] });
    writeJson(path.join(sd, "T-002.json"), { task: "T-002", runs: [{ at: mid, kind: "first", status: "blocked", steps: 8, cost: 0.02, stopReason: "loop" }, { at: mid, kind: "fix", status: "done", steps: 4, cost: 0.01 }] });

    const row = round.end(cfg, { quota: "12", bugs: "yok" });
    eq(row.round, 1); eq(row.type, "ozellik"); eq(row.quotaStart, 10); eq(row.quotaEnd, 12);
    eq(row.claude.calls, 2, "çağrı (tekrar ve pencere dışı sayılmaz)");
    eq(row.claude.sidechainCalls, 1);
    eq(row.claude.load, 0.04 + 0.01 * 0.6, "yük: (1000*20 + 100000*0.2)/1e6 × 1 + 500*20/1e6 × 0.6");
    eq([row.delegate.tasks, row.delegate.runs, row.delegate.firstTryDone, row.delegate.endedDone, row.delegate.fixRuns], [2, 3, 1, 2, 1]);
    eq([row.delegate.steps, row.delegate.wastedSteps, row.delegate.loopStops, row.delegate.cost], [24, 8, 1, 0.08]);
    eq([row.git.commits, row.git.codeAdded, row.git.agentCodeAdded, row.git.claudeCodeAdded, row.git.specLines], [3, 5, 2, 3, 4]);
    eq(row.git.specPerCode, 0.8);

    eq(round.rows(cfg).length, 1);
    ok(!round.isOpen(cfg), "tur kapandı");
    ok(readText(path.join(cfg.root, ".evrim/METRICS.md")).includes("| 1 | "), "tablo üretildi");
    ok(round.show(cfg).includes("açık tur yok") && round.show(cfg).includes("tur 1"), "show son turları gösterir");
    throws(() => round.end(cfg, {}), /açık tur yok/, "kapalı turu bitirme");
});

test("tur: geçmiş tur eklenir; aynı numara iki kez yazılmaz; dry yazmaz", () => {
    const cfg = project("round-add");
    const base = git(["rev-parse", "HEAD"], cfg.root).out;
    commit(cfg.root, "src/x.js", "x\n", "kod");
    const head = git(["rev-parse", "HEAD"], cfg.root).out;
    const o = { from: new Date(Date.now() - 600e3).toISOString(), to: new Date().toISOString(), base, head };
    eq(round.add(cfg, { ...o, dry: true }).git.codeAdded, 1);
    eq(round.rows(cfg).length, 0, "dry yazmaz");
    round.add(cfg, o);
    throws(() => round.add(cfg, { ...o, round: "1" }), /zaten/, "aynı tur");
    throws(() => round.add(cfg, { from: o.from }), /--to/, "eksik alan");
});

test("tur: Claude kayıt klasörü proje yolundan türetilir", () => {
    const cfg = { root: path.resolve("/tmp/a b/proj"), metrics: { claudeProjectDir: null } };
    ok(round.claudeDir(cfg).endsWith(path.resolve("/tmp/a b/proj").replace(/[^A-Za-z0-9]/g, "-")), "yol kısaltması");
    ok(!path.basename(round.claudeDir(cfg)).includes(" "), "boşluk yok");});
