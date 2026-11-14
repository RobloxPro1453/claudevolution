// Reference matching: one naming rule for the reference app's screenshots and ours, an index, and a
// side-by-side HTML page. Nothing is copied; the page links the images by relative path. Interface: README.md.
import fs from "node:fs";
import path from "node:path";
import { slash, writeJson, writeText } from "../lib/util.js";
import { stateDir } from "../lib/config.js";

const TR = { ç: "c", ğ: "g", ı: "i", İ: "i", ö: "o", ş: "s", ü: "u", Ç: "c", Ğ: "g", Ö: "o", Ş: "s", Ü: "u" };
// "Görüntü/Ayarlar/Düzeyler..." → "goruntu__ayarlar__duzeyler"
export function slug(label) {
    return String(label).replace(/[çğıİöşüÇĞÖŞÜ]/g, (c) => TR[c]).normalize("NFKD").replace(/[̀-ͯ]/g, "")
        .replace(/\.\.\.|…/g, "").toLowerCase()
        .split(/\s*(?:\/|>)\s*/).map((p) => p.replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "")).filter(Boolean).join("__");
}

const IMAGE = /\.(png|jpe?g|webp|gif)$/i, VIDEO = /\.(mp4|webm|mov)$/i;
// A file's match key: its name without extension and without a "-2" style variant suffix.
export const keyOf = (file) => path.basename(file).replace(/\.[^.]+$/, "").replace(/-\d+$/, "");

export function scan(dir) {
    const items = new Map();
    let files = [];
    // Order by name, then variant: "a.png" before "a-2.png" ("-" sorts before "." as plain text).
    const variant = (f) => { const m = path.basename(f).replace(/\.[^.]+$/, "").match(/-(\d+)$/); return m ? Number(m[1]) : 1; };
    try { files = fs.readdirSync(dir).filter((f) => IMAGE.test(f) || VIDEO.test(f)).sort((a, b) => keyOf(a).localeCompare(keyOf(b)) || variant(a) - variant(b)); } catch (_) { /* no folder yet */ }
    for (const f of files) {
        const k = keyOf(f);
        if (!items.has(k)) items.set(k, { name: k, files: [], kind: IMAGE.test(f) ? "image" : "video" });
        items.get(k).files.push(f);
    }
    return [...items.values()];
}

export function index(cfg, now = new Date()) {
    const dir = path.resolve(cfg.root, cfg.reference.dir);
    const items = scan(dir);
    const file = path.join(stateDir(cfg), "ref-index.json");
    writeJson(file, { at: now.toISOString(), dir: cfg.reference.dir, items });
    return { file, items };
}

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function compare(cfg) {
    const refDir = path.resolve(cfg.root, cfg.reference.dir), oursDir = path.resolve(cfg.root, cfg.reference.shotsDir);
    const out = path.resolve(cfg.root, cfg.reference.out);
    const ref = new Map(scan(refDir).map((i) => [i.name, i])), ours = new Map(scan(oursDir).map((i) => [i.name, i]));
    const both = [...ref.keys()].filter((k) => ours.has(k)).sort();
    const onlyRef = [...ref.keys()].filter((k) => !ours.has(k)).sort(), onlyOurs = [...ours.keys()].filter((k) => !ref.has(k)).sort();
    const link = (dir, f) => esc(slash(path.relative(path.dirname(out), path.join(dir, f))));
    const media = (dir, item) => {
        const src = link(dir, item.files[0]);
        const more = item.files.length > 1 ? `<small>+${item.files.length - 1}</small>` : "";
        return (item.kind === "image" ? `<a href="${src}"><img src="${src}" alt="" loading="lazy"></a>` : `<video src="${src}" controls preload="none"></video>`) + more;
    };
    const rows = both.map((k) => `<tr><th>${esc(k)}</th><td>${media(refDir, ref.get(k))}</td><td>${media(oursDir, ours.get(k))}</td></tr>`).join("\n");
    const list = (keys) => keys.length ? `<ul>${keys.map((k) => `<li>${esc(k)}</li>`).join("")}</ul>` : "<p>(yok)</p>";
    const html = `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Referans karşılaştırma · ${esc(cfg.project)}</title>
<style>
:root{color-scheme:light dark;--bg:#fff;--fg:#1a1a1a;--line:#ddd}
@media (prefers-color-scheme:dark){:root{--bg:#161616;--fg:#eee;--line:#333}}
body{margin:0;padding:16px;background:var(--bg);color:var(--fg);font:14px/1.4 system-ui,sans-serif}
table{border-collapse:collapse;width:100%}th,td{border-top:1px solid var(--line);padding:8px;vertical-align:top;text-align:left}
td{width:45%}img,video{max-width:100%;height:auto;display:block}th{font-weight:600;word-break:break-all}
</style></head><body>
<h1>Referans ↔ bizimki</h1>
<p>${both.length} eşleşme · yalnız referansta ${onlyRef.length} · yalnız bizde ${onlyOurs.length}. Üreten: <code>cv ref compare</code>.</p>
<table><thead><tr><th>ad</th><th>referans</th><th>bizimki</th></tr></thead><tbody>
${rows}
</tbody></table>
<h2>Yalnız referansta</h2>${list(onlyRef)}
<h2>Yalnız bizde</h2>${list(onlyOurs)}
</body></html>
`;
    writeText(out, html);
    return { out, both: both.length, onlyRef: onlyRef.length, onlyOurs: onlyOurs.length };
}
