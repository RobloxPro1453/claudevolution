// cv update [--apply] [--rollback [<yedek>]] [--backups]
// Shows what the installed package version would change in the project; --apply takes it, --rollback undoes it.
// Lossless (owner decision #21, core/cli/migrate.js): package-owned files (skill copies on Claude, Codex and
// Antigravity, the Antigravity loop workflow, .evrim/README.md) are refreshed; .evrim/config.json is merged,
// never replaced (missing keys added, the owner's values kept, safety lists only grow); memory, metrics,
// documents, task specs and the owner's own skills are never touched. Every apply first copies what it
// changes to .evrim/backups/, so one command brings the old state back.
import path from "node:path";
import process from "node:process";
import { exists, git } from "../lib/util.js";
import { VERSION, findRoot } from "../lib/config.js";
import { ignoreLines, writeShims } from "./init.js";
import { writeProject } from "../evolve/merge.js";
import { listBackups, migrate, planFiles, planUpdate, rollback } from "./migrate.js";

// The package-owned files that differ (kept for callers and tests; the full plan is migrate.planUpdate).
export function plan(cfg) {
    return planFiles(cfg.root, cfg.lang).map(({ rel, want, kind, added, removed }) => ({ rel, want, kind, added, removed }));
}

function rootOf(args) {
    const start = typeof args.dir === "string" ? path.resolve(args.dir) : process.cwd();
    const root = findRoot(start);
    if (!root) throw new Error("burada claudevolution kurulu değil (.evrim/config.json yok). Önce: cv init");
    return root;
}

export async function run(args) {
    const root = rootOf(args);
    if (args.backups) {
        const all = listBackups(root);
        if (!all.length) { console.log("Yedek yok."); return 0; }
        for (const b of all) console.log(`${b.id}  (${b.manifest.files.length} dosya${b.manifest.rolledBackAt ? ", geri alındı" : ""})`);
        return 0;
    }
    if (args.rollback) {
        const r = rollback(root, typeof args.rollback === "string" ? args.rollback : null);
        console.log(`Geri alındı: ${r.id}\n  eski hâline dönen: ${r.restored.length} dosya${r.removed.length ? `\n  güncellemenin eklediği, kaldırılan: ${r.removed.join(", ")}` : ""}\nSürüm: ${r.manifest.from}. Farka bakın: git status`);
        return 0;
    }

    const p = planUpdate(root);
    console.log(`Proje sürümü ${p.from}, paket ${VERSION}.`);
    if (p.blocked) { console.log(`\nGüncelleme durdu, hiçbir şey yazılmadı: ${p.blocked}`); return 1; }
    console.log("Verileriniz silinmez: dersler, günlük, ölçümler, belgeler, tarifler ve kendi becerileriniz olduğu gibi kalır; değişen her dosya önce .evrim/backups/ altına yedeklenir (geri almak: cv update --rollback).");
    if (p.items.length) {
        console.log(`\nDeğişecek: ${p.items.length} dosya`);
        for (const i of p.items) {
            if (i.kind === "onarım") {
                console.log(`  onarım  ${i.rel}  (sizin değerleriniz aynen kalır)`);
                for (const a of i.added) console.log(`           + yeni ayar: ${a} (varsayılan değeriyle)`);
                for (const r of i.repaired) console.log(`           + ${r.why}`);
            } else console.log(`  ${i.kind.padEnd(7)} ${i.rel}  (+${i.added} / -${i.removed} satır)`);
        }
    }
    if (p.kept.length) console.log(`\nDokunulmayacak (sizin): ${p.kept.join(", ")}`);
    for (const n of p.notes) console.log("not: " + n);
    const have = p.from;
    if (!p.items.length && have === VERSION) { if (args.apply) { ignoreLines(root); writeProject(root); } console.log("\nGüncel."); return 0; }
    if (!args.apply) { console.log("\nUygulamak için: cv update --apply"); return 0; }

    // Local edits to a package skill copy are still a reason to stop: the owner may want to keep them as a skill of their own.
    const skillPaths = [".claude/skills", ".codex/skills", ".agent/skills", ".agent/workflows", ".evrim/README.md"].filter((x) => exists(path.join(root, x)));
    const dirty = skillPaths.length ? git(["status", "--porcelain", "--", ...skillPaths], root) : { ok: false };
    if (dirty.ok && dirty.out) throw new Error("beceri dosyalarında commit edilmemiş değişiklik var; önce commit edin (ya da kendi adınızla ayrı bir beceri klasörüne taşıyın):\n" + dirty.out);

    const res = migrate(root, p);
    writeShims(root);
    const ig = ignoreLines(root);
    if (ig.length) console.log(".gitignore'a eklendi: " + ig.join(", "));
    const u = writeProject(root);
    console.log(`Evrensel dersler yenilendi: paketten ${u.pkg}, bu makineden ${u.machine} (.evrim/evrensel.md)`);
    console.log(`\nUygulandı: ${res.written.length} dosya, sürüm ${VERSION}. Yedek: .evrim/backups/${res.backup.id}\nDenetim: config geçerli. Farka bakıp commit edin: git diff   (geri almak: cv update --rollback)`);
    return 0;
}
