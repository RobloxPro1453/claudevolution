// cv ref name "<label>" | index | compare      (core/reference/README.md)
import path from "node:path";
import { project } from "./_project.js";
import * as ref from "../reference/ref.js";

export function run(args) {
    const [sub, ...rest] = args._;
    if (sub === "name" && rest.length) { console.log(ref.slug(rest.join(" "))); return 0; }
    const cfg = project(args);
    if (sub === "index") {
        const r = ref.index(cfg);
        const files = r.items.reduce((a, i) => a + i.files.length, 0);
        console.log(`${r.items.length} ad, ${files} dosya → ${path.relative(cfg.root, r.file)}`);
        return 0;
    }
    if (sub === "compare") {
        const r = ref.compare(cfg);
        console.log(`eşleşen ${r.both} · yalnız referansta ${r.onlyRef} · yalnız bizde ${r.onlyOurs} → ${path.relative(cfg.root, r.out)}`);
        return 0;
    }
    console.log("Kullanım: cv ref name \"<menü/yol>\" | index | compare");
    return 1;
}
