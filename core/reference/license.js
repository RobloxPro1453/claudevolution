// What may be taken from a reference program (owner decision #11, "Q4-B"). Open source under a permissive
// licence: code and modules may be adapted, with a line in THIRD_PARTY_NOTICES.md. Copyleft (GPL family):
// only ideas, unless the owner's project is released under the same licence. No licence, closed source, or
// an installed program without its source: clean room — look only at screens, the accessibility tree and
// the flow; copy no code, no icons, no images (draw original SVG icons). Reads files only; runs nothing.
import fs from "node:fs";
import path from "node:path";
import { readJson, readText } from "../lib/util.js";

export const PERMISSIVE = ["MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC", "Zlib", "0BSD", "Unlicense", "BSL-1.0"];
// MPL-2.0 is copyleft per file (a changed MPL file must stay MPL): ideas only by default, like the others.
export const COPYLEFT = ["GPL-2.0", "GPL-3.0", "AGPL-3.0", "LGPL-2.1", "LGPL-3.0", "MPL-2.0"];

// Licence text -> SPDX id, by the phrases each licence text carries (first match wins; order matters).
const TEXT_RULES = [
    [/GNU AFFERO GENERAL PUBLIC LICENSE/i, "AGPL-3.0"],
    [/GNU LESSER GENERAL PUBLIC LICENSE[\s\S]{0,200}Version 3/i, "LGPL-3.0"],
    [/GNU LESSER GENERAL PUBLIC LICENSE|GNU LIBRARY GENERAL PUBLIC/i, "LGPL-2.1"],
    [/GNU GENERAL PUBLIC LICENSE[\s\S]{0,200}Version 3/i, "GPL-3.0"],
    [/GNU GENERAL PUBLIC LICENSE/i, "GPL-2.0"],
    [/Mozilla Public License,? (?:Version|v\.?) ?2\.0/i, "MPL-2.0"],
    [/Apache License,?\s+Version 2\.0/i, "Apache-2.0"],
    [/Permission is hereby granted, free of charge, to any person obtaining a copy/i, "MIT"],
    [/Redistribution and use in source and binary forms[\s\S]*Neither the name/i, "BSD-3-Clause"],
    [/Redistribution and use in source and binary forms/i, "BSD-2-Clause"],
    [/Permission to use, copy, modify, and\/or distribute this software for any purpose/i, "ISC"],
    [/This is free and unencumbered software released into the public domain/i, "Unlicense"],
    [/Boost Software License/i, "BSL-1.0"],
    [/This software is provided 'as-is', without any express or implied warranty/i, "Zlib"]
];
const LICENSE_FILE = /^(?:LICEN[CS]E|COPYING|UNLICENSE)(?:[-_.][\w.-]*)?$/i;

function normalizeSpdx(expr) {
    return String(expr).split(/\s+(?:OR|AND|WITH)\s+|\s*\/\s*|[()]/i).map((s) => s.trim()).filter(Boolean)
        .map((s) => s.replace(/-only$|-or-later$|\+$/i, "").replace(/^Apache-2$/i, "Apache-2.0").replace(/^GPL-?([23])$/i, "GPL-$1.0").replace(/^MIT\b.*$/i, "MIT"));
}

// { ids, source, mode: "adapt" | "ideas-only" | "clean-room", why }
export function detectLicense(dir) {
    const found = [], sources = [];
    const add = (ids, src) => { for (const id of ids) if (!found.includes(id)) found.push(id); sources.push(src); };
    const pkg = readJson(path.join(dir, "package.json"), null);
    if (pkg && typeof pkg.license === "string") add(normalizeSpdx(pkg.license), "package.json");
    const cargo = readText(path.join(dir, "Cargo.toml"), "");
    const cm = cargo.match(/^\s*license\s*=\s*"([^"]+)"/m);
    if (cm) add(normalizeSpdx(cm[1]), "Cargo.toml");
    let names = [];
    try { names = fs.readdirSync(dir).filter((f) => LICENSE_FILE.test(f)); } catch (_) { /* not a folder */ }
    for (const f of names) {
        const text = readText(path.join(dir, f), "").slice(0, 20000);
        const hit = TEXT_RULES.find(([re]) => re.test(text));
        if (hit) add([hit[1]], f);
    }
    if (!found.length) return { ids: [], source: null, mode: "clean-room", why: "lisans bulunamadı (kapalı kaynak sayılır): yalnız ekran, erişilebilirlik ağacı ve akış incelenir; kod, ikon, görsel kopyalanmaz, özgün SVG ikon çizilir" };
    // Dual licences ("MIT OR Apache-2.0") give the choice: one permissive option is enough.
    if (found.some((id) => PERMISSIVE.includes(id))) return { ids: found, source: sources.join(", "), mode: "adapt", why: `izin verici lisans (${found.join(" / ")}): kod uyarlanabilir, THIRD_PARTY_NOTICES.md'ye kaynak + telif satırı; marka/logo alınmaz` };
    if (found.some((id) => COPYLEFT.includes(id))) return { ids: found, source: sources.join(", "), mode: "ideas-only", why: `copyleft (${found.join(" / ")}): kod alınırsa projenin de aynı lisansla açılması gerekir; varsayılan yalnız fikir/davranış` };
    return { ids: found, source: sources.join(", "), mode: "clean-room", why: `tanınmayan lisans (${found.join(" / ")}): emin olunana kadar clean-room` };
}

// The rule for the brief, by the owner's choice: "birebir" keeps the layout, "benzer" derives an original
// design in the same design language. Icons are always drawn new unless the licence is permissive.
export function referenceRule(lic, likeness = "benzer") {
    const layout = likeness === "birebir" ? "Düzeni (pencere yerleşimi, menü sırası, kısayollar) birebir koru." : "Aynı tasarım dilinde özgün bir düzen türet; birebir kopya değil.";
    const assets = lic.mode === "adapt" ? "İkon ve görseller lisansına uygun alınabilir (atıfla)." : "İkon ve görsel kopyalanmaz: özgün SVG ikon çiz.";
    return `${lic.why}. ${layout} ${assets}`;
}
