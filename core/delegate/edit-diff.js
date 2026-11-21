// Fuzzy find-and-replace for the agent's edit_file tool.
// Adapted from OMK packages/coding-agent/src/core/tools/edit-diff.ts and edit-occurrences.ts
// (MIT; Copyright (c) 2025 Mario Zechner, (c) 2026 ClassicMate; see THIRD_PARTY_NOTICES.md).
//
// The cheap model copies old_text with small differences: trailing spaces, CRLF vs LF, smart quotes,
// Unicode dashes and spaces, a BOM. An exact-only match made it re-read the file and try again, steps and
// money for nothing. Here the exact match is tried first; then the text is looked up in a normalized copy
// of the file whose every character remembers where it came from, so the match is mapped back to the
// original and only that span is replaced: every other byte of the file stays exactly as it was.

export function detectLineEnding(text) {
    const crlf = text.indexOf("\r\n"), lf = text.indexOf("\n");
    return lf !== -1 && crlf !== -1 && crlf < lf ? "\r\n" : "\n";
}
export const normalizeToLF = (t) => String(t).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
export const restoreLineEndings = (t, ending) => (ending === "\r\n" ? t.replace(/\n/g, "\r\n") : t);
export function stripBom(text) { return text.startsWith("﻿") ? { bom: "﻿", text: text.slice(1) } : { bom: "", text }; }

const SMART_SINGLE = /[‘’‚‛]/, SMART_DOUBLE = /[“”„‟]/;
const UNI_DASH = /[‐‑‒–—―−]/, UNI_SPACE = /[  -   　]/;
const fold = (c) => (SMART_SINGLE.test(c) ? "'" : SMART_DOUBLE.test(c) ? '"' : UNI_DASH.test(c) ? "-" : UNI_SPACE.test(c) ? " " : c);

export function normalizeForFuzzyMatch(text) {
    return String(text).normalize("NFKC").split("\n").map((l) => l.trimEnd()).join("\n")
        .replace(/[‘’‚‛]/g, "'").replace(/[“”„‟]/g, '"')
        .replace(/[‐‑‒–—―−]/g, "-").replace(/[  -   　]/g, " ");
}

const COMBINING = /\p{M}/u;
function joinsPrevious(cp, prev) {
    if (prev === 0x0a) return false;
    if (COMBINING.test(String.fromCodePoint(cp))) return true;
    if (cp === 0xff9e || cp === 0xff9f) return true;
    if (cp >= 0x1160 && cp <= 0x11ff) return (prev >= 0x1100 && prev <= 0x11ff) || (prev >= 0xac00 && prev <= 0xd7a3);
    return false;
}

// The normalized text plus, for every code unit, the span of the original it came from.
export function buildNormalizedContentMap(text) {
    const nChars = [], nStarts = [], nEnds = [];
    let i = 0;
    while (i < text.length) {
        const first = text.codePointAt(i);
        let j = i + (first > 0xffff ? 2 : 1), prev = first;
        while (j < text.length) {
            const cp = text.codePointAt(j);
            if (!joinsPrevious(cp, prev)) break;
            j += cp > 0xffff ? 2 : 1;
            prev = cp;
        }
        const chunk = text.slice(i, j).normalize("NFKC");
        for (let k = 0; k < chunk.length; k++) { nChars.push(chunk[k]); nStarts.push(i); nEnds.push(j); }
        i = j;
    }
    const chars = [], startOffsets = [], endOffsets = [];
    let lineStart = 0;
    for (let k = 0; k <= nChars.length; k++) {
        if (k < nChars.length && nChars[k] !== "\n") continue;
        const keep = nChars.slice(lineStart, k).join("").trimEnd().length;
        for (let m = lineStart; m < lineStart + keep; m++) { chars.push(fold(nChars[m])); startOffsets.push(nStarts[m]); endOffsets.push(nEnds[m]); }
        if (k < nChars.length) { chars.push("\n"); startOffsets.push(nStarts[k]); endOffsets.push(nEnds[k]); }
        lineStart = k + 1;
    }
    return { normalized: chars.join(""), startOffsets, endOffsets, originalLength: text.length };
}

