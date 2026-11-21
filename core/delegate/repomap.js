// A compact map of the project's code: files under config codePaths with their top-level symbols.
// Given to the scout and to `ask` (and printed by `cv delegate map` for the planner), so the cheap model
// starts from where things are instead of spending steps on list_files/search. Only files git tracks
// (ignored and build output never appear); no file is executed. Cached by HEAD + working-tree state.
import crypto from "node:crypto";
import path from "node:path";
import { git, readJson, readText, slash, writeJson } from "../lib/util.js";

const RULES = [
    { ext: /\.(?:m?js|cjs|jsx|ts|tsx)$/i, re: /^(?:export\s+(?:default\s+)?)?(?:async\s+)?(?:function\*?\s+([A-Za-z_$][\w$]*)|class\s+([A-Za-z_$][\w$]*)|(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\(|function|[A-Za-z_$][\w$]*\s*=>))/ },
    { ext: /\.rs$/i, re: /^\s{0,4}(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?(?:fn\s+(\w+)|struct\s+(\w+)|enum\s+(\w+)|trait\s+(\w+)|impl(?:<[^>]*>)?\s+(?:[\w:<>]+\s+for\s+)?([\w:]+))/ },
    { ext: /\.py$/i, re: /^(?:async\s+)?(?:def\s+(\w+)|class\s+(\w+))/ },
    { ext: /\.go$/i, re: /^(?:func\s+(?:\([^)]*\)\s*)?(\w+)|type\s+(\w+))/ },
    { ext: /\.(?:cs|java|kt)$/i, re: /^\s{0,8}(?:public|internal|private|protected)?\s*(?:static\s+|sealed\s+|abstract\s+|partial\s+)*(?:class|interface|enum|record|struct)\s+(\w+)/ }
];
const MAX_FILES = 400;

export function symbolsOf(rel, text) {
    const rule = RULES.find((r) => r.ext.test(rel));
    if (!rule) return [];
    const out = [];
    for (const line of String(text).split(/\r?\n/)) {
        const m = line.match(rule.re);
        if (!m) continue;
        const name = m.slice(1).find(Boolean);
        if (name && !out.includes(name)) out.push(name);
        if (out.length >= 24) break;
    }
    return out;
}

function trackedFiles(cfg) {
    const r = git(["ls-files", "-z"], cfg.root);
    if (!r.ok) return [];
    const roots = (cfg.codePaths || []).map((p) => slash(p).replace(/^\.\//, ""));
    return r.text.split("\0").map(slash).filter((f) => f && (!roots.length || roots.some((p) => f === p.replace(/\/$/, "") || f.startsWith(p.endsWith("/") ? p : p + "/"))));
}

// The map as text, at most maxChars (files beyond the cap are counted, never silently dropped).
export function repoMap(cfg, { maxChars = 6000, cache = true } = {}) {
    const head = git(["rev-parse", "HEAD"], cfg.root), status = git(["status", "--porcelain", "--", ...(cfg.codePaths || [])], cfg.root);
    const key = crypto.createHash("sha1").update(`${head.out}\0${status.out}\0${(cfg.codePaths || []).join(",")}\0${maxChars}`).digest("hex");
    const file = path.join(cfg.root, ".evrim", "state", "repomap.json");
    if (cache) { const c = readJson(file, null); if (c && c.key === key) return c.text; }
    const files = trackedFiles(cfg);
    const lines = [];
    let size = 0, shown = 0;
    for (const rel of files.slice(0, MAX_FILES)) {
        const syms = symbolsOf(rel, readText(path.join(cfg.root, rel), ""));
        const line = syms.length ? `${rel}: ${syms.join(", ")}` : rel;
        if (size + line.length + 1 > maxChars) break;
        lines.push(line); size += line.length + 1; shown++;
    }
    if (shown < files.length) lines.push(`... ${files.length - shown} more files not shown (search for them)`);
    const text = lines.join("\n");
    if (cache) { try { writeJson(file, { key, text }); } catch (_) { /* cache only */ } }
    return text;
}
