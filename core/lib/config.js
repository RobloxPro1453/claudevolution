// Project configuration: load (.evrim/config.json over the packaged defaults), validate, detect.
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { deepMerge, exists, expand, git, readJson, readText } from "./util.js";

export const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const VERSION = readJson(path.join(PKG_ROOT, "package.json"), {}).version || "0.0.0";
export const TEMPLATE_DIR = path.join(PKG_ROOT, "templates", "project");
export const CONFIG_REL = ".evrim/config.json";

export const defaults = () => readJson(path.join(TEMPLATE_DIR, ".evrim", "config.json"), {});

// The project root is the nearest folder upwards that holds .evrim/config.json.
export function findRoot(start = process.cwd()) {
    let dir = path.resolve(start);
    for (;;) {
        if (exists(path.join(dir, CONFIG_REL))) return dir;
        const up = path.dirname(dir);
        if (up === dir) return null;
        dir = up;
    }
}

export function loadConfig(root) {
    const file = path.join(root, CONFIG_REL);
    let own;
    try { own = JSON.parse(readText(file)); } catch (e) { throw new Error(`${CONFIG_REL} okunamadı: ${e.message}`); }
    const cfg = deepMerge(defaults(), own);
    // Safety lists are never inherited loosely: the project's own list is used as written.
    if (Array.isArray(own.forbiddenWrite)) cfg.forbiddenWrite = own.forbiddenWrite;
    cfg.root = root;
    return cfg;
}

