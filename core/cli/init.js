// cv init [--name X] [--lang tr|en] [--dir PATH] [--no-doctor]
// Copies the project skeleton. Never overwrites: a differing existing file gets a ".new" beside it.
// Running it twice changes nothing (idempotent).
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { exists, git, isWindows, readJson, readText, slash, today, writeJson, writeText } from "../lib/util.js";
import { CONFIG_REL, PKG_ROOT, TEMPLATE_DIR, VERSION, defaults, detect } from "../lib/config.js";
import { writeProject } from "../evolve/merge.js";
import { planSettings } from "../lib/hooks.js";

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

// Write dest unless it exists. Existing and identical: nothing. Existing and different: dest.new (unless noNew).
export function place(dest, content, report, rel, { noNew = false } = {}) {
    if (!exists(dest)) { writeText(dest, content); report.created.push(rel); return; }
    if (sameText(readText(dest), content)) { report.same.push(rel); return; }
    if (noNew) { report.kept.push(rel); return; }
    const side = dest + ".new";
    if (exists(side) && sameText(readText(side), content)) { report.kept.push(rel); return; }
    writeText(side, content);
    report.kept.push(rel);
    report.newFiles.push(rel + ".new");
}

export const stampSkill = (text) => text.replace(/\s*$/, "") + `\n\n<!-- claudevolution ${VERSION} -->\n`;
export function skillSources(lang) {
    const out = {};
    // Built-in design library (skills/library): single-language skills from permissive sources, installed in
    // every project so UI work starts from real design guidance (benchmark 2026-11-21: the model's own taste
    // alone gave a poor first screen). Language skills below win on a name clash.
    const lib = path.join(PKG_ROOT, "skills", "library");
    if (exists(lib)) for (const name of fs.readdirSync(lib)) { const f = path.join(lib, name, "SKILL.md"); if (exists(f)) out[name] = f; }
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

// Project documents in the chosen language (Q12-B): templates/project is the complete Turkish set; the
// English overlay templates/project-en replaces a file where it has one. File names stay the same (code and
// skills read them by name), only the text changes.
export const TEMPLATE_EN_DIR = path.join(PKG_ROOT, "templates", "project-en");
export function templateFile(rel, lang = "tr") {
    const en = path.join(TEMPLATE_EN_DIR, rel);
    return lang === "en" && exists(en) ? en : path.join(TEMPLATE_DIR, rel);
}

export function loopWorkflowText(lang = "tr") {
    if (lang === "en") {
        return [
            "---",
            "description: Autonomous cycle workflow (Antigravity /goal, /schedule, or 'başla') — runs one claudevolution cycle and schedules the next wakeup.",
            "---",
            "",
            "# Autonomous Cycle (Antigravity — `/goal`, `/schedule`, or `başla`)",
            "",
            "1. Check `.evrim/config.json`: if `kurulum` is `\"bekliyor\"`, follow `.agent/skills/cv-init/SKILL.md` instead of starting the autonomous loop.",
            "2. Otherwise load `.agent/skills/otonom/SKILL.md` and run **one** autonomous cycle:",
            "   - If Antigravity sent a `[quota] ... (X% remaining, resets at <ISO>)` notice, pass `--five <100 - X> --five-resets <ISO>`; otherwise run `.evrim/cv cycle begin --five unknown --week unknown`.",
            "   - Follow the `KARAR` line (`GO`, `KUCUK`, `CIK`, `MESGUL`, `DUR`, `SIRA_DEGIL`, `BITTI`).",
            "   - On `DUR` or `BITTI`, cancel any active timers with `manage_task` (`list` -> `kill`) and stop cleanly without calling `schedule`.",
            "   - After work (`GO` / `KUCUK`), update `.evrim/otonom/OZET.md`, run `cv cycle end`, and commit memory files.",
            "3. When continuing unattended (`KARAR` is neither `DUR` nor `BITTI`), call Antigravity's built-in `schedule` tool (`DurationSeconds: <UYKU>`, `Prompt: \"otonom becerisini yükle ve bir çevrim yap\"`) and end the turn.",
        ].join("\n");
    }
    return [
        "---",
        "description: Gözetimsiz otonom döngü (Antigravity /goal, /schedule veya 'başla') — tek çevrim çalıştırır ve bitince sonraki uyanışı kurar.",
        "---",
        "",
        "# Otonom Çevrim (Antigravity — `/goal`, `/schedule` veya `başla`)",
        "",
        "1. `.evrim/config.json` dosyasını kontrol et: `kurulum` alanı `\"bekliyor\"` ise döngüyü başlatma; `.agent/skills/cv-init/SKILL.md` becerisiyle keşif görüşmesini yap.",
        "2. Kurulum tamamsa `.agent/skills/otonom/SKILL.md` becerisini yükle ve **tek** otonom çevrim çalıştır:",
        "   - Antigravity sistem mesajında `[quota] ... (X% remaining, resets at <ISO>)` varsa `--five <100 - X> --five-resets <ISO>` geçir; yoksa `.evrim/cv cycle begin --five unknown --week unknown` çalıştır.",
        "   - Çıktıdaki `KARAR` satırına uy (`GO`, `KUCUK`, `CIK`, `MESGUL`, `DUR`, `SIRA_DEGIL`, `BITTI`).",
        "   - `DUR` veya `BITTI` kararında `manage_task` (`list` -> `kill`) ile aktif zamanlayıcıyı kapatıp yeni `schedule` kurmadan temiz şekilde dur.",
        "   - İş bitince (`GO` / `KUCUK`) `.evrim/otonom/OZET.md` dosyasını güncelle, `cv cycle end` çalıştır ve hafıza dosyalarını commit et.",
        "3. Döngü sürecekse (`DUR` veya `BITTI` değilse) Antigravity'nin yerleşik `schedule` aracını (`DurationSeconds: <UYKU>`, `Prompt: \"otonom becerisini yükle ve bir çevrim yap\"`) çağırıp turu bitir.",
    ].join("\n");
}

export function buildConfig(root, name, lang, { adoptMode = false } = {}) {
    const d = detect(root);
    const cfg = defaults();
    cfg.project = name || d.name;
    cfg.lang = lang;
    cfg.projectMode = adoptMode ? "adopted" : "greenfield";
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

function makeSkipCheck(adoptMode, skipExisting) {
    if (typeof skipExisting === "function") return (rel) => !!skipExisting(slash(rel));
    const list = skipExisting instanceof Set ? [...skipExisting] : Array.isArray(skipExisting) ? skipExisting : null;
    if (list) {
        const files = new Set(), dirs = [];
        for (const item of list) {
            const s = slash(String(item || "")).replace(/^\/+/, "");
            if (!s) continue;
            if (s.endsWith("/")) dirs.push(s);
            else files.add(s);
        }
        return (rel) => {
            const r = slash(rel);
            return files.has(r) || dirs.some((d) => r.startsWith(d));
        };
    }
    return () => !!adoptMode && skipExisting !== false;
}

export function init(root, { name, lang = "tr", adoptMode = false, skipExisting = null } = {}) {
    const report = { created: [], same: [], kept: [], newFiles: [], notes: [] };
    const shouldSkipNew = makeSkipCheck(adoptMode, skipExisting);
    fs.mkdirSync(root, { recursive: true });

    // 1. Config first: placeholders in the documents come from it.
    const cfgFile = path.join(root, CONFIG_REL);
    let cfg;
    if (exists(cfgFile)) { cfg = { ...defaults(), ...readJson(cfgFile, {}) }; report.same.push(CONFIG_REL); }
    else {
        const built = buildConfig(root, name, lang, { adoptMode });
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
        place(path.join(root, rel), fill(readText(templateFile(rel, cfg.lang || lang))), report, rel, { noNew: shouldSkipNew(rel) });
    }

    // 3. Skills: version-stamped copies across Claude Code, Codex, and Antigravity (docs/DECISIONS.md K3).
    const skillDirs = [".claude/skills", ".codex/skills", ".agent/skills"];
    for (const [skill, src] of Object.entries(skillSources(cfg.lang || lang))) {
        const stamped = stampSkill(readText(src));
        for (const base of skillDirs) {
            const rel = `${base}/${skill}/SKILL.md`;
            place(path.join(root, rel), stamped, report, rel, { noNew: shouldSkipNew(rel) });
        }
    }
    const loopRel = ".agent/workflows/loop.md";
    place(path.join(root, loopRel), stampSkill(loopWorkflowText(cfg.lang || lang)), report, loopRel, { noNew: shouldSkipNew(loopRel) });

    // 4. Version, launchers, .gitignore lines.
    const versionFile = path.join(root, ".evrim", "version");
    if (!exists(versionFile)) { writeText(versionFile, VERSION + "\n"); report.created.push(".evrim/version"); }
    writeShims(root);
    // Quota guard hooks (Claude Code): merged into the project's settings, never replacing the owner's.
    const hk = planSettings(root);
    if (hk.error) report.notes.push(hk.error);
    else if (hk.changed) {
        writeText(path.join(root, hk.rel), hk.text);
        if (hk.old === null) report.created.push(hk.rel);
        else report.notes.push(`${hk.rel}: kota bekçisi kancası eklendi (sizin ayarlarınız korundu)`);
    }
    const added = ignoreLines(root);
    if (added.length) report.notes.push(".gitignore'a eklendi: " + added.join(", "));
    if (!isOwnRepoRoot(root)) report.notes.push("burası henüz kendi git deposu değil: `git init` çalıştırın (otonomi ve şeritler git ister)");
    // 5. Universal lessons of both layers (package + this machine), merged for this project.
    const u = writeProject(root);
    report.notes.push(`evrensel dersler: paketten ${u.pkg}, bu makineden ${u.machine} (.evrim/evrensel.md)`);
    return report;
}

// True only when root is the top folder of its own git repository.
export function isOwnRepoRoot(root) {
    if (!exists(root)) return false;
    const top = git(["rev-parse", "--show-toplevel"], root);
    if (!top.ok || !top.out) return false;
    const canon = (p) => { let r; try { r = fs.realpathSync.native(p); } catch (_) { r = path.resolve(p); } r = path.resolve(r); return isWindows ? r.toLowerCase() : r; };
    return canon(top.out) === canon(root);
}

export async function run(args) {
    const root = path.resolve(typeof args.dir === "string" ? args.dir : process.cwd());
    const lang = args.lang === "en" ? "en" : "tr";
    // A new folder becomes a git repository (autonomy, lanes and evolution need one). A folder that only sits
    // inside another repository (a project folder on a Desktop that is itself a repo) is new too: rev-parse
    // walks upwards and answered "yes", so the first commit landed in that other, outer repository.
    const fresh = !isOwnRepoRoot(root);
    if (fresh) { fs.mkdirSync(root, { recursive: true }); git(["init", "-q"], root); }
    const r = init(root, { name: typeof args.name === "string" ? args.name : undefined, lang });
    console.log(`claudevolution ${VERSION} → ${root}`);
    console.log(`  yeni dosya: ${r.created.length}   aynı kalan: ${r.same.length}   dokunulmayan (sizinki farklı): ${r.kept.length}`);
    for (const f of r.newFiles) console.log(`  yanına bırakıldı: ${f}`);
    if (r.kept.length && !r.newFiles.length) console.log("  (farklı dosyaların .new kopyaları zaten duruyor)");
    for (const n of r.notes.filter((n) => !(fresh && /henüz kendi git deposu değil/.test(n)))) console.log("  not: " + n);
    // First commit of exactly the files this command wrote (never the owner's other files).
    if (r.created.length) {
        const paths = [...new Set([...r.created, ...r.newFiles, ".gitignore"])].filter((p) => exists(path.join(root, p)));
        git(["add", "--", ...paths], root);
        const c = git(["commit", "-q", "-m", "claudevolution kuruldu (cv init)", "--", ...paths], root);
        console.log(c.ok ? "  commit: claudevolution kuruldu" : "  not: ilk commit atılamadı (git kullanıcı adı/e-postası tanımlı mı?); dosyalar hazır, commit'i Claude atar");
    }
    // Once per machine (idempotent): user-level skills for Claude, Codex, and Antigravity.
    if (!args["no-setup"]) {
        try {
            const { setupAll } = await import("./setup.js");
            for (const s of setupAll()) {
                if (s.status !== "aynı") console.log(`  makine becerisi (${s.platform}) ${s.status}: ${s.file}`);
            }
        } catch (e) {
            console.log("  not: makine becerisi yazılamadı (cv setup): " + e.message);
        }
    }
    // A project still waiting for its discovery conversation gets no checklist here: build/test commands and
    // machine settings are decided in that conversation (cv-init runs cv doctor), not by the owner in a terminal.
    const waiting = readJson(path.join(root, CONFIG_REL), {}).kurulum === "bekliyor";
    if (!args["no-doctor"] && !waiting) {
        console.log("");
        const doctor = await import("./doctor.js");
        await doctor.run({ _: [], dir: root, quiet: true });
    }
    console.log(lang === "tr"
        ? "\n✓ Her şey hazır! Bu terminali kapatabilirsiniz. Şimdi Claude, Codex veya Antigravity uygulamasında bu klasörü açın ve \"merhaba\" yazın; gerisini sistem sorar."
        : "\nNext: open this folder in the Claude, Codex, or Antigravity app and write \"hello\"; the system asks the rest.");
    return 0;
}
