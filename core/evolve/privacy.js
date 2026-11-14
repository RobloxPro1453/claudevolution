// Privacy scan before anything leaves the machine: API-key shapes, e-mail addresses, personal home paths, sensitive files.
// Scans tracked files (when .git exists) or walks the folder safely (skipping .git, node_modules, refs, .evrim).
// Obvious test fakes are allowed.
import fs from "node:fs";
import path from "node:path";
import { SECRET_RES } from "../lib/config.js";
import { exists, git } from "../lib/util.js";

const BENCH_TRAP = ["sk", "live", "4f9a2b7c", "1d8e6f3a", "5b0c9d2e"].join("-");
export const allowFakeKey = (m) => /^sk-abcdefghij/.test(String(m || "")) || m === BENCH_TRAP;

const RULES = [
    ...SECRET_RES.map((r) => ({ id: "anahtar", re: new RegExp(r.source, r.flags.replace(/g/g, "") + "g"), allow: allowFakeKey })),
    { id: "e-posta", re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g, allow: (m) => /@example\.(invalid|com|org)$/i.test(m) || /^no-?reply@/i.test(m) },
    { id: "kişisel yol", re: /(?:[A-Za-z]:[\\/]+Users[\\/]+|\/c\/Users\/|\/home\/|\/Users\/)([A-Za-z0-9][A-Za-z0-9._-]*)/g, allow: (m, user) => /^(public|default|shared)$/i.test(user) },
];

const SENSITIVE_FILE_RES = [
    /(^|\/)\.env($|\.(?!example$|sample$|template$))/i,
    /(^|\/)\.envrc(?:\..*)?$/i,
    /(^|\/)\.(npmrc|netrc)$/i,
    /(^|\/)id_(?:rsa|ed25519|ecdsa|dsa)(?:\.pub)?$/i,
    /\.(pem|key|p12|pfx)$/i,
];
const SKIP_DIRS = new Set([".git", "node_modules", "refs", ".evrim"]);

export function isSensitiveFile(rel) {
    const clean = String(rel || "").replace(/\\/g, "/").replace(/^\/+/, "");
    return SENSITIVE_FILE_RES.some((r) => r.test(clean));
}

export function scanText(text) {
    const found = [];
    for (const r of RULES) {
        for (const m of text.matchAll(r.re)) if (!r.allow(m[0], m[1])) found.push({ rule: r.id, match: m[0] });
    }
    return found;
}

function walkFiles(dir, rel = "", out = []) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (e.isSymbolicLink()) continue;
        if (e.isDirectory()) {
            if (SKIP_DIRS.has(e.name)) continue;
            walkFiles(path.join(dir, e.name), rel ? rel + "/" + e.name : e.name, out);
        } else if (e.isFile()) {
            out.push(rel ? rel + "/" + e.name : e.name);
        }
    }
    return out;
}

export function scanFile(root, rel) {
    const filePath = rel === undefined ? root : path.join(root, rel);
    const clean = String(rel === undefined ? root : rel).replace(/\\/g, "/");
    const out = [];
    if (isSensitiveFile(clean)) out.push({ file: clean, line: 0, rule: "hassas dosya", match: clean });
    let text;
    try { text = fs.readFileSync(filePath, "utf8"); } catch (_) { return out; }
    if (text.includes("\0")) return out; // binary
    text.split(/\r?\n/).forEach((l, i) => {
        for (const f of scanText(l)) out.push({ file: clean, line: i + 1, ...f });
    });
    return out;
}

// Returns [{ file, line, rule, match }] for tracked files (or walked files when .git is absent) under root.
export function scan(root) {
    let files;
    if (exists(path.join(root, ".git"))) {
        const ls = git(["ls-files", "-z"], root);
        if (!ls.ok) throw new Error("git ls-files başarısız: " + ls.text);
        files = ls.out.split("\0").filter(Boolean);
    } else {
        files = walkFiles(root);
    }
    const out = [];
    for (const rel of files) out.push(...scanFile(root, rel));
    return out;
}
