// cv stack suggest "<istek>" | new <yığın> [--name A] [--title T] [--dir K] | list
// Which desktop stack and its working skeleton (core/stack/README.md). `new` never overwrites a file.
import path from "node:path";
import process from "node:process";
import { catalogue, scaffold, suggest } from "../stack/stack.js";

export async function run(args) {
    const [sub, ...rest] = args._;
    if (sub === "list" || !sub) {
        for (const s of catalogue()) console.log(`${s.id.padEnd(11)} ${s.template ? "iskelet var " : "yalnız öneri"} ${s.title}\n            ${s.when}`);
        return 0;
    }
    if (sub === "suggest") { const s = suggest(rest.join(" ")); console.log(`YIGIN: ${s.stack} — ${s.why}`); return 0; }
    if (sub === "new" && rest[0]) {
        const dir = path.resolve(typeof args.dir === "string" ? args.dir : process.cwd());
        const name = typeof args.name === "string" ? args.name : path.basename(dir);
        const r = scaffold(rest[0], dir, { name, title: typeof args.title === "string" ? args.title : name });
        console.log(`iskelet: ${rest[0]} → ${dir}\n  yeni: ${r.created.length}   dokunulmayan (zaten var): ${r.kept.length}\n  program adı: ${r.crate} (Cargo default-run)\nSonra: cargo build --release, ardından cv check (pencere + --self-test).`);
        return 0;
    }
    console.log("Kullanım: cv stack list | suggest \"<istek>\" | new <yığın> [--name A] [--title T] [--dir K]");
    return 1;
}
