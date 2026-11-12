// Privacy scan before anything leaves the machine: API-key shapes, e-mail addresses, personal home paths.
// Scans tracked files only (what a push would publish). Obvious test fakes are allowed.
import fs from "node:fs";
import path from "node:path";
import { git } from "../lib/util.js";

const RULES = [
    { id: "anahtar", re: /sk-[A-Za-z0-9]{20,}/g, allow: (m) => /^sk-abcdefghij/.test(m) },
    { id: "e-posta", re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g, allow: (m) => /@example\.(invalid|com|org)$/i.test(m) || /^no-?reply@/i.test(m) },
    { id: "kişisel yol", re: /(?:[A-Za-z]:[\\/]+Users[\\/]+|\/c\/Users\/|\/home\/|\/Users\/)([A-Za-z0-9][A-Za-z0-9._-]*)/g, allow: (m, user) => /^(public|default|shared)$/i.test(user) },
];

export function scanText(text) {
    const found = [];
    for (const r of RULES) {
        for (const m of text.matchAll(r.re)) if (!r.allow(m[0], m[1])) found.push({ rule: r.id, match: m[0] });
    }
    return found;
}

// Returns [{ file, line, rule, match }] for tracked files under root.
export function scan(root) {
    const ls = git(["ls-files", "-z"], root);
    if (!ls.ok) throw new Error("git ls-files başarısız: " + ls.text);
    const out = [];
    for (const rel of ls.out.split("\0").filter(Boolean)) {
        let text;
        try { text = fs.readFileSync(path.join(root, rel), "utf8"); } catch (_) { continue; }
        if (text.includes("\0")) continue; // binary
        text.split(/\r?\n/).forEach((l, i) => { for (const f of scanText(l)) out.push({ file: rel, line: i + 1, ...f }); });
    }
    return out;
}
