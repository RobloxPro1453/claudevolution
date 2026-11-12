// All tests: fast, no network.   node tests/run.js   (or: deno run -A tests/run.js, or: npm test)
import fs from "node:fs";
import process from "node:process";
import { runAll } from "./harness.js";

for (const file of ["core", "evolution", "delegate", "metrics", "adopt", "ref", "docs", "bench", "live", "evolve", "lesson"]) {
    try { await import(`./${file}.test.js`); }
    catch (e) {
        // Only a missing file is skipped; a broken one fails the run (a syntax error once hid a whole suite).
        if (!fs.existsSync(new URL(`./${file}.test.js`, import.meta.url))) continue;
        console.error(`tests/${file}.test.js yüklenemedi: ${e.message}`);
        process.exit(1);
    }
}
process.exit((await runAll()) ? 1 : 0);
