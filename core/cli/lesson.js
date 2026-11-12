// cv lesson "<ders>" [--evrensel] [--hata] [--no-push]
// Writes a lesson into this project's memory (DERSLER.md; HATALAR.md with --hata). With --evrensel the
// lesson goes to the package at once (core/evolve/lesson.js: branch, commit, measure, push) and the local
// line is marked [evrensel→taşındı vX]. If the package refuses it, the local line stays [evrensel] so the
// next distillation sees it again, and the reason is printed.
import { appendText, exists, today, writeText } from "../lib/util.js";
import { lessonTarget, userUniversal } from "../lib/home.js";
import { writeProject } from "../evolve/merge.js";
import { PKG_ROOT, findRoot, loadConfig } from "../lib/config.js";
import { memFile } from "../autonomy/memory.js";
import { problems, promote } from "../evolve/lesson.js";
import process from "node:process";
import path from "node:path";

function localWrite(cfg, kind, tag, text) {
    if (!cfg) return null;
    if (kind === "hata") {
        appendText(memFile(cfg, "HATALAR"), `\n## ${tag} ${text.split(/\r?\n/)[0].slice(0, 80)} (${today()})\n- ${text}\n`);
        return memFile(cfg, "HATALAR");
    }
    appendText(memFile(cfg, "DERSLER"), `- ${tag} ${text} (${today()})\n`);
    return memFile(cfg, "DERSLER");
}

export async function run(args) {
    const text = String(args._.join(" ") || "").trim();
    if (!text) throw new Error('kullanım: cv lesson "<ders>" [--evrensel] [--hata] [--no-push]');
    const kind = args.hata ? "hata" : "ders";
    const root = findRoot(typeof args.dir === "string" ? path.resolve(args.dir) : process.cwd());
    const cfg = root ? loadConfig(root) : null;

    if (!args.evrensel) {
        const where = localWrite(cfg, kind, "[yerel]", text);
        console.log(where ? `yerel ${kind} yazıldı: ${where}` : "proje bulunamadı; yerel ders yazılmadı");
        return where ? 0 : 1;
    }
    // An owner without push rights to the package (claudevrim installed, not a developer machine): the lesson
    // goes to this machine's universal layer and from there into every project (.evrim/evrensel.md).
    if (lessonTarget() === "makine") {
        const bad = problems(text, { projectWords: cfg ? [cfg.project] : [] });
        if (bad.length) { localWrite(cfg, kind, "[evrensel]", text); console.log("evrensel olamaz (yerelde [evrensel] kaldı):\n  - " + bad.join("\n  - ")); return 1; }
        const file = userUniversal(kind);
        if (!exists(file)) writeText(file, kind === "hata" ? "# Bu makinenin evrensel hata kalıpları\n\n" : "# Bu makinenin evrensel dersleri\n\n");
        appendText(file, kind === "hata" ? `\n## ${text.split(/\r?\n/)[0].slice(0, 80)}\n- ${text} (${today()})\n` : `- ${text} (${today()})\n`);
        localWrite(cfg, kind, "[evrensel→taşındı makine]", text);
        if (root) writeProject(root);
        console.log(`evrensel ${kind} bu makinenin katmanında: ${file} (bütün projelere .evrim/evrensel.md ile gider)`);
        return 0;
    }
    let r;
    try {
        r = promote({ root: PKG_ROOT, text, kind, source: "", projectWords: cfg ? [cfg.project] : [], push: !args["no-push"] });
    } catch (e) {
        localWrite(cfg, kind, "[evrensel]", text);
        console.log(`pakete gitmedi (yerelde [evrensel] kaldı, damıtma yeniden bakar): ${e.message}`);
        return 1;
    }
    for (const l of r.lines) console.log(l);
    localWrite(cfg, kind, r.accepted ? `[evrensel→taşındı v${r.version}]` : "[evrensel]", text);
    console.log(r.accepted ? `evrensel ${kind} pakette: v${r.version}` : `pakete alınmadı (yerelde [evrensel] kaldı): ${r.why}`);
    return r.accepted ? 0 : 1;
}