// Every start position, overlapping ones included ("aaa" is twice in "aaaa"; split() said once).
export function countOccurrences(haystack, needle) {
    if (!needle.length) return haystack.split(needle).length - 1;
    let n = 0;
    for (let at = haystack.indexOf(needle); at !== -1; at = haystack.indexOf(needle, at + 1)) n++;
    return n;
}

export function fuzzyFindText(content, oldText, map = null) {
    const exact = content.indexOf(oldText);
    if (exact !== -1) return { found: true, index: exact, matchLength: oldText.length, fuzzy: false, count: countOccurrences(content, oldText) };
    const m = map || buildNormalizedContentMap(content);
    const needle = normalizeForFuzzyMatch(oldText);
    const at = needle ? m.normalized.indexOf(needle) : -1;
    if (at === -1) return { found: false, index: -1, matchLength: 0, fuzzy: false, count: 0 };
    const start = at < m.startOffsets.length ? m.startOffsets[at] : m.originalLength;
    const end = m.endOffsets[at + needle.length - 1];
    return { found: true, index: start, matchLength: end - start, fuzzy: true, count: countOccurrences(m.normalized, needle) };
}

// The nearest line to the first line of old_text, so a failed edit says where to look (OMK spec 107 idea).
export function closestLine(content, oldText) {
    const want = normalizeForFuzzyMatch(String(oldText).split("\n").find((l) => l.trim()) || "").trim();
    if (!want) return null;
    const lines = content.split("\n");
    let best = null;
    for (let i = 0; i < lines.length; i++) {
        const have = normalizeForFuzzyMatch(lines[i]).trim();
        if (!have) continue;
        const score = similarity(want, have);
        if (!best || score > best.score) best = { line: i + 1, text: lines[i].trim().slice(0, 160), score };
    }
    return best && best.score >= 0.5 ? best : null;
}
function similarity(a, b) {
    if (a === b) return 1;
    const grams = (s) => { const g = new Map(); for (let i = 0; i < s.length - 1; i++) { const k = s.slice(i, i + 2); g.set(k, (g.get(k) || 0) + 1); } return g; };
    const A = grams(a), B = grams(b);
    let common = 0;
    for (const [k, n] of A) common += Math.min(n, B.get(k) || 0);
    return (2 * common) / Math.max(1, a.length - 1 + b.length - 1);
}

// One replacement in a whole file's text. Keeps the BOM and the file's line endings; throws a plain
// error the model can act on (not found + nearest line / not unique / no change).
export function applyEdit(fileText, oldText, newText, rel = "the file") {
    const { bom, text } = stripBom(String(fileText));
    const ending = detectLineEnding(text);
    const base = normalizeToLF(text), oldLF = normalizeToLF(oldText), newLF = normalizeToLF(newText);
    if (!oldLF.length) throw new Error(`old_text must not be empty in ${rel}.`);
    const hit = fuzzyFindText(base, oldLF);
    if (!hit.found) {
        const near = closestLine(base, oldLF);
        throw new Error(`old_text not found in ${rel}.${near ? ` The closest line is ${near.line}: "${near.text}". Read the lines around it and copy them exactly.` : " Read the file again and copy the exact text."}`);
    }
    if (hit.count > 1) throw new Error(`old_text found ${hit.count} times in ${rel}; it must be unique. Add surrounding lines to make it unique.`);
    const out = base.slice(0, hit.index) + newLF + base.slice(hit.index + hit.matchLength);
    if (out === base) throw new Error(`No change in ${rel}: the replacement is identical to the existing text.`);
    return { text: bom + restoreLineEndings(out, ending), fuzzy: hit.fuzzy };
}
