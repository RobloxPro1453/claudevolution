// cv check [--self] [--force] [--json] | contract | last
// The numeric gate for a desktop app (core/check/README.md): build, start the declared program with
// --screenshot (blank or not, likeness to references), --self-test steps, or console runs; one round saved
// as .evrim/state/checks/round-<n>/check.json. --self = round 0, the builder's own look while it works.
import { project } from "./_project.js";
import { lastRound, runChecks, summary } from "../check/check.js";
import { SCREENSHOT_CONTRACT, SELF_TEST_CONTRACT } from "../check/selftest.js";

export async function run(args) {
    const [sub] = args._;
    if (sub === "contract") { console.log(`${SCREENSHOT_CONTRACT}

${SELF_TEST_CONTRACT}`); return 0; }
    const cfg = project(args);
    if (sub === "last") { const r = lastRound(cfg); console.log(r ? summary(r) : "Henüz denetim turu yok: cv check"); return r && r.passed ? 0 : 1; }
    const r = await runChecks(cfg, { self: !!args.self, deps: { force: !!args.force } });
    console.log(args.json ? JSON.stringify(r) : summary(r));
    return r.passed ? 0 : 1;
}
