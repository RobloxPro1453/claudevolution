// `cv check`: the numeric gate for a desktop app, run after a build (craft-anything rebuild/ check rounds,
// MIT OR Apache-2.0). Each check gives { id, passed, note, claims, artifacts, confidence }; a round is saved
// as .evrim/state/checks/round-<n>/check.json and passes when every check does. Round 0 is the builder's own
// check while it works (not counted). A round in which everything passed is kept while nothing it looks at
// changes (HEAD, the working tree's contents, the program file, the check settings), so asking again costs
// nothing (craft-anything kept_check.rs + engine/workspace/progress.rs: by content, never by date).
// Pictures are evidence the main model may look at; the gate is the numbers here (ERRATA E4/E7): blank or
// not, self-test steps, console runs. Likeness to a reference picture is a gate only when check.referenceGate
// is set (a "rebuild this" job); in a greenfield app it is a note.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawn, spawnSync } from "node:child_process";
import { exists, git, isWindows, readJson, readText, slash, writeJson } from "../lib/util.js";
import { decodePng } from "./png.js";
import { closestReference, isBlank } from "./image.js";
import { programFor } from "./program.js";
import { importedDlls, strayDlls } from "./pe.js";
import { launchTarget } from "../lib/process.js";
import { SCREENSHOT_CONTRACT, SELF_TEST_CONTRACT, verdict } from "./selftest.js";

export const MAX_CLAIMS = 20;
export const RUN_SECONDS = 90;
export const CASES = [["no arguments", []], ["--help", ["--help"]], ["--version", ["--version"]]];
export const checksDir = (cfg) => path.join(cfg.root, ".evrim", "state", "checks");

// Start a program with a time limit; on Windows the whole tree is killed (a launcher's child once kept a
// build output locked). Resolves { code, text, timedOut }. Waits for nothing else.
export function runProgram(program, args, { cwd, seconds = RUN_SECONDS, env } = {}) {
    return new Promise((resolve) => {
        let text = "", done = false, child;
        const finish = (code, timedOut = false) => { if (!done) { done = true; clearTimeout(timer); resolve({ code, text: text.slice(-20000), timedOut }); } };
        // An npm .cmd shim starts through its interpreter (no cmd.exe quoting limits; core/lib/process.js).
        const [prog, ...argv] = isWindows ? launchTarget(program, args) : [program, ...args];
        try { child = spawn(prog, argv, { cwd, windowsHide: true, env: env || process.env }); } catch (e) { return resolve({ code: 127, text: String(e.message), timedOut: false }); }
        const kill = () => {
            if (isWindows && child.pid) { try { spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true }); return; } catch (_) { /* fall back */ } }
            try { child.kill("SIGKILL"); } catch (_) { /* gone */ }
        };
        const timer = setTimeout(() => { kill(); finish(124, true); }, seconds * 1000);
        child.stdout.on("data", (d) => { text += d; });
        child.stderr.on("data", (d) => { text += d; });
        child.on("error", (e) => { text += String(e.message); finish(127); });
        child.on("close", (code) => finish(code === null ? 1 : code));
    });
}

// A Windows program marked for the console (PE optional header subsystem 3) prints instead of drawing.
export function isConsoleProgram(file) {
    try {
        const b = fs.readFileSync(file);
        if (b[0] !== 0x4d || b[1] !== 0x5a) return false;
        const pe = b.readUInt32LE(0x3c);
        if (b.toString("latin1", pe, pe + 4) !== "PE\0\0") return false;
        return b.readUInt16LE(pe + 24 + 68) === 3;
    } catch (_) { return false; }
}

const claim = (title, passed, detail = "") => ({ title, passed, detail: passed ? "" : detail });
const result = (id, passed, note, extra = {}) => ({ id, passed, note, claims: [], artifacts: [], confidence: "observed", ...extra });

