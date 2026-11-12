// cv adopt: plan for a hand-grown setup, --dry-run writes nothing, --apply only adds files.
import fs from "node:fs";
import path from "node:path";
import { test, tmpDir, eq, ok } from "./harness.js";
import { git, readJson, readText, writeJson, writeText } from "../core/lib/util.js";
import { loadConfig, validate } from "../core/lib/config.js";
import { apply, plan, render, run } from "../core/cli/adopt.js";

function legacyProject() {
    const dir = tmpDir("legacy");
    git(["init", "-q"], dir);
    const w = (rel, text) => writeText(path.join(dir, rel), text);
    writeJson(path.join(dir, "docs/workflow/config.json"), {
        project: "Eski", baseBranch: "develop", worktree: "../../eski-calisma/ds", claudeProjectDir: "~/.claude/projects/X",
        build: ["make"], test: ["make", "test"], testMinutes: 4, tasksDir: "docs/tasks", taskPattern: "^DS-\\d+\\.md$", agentRules: "docs/tasks/README.md",
        stateDir: "build/ds", metrics: "docs/workflow/metrics.jsonl", metricsTable: "docs/workflow/METRICS.md", codePaths: ["src/"],
        agentCommitTrailer: "DeepSeek", forbiddenWrite: ["^vendor/"], skipDirs: "^(\\.git|build)(/|$)", agentIntro: "You work on Eski.",
        engineSearch: { file: "x" }, claudeWeights: { output: 20, cacheRead: 0.2, cacheWrite: 8, input: 4, modelFactor: { opus: 1 } }
    });
    w("AGENTS.md", "# Eski kurallar\n");
    w("docs/VISION.md", "# Eski vizyon\n");
    w("docs/ENGINE.md", "motor\n");
    w("docs/workflow/README.md", "yöntem\n");
    w("docs/workflow/metrics.jsonl", JSON.stringify({ round: 1, claude: { calls: 1, load: 1 }, deepseek: { tasks: 1 }, git: { codeAdded: 1 } }) + "\n");
    w("docs/tasks/README.md", "rules\n");
    w("docs/tasks/DS-001.md", "spec\n");
    w("docs/tasks/DS-001.report.md", "report\n");
    w("scripts/ds/agent.js", "//\n");
    w("scripts/ds.ps1", "#\n");
    w("scripts/round.js", "//\n");
    w("scripts/probe.ps1", "#\n");
    w("scripts/capture/ref_index.py", "#\n");
    w(".claude/skills/fullotonom/SKILL.md", "eski döngü\n");
    w(".claude/skills/durum/SKILL.md", "eski durum\n");
    w(".claude/skills/test/SKILL.md", "test\n");
    w(".claude/loop.md", "loop\n");
    w("build/otonom/DERSLER.md", "- eski ders\n");
    w("build/ds/DS-001.json", JSON.stringify({ task: "DS-001", runs: [] }));
    w("src/main.c", "int main;\n");
    w("original/secret.bin", "x");
    return dir;
}
const snapshot = (d) => { const out = {}; const walk = (p, rel) => { for (const e of fs.readdirSync(p, { withFileTypes: true })) { if (e.name === ".git") continue; const r = rel ? rel + "/" + e.name : e.name; if (e.isDirectory()) walk(path.join(p, e.name), r); else out[r] = readText(path.join(p, e.name)); } }; walk(d, ""); return out; };
const action = (p, src) => (p.rows.find((r) => r.src === src) || {}).action;

