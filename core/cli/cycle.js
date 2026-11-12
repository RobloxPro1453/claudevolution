// cv cycle begin --five N --week N [--five-resets ISO] [--week-resets ISO] [--session ID]
// cv cycle end   [--id ID] --did "..." --cost "..." --worth evet|hayir [--five N --week N] [--next "..."]
// cv cycle sleep --reason "..." [--five N --week N]
import { project } from "./_project.js";
import { begin, end } from "../autonomy/cycle.js";

export async function run(args) {
    const cfg = project(args);
    const sub = args._[0];
    if (sub === "begin") { console.log(begin(cfg, args).lines.join("\n")); return 0; }
    if (sub === "end") { console.log(end(cfg, args).join("\n")); return 0; }
    if (sub === "sleep") { console.log(end(cfg, args, new Date(), { sleepOnly: true }).join("\n")); return 0; }
    throw new Error("kullanım: cv cycle begin | end | sleep");
}
