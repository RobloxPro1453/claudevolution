// Stacks: which kind of desktop app to build and its starting skeleton (owner decision #3 "1-C": a light
// pure-Rust egui app by default, Rust + Tauri when the work really needs rich web content).
// templates/stacks.json is the catalogue; templates/stacks/<id>/ the skeleton, copied with {{crate}}/{{title}}
// filled in. Copying never overwrites a file that is already there.
import fs from "node:fs";
import path from "node:path";
import { exists, readJson, readText, writeText } from "../lib/util.js";
import { PKG_ROOT } from "../lib/config.js";

export const STACKS_FILE = path.join(PKG_ROOT, "templates", "stacks.json");
export const STACKS_DIR = path.join(PKG_ROOT, "templates", "stacks");
export const catalogue = () => readJson(STACKS_FILE, { stacks: [] }).stacks;

// The stack for a request, with the reason in plain words. Words that need a browser engine (web pages
// inside the app, HTML/CSS editing, embedded web content) pick Tauri; everything else egui. The owner's
// explicit word always wins ("tauri ile", "egui ile"): a default is never an order (craft-anything pitfall).
export function suggest(request) {
    const t = String(request || "").toLocaleLowerCase("tr");
    const list = catalogue();
    const named = list.find((s) => new RegExp(`\\b${s.id.split("-").pop()}\\b`).test(t));
    if (named) return { stack: named.id, why: `sahibi "${named.id.split("-").pop()}" dedi (söz varsayılandan üstündür)` };
    const tauri = list.find((s) => s.id === "rust-tauri");
    const hit = tauri && (tauri.signals || []).find((w) => t.includes(w));
    if (hit) return { stack: "rust-tauri", why: `"${hit}" zengin web içeriği istiyor: Rust + Tauri (Windows'un WebView2'si; yoksa tek onayla kurulur)` };
    return { stack: "rust-egui", why: "varsayılan: saf Rust + egui (gerçek tek .exe, hızlı açılış; çok panelli düzen de karşılanır)" };
}

export const crateName = (name) => String(name || "app").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/^(\d)/, "app-$1") || "app";

function walk(dir, rel = "") {
    const out = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const r = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory()) out.push(...walk(path.join(dir, e.name), r)); else out.push(r);
    }
    return out;
}

// Copies the skeleton of `stack` into `dest`; returns { created, kept }. Existing files are never replaced.
export function scaffold(stack, dest, { name = path.basename(dest), title = name } = {}) {
    const src = path.join(STACKS_DIR, stack);
    if (!exists(src)) throw new Error(`şablon yok: ${stack} (var olanlar: ${catalogue().filter((s) => s.template).map((s) => s.id).join(", ")})`);
    const vars = { crate: crateName(name).replace(/-/g, "_"), title: String(title) };
    const created = [], kept = [];
    for (const rel of walk(src)) {
        const to = path.join(dest, rel);
        if (exists(to)) { kept.push(rel); continue; }
        writeText(to, readText(path.join(src, rel)).replace(/\{\{(crate|title)\}\}/g, (_, k) => vars[k]));
        created.push(rel);
    }
    return { created, kept, crate: vars.crate };
}
