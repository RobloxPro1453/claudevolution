// cv watch [--every <saniye>] [--once]
// Rewrites .evrim/STATUS.md (core/autonomy/livestatus.js) and prints it; with --every it repeats until no
// lane runs any more. For an owner who is at the computer; the autonomous loop does not need it.
import { project } from "./_project.js";
import { lanes, statusDoc, writeStatus } from "../autonomy/livestatus.js";
import { lastRound } from "../check/check.js";

export async function run(args) {
    const cfg = project(args);
    const every = Number(args.every) || 0;
    for (;;) {
        const round = lastRound(cfg);
        writeStatus(cfg, { lastRound: round });
        console.log(statusDoc(cfg, { lastRound: round }));
        if (args.once || !every || !lanes(cfg).some((l) => l.alive)) return 0;
        await new Promise((r) => setTimeout(r, every * 1000));
    }
}
