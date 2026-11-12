// cv init [--name X] [--lang tr|en] [--dir PATH] [--no-doctor]
// Copies the project skeleton. Never overwrites: a differing existing file gets a ".new" beside it.
// Running it twice changes nothing (idempotent).
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { exists, git, isWindows, readJson, readText, slash, today, writeJson, writeText } from "../lib/util.js";
import { CONFIG_REL, PKG_ROOT, TEMPLATE_DIR, VERSION, defaults, detect } from "../lib/config.js";
import { writeProject } from "../evolve/merge.js";

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

// The Windows launcher runs Node (or Deno) itself. It must not `call` the package's cv.cmd: call expands
// % in the arguments a second time, so "--did %34" reached the CLI as argument 3 + "4" (journal lines broke).
export function cvCmd(pkgRoot) {
    return ["@echo off", "setlocal", `set "CV_PKG=${pkgRoot}"`, 'if defined CV_HOME set "CV_PKG=%CV_HOME%"',
        // "& exit /b" on the same line: cv update rewrites this very file while it runs, and cmd reads a batch
        // file line by line from a byte offset; once the command line is parsed nothing after it is read.
        "where node >nul 2>nul", "if errorlevel 1 goto :deno", 'node "%CV_PKG%\\bin\\cv.js" %* & exit /b',
        ":deno", "where deno >nul 2>nul", "if errorlevel 1 goto :claudevrim", 'deno run -A --quiet "%CV_PKG%\\bin\\cv.js" %* & exit /b',
        // An owner with neither: the claudevrim launcher carries its own runtime.
        ":claudevrim", "claudevrim %* & exit /b", ""].join("\r\n");
}

// Machine-specific launchers (git-ignored): they know where this package lives on this machine.
export function writeShims(root) {
    const evrim = path.join(root, ".evrim");
    writeJson(path.join(evrim, "local.json"), { packageHome: PKG_ROOT, writtenBy: "cv init", note: "Makineye özgü; git'e girmez. cv init yeniden üretir." });
    const cmd = path.join(evrim, "cv.cmd");
    if (readText(cmd, "") !== cvCmd(PKG_ROOT)) writeText(cmd, cvCmd(PKG_ROOT));
    const sh = path.join(evrim, "cv");
    writeText(sh, `#!/bin/sh\nif command -v node >/dev/null 2>&1 || command -v deno >/dev/null 2>&1; then exec "\${CV_HOME:-${slash(PKG_ROOT)}}/bin/cv" "$@"; fi\nexec claudevrim "$@"\n`);
    if (!isWindows) { try { fs.chmodSync(sh, 0o755); } catch (_) { /* best effort */ } }
}

// Adds the package's .gitignore lines the project lacks (init, and cv update for lines added later).
// The package itself may sit inside the project (cloned or dropped in): it is its own repository, keep it out.
export function ignoreLines(root) {
    const ignoreFile = path.join(root, ".gitignore");
    const have = readText(ignoreFile, "");
    const inner = path.relative(root, PKG_ROOT);
    const nested = inner && !inner.startsWith("..") && !path.isAbsolute(inner) ? [`/${slash(inner)}/`] : [];
    const want = [...readText(path.join(TEMPLATE_DIR, "gitignore.add")).split(/\r?\n/), ...nested].filter((l) => l && !have.split(/\r?\n/).includes(l) && (!l.startsWith("#") || !have.includes(l)));
    if (!want.some((l) => !l.startsWith("#"))) return [];
    writeText(ignoreFile, have + (have && !have.endsWith("\n") ? "\n" : "") + want.join("\n") + "\n");
    return want.filter((l) => !l.startsWith("#"));
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
    const added = ignoreLines(root);
    if (added.length) report.notes.push(".gitignore'a eklendi: " + added.join(", "));
    if (!git(["rev-parse", "--git-dir"], root).ok) report.notes.push("burası henüz git deposu değil: `git init` çalıştırın (otonomi ve şeritler git ister)");
    // 5. Universal lessons of both layers (package + this machine), merged for this project.
    const u = writeProject(root);
    report.notes.push(`evrensel dersler: paketten ${u.pkg}, bu makineden ${u.machine} (.evrim/evrensel.md)`);
    return report;
}

export async function run(args) {
    const root = path.resolve(typeof args.dir === "string" ? args.dir : process.cwd());
    const lang = args.lang === "en" ? "en" : "tr";
    // A new folder becomes a git repository (autonomy, lanes and evolution need one).
    const fresh = !git(["rev-parse", "--git-dir"], root).ok;
    if (fresh) { fs.mkdirSync(root, { recursive: true }); git(["init", "-q"], root); }
    const r = init(root, { name: typeof args.name === "string" ? args.name : undefined, lang });
    console.log(`claudevolution ${VERSION} → ${root}`);
    console.log(`  yeni dosya: ${r.created.length}   aynı kalan: ${r.same.length}   dokunulmayan (sizinki farklı): ${r.kept.length}`);
    for (const f of r.newFiles) console.log(`  yanına bırakıldı: ${f}`);
    if (r.kept.length && !r.newFiles.length) console.log("  (farklı dosyaların .new kopyaları zaten duruyor)");
    for (const n of r.notes.filter((n) => !(fresh && /henüz git deposu değil/.test(n)))) console.log("  not: " + n);
    // First commit of exactly the files this command wrote (never the owner's other files).
    if (r.created.length) {
        const paths = [...new Set([...r.created, ...r.newFiles, ".gitignore"])].filter((p) => exists(path.join(root, p)));
        git(["add", "--", ...paths], root);
        const c = git(["commit", "-q", "-m", "claudevolution kuruldu (cv init)", "--", ...paths], root);
        console.log(c.ok ? "  commit: claudevolution kuruldu" : "  not: ilk commit atılamadı (git kullanıcı adı/e-postası tanımlı mı?); dosyalar hazır, commit'i Claude atar");
    }
    // Once per machine (idempotent): the user-level skill that lets any new session recognise the package.
    if (!args["no-setup"]) { try { const { setup, userSkillFile } = await import("./setup.js"); const s = setup(); if (s !== "aynı") console.log(`  makine becerisi ${s}: ${userSkillFile()}`); } catch (e) { console.log("  not: makine becerisi yazılamadı (cv setup): " + e.message); } }
    // A project still waiting for its discovery conversation gets no checklist here: build/test commands and
    // machine settings are decided in that conversation (cv-init runs cv doctor), not by the owner in a terminal.
    const waiting = readJson(path.join(root, CONFIG_REL), {}).kurulum === "bekliyor";
    if (!args["no-doctor"] && !waiting) {
        console.log("");
        const doctor = await import("./doctor.js");
        await doctor.run({ _: [], dir: root, quiet: true });
    }
    console.log(lang === "tr" ? "\nSıradaki: Claude uygulamasında bu klasörü açın ve \"merhaba\" yazın; gerisini Claude sorar." : "\nNext: open this folder in the Claude app and write \"hello\"; Claude asks the rest.");
    return 0;
}
