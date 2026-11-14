// Probe the running app through the project's plugin: bounded time, bounded JSON output, named screenshots.
// Interface: core/probe/README.md.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { exists, readText } from "../lib/util.js";
import { slug } from "../reference/ref.js";

export async function loadPlugin(cfg) {
    const spec = cfg.probe && cfg.probe.plugin;
    if (!spec) throw new Error("probe eklentisi tanımlı değil: .evrim/config.json içinde probe.plugin (arayüz: paketteki core/probe/README.md)");
    const file = path.resolve(cfg.root, spec);
    if (!exists(file)) throw new Error("probe eklentisi bulunamadı: " + spec);
    const mod = (await import(pathToFileURL(file).href)).default;
    if (!mod || typeof mod.run !== "function") throw new Error("probe eklentisi run() dışa aktarmıyor: " + spec);
    return mod;
}

// Cuts the JSON text to max characters and says so (the caller's context stays small).
export function cap(text, max) {
    return text.length > max ? { text: text.slice(0, max) + `\n… (${text.length - max} karakter kesildi; --max ya da daha dar bir yoklama)`, truncated: true } : { text, truncated: false };
}

export async function probe(cfg, { preset = null, script = null, args = {}, max, timeoutSeconds } = {}) {
    const plugin = await loadPlugin(cfg);
    if (preset && plugin.presets && !(preset in plugin.presets)) throw new Error(`bilinmeyen hazır yoklama: ${preset} (cv probe --list)`);
    if (script && /\.(m?js)$/.test(script) && exists(path.resolve(cfg.root, script))) script = readText(path.resolve(cfg.root, script));
    const p = cfg.probe || {};
    const timeoutMs = (timeoutSeconds || p.timeoutSeconds || 120) * 1000;
    const shotsDir = path.resolve(cfg.root, (cfg.reference && cfg.reference.shotsDir) || ".evrim/state/shots");
    const ctx = { cfg, root: cfg.root, timeoutMs, shot: (name) => { fs.mkdirSync(shotsDir, { recursive: true }); return path.join(shotsDir, slug(name) + ".png"); } };
    let timer;
    const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`zaman aşımı (${timeoutMs / 1000} sn)`)), timeoutMs); });
    try {
        const value = await Promise.race([plugin.run({ preset, script, args }, ctx), timeout]);
        const json = JSON.stringify(value === undefined ? null : value, null, 1);
        return { ok: true, ...cap(json, max || p.maxChars || 4000) };
    } finally { clearTimeout(timer); }
}

export async function presets(cfg) {
    const plugin = await loadPlugin(cfg);
    return plugin.presets || {};
}
