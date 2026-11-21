// The subtext engine (owner requirement 2026-11-20): from a short request, what the owner did not say.
// A non-technical owner names a wish in one sentence; the unsaid part (who, when, why, the feeling they want,
// what would annoy them, what "like X" means) is where revisions come from. This module gives the main
// model the deterministic half of that work, at zero tokens:
//   1. kind of app, by keywords (templates/expectations/<kind>.json); the owner's own words always win
//      over a default (craft-anything pitfall "A default given as an order");
//   2. the catalogue of "must have even if unsaid" for that kind -> self-test steps and acceptance lines;
//   3. at most 7 questions, only where the choice is the owner's and a wrong guess is expensive, each with
//      options and a default written as "unless you say otherwise"; a question the request already answers
//      is not asked but still accounted for (LoopTroop server/prompts PROM4 "Auto-Skipping");
//   4. docs/INTENT.md: the intent card, with an "Anladığım şu" summary the main model fills and shows with
//      the mock-up screenshot, so the owner corrects once, before code;
//   5. coverage: every expectation id must reach the plan (ROADMAP / task specs), or the plan is refused
//      (LoopTroop PROM5 coverage verification idea).
import fs from "node:fs";
import path from "node:path";
import { exists, readJson, readText } from "../lib/util.js";
import { PKG_ROOT } from "../lib/config.js";

export const EXPECT_DIR = path.join(PKG_ROOT, "templates", "expectations");
export const MAX_QUESTIONS = 7;

export function kinds() {
    let files = [];
    try { files = fs.readdirSync(EXPECT_DIR).filter((f) => f.endsWith(".json")).sort(); } catch (_) { /* none */ }
    return files.map((f) => readJson(path.join(EXPECT_DIR, f), null)).filter(Boolean);
}

const lower = (s) => String(s || "").toLocaleLowerCase("tr");
// Ranked kinds for a request: keyword hits (a longer keyword weighs more). [] when nothing matches.
export function classify(request) {
    const t = lower(request);
    return kinds()
        .map((k) => ({ id: k.id, title: k.title, score: k.keywords.reduce((s, w) => s + (t.includes(lower(w)) ? 1 + lower(w).length / 10 : 0), 0) }))
        .filter((k) => k.score > 0)
        .sort((a, b) => b.score - a.score);
}

// "like Obsidian" / "Obsidian gibi" / "X benzeri": the named program, so the card asks which of its
// qualities are meant (local files and panes, not its plug-in store).
export function likeWhat(request) {
    const m = String(request || "").match(/([A-ZÇĞİÖŞÜ][\w.+-]*(?:\s+[A-ZÇĞİÖŞÜ][\w.+-]*)?)\s+(?:gibi|benzeri|tarzı|tarzında)|like\s+([A-Z][\w.+-]*)/u);
    return m ? (m[1] || m[2]).trim() : null;
}

// The card for a request: kind, unsaid expectations, the few questions worth asking, the self-test steps.
export function card(request, { kind = null } = {}) {
    const all = kinds();
    const ranked = classify(request);
    const chosen = all.find((k) => k.id === (kind || (ranked[0] && ranked[0].id))) || all.find((k) => k.id === "tool");
    const t = lower(request);
    const like = likeWhat(request);
    const likeWord = like ? lower(like) : null;
    const questions = [];
    for (const q of chosen.questions || []) {
        // Answered already when the request contains the words of one option: not asked, still listed. The
        // name of the program it is likened to is no answer ("Obsidian gibi" does not mean every option
        // that mentions Obsidian; the "like" question asks which side is meant).
        const said = q.options.findIndex((o) => lower(o).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 4 && w !== likeWord).some((w) => t.includes(w)));
        questions.push({ ...q, answered: said >= 0 ? said : null });
    }
    if (like) questions.unshift({ id: "like", text: `"${like} gibi" derken en çok hangisi önemli?`, options: ["Görünüşü ve düzeni", "Çalışma şekli (dosyalar, kısayollar)", "Belirli bir özelliği (yazın)"], default: 1, why: "Benzetilen programın tamamı değil, kastedilen yanı yapılır", answered: null });
    const steps = [...new Set(chosen.expectations.map((e) => e.step).filter(Boolean))];
    return {
        request: String(request),
        kind: chosen.id,
        title: chosen.title,
        alternatives: ranked.filter((r) => r.id !== chosen.id).slice(0, 2).map((r) => r.id),
        feel: chosen.feel,
        like,
        expectations: chosen.expectations,
        questions: questions.slice(0, MAX_QUESTIONS),
        selfTestSteps: steps,
        acceptance: chosen.expectations.map((e) => `[E:${e.id}] ${e.text}`)
    };
}