// What the checks look at, as one digest: kept rounds are reused only while it is the same.
export function fingerprint(cfg, program) {
    const h = crypto.createHash("sha1");
    h.update(git(["rev-parse", "HEAD"], cfg.root).out + "\0");
    const st = git(["status", "--porcelain", "-uall"], cfg.root);
    h.update(st.out + "\0");
    // .text, not .out: .out is trimmed and loses the first line's leading status column (path cut by one).
    for (const line of st.text.split(/\r?\n/).filter(Boolean)) {
        const rel = line.slice(3).replace(/^"(.*)"$/, "$1").split(" -> ").pop();
        if (rel.startsWith(".evrim/")) continue;
        try { const p = path.join(cfg.root, rel); if (fs.statSync(p).isFile()) h.update(rel + ":" + crypto.createHash("sha1").update(fs.readFileSync(p)).digest("hex") + "\n"); } catch (_) { h.update(rel + ":gone\n"); }
    }
    if (program) { try { const s = fs.statSync(program.program); h.update(`${program.program}:${s.size}:${s.mtimeMs}`); } catch (_) { h.update("no-program"); } }
    h.update(JSON.stringify({ check: cfg.check || {}, build: cfg.build }));
    return h.digest("hex");
}

export function rounds(cfg) {
    let names = [];
    try { names = fs.readdirSync(checksDir(cfg)).filter((n) => /^round-\d+$/.test(n)); } catch (_) { /* none */ }
    return names.map((n) => Number(n.slice(6))).sort((a, b) => a - b);
}
export const lastRound = (cfg) => { const r = rounds(cfg).filter((n) => n > 0); return r.length ? readJson(path.join(checksDir(cfg), `round-${r[r.length - 1]}`, "check.json"), null) : null; };

async function screenshotCheck(cfg, prog, dir, deps) {
    const shot = path.join(dir, "screenshot.png");
    const r = await (deps.runProgram || runProgram)(prog.program, [...prog.args, "--screenshot", shot], { cwd: cfg.root, seconds: (cfg.check && cfg.check.runSeconds) || RUN_SECONDS });
    const rel = slash(path.relative(cfg.root, shot));
    if (!exists(shot)) return result("screenshot", false, `The program did not save a picture with --screenshot (exit ${r.code}${r.timedOut ? ", time limit" : ""}). ${SCREENSHOT_CONTRACT}`);
    let img;
    try { img = decodePng(fs.readFileSync(shot)); } catch (e) { return result("screenshot", false, `The --screenshot file is not a readable PNG: ${e.message}`, { artifacts: [rel] }); }
    if (isBlank(img)) return result("screenshot", false, "The screenshot is blank (one colour): nothing was drawn. Draw the first frames before saving.", { artifacts: [rel], claims: [claim("The window draws something", false, "blank picture")] });
    const claims = [claim("The window draws something", true)];
    let note = `The program starts and draws (${img.width}x${img.height}).`, passed = true, similarity = null;
    const refDir = path.resolve(cfg.root, (cfg.reference && cfg.reference.dir) || "references/shots");
    let refs = [];
    try { refs = fs.readdirSync(refDir).filter((f) => /\.png$/i.test(f)).map((f) => path.join(refDir, f)); } catch (_) { /* none */ }
    const best = refs.length ? closestReference(img, refs) : null;
    if (best) {
        similarity = best.score;
        note += ` It looks about ${best.score}% like ${best.name}.`;
        const gate = cfg.check && cfg.check.referenceGate;
        if (typeof gate === "number") {
            const ok = best.score >= gate;
            claims.push(claim(`Looks like the reference (>= ${gate}%)`, ok, `${best.score}% like ${best.name}`));
            if (!ok) passed = false;
        }
    }
    return result("screenshot", passed, note, { artifacts: [rel], claims, similarity });
}

async function selfTestCheck(cfg, prog, dir, deps) {
    const file = path.join(dir, "self-test.json");
    const required = (cfg.check && cfg.check.selfTest && cfg.check.selfTest.steps) || [];
    const r = await (deps.runProgram || runProgram)(prog.program, [...prog.args, "--self-test", file], { cwd: cfg.root, seconds: (cfg.check && cfg.check.runSeconds) || RUN_SECONDS });
    if (!exists(file)) return result("self-test", false, `The program did not save a report with --self-test (exit ${r.code}${r.timedOut ? ", time limit" : ""}). ${SELF_TEST_CONTRACT}`, { claims: required.map((s) => claim(`Self-test: ${s}`, false, "not tested")) });
    const v = verdict(readText(file), required);
    return result("self-test", v.passed, v.note, { claims: v.claims, artifacts: [slash(path.relative(cfg.root, file))] });
}

