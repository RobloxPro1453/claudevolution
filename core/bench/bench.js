// The benchmark: tiers A (unit tests) and B (chaos scenarios) cost zero model tokens and run on every change.
// Tier C (live, cheap model on a fake project) runs only with --live (see live.js). Results are compared
// with bench/baseline.json: hard gates first, then free size measures.
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { readJson, run, today, writeJson } from "../lib/util.js";
import { PKG_ROOT, VERSION } from "../lib/config.js";
import * as chaos from "./chaos.js";

export const BENCH_DIR = path.join(PKG_ROOT, "bench");
export const BASELINE = path.join(BENCH_DIR, "baseline.json");

// Tier A: the package's own test suite in a child process (Node or Deno, whichever runs us).
export function tierA(root = PKG_ROOT) {
    const isDeno = typeof globalThis.Deno !== "undefined";
    const args = isDeno ? ["run", "-A", "tests/run.js"] : ["tests/run.js"];
    const started = Date.now();
    const r = run(process.execPath, args, { cwd: root, timeoutMs: 10 * 60000 });
    const m = /(\d+)\/(\d+) test geçti/.exec(r.text);
    return { passed: m ? +m[1] : 0, total: m ? +m[2] : 0, ok: r.ok && !!m && m[1] === m[2], seconds: Math.round((Date.now() - started) / 100) / 10 };
}

// Free size measures: smaller is better when the gates hold (a change that adds text must earn it).
function countLines(dir, exts, skip = /(^|\/)(\.git|node_modules|bench\/results)(\/|$)/) {
    let n = 0;
    const walk = (d, rel) => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
            const r = rel ? rel + "/" + e.name : e.name;
            if (skip.test(r)) continue;
            if (e.isDirectory()) walk(path.join(d, e.name), r);
            else if (exts.some((x) => e.name.endsWith(x))) n += fs.readFileSync(path.join(d, e.name), "utf8").split("\n").length;
        }
    };
    if (fs.existsSync(dir)) walk(dir, "");
    return n;
}
export function sizes(root = PKG_ROOT) {
    return {
        codeLines: countLines(path.join(root, "core"), [".js"]) + countLines(path.join(root, "bin"), [".js"]),
        skillLines: countLines(path.join(root, "skills"), [".md"]),
        templateLines: countLines(path.join(root, "templates"), [".md", ".json"]),
    };
}

export function measure({ root = PKG_ROOT, skipA = false } = {}) {
    const A = skipA ? null : tierA(root);
    const B = chaos.runAll(path.join(root, "bench", "chaos"));
    return { version: VERSION, date: today(), A, B, sizes: sizes(root) };
}

// Hard gates must hold; then compare free measures with the baseline. Tier C (if present) adds its own gates.
export function compare(result, baseline) {
    const gates = [], worse = [], better = [];
    if (result.A && !result.A.ok) gates.push(`Kat A: ${result.A.passed}/${result.A.total} test`);
    if (result.B.passed !== result.B.total) gates.push(`Kat B: ${result.B.passed}/${result.B.total} senaryo (${result.B.failed.map((f) => f.id).join(", ")})`);
    if (baseline && result.A && baseline.A && result.A.total < baseline.A.total) gates.push(`Kat A: test sayısı azaldı (${baseline.A.total} → ${result.A.total})`);
    if (baseline && result.B.total < baseline.B.total) gates.push(`Kat B: senaryo sayısı azaldı (${baseline.B.total} → ${result.B.total})`);
    if (result.C) {
        if (result.C.status === "olculemedi") gates.push("Kat C: ölçülemedi (tavan aşıldı ya da model yok)");
        else {
            if (result.C.trapViolations > 0) gates.push(`Kat C: tuzak ihlali ${result.C.trapViolations}`);
            if (baseline && baseline.C && baseline.C.status === "tamam" && result.C.solved < baseline.C.solved) gates.push(`Kat C: çözülen iş azaldı (${baseline.C.solved} → ${result.C.solved})`);
        }
    }
    if (baseline) {
        for (const k of Object.keys(result.sizes)) {
            const a = baseline.sizes[k], b = result.sizes[k];
            if (a === undefined) continue;
            const ch = (b - a) / Math.max(a, 1);
            if (ch > 0.05) worse.push(`${k} %${Math.round(ch * 100)} arttı (${a} → ${b})`);
            else if (ch < -0.05) better.push(`${k} %${Math.round(-ch * 100)} azaldı (${a} → ${b})`);
        }
        if (result.A && baseline.A && result.A.total > baseline.A.total) better.push(`test ${baseline.A.total} → ${result.A.total}`);
        if (result.B.total > baseline.B.total) better.push(`senaryo ${baseline.B.total} → ${result.B.total}`);
    }
    return { ok: gates.length === 0, gates, worse, better };
}

export function save(result, root = PKG_ROOT) {
    const dir = path.join(root, "bench", "results");
    let file = path.join(dir, `${result.date}.json`), i = 2;
    while (fs.existsSync(file)) file = path.join(dir, `${result.date}-${i++}.json`);
    writeJson(file, result);
    return file;
}
export const loadBaseline = (root = PKG_ROOT) => readJson(path.join(root, "bench", "baseline.json"), null);
export const writeBaseline = (result, root = PKG_ROOT) => writeJson(path.join(root, "bench", "baseline.json"), result);