// docs/INTENT.md. The «...» lines are for the main model to fill from the conversation (one pass); the
// rest is the catalogue, so nothing the kind needs can be forgotten.
export function renderIntent(c, answers = {}) {
    const ans = (q) => {
        const i = answers[q.id] ?? q.answered;
        return i === null || i === undefined ? `${q.options[q.default]} (aksi söylenmedikçe)` : typeof i === "number" ? q.options[i] : String(i);
    };
    return [
        `# Niyet kartı`,
        ``,
        `İstek: "${c.request}"`,
        `Tür: ${c.title} (\`${c.kind}\`)${c.alternatives.length ? ` · yakın türler: ${c.alternatives.join(", ")}` : ""}`,
        ``,
        `## Anladığım şu (5-8 satır, sahibe maket görüntüsüyle birlikte gösterilir)`,
        ``,
        `- Kim kullanacak, ne zaman, nerede: «günlük bir sahne: "salı sabahı işe başlarken..."»`,
        `- Asıl dert (neden bu program): «»`,
        `- İstenen his: ${c.feel} «sahibin kelimeleriyle düzelt»`,
        `- "Mükemmel" onun için: «»`,
        `- Neyi görünce sinirlenir: «yavaşlık, veri kaybı, karmaşık menü... hangisi»`,
        c.like ? `- "${c.like} gibi" = «kastedilen yanı; kastedilmeyen (ör. eklenti mağazası) açıkça dışarıda»` : `- Benzettiği program: yok`,
        ``,
        `## Kararlar`,
        ``,
        ...c.questions.map((q) => `- ${q.text} → ${ans(q)}${q.answered !== null && answers[q.id] === undefined ? " (istekte söylendi, sorulmadı)" : ""}`),
        ``,
        `## Söylenmese de olmazsa olmazlar (kabul ölçütleri)`,
        ``,
        ...c.acceptance.map((a) => `- ${a}`),
        ``,
        `## Ölçüm`,
        ``,
        `- \`--self-test\` adımları: ${c.selfTestSteps.join(", ") || "(yok)"} (\`.evrim/config.json\` > \`check.selfTest.steps\`)`,
        `- Kapsam: her \`[E:...]\` maddesi yol haritasında ya da bir tarifte geçmeli: \`cv intent coverage\``,
        ``
    ].join("\n");
}

// Which expectation ids from docs/INTENT.md never reached the plan (docs/ROADMAP.md, task specs, VISION).
export function coverage(cfg) {
    const intent = readText(path.join(cfg.root, "docs", "INTENT.md"), "");
    const ids = [...new Set([...intent.matchAll(/\[E:([\w-]+)\]/g)].map((m) => m[1]))];
    const plan = [];
    for (const rel of [(cfg.docs && cfg.docs.roadmap) || "docs/ROADMAP.md", (cfg.docs && cfg.docs.vision) || "docs/VISION.md"]) plan.push(readText(path.join(cfg.root, rel), ""));
    const tasksDir = path.join(cfg.root, (cfg.tasks && cfg.tasks.dir) || "docs/tasks");
    if (exists(tasksDir)) for (const f of fs.readdirSync(tasksDir).filter((x) => x.endsWith(".md") && !x.endsWith(".report.md"))) plan.push(readText(path.join(tasksDir, f), ""));
    const text = plan.join("\n");
    const covered = ids.filter((id) => text.includes(`[E:${id}]`) || text.includes(`E:${id}`));
    return { ids, covered, missing: ids.filter((id) => !covered.includes(id)), hasIntent: !!intent };
}