// Console programs: each case is run twice; a program that prints differently for the same input is
// flagged (a check that sees noise cannot gate anything). Exit code and non-empty output are claimed.
async function runsCheck(cfg, prog, deps) {
    const norm = (t) => String(t).replace(/\d{1,2}:\d{2}(:\d{2})?(\.\d+)?|\b\d+(\.\d+)?\s*(ms|s)\b/g, "#").trim();
    const claims = [];
    let passed = true;
    for (const [name, args] of CASES) {
        const a = await (deps.runProgram || runProgram)(prog.program, [...prog.args, ...args], { cwd: cfg.root, seconds: 8 });
        const b = await (deps.runProgram || runProgram)(prog.program, [...prog.args, ...args], { cwd: cfg.root, seconds: 8 });
        if (name !== "no arguments") { const ok = a.code === 0 && a.text.trim().length > 0; claims.push(claim(`${name} prints and exits 0`, ok, `exit ${a.code}, ${a.text.trim().length} characters`)); if (!ok) passed = false; }
        if (!a.timedOut && norm(a.text) !== norm(b.text)) claims.push(claim(`${name} prints the same twice`, false, "two runs printed different text"));
    }
    return result("runs", passed, passed ? "The console program answers --help and --version." : "The console program does not answer every case.", { claims });
}

// "One .exe, no install": the import table may not need a DLL Windows does not ship. A stray DLL lying next
// to the .exe still starts but is not one file; one that is missing means the build needs the static C runtime.
function singleExeCheck(prog) {
    let names = null;
    try { names = importedDlls(fs.readFileSync(prog.program)); } catch (_) { /* unreadable: noted below */ }
    if (!names) return result("single-exe", true, "The .exe's import table could not be read, so its DLLs are unknown.");
    const stray = strayDlls(names);
    const dir = path.dirname(prog.program);
    const here = stray.filter((d) => exists(path.join(dir, d)));
    const missing = stray.filter((d) => !here.includes(d));
    if (!stray.length) return result("single-exe", true, `One .exe: it imports only DLLs Windows ships (${names.length} names read).`);
    if (!missing.length) return result("single-exe", true, `Not one file, but it starts: ${stray.join(", ")} sit next to the .exe and must be installed with it.`);
    return result("single-exe", false, `The .exe needs ${missing.join(", ")}, which Windows does not ship, so a bare copy will not start on another machine. Build with the static C runtime (for example \`-C target-feature=+crt-static\`) so the .exe needs nothing beside it.`);
}

// Layer boundary (clean-architecture skill): Engine -> Tools/Storage -> thin UI. Engine files may not use a
// window library or the disk; UI files may not touch the disk. Read from the Rust source only (comments and
// strings are skipped roughly: lines starting with //). Applies when src/engine.rs or src/engine/ exists.
export function layersCheck(root) {
    const src = path.join(root, "src");
    const files = (dir, rel) => { const out = []; let es = []; try { es = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return out; } for (const e of es) { const r = `${rel}/${e.name}`; if (e.isDirectory()) out.push(...files(path.join(dir, e.name), r)); else if (e.name.endsWith(".rs")) out.push(r); } return out; };
    const all = files(src, "src");
    const engine = all.filter((f) => /^src\/engine(\.rs|\/)/.test(f)), ui = all.filter((f) => /^src\/ui(\.rs|\/)/.test(f));
    if (!engine.length) return null;
    const claims = [];
    const scan = (list, re, what) => {
        for (const f of list) {
            const lines = readText(path.join(root, f), "").split(/\r?\n/);
            const at = lines.findIndex((l) => !l.trim().startsWith("//") && re.test(l));
            claims.push(claim(`${f}: ${what}`, at < 0, at < 0 ? "" : `line ${at + 1}: ${lines[at].trim().slice(0, 100)}`));
        }
    };
    scan(engine, /\b(?:eframe|egui|tauri|winit)::|\buse\s+(?:eframe|egui|tauri|winit)\b|\bstd::fs\b|\bFile::(?:open|create)\b/, "no window library, no disk");
    scan(ui, /\bstd::fs\b|\bFile::(?:open|create)\b/, "no disk in the UI");
    const bad = claims.filter((c) => !c.passed);
    return result("layers", !bad.length, bad.length ? `Layer boundary broken in ${bad.length} file(s): rules and disk belong to engine/storage, drawing to the UI.` : `Engine -> Storage -> UI boundary holds (${engine.length + ui.length} files).`, { claims });
}

