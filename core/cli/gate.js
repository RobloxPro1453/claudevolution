// cv gate --five N --week N [--five-resets ISO] [--week-resets ISO]
// Prints the decision for the current usage and remembers it as the last known quota.
import { project } from "./_project.js";
import { gate } from "../autonomy/gates.js";
import { parseUsage, rememberQuota } from "../autonomy/cycle.js";

export async function run(args) {
    const cfg = project(args);
    const usage = parseUsage(args);
    if (!usage) { console.log("KARAR: KUCUK\nNEDEN: kota verilmedi ya da okunamadı (--five N --week N); yalnız tek küçük adım\nUYKU: 1800"); return 0; }
    rememberQuota(cfg, usage);
    const g = gate(usage, cfg.autonomy);
    console.log(`KARAR: ${g.decision}\nNEDEN: ${g.reason}\nUYKU: ${g.sleepSeconds}\nHAFTALIK_TAVAN: %${g.ceiling} (haftanın %${Math.round(g.f * 100)}'i geçti)`);
    return 0;
}
