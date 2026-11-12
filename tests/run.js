// All tests: fast, no network.   node tests/run.js   (or: deno run -A tests/run.js, or: npm test)
import process from "node:process";
import { runAll } from "./harness.js";

for (const file of ["core", "evolution", "delegate", "metrics", "adopt", "ref", "docs", "bench"]) {
    try { await import(`./${file}.test.js`); }
    catch (e) {
        if (e.code === "ERR_MODULE_NOT_FOUND" && String(e.message).includes(`${file}.test.js`)) continue; // suite not written yet
        console.error(`tests/${file}.test.js yüklenemedi: ${e.message}`);
        process.exit(1);
    }
}
process.exit((await runAll()) ? 1 : 0);
