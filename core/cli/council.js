// cv council --topic "<konu>" [--complexity auto|low|medium|high] [--depth auto|solo|light|deep] [--license personal|commercial|open-source] [--execute] [--json]
// Plans (and optionally executes) a quota- and plan-aware multi-CLI/multi-model council.
import path from "node:path";
import process from "node:process";
import { defaults, findRoot, loadConfig } from "../lib/config.js";
import { runCouncil } from "../orchestrate/council.js";

const COMPLEXITIES = ["auto", "low", "medium", "high"];
const DEPTHS = ["auto", "solo", "light", "deep"];
const LICENSES = ["auto", "personal", "commercial", "open-source", "oss", "opensource"];

const USAGE = 'kullanım: cv council --topic "<konu>" [--complexity auto|low|medium|high] [--depth auto|solo|light|deep] [--license personal|commercial|open-source] [--execute] [--json]';

function resolveProjectConfig(args) {
    const start = typeof args.dir === "string" ? path.resolve(args.dir) : process.cwd();
    const root = findRoot(start);
    if (root) {
        try { return loadConfig(root); } catch (_) { /* fall back gracefully during discovery */ }
    }
    return { ...defaults(), root: root || start };
}

export async function run(args = {}, ctx = {}) {
    if (args.help || args.h || (args._ && args._[0] === "help")) {
        console.log(USAGE);
        return 0;
    }

    const topic = typeof args.topic === "string"
        ? args.topic.trim()
        : (Array.isArray(args._) ? args._.join(" ").trim() : "");
    if (!topic) throw new Error(USAGE);

    const complexity = typeof args.complexity === "string" ? args.complexity.toLowerCase() : "auto";
    if (!COMPLEXITIES.includes(complexity)) throw new Error(`geçersiz --complexity değeri "${complexity}" (beklenen: ${COMPLEXITIES.join(" | ")})`);

    const depth = typeof args.depth === "string" ? args.depth.toLowerCase() : "auto";
    if (!DEPTHS.includes(depth)) throw new Error(`geçersiz --depth değeri "${depth}" (beklenen: ${DEPTHS.join(" | ")})`);

    const licensePolicy = typeof args.license === "string" ? args.license.toLowerCase() : undefined;
    if (licensePolicy && !LICENSES.includes(licensePolicy)) throw new Error(`geçersiz --license değeri "${licensePolicy}" (beklenen: personal | commercial | open-source | auto)`);

    const cfg = resolveProjectConfig(args);
    const res = await runCouncil(cfg, {
        topic,
        complexity,
        depth,
        licensePolicy,
        plan: typeof args.plan === "string" ? args.plan : undefined,
        execute: Boolean(args.execute),
        runCli: Boolean(args["run-cli"]),
        write: !args["no-write"],
        out: typeof args.out === "string" ? args.out : undefined,
        probeLocalBlocks: true,
        env: ctx.env || process.env
    });

    if (args.json) {
        console.log(JSON.stringify({
            plan: res.plan,
            mdPath: res.mdPath,
            executions: res.executions || null,
            synthesis: res.synthesis || null
        }, null, 2));
    } else {
        console.log(res.lines.join("\n"));
    }
    return 0;
}
