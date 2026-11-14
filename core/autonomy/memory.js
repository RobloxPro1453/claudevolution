// The autonomous memory files (.evrim/otonom): cheap, bounded reads.
//   DERSLER  read whole every cycle (<= lessonsMax lines)      GUNLUK  append-only, only the tail is read
//   HATALAR  only grepped when an error appears                 OZET    for the owner
//   NOTLAR   owner -> agent (unread notes, DUR, ÖNCE:)          SORULAR agent -> owner (answers picked up)
import path from "node:path";
import { appendText, lines, readText, tail } from "../lib/util.js";
import { autonomyDir, defaults, loadConfig } from "../lib/config.js";
import { keyOf, merged, projectLessons } from "../evolve/merge.js";

export const memFile = (cfg, name) => path.join(autonomyDir(cfg), name + ".md");
const stripComments = (text) => String(text).replace(/<!--[\s\S]*?-->/g, "");

// Lesson lines: "- ..." bullets outside comments.
export function lessons(cfg) {
    return lines(stripComments(readText(memFile(cfg, "DERSLER"), ""))).filter((l) => /^\s*-\s+\S/.test(l)).map((l) => l.trim());
}
export function journalTail(cfg) {
    // Entries start at the first "## " heading; the file's own instructions above it are not journal.
    const text = stripComments(readText(memFile(cfg, "GUNLUK"), ""));
    const at = text.search(/^##\s/m);
    if (at < 0) return "";
    return tail(lines(text.slice(at)).filter((l) => l.trim()).join("\n"), cfg.evolution.journalTailLines);
}
export function appendJournal(cfg, heading, bodyLines) {
    appendText(memFile(cfg, "GUNLUK"), `\n## ${heading}\n${bodyLines.filter(Boolean).join("\n")}\n`);
}

// Owner notes: everything under "## Notlar". A line that is exactly DUR stops the loop until it is removed.
export function notes(cfg) {
    const text = stripComments(readText(memFile(cfg, "NOTLAR"), ""));
    const at = text.search(/^##\s+Notlar\s*$/m);
    const body = lines(at < 0 ? "" : text.slice(at).replace(/^.*\r?\n/, "")).map((l) => l.trim()).filter(Boolean);
    const stop = lines(text).some((l) => /^\s*(-\s*)?DUR\s*$/.test(l));
    const unread = body.filter((l) => !/^(-\s*)?\[okundu/i.test(l) && !/^(-\s*)?DUR$/.test(l));
    return { stop, unread, first: unread.filter((l) => /^(-\s*)?ÖNCE:/i.test(l)), objections: body.filter((l) => /beğenme|begenme|yapma\b|istemiyorum|geri al|kötü|yanlış/i.test(l)).length };
}

// Open questions the owner has answered: a "### ..." block under "## Açık" whose **Cevap:** has text.
export function answered(cfg) {
    const text = stripComments(readText(memFile(cfg, "SORULAR"), ""));
    const open = (text.split(/^##\s+Açık\s*$/m)[1] || "").split(/^##\s+/m)[0];
    const out = [];
    for (const block of open.split(/^###\s+/m).slice(1)) {
        const m = block.match(/\*\*Cevap:\*\*\s*([\s\S]*)/);
        const answer = m ? m[1].replace(/\(sahibi buraya yazar\)/, "").trim() : "";
        if (answer) out.push({ question: lines(block)[0].trim(), answer: answer.slice(0, 400) });
    }
    return { answered: out, openCount: open.split(/^###\s+/m).length - 1 };
}

// First lines of OZET's "Şu an" section, for cv status.
export function summaryNow(cfg) {
    const text = stripComments(readText(memFile(cfg, "OZET"), ""));
    const m = text.split(/^##\s+Şu an\s*$/m)[1];
    return m ? lines(m.split(/^##\s+/m)[0]).map((l) => l.trim()).filter(Boolean).slice(0, 3).join(" ") : "";
}

const STOP_WORDS = new Set(["the", "and", "for", "with", "that", "this", "from", "into", "ve", "ile", "bir", "için", "olan", "gibi", "daha", "çok", "yok", "var", "her"]);

function tokenize(text) {
    const raw = String(text || "").toLowerCase().match(/[a-zçğıöşü0-9_./:-]{2,}/gi) || [];
    const tokens = [];
    for (const part of raw) {
        for (const sub of part.split(/[./:\\-]+/)) {
            const t = sub.replace(/^[:-]+|[:-]+$/g, "");
            if (t.length >= 2 && !STOP_WORDS.has(t)) tokens.push(t);
        }
    }
    return [...new Set(tokens)];
}

function readTaskSpec(cfg, task) {
    if (!task || typeof task !== "string") return "";
    const trimmed = task.trim();
    const candidates = [
        path.join(cfg.root, (cfg.tasks && cfg.tasks.dir) || "tarifler", trimmed.endsWith(".md") ? trimmed : `${trimmed}.md`),
        path.resolve(cfg.root, trimmed)
    ];
    for (const p of candidates) {
        const txt = readText(p, "");
        if (txt) return txt.slice(0, 4000);
    }
    return "";
}

// Selectively score and prime universal + machine + local lessons against task/files/keywords/errors.
export function primeLessons(rootOrCfg, { task = "", files = [], keywords = [], errors = [], limit = 12 } = {}) {
    const cfg = typeof rootOrCfg === "string"
        ? loadConfig(rootOrCfg)
        : (rootOrCfg && rootOrCfg.root ? rootOrCfg : defaults());
    const maxItems = Math.max(1, Number(limit) || 12);

    const fileList = [].concat(files || []).filter(Boolean).map(String);
    const kwList = [].concat(keywords || []).filter(Boolean).map(String);
    const errList = [].concat(errors || []).filter(Boolean).map(String);
    const taskStr = typeof task === "string" ? task.trim() : "";
    const specText = readTaskSpec(cfg, taskStr);

    const fileTerms = new Set();
    for (const f of fileList) {
        const norm = f.replace(/\\/g, "/").toLowerCase();
        fileTerms.add(norm);
        const base = path.posix.basename(norm);
        if (base) fileTerms.add(base);
        const stem = base.replace(/\.[^.]+$/, "");
        if (stem.length >= 2) fileTerms.add(stem);
    }
    const errTerms = new Set(errList.flatMap(tokenize));
    const queryTerms = new Set([
        ...tokenize(taskStr),
        ...tokenize(specText),
        ...kwList.flatMap(tokenize),
        ...fileList.flatMap(tokenize)
    ]);

    const candidates = [];
    const seen = new Set();
    const addCandidate = (line, source, baseBoost) => {
        const text = String(line || "").trim();
        if (!/^\s*-\s+\S/.test(text)) return;
        const k = keyOf(text);
        if (!k || seen.has(k)) return;
        seen.add(k);
        candidates.push({ text, source, baseBoost, order: candidates.length });
    };

    for (const l of lessons(cfg)) addCandidate(l, "local", 0.5);
    const errLines = lines(stripComments(readText(memFile(cfg, "HATALAR"), "")))
        .filter((l) => /^\s*-\s+\S/.test(l))
        .map((l) => l.trim());
    for (const l of errLines) addCandidate(l, "errors", 0.4);
    for (const l of projectLessons(cfg.root)) addCandidate(l, "project-universal", 0.8);

    try {
        const u = merged();
        for (const l of u.fromMachine || []) addCandidate(l, "machine", 0.7);
        for (const l of u.fromPkg || []) addCandidate(l, "universal", 0.6);
    } catch { /* universal package/machine stores are optional */ }

    const hasQuery = fileTerms.size > 0 || errTerms.size > 0 || queryTerms.size > 0;
    const scored = candidates.map((c) => {
        const lower = c.text.toLowerCase();
        const words = tokenize(c.text);
        const wordSet = new Set(words);
        const matched = [];
        let score = c.baseBoost;

        for (const ft of fileTerms) {
            if (lower.includes(ft)) {
                score += 10;
                matched.push(ft);
            }
        }
        for (const et of errTerms) {
            if (wordSet.has(et) || lower.includes(et)) {
                score += 6;
                if (!matched.includes(et)) matched.push(et);
            }
        }
        for (const qt of queryTerms) {
            if (wordSet.has(qt)) {
                score += 4;
                if (!matched.includes(qt)) matched.push(qt);
            } else if (qt.length >= 4 && (lower.includes(qt) || words.some((w) => w.length >= 4 && qt.startsWith(w.slice(0, 4)) && w.slice(0, 4) === qt.slice(0, 4)))) {
                score += 2;
                if (!matched.includes(qt)) matched.push(qt);
            }
        }
        if (/\b(KRİTİK|ASLA|MUST|NEVER|UYARI|ZORUNLU)\b/.test(c.text)) score += 2;
        if (hasQuery && matched.length === 0) score *= 0.25;

        const item = { text: c.text, source: c.source, score: Math.round(score * 100) / 100, matched };
        Object.defineProperty(item, "toString", { value() { return this.text; }, enumerable: false });
        return { item, order: c.order };
    });

    scored.sort((a, b) => (b.item.score - a.item.score) || (a.order - b.order));
    return scored.slice(0, maxItems).map((s) => s.item);
}
