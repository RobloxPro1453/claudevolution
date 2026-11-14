// Tiny test harness: no dependencies, no network. Each test gets a fresh temp folder on request.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

// Shared machine state (machine lock, project registry) must never touch the real home folder in tests.
export const SANDBOX = fs.mkdtempSync(path.join(os.tmpdir(), "cv-test-"));
process.env.CV_STATE_HOME = path.join(SANDBOX, "state-home");

const tests = [];
export const test = (name, fn) => tests.push({ name, fn });
let dirCount = 0;
export function tmpDir(label = "t") {
    const dir = path.join(SANDBOX, `${label}-${++dirCount}`);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}
export function eq(actual, expected, what = "") {
    const a = JSON.stringify(actual), e = JSON.stringify(expected);
    if (a !== e) throw new Error(`${what ? what + ": " : ""}beklenen ${e}, gelen ${a}`);
}
export function ok(cond, what) { if (!cond) throw new Error(what || "koşul sağlanmadı"); }
export function throws(fn, pattern, what = "") {
    try { fn(); } catch (e) { if (pattern && !pattern.test(e.message)) throw new Error(`${what}: hata metni beklenmedik: ${e.message}`); return; }
    throw new Error(`${what}: hata bekleniyordu`);
}

export async function runAll() {
    let failed = 0;
    const started = Date.now();
    for (const t of tests) {
        try { await t.fn(); console.log("  ✓ " + t.name); }
        catch (e) { failed++; console.log("  ✗ " + t.name + "\n      " + String(e.message).split("\n").join("\n      ")); }
    }
    try { fs.rmSync(SANDBOX, { recursive: true, force: true }); } catch (_) { /* temp cleanup is best effort */ }
    console.log(`\n${tests.length - failed}/${tests.length} test geçti (${((Date.now() - started) / 1000).toFixed(1)} sn)`);
    return failed;
}
