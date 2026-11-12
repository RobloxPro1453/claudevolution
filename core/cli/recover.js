// cv recover [--fix]
import { project } from "./_project.js";
import { find, fix } from "../autonomy/recover.js";

export async function run(args) {
    const cfg = project(args);
    const found = find(cfg);
    if (!found.length) { console.log("Takılma yok: kilit, git ve şeritler temiz."); return 0; }
    for (const f of found) console.log(`- ${f.text}${f.fixable ? "  [--fix düzeltir]" : "  [elle]"}`);
    if (args.fix) for (const d of fix(cfg, found)) console.log("  düzeltildi: " + d);
    return 0;
}
