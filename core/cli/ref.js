// cv ref name "<label>" | index | compare | license <folder> [--birebir]      (core/reference/README.md)
import path from "node:path";
import { project } from "./_project.js";
import * as ref from "../reference/ref.js";

export async function run(args) {
    const [sub, ...rest] = args._;
    if (sub === "name" && rest.length) { console.log(ref.slug(rest.join(" "))); return 0; }
    // What may be taken from a reference program: adapt (permissive), ideas only (copyleft) or clean room.
    if (sub === "license" && rest[0]) {
        const { detectLicense, referenceRule } = await import("../reference/license.js");
        const lic = detectLicense(path.resolve(rest[0]));
        console.log(`LISANS: ${lic.ids.join(" / ") || "yok"}${lic.source ? " (" + lic.source + ")" : ""}
KIP: ${lic.mode}
KURAL: ${referenceRule(lic, args.birebir ? "birebir" : "benzer")}`);
        return 0;
    }
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
    console.log("Kullanım: cv ref name \"<menü/yol>\" | index | compare | license <klasör> [--birebir]");
    return 1;
}