// Paths the cheap model may never write, whatever the project list says (the guard cannot be configured away).
export const ALWAYS_FORBIDDEN = [
    "^\\.git(/|$)",
    "^\\.evrim/",
    "^\\.claude/",
    "^\\.codex/",
    "^\\.agent/",
    "^AGENTS\\.md$",
    "^CLAUDE\\.md$",
    "^docs/VISION\\.md$",
    "^docs/WORKER\\.md$",
    "^docs/tasks/(?!.*\\.report\\.md$)",
    "(^|/)\\.env($|\\.(?!example$|sample$|template$))",
    "(^|/)\\.(npmrc|netrc)$",
    "(^|/)id_(rsa|ed25519)(\\.pub)?$",
    "\\.(pem|key|p12|pfx)$",
];
// Universal lesson 30: the script files the build and test commands run are never the cheap model's to change
// (an agent once put "kill every app process" in a build script and cut the other lanes' tests). Derived from
// the commands themselves, so it holds for every project without a project-specific list.
const SCRIPT_EXT = /\.(?:ps1|psm1|sh|bash|bat|cmd|js|mjs|cjs|ts|py|rb|pl)$/i;
export function runnerScripts(cfg) {
    const out = [];
    for (const c of [cfg && cfg.build, cfg && cfg.test]) {
        if (!Array.isArray(c)) continue;
        for (const a of c) {
            const s = String(a).replace(/\\/g, "/").replace(/^\.\//, "");
            if (!SCRIPT_EXT.test(s) || /^[A-Za-z]:|^\//.test(s) || s.split("/").includes("..")) continue;
            out.push("^" + s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$");
        }
    }
    return out;
}
export function forbiddenRegexes(cfg) {
    const list = [...ALWAYS_FORBIDDEN, ...runnerScripts(cfg), ...((cfg && cfg.forbiddenWrite) || [])];
    return [...new Set(list)].map((s) => new RegExp(s, "i"));
}
// A path given by a model: relative, inside the project, no drive letter, no "..".
export function safeRel(p) {
    const raw = String(p || "");
    if (raw.includes("\0")) throw new Error("path must be relative to the project and stay inside it: " + p);
    const clean = raw.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\/+/, "").replace(/^(\.\/)+/, "").replace(/\/(\.\/)+/g, "/");
    if (!clean || clean.split("/").includes("..") || /^[A-Za-z]:/.test(clean)) throw new Error("path must be relative to the project and stay inside it: " + p);
    return clean;
}
export function isForbidden(cfg, rel) {
    const clean = safeRel(rel);
    return forbiddenRegexes(cfg).some((r) => r.test(clean));
}

function isSameOrUnder(base, candidate) {
    const norm = (s) => {
        const r = path.resolve(s);
        return process.platform === "win32" ? r.toLowerCase() : r;
    };
    const b = norm(base), c = norm(candidate);
    if (b === c) return true;
    const rel = path.relative(b, c);
    return rel !== "" && rel !== ".." && !rel.startsWith(".." + path.sep) && !rel.startsWith("../") && !path.isAbsolute(rel);
}

function nearestReal(p) {
    let cur = path.resolve(p);
    for (;;) {
        try { fs.lstatSync(cur); } catch (e) {
            if (e && e.code === "ENOENT") {
                const parent = path.dirname(cur);
                if (parent === cur) return null;
                cur = parent;
                continue;
            }
            return null;
        }
        // Entry exists (including as a symlink/junction); failing to resolve means broken or cyclic link.
        try { return fs.realpathSync(cur); } catch (_) { return null; }
    }
}

// Rejects symlink/junction traversal outside root (or outside explicitly allowed linkDirs).
export function realInside(root, targetPath, allowedLinkDirs = []) {
    if (!root || !targetPath || typeof root !== "string" || typeof targetPath !== "string") return false;
    if (root.includes("\0") || targetPath.includes("\0")) return false;
    let realRoot;
    try { realRoot = fs.realpathSync(path.resolve(root)); } catch (_) { return false; }
    const resolvedRoot = path.resolve(root);
    const absTarget = path.isAbsolute(targetPath) ? path.resolve(targetPath) : path.resolve(resolvedRoot, targetPath);
    const matchedRoot = isSameOrUnder(resolvedRoot, absTarget) ? resolvedRoot : (isSameOrUnder(realRoot, absTarget) ? realRoot : null);
    if (!matchedRoot) return false;

    const relSlash = path.relative(matchedRoot, absTarget).replace(/\\/g, "/");
    const links = Array.isArray(allowedLinkDirs) ? allowedLinkDirs : [];
    const matchedLink = links
        .map((d) => String(d || "").replace(/\\/g, "/").replace(/^\/+|\/+$/g, ""))
        .filter(Boolean)
        .find((link) => {
            if (process.platform === "win32") {
                const rl = relSlash.toLowerCase(), ll = link.toLowerCase();
                return rl === ll || rl.startsWith(ll + "/");
            }
            return relSlash === link || relSlash.startsWith(link + "/");
        });

    const realTarget = nearestReal(absTarget);
    if (!realTarget) return false;
    if (isSameOrUnder(realRoot, realTarget)) return true;
    if (!matchedLink) return false;

    const linkReal = nearestReal(path.join(realRoot, matchedLink));
    if (!linkReal) return false;
    return isSameOrUnder(linkReal, realTarget);
}

// The key patterns live in secrets.js (no imports), so the process helpers can use them without a cycle.
export { SECRET_RES } from "./secrets.js";
import { SECRET_RES } from "./secrets.js";
const isCmd = (v) => v === null || (Array.isArray(v) && v.length > 0 && v.every((s) => typeof s === "string" && s));
const isNum = (v) => typeof v === "number" && Number.isFinite(v);

const isPlainObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const isOptStr = (v) => v === undefined || v === null || typeof v === "string";

// Returns { errors, warnings } in the owner's language (plain Turkish).
export function validate(cfg) {
    const errors = [], warnings = [];
    const err = (m) => errors.push(m), warn = (m) => warnings.push(m);
    if (cfg.schema !== 1) err("schema 1 olmalı");
    if (!cfg.project || typeof cfg.project !== "string") err("project (proje adı) boş");
    if (!cfg.baseBranch) err("baseBranch (ana dal) boş");
    if (cfg.projectMode !== undefined && cfg.projectMode !== null && !["greenfield", "adopted"].includes(cfg.projectMode)) {
        err('projectMode: "greenfield" veya "adopted" olmalı');
    }
    if (cfg.licensePolicy !== undefined && cfg.licensePolicy !== null && !["auto", "personal", "open-source", "commercial"].includes(cfg.licensePolicy)) {
        err("licensePolicy: auto | personal | open-source | commercial olmalı");
    }
    if (cfg.finalForm !== undefined && cfg.finalForm !== null) {
        if (!isPlainObj(cfg.finalForm)) err("finalForm: nesne olmalı");
        else {
            const ff = cfg.finalForm;
            if (!isOptStr(ff.deliverable)) err("finalForm.deliverable: metin veya null olmalı");
            if (ff.verifyCmd !== undefined && ff.verifyCmd !== null && typeof ff.verifyCmd !== "string" && !isCmd(ff.verifyCmd)) {
                err('finalForm.verifyCmd: null, metin ya da ["program", "argüman", ...] olmalı');
            }
            if (ff.criteria !== undefined && ff.criteria !== null && (!Array.isArray(ff.criteria) || !ff.criteria.every((c) => typeof c === "string"))) {
                err("finalForm.criteria: metin listesi olmalı");
            }
        }
    }
    for (const k of ["build", "test"]) {
        if (!isCmd(cfg[k])) err(`${k}: null ya da ["program", "argüman", ...] biçiminde olmalı`);
    }
    for (const k of ["buildMinutes", "testMinutes"]) if (!isNum(cfg[k]) || cfg[k] <= 0) err(`${k}: pozitif sayı olmalı (süre sınırı)`);
    if (!Array.isArray(cfg.forbiddenWrite)) err("forbiddenWrite: liste olmalı");
    else for (const s of cfg.forbiddenWrite) { try { new RegExp(s, "i"); } catch (_) { err(`forbiddenWrite: geçersiz düzenli ifade: ${s}`); } }
    try { new RegExp(cfg.skipDirs); } catch (_) { err("skipDirs: geçersiz düzenli ifade"); }
    for (const k of ["agents", "vision", "progress", "roadmap", "checkup", "knowledge", "worker", "changelog"]) {
        if (!cfg.docs || typeof cfg.docs[k] !== "string") err(`docs.${k}: belge yolu eksik`);
    }
    const t = cfg.tasks || {};
    if (!t.dir || !t.rules || !t.prefix) err("tasks.dir / tasks.rules / tasks.prefix eksik");
    try { new RegExp(t.pattern); } catch (_) { err("tasks.pattern: geçersiz düzenli ifade"); }

    const d = cfg.delegate || {};
    const p = d.providers && d.providers[d.provider];
    if (!p) err(`delegate.provider "${d.provider}" delegate.providers içinde yok`);
    else {
        if (!/^https?:\/\//.test(p.apiBase || "")) err("delegate sağlayıcı apiBase: http(s) adresi olmalı");
        if (!/^[A-Z_][A-Z0-9_]*$/.test(p.keyEnv || "")) err("delegate sağlayıcı keyEnv: ortam değişkeninin ADI olmalı (anahtarın kendisi değil)");
        if (!p.model) err("delegate sağlayıcı model boş");
        for (const k of ["input", "cached", "output"]) if (!p.price || !isNum(p.price[k])) err(`delegate sağlayıcı price.${k}: sayı olmalı`);
        if (p.peakUtc && !String(p.peakUtc).split(",").every((w) => /^\s*\d\d:\d\d-\d\d:\d\d\s*$/.test(w))) err("delegate sağlayıcı peakUtc: \"SS:DD-SS:DD,...\" biçiminde olmalı");
    }
    if (!isNum(d.lanes) || d.lanes < 1) err("delegate.lanes: en az 1");
    if (!isNum(d.defaultBudget) || !isNum(d.dailyBudget) || !isNum(d.defaultSteps)) err("delegate.defaultBudget / dailyBudget / defaultSteps: sayı olmalı");
    if (!Array.isArray(d.plugins)) err("delegate.plugins: liste olmalı");
    if (d.slots !== undefined && (typeof d.slots !== "object" || Array.isArray(d.slots) || !Object.values(d.slots).every((v) => Number.isInteger(v) && v >= 1))) err("delegate.slots: { \"test\": n, \"build\": n } (makine çapında aynı anda en çok n; n ≥ 1)");
    if (d.fallback !== undefined && (!Array.isArray(d.fallback) || d.fallback.some((f) => !["claude-subagent", "self"].includes(f)))) err("delegate.fallback: yalnız \"claude-subagent\" ve \"self\" içeren liste olmalı");
    if (d.policy !== undefined && !["kendisi", "yalniz-api", "api-yoksa-kendisi", "api-yoksa-subagent"].includes(d.policy)) err("delegate.policy: kendisi | yalniz-api | api-yoksa-kendisi | api-yoksa-subagent");
    if (d.subagentModel !== undefined && !/^[a-z0-9.-]+$/i.test(String(d.subagentModel))) err("delegate.subagentModel: model adı olmalı (ör. haiku, sonnet)");
    if (d.contextBudget !== undefined && (!isNum(d.contextBudget) || d.contextBudget < 8000)) err("delegate.contextBudget: en az 8000 (token)");
    if (d.effort !== undefined && d.effort !== null && (!isPlainObj(d.effort) || !Object.values(d.effort).every((v) => v === null || ["low", "medium", "high", "max"].includes(v)))) err("delegate.effort: { \"scout\": \"low\", ... } (low | medium | high | max)");

    const a = cfg.autonomy || {}, g = a.gates || {};
    for (const k of ["fiveHourNoNewStep", "fiveHourExit", "weeklyBase", "weeklySlope", "weeklyMargin", "cycleShareMax", "stepShareAlarm"]) if (!isNum(g[k])) err(`autonomy.gates.${k}: sayı olmalı`);
    if (isNum(g.fiveHourNoNewStep) && isNum(g.fiveHourExit)) {
        if (g.fiveHourNoNewStep >= g.fiveHourExit) err("autonomy.gates: fiveHourNoNewStep, fiveHourExit'ten küçük olmalı");
        // Lesson 8: at 100% the turn dies and no wake-up can be scheduled. The exit gate may not be configured that high.
        if (g.fiveHourExit > 95) err("autonomy.gates.fiveHourExit en çok 95 olabilir (limit %100'e dayanırsa döngü ölür)");
    }
    if (isNum(g.weeklyBase) && isNum(g.weeklySlope) && g.weeklyBase + g.weeklySlope > 95) err("autonomy.gates: weeklyBase + weeklySlope en çok 95 olabilir");
    if (g.paceBand !== undefined && (!isNum(g.paceBand) || g.paceBand <= 0)) err("autonomy.gates.paceBand: pozitif sayı olmalı");
    if (a.office !== undefined && a.office !== null) {
        if (!isPlainObj(a.office)) err("autonomy.office: nesne olmalı");
        else {
            const o = a.office;
            if (o.autoTune !== undefined && typeof o.autoTune !== "boolean") err("autonomy.office.autoTune: true/false olmalı");
            if (o.maxLanes !== undefined && (!isNum(o.maxLanes) || o.maxLanes < 1)) err("autonomy.office.maxLanes: en az 1 olmalı");
            if (o.strategyPivotCycles !== undefined && (!isNum(o.strategyPivotCycles) || o.strategyPivotCycles < 1)) err("autonomy.office.strategyPivotCycles: en az 1 olmalı");
        }
    }
    if (!isNum(a.lockStaleMinutes) || a.lockStaleMinutes < 5) err("autonomy.lockStaleMinutes: en az 5");
    const wr = a.weeklyReset || {};
    if (!(wr.weekdayUtc >= 0 && wr.weekdayUtc <= 6) || !(wr.hourUtc >= 0 && wr.hourUtc <= 23)) err("autonomy.weeklyReset: weekdayUtc 0-6, hourUtc 0-23");
    if (!a.share || !isNum(a.share.weight) || a.share.weight <= 0) err("autonomy.share.weight: pozitif sayı olmalı");

    const e = cfg.evolution || {};
    for (const k of ["lessonsMax", "journalTailLines", "distillEveryCycles", "distillQuotaShare", "selectionK"]) if (!isNum(e[k]) || e[k] <= 0) err(`evolution.${k}: pozitif sayı olmalı`);

    const ck = cfg.check;
    if (ck !== undefined && ck !== null) {
        if (!isPlainObj(ck)) err("check: nesne olmalı");
        else {
            if (ck.kind !== undefined && !["auto", "window", "console"].includes(ck.kind)) err("check.kind: auto | window | console");
            if (ck.program !== undefined && ck.program !== null && !isCmd(ck.program)) err("check.program: null ya da [\"yol\", \"argüman\", ...]");
            if (ck.selfTest !== undefined && ck.selfTest !== true && !(isPlainObj(ck.selfTest) && (ck.selfTest.steps === undefined || (Array.isArray(ck.selfTest.steps) && ck.selfTest.steps.every((s) => typeof s === "string" && s.trim()))))) err("check.selfTest: { \"steps\": [\"create\", \"save\", ...] }");
            if (ck.referenceGate !== undefined && ck.referenceGate !== null && (!isNum(ck.referenceGate) || ck.referenceGate < 0 || ck.referenceGate > 100)) err("check.referenceGate: null ya da 0-100");
            if (ck.runSeconds !== undefined && (!isNum(ck.runSeconds) || ck.runSeconds < 5)) err("check.runSeconds: en az 5");
        }
    }

    const raw = JSON.stringify({ ...cfg, root: undefined });
    if (SECRET_RES.some((r) => r.test(raw))) err("config içinde anahtara benzeyen bir değer var: anahtarlar yalnız ortam değişkeninde durur, dosyadan silin");
    if (/[A-Za-z]:\\\\Users\\\\|\/Users\/[^/"]+\/|\/home\/[^/"]+\//.test(raw)) warn("config içinde makineye özgü mutlak yol var; ~ ya da göreli yol kullanın");
    return { errors, warnings };
}

// Best-effort detection for cv init. Never runs anything in the project; only looks at files.
export function detect(root) {
    const has = (f) => exists(path.join(root, f));
    const d = { name: path.basename(root), build: null, test: null, codePaths: [], baseBranch: "main", notes: [] };
    const head = git(["symbolic-ref", "--short", "HEAD"], root);
    if (head.ok && head.out) d.baseBranch = head.out;
    const ps = (file) => ["powershell", "-ExecutionPolicy", "Bypass", "-File", file];
    if (has("package.json")) {
        const pkg = readJson(path.join(root, "package.json"), {});
        const s = pkg.scripts || {};
        if (pkg.name) d.name = String(pkg.name).replace(/^@[^/]+\//, "");
        if (s.build) d.build = ["npm", "run", "build"];
        if (s.test && !/no test specified/.test(s.test)) d.test = ["npm", "test"];
        d.notes.push("package.json");
    } else if (has("Cargo.toml")) { d.build = ["cargo", "build"]; d.test = ["cargo", "test"]; d.notes.push("Cargo.toml"); }
    else if (has("go.mod")) { d.build = ["go", "build", "./..."]; d.test = ["go", "test", "./..."]; d.notes.push("go.mod"); }
    else if (has("pyproject.toml") || has("pytest.ini") || has("setup.py")) { d.test = ["python", "-m", "pytest", "-q"]; d.notes.push("python"); }
    else if (has("deno.json") || has("deno.jsonc")) { d.test = ["deno", "test"]; d.notes.push("deno.json"); }
    if (has("build.ps1")) { d.build = ps("build.ps1"); d.notes.push("build.ps1"); }
    if (has("tests/run.ps1")) { d.test = ps("tests\\run.ps1"); d.notes.push("tests/run.ps1"); }
    if (!d.build && has("Makefile")) { d.build = ["make"]; d.notes.push("Makefile"); }
    for (const dir of ["src", "lib", "app", "crates", "tests", "test", "scripts"]) {
        try { if (fs.statSync(path.join(root, dir)).isDirectory()) d.codePaths.push(dir + "/"); } catch (_) { /* absent */ }
    }
    return d;
}

export const autonomyDir = (cfg) => expand(cfg.autonomy.dir, cfg.root);
export const stateDir = (cfg) => path.join(cfg.root, ".evrim", "state");
