// cv evolve evrim/<ad> --why "<beklenen etki>" [--live] [--no-push]
// Run inside the claudevolution checkout. Accepts the candidate into main only if the benchmark says so.
import { PKG_ROOT } from "../lib/config.js";
import { evolve } from "../evolve/evolve.js";

export async function run(args) {
    const branch = args._[0];
    if (!branch) throw new Error("kullanım: cv evolve evrim/<ad> --why \"<beklenen etki>\" [--live] [--no-push]");
    const r = evolve({ root: typeof args.dir === "string" ? args.dir : PKG_ROOT, branch, why: typeof args.why === "string" ? args.why : "", live: !!args.live, push: !args["no-push"] });
    for (const l of r.lines) console.log(l);
    return r.accepted ? 0 : 1;
}
