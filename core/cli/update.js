// cv update [--apply]
// Shows what the installed package version would change in the project; --apply takes it.
// Only package-owned files are touched: skill copies and .evrim/README.md. The project's config
// (forbidden paths, thresholds) and its documents are the owner's and are never rewritten here.
import path from "node:path";
import { exists, git, readText, writeText } from "../lib/util.js";
import { TEMPLATE_DIR, VERSION } from "../lib/config.js";
import { project } from "./_project.js";
import { skillSources, stampSkill, writeShims } from "./init.js";

const norm = (s) => s.replace(/\r\n/g, "\n").replace(/<!-- claudevolution [\d.]+ -->/, "").trim();
// Line-level difference size, order-insensitive: enough to tell "one paragraph" from "rewritten".
function delta(a, b) {
    const A = norm(a).split("\n"), B = norm(b).split("\n"), sa = new Set(A), sb = new Set(B);
    return { added: B.filter((l) => !sa.has(l)).length, removed: A.filter((l) => !sb.has(l)).length };
}

export function plan(cfg) {
    const items = [];
    const add = (rel, want) => {
        const dest = path.join(cfg.root, rel);
        if (!exists(dest)) { items.push({ rel, want, kind: "yeni", added: norm(want).split("\n").length, removed: 0 }); return; }
        const have = readText(dest);
        if (norm(have) !== norm(want)) items.push({ rel, want, kind: "değişti", ...delta(have, want) });
    };
    for (const [skill, src] of Object.entries(skillSources(cfg.lang))) add(`.claude/skills/${skill}/SKILL.md`, stampSkill(readText(src)));
    add(".evrim/README.md", readText(path.join(TEMPLATE_DIR, ".evrim", "README.md")));
    return items;
}

export async function run(args) {
    const cfg = project(args);
    const versionFile = path.join(cfg.root, ".evrim", "version");
    const have = readText(versionFile, "?").trim();
    const items = plan(cfg);
    console.log(`Proje sürümü ${have}, paket ${VERSION}. Farklı dosya: ${items.length}`);
    for (const i of items) console.log(`  ${i.kind.padEnd(7)} ${i.rel}  (+${i.added} / -${i.removed} satır)`);
    if (!items.length && have === VERSION) { console.log("Güncel."); return 0; }
    if (!args.apply) { console.log("\nUygulamak için: cv update --apply  (config.json ve proje belgelerine dokunulmaz; eski hâl git geçmişinde kalır)"); return 0; }
    // Local edits to a skill would be lost: refuse unless they are committed (git keeps the old text).
    const dirty = git(["status", "--porcelain", "--", ".claude/skills", ".evrim/README.md"], cfg.root);
    if (dirty.ok && dirty.out) throw new Error("beceri dosyalarında commit edilmemiş değişiklik var; önce commit edin (geri dönülebilsin):\n" + dirty.out);
    for (const i of items) writeText(path.join(cfg.root, i.rel), i.want);
    writeText(versionFile, VERSION + "\n");
    writeShims(cfg.root);
    console.log(`\nUygulandı: ${items.length} dosya, sürüm ${VERSION}. Farka bakıp commit edin: git diff`);
    return 0;
}
