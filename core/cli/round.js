// cv round start [--quota N] [--type T] [--mode hybrid|solo]
// cv round end   [--quota N] [--bugs "..."] [--waste "..."] [--note "..."] [--session ID] [--exclude-session ID] [--dry]
// cv round add   --from ISO --to ISO --base REV --head REV [same fields as end]
// cv round show | table
import { project } from "./_project.js";
import * as round from "../metrics/round.js";

export function run(args) {
    const cfg = project(args);
    const [sub] = args._;
    if (sub === "start") {
        const o = round.start(cfg, args);
        console.log(`tur ${o.round} başladı: ${o.from}, başlangıç ${o.base.slice(0, 7)}`);
    } else if (sub === "end" || sub === "add") {
        const row = sub === "end" ? round.end(cfg, args) : round.add(cfg, args);
        console.log(args.dry ? JSON.stringify(row, null, 2) : round.summary(row));
    } else if (sub === "show") {
        console.log(round.show(cfg));
    } else if (sub === "table") {
        console.log("yazıldı: " + round.table(cfg));
    } else {
        console.log("Kullanım: cv round start | end | add --from --to --base --head | show | table");
        return 1;
    }
    return 0;
}