// WCAG 2.x contrast ratio of two "#rrggbb" colours (desktop-design: text >= 4.5, edges >= 3).
export function contrastRatio(a, b) {
    const lum = (hex) => {
        const n = parseInt(String(hex).replace("#", ""), 16), c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
        return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100;
}

// Runs one round. self = round 0 (the builder's own look, not counted). deps: injectable runner/build.
export async function runChecks(cfg, { self = false, deps = {}, now = new Date() } = {}) {
    const c = cfg.check || {};
    let prog = deps.program !== undefined ? deps.program : programFor(cfg);
    const fp = fingerprint(cfg, prog);
    const last = lastRound(cfg);
    const n = self ? 0 : (rounds(cfg).filter((x) => x > 0).pop() || 0) + 1;
    const dir = path.join(checksDir(cfg), `round-${n}`);
    if (last && last.passed && last.fingerprint === fp && !deps.force) {
        const kept = { ...last, round: n, at: now.toISOString(), kept: last.keptFrom || last.round, keptFrom: last.keptFrom || last.round };
        writeJson(path.join(dir, "check.json"), kept);
        return { ...kept, note: "Nothing the check looks at has changed since it last passed, so its results stand." };
    }
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    const results = [];
    if (cfg.build && !deps.skipBuild) {
        const b = await (deps.runProgram || runProgram)(cfg.build[0], cfg.build.slice(1), { cwd: cfg.root, seconds: (cfg.buildMinutes || 10) * 60 });
        const tail = b.text.trim().split(/\r?\n/).slice(-6).join(" | ");
        results.push(result("build", b.code === 0, b.code === 0 ? `\`${cfg.build.join(" ")}\` passed.` : `Build failed (exit ${b.code}): ${tail}`));
    }
    const layers = layersCheck(cfg.root);
    if (layers) results.push(layers);
    const built = !results.length || results[0].passed;
    // The program is looked for again after the build: a fresh project has no .exe before its first build
    // (found by the real template build test: "No program to start" right after "build passed").
    if (built && deps.program === undefined) prog = programFor(cfg);
    if (built && c.enabled !== false) {
        if (!prog) results.push(result("program", false, "No program to start: set finalForm.deliverable or check.program, or build a Cargo project (its default-run / window package is used)."));
        else {
            const kind = c.kind && c.kind !== "auto" ? c.kind : isConsoleProgram(prog.program) ? "console" : "window";
            if (kind === "console") results.push(await runsCheck(cfg, prog, deps));
            else results.push(await screenshotCheck(cfg, prog, dir, deps));
            if (kind !== "console" && (c.selfTest && (c.selfTest.steps || []).length || c.selfTest === true)) results.push(await selfTestCheck(cfg, prog, dir, deps));
            if (/\.exe$/i.test(prog.program)) results.push(singleExeCheck(prog));
        }
    }
    // At most MAX_CLAIMS claims in all: a capped list says so (a cut list must never look complete).
    let left = MAX_CLAIMS;
    for (const r of results) { if (r.claims.length > left) { r.note += ` (${r.claims.length - left} more claims not listed)`; r.claims = r.claims.slice(0, left); } left -= r.claims.length; }
    const out = { version: 1, round: n, at: now.toISOString(), fingerprint: fp, program: prog ? { file: slash(path.relative(cfg.root, prog.program)), why: prog.why } : null, passed: results.length > 0 && results.every((r) => r.passed), results };
    writeJson(path.join(dir, "check.json"), out);
    return out;
}

// One block of plain text for the owner/model (no picture is read here).
export function summary(round) {
    const lines = [`cv check · tur ${round.round}${round.kept ? ` (tur ${round.kept} sonucu geçerli: hiçbir şey değişmedi)` : ""} · ${round.passed ? "GEÇTİ" : "KALDI"}`];
    for (const r of round.results) {
        lines.push(`  ${r.passed ? "✓" : "✗"} ${r.id}: ${r.note}`);
        for (const c of r.claims) lines.push(`      ${c.passed ? "✓" : "✗"} ${c.title}${c.detail ? ` — ${c.detail}` : ""}`);
        for (const a of r.artifacts) lines.push(`      dosya: ${a}`);
    }
    return lines.join("\n");
}
