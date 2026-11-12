// cv probe --preset <name> | --script "<js>" | --list   [--max N] [--timeout SEC] [--arg k=v ...]   (core/probe/README.md)
import { num } from "../lib/util.js";
import { project } from "./_project.js";
import * as probe from "../probe/probe.js";

export async function run(args) {
    const cfg = project(args);
    if (args.list) {
        const p = await probe.presets(cfg);
        const names = Object.keys(p);
        console.log(names.length ? names.map((n) => `${n.padEnd(14)} ${p[n]}`).join("\n") : "(eklentinin hazır yoklaması yok)");
        return 0;
    }
    const preset = typeof args.preset === "string" ? args.preset : null, script = typeof args.script === "string" ? args.script : null;
    if (!preset && !script) { console.log("Kullanım: cv probe --preset <ad> | --script \"<js>\" | --list  [--max N] [--timeout SN]"); return 1; }
    const extra = {};
    if (typeof args.arg === "string") for (const kv of [args.arg]) { const i = kv.indexOf("="); if (i > 0) extra[kv.slice(0, i)] = kv.slice(i + 1); }
    const r = await probe.probe(cfg, { preset, script, args: extra, max: num(args.max), timeoutSeconds: num(args.timeout) });
    console.log(r.text);
    return 0;
}
