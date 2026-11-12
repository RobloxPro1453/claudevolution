// cv init [--name X] [--lang tr|en] [--dir PATH] [--no-doctor]
// Copies the project skeleton. Never overwrites: a differing existing file gets a ".new" beside it.
// Running it twice changes nothing (idempotent).
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { exists, git, isWindows, readJson, readText, slash, today, writeJson, writeText } from "../lib/util.js";
import { CONFIG_REL, PKG_ROOT, TEMPLATE_DIR, VERSION, defaults, detect } from "../lib/config.js";

function walk(dir, rel = "") {
    const out = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const r = rel ? rel + "/" + e.name : e.name;
        if (e.isDirectory()) out.push(...walk(path.join(dir, e.name), r)); else out.push(r);
    }
    return out;
}
// Line endings and the fill-in date do not make a file "different" (a second init on another day stays a no-op).
const norm = (s) => s.replace(/\r\n/g, "\n").replace(/\d{4}-\d{2}-\d{2}/g, "<tarih>");
const sameText = (a, b) => norm(a) === norm(b);
const showCmd = (c) => (c ? c.join(" ") : "<komut tanımlı değil: .evrim/config.json içinde doldurun>");

// Write dest unless it exists. Existing and identical: nothing. Existing and different: dest.new.
export function place(dest, content, report, rel) {
    if (!exists(dest)) { writeText(dest, content); report.created.push(rel); return; }
    if (sameText(readText(dest), content)) { report.same.push(rel); return; }
    const side = dest + ".new";
    if (exists(side) && sameText(readText(side), content)) { report.kept.push(rel); return; }
    writeText(side, content);
    report.kept.push(rel);
    report.newFiles.push(rel + ".new");
}

export const stampSkill = (text) => text.replace(/\s*$/, "") + `\n\n<!-- claudevolution ${VERSION} -->\n`;
export function skillSources(lang) {
    const out = {};
    for (const l of ["tr", lang]) { // tr is the complete set; the chosen language overrides where it exists
        const dir = path.join(PKG_ROOT, "skills", l);
        if (!exists(dir)) continue;
        for (const name of fs.readdirSync(dir)) {
            const f = path.join(dir, name, "SKILL.md");
            if (exists(f)) out[name] = f;
        }
    }
    return out;
}

export function buildConfig(root, name, lang) {
    const d = detect(root);
    const cfg = defaults();
    cfg.project = name || d.name;
    cfg.lang = lang;
    cfg.baseBranch = d.baseBranch;
    cfg.build = d.build;
    cfg.test = d.test;
    if (d.codePaths.length) cfg.codePaths = d.codePaths;
    return { cfg, detected: d };
}

// Machine-specific launchers (git-ignored): they know where this package lives on this machine.
export function writeShims(root) {
    const evrim = path.join(root, ".evrim");
    writeJson(path.join(evrim, "local.json"), { packageHome: PKG_ROOT, writtenBy: "cv init", note: "Makineye özgü; git'e girmez. cv init yeniden üretir." });
    writeText(path.join(evrim, "cv.cmd"), `@echo off\r\nsetlocal\r\nset "CV_PKG=${PKG_ROOT}"\r\nif defined CV_HOME set "CV_PKG=%CV_HOME%"\r\ncall "%CV_PKG%\\bin\\cv.cmd" %*\r\nexit /b %errorlevel%\r\n`);
    const sh = path.join(evrim, "cv");
    writeText(sh, `#!/bin/sh\nexec "\${CV_HOME:-${slash(PKG_ROOT)}}/bin/cv" "$@"\n`);
    if (!isWindows) { try { fs.chmodSync(sh, 0o755); } catch (_) { /* best effort */ } }
}

export function init(root, { name, lang = "tr" } = {}) {
    const report = { created: [], same: [], kept: [], newFiles: [], notes: [] };
    fs.mkdirSync(root, { recursive: true });

    // 1. Config first: placeholders in the documents come from it.
    const cfgFile = path.join(root, CONFIG_REL);
    let cfg;
    if (exists(cfgFile)) { cfg = { ...defaults(), ...readJson(cfgFile, {}) }; report.same.push(CONFIG_REL); }
    else {
        const built = buildConfig(root, name, lang);
        cfg = built.cfg;
        writeJson(cfgFile, cfg);
        report.created.push(CONFIG_REL);
        report.notes.push(`algılanan: ${built.detected.notes.join(", ") || "tanıdık bir proje dosyası yok"}; derleme: ${showCmd(cfg.build)}; test: ${showCmd(cfg.test)}`);
    }
    const vars = { project: cfg.project, date: today(), build: showCmd(cfg.build), test: showCmd(cfg.test), baseBranch: cfg.baseBranch, tasksDir: cfg.tasks.dir, taskPrefix: cfg.tasks.prefix };
    const fill = (text) => text.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? vars[k] : m));

    // 2. Documents and memory files.
    for (const rel of walk(TEMPLATE_DIR)) {
        if (rel === CONFIG_REL || rel === "gitignore.add") continue;
        place(path.join(root, rel), fill(readText(path.join(TEMPLATE_DIR, rel))), report, rel);
    }

    // 3. Skills: version-stamped copies (docs/DECISIONS.md K3).
    for (const [skill, src] of Object.entries(skillSources(cfg.lang || lang))) {
        const rel = `.claude/skills/${skill}/SKILL.md`;
        place(path.join(root, rel), stampSkill(readText(src)), report, rel);
    }

    // 4. Version, launchers, .gitignore lines.
    const versionFile = path.join(root, ".evrim", "version");
    if (!exists(versionFile)) { writeText(versionFile, VERSION + "\n"); report.created.push(".evrim/version"); }
    writeShims(root);
    const ignoreFile = path.join(root, ".gitignore");
    const have = readText(ignoreFile, "");
    const want = readText(path.join(TEMPLATE_DIR, "gitignore.add")).split(/\r?\n/).filter((l) => l && !have.split(/\r?\n/).includes(l) && (!l.startsWith("#") || !have.includes(l)));
    if (want.some((l) => !l.startsWith("#"))) { writeText(ignoreFile, have + (have && !have.endsWith("\n") ? "\n" : "") + want.join("\n") + "\n"); report.notes.push(".gitignore'a makineye özgü dosyalar eklendi"); }
    if (!git(["rev-parse", "--git-dir"], root).ok) report.notes.push("burası henüz git deposu değil: `git init` çalıştırın (otonomi ve şeritler git ister)");
    return report;
}

export async function run(args) {
    const root = path.resolve(typeof args.dir === "string" ? args.dir : process.cwd());
    const lang = args.lang === "en" ? "en" : "tr";
    const r = init(root, { name: typeof args.name === "string" ? args.name : undefined, lang });
    console.log(`claudevolution ${VERSION} → ${root}`);
    console.log(`  yeni dosya: ${r.created.length}   aynı kalan: ${r.same.length}   dokunulmayan (sizinki farklı): ${r.kept.length}`);
    for (const f of r.newFiles) console.log(`  yanına bırakıldı: ${f}`);
    if (r.kept.length && !r.newFiles.length) console.log("  (farklı dosyaların .new kopyaları zaten duruyor)");
    for (const n of r.notes) console.log("  not: " + n);
    if (args["no-doctor"]) return 0;
    console.log("");
    const doctor = await import("./doctor.js");
    await doctor.run({ _: [], dir: root, quiet: true });
    console.log("\nSıradaki: Claude'a \"claudevolution kurulumunu tamamlayalım\" yazın (cv-init becerisi VISION'ı sizinle doldurur).");
    return 0;
}