test("adopt: her parça bir yere eşlenir; config alanları taşınır", () => {
    const dir = legacyProject(), p = plan(dir);
    eq(p.legacy, "docs/workflow/config.json");
    eq([action(p, "docs/workflow/config.json"), action(p, "AGENTS.md"), action(p, "docs/VISION.md"), action(p, "docs/ENGINE.md")], ["config", "birleştir", "kalır", "kalır"]);
    eq([action(p, "scripts/ds/agent.js"), action(p, "scripts/ds.ps1"), action(p, "scripts/round.js"), action(p, "scripts/capture/ref_index.py")], ["emekli", "emekli", "emekli", "emekli"]);
    eq([action(p, "scripts/probe.ps1"), action(p, "(ajan içindeki engine_search)")], ["eklenti", "eklenti"]);
    eq([action(p, ".claude/skills/fullotonom/"), action(p, ".claude/skills/durum/"), action(p, ".claude/skills/test/"), action(p, ".claude/loop.md")], ["emekli", "birleştir", "kalır", "emekli"]);
    eq([action(p, "build/otonom/DERSLER.md"), action(p, "docs/workflow/metrics.jsonl"), action(p, "build/ds/*.json (1)")], ["kopya", "kopya", "kopya"]);
    eq([action(p, "src/"), action(p, "original/")], ["dokunulmaz", "dokunulmaz"]);
    ok(p.rows.some((r) => r.src.startsWith("docs/tasks/DS-*.md (1 tarif, 1 rapor)")), "tarifler sayılır");
    const c = p.cfg;
    eq([c.project, c.baseBranch, c.tasks.prefix, c.tasks.pattern, c.metrics.table], ["Eski", "develop", "DS", "^DS-\\d+\\.md$", "docs/workflow/METRICS.md"]);
    eq(c.forbiddenWrite, ["^vendor/", "^\\.evrim/", "^\\.claude/"]);
    eq(c.delegate.commitTrailer, "Co-Authored-By: DeepSeek <noreply@deepseek.com>");
    eq(c.delegate.worktreeRoot, "~/eski-calisma/{project}");
    eq(c.metrics.claudeProjectDir, null, "makineye özgü yol alınmaz");
    ok(!c.delegate.plugins.some((x) => x.includes("engine-search")), "yazılmamış eklenti listeye girmez");
    const md = render(p);
    ok(md.includes("| `AGENTS.md` | `AGENTS.md` | birleştir |") && md.includes("## Config eşlemesi"), "plan metni");
});

test("adopt: --dry-run hiçbir şey yazmaz", () => {
    const dir = legacyProject(), before = snapshot(dir);
    const log = console.log; console.log = () => {};
    try { eq(run({ _: [], dir, "dry-run": true }), 0); } finally { console.log = log; }
    eq(snapshot(dir), before, "dosyalar değişti");
});

test("adopt: --apply yalnız ekler; eski dosyalar yerinde; ikinci kez değişiklik yok", () => {
    const dir = legacyProject(), before = snapshot(dir);
    const r = apply(plan(dir));
    const after = snapshot(dir);
    for (const [f, t] of Object.entries(before)) eq(after[f], t, "değişti: " + f);
    eq(readText(path.join(dir, ".evrim/otonom/DERSLER.md")), "- eski ders\n", "ders kopyalandı (şablon değil)");
    ok(fs.existsSync(path.join(dir, ".evrim/metrics.jsonl")) && fs.existsSync(path.join(dir, ".evrim/state/delegate/DS-001.json")), "ölçüm ve kayıt kopyası");
    ok(fs.existsSync(path.join(dir, "AGENTS.md.new")) && fs.existsSync(path.join(dir, ".claude/skills/durum/SKILL.md.new")), "birleştirilecekler .new");
    ok(fs.existsSync(path.join(dir, ".evrim/adopt-plan.md")), "plan yazıldı");
    eq(validate(loadConfig(dir)).errors, [], "config geçerli");
    eq(readJson(path.join(dir, ".evrim/config.json")).tasks.prefix, "DS");
    ok(r.written.length > 10, "yeni dosyalar");
    const second = snapshot(dir);
    apply(plan(dir));
    const third = snapshot(dir);
    delete second[".evrim/adopt-plan.md"]; delete third[".evrim/adopt-plan.md"];
    eq(third, second, "ikinci apply bir şey değiştirdi");
});
