// The autonomous memory files (.evrim/otonom): cheap, bounded reads.
//   DERSLER  read whole every cycle (<= lessonsMax lines)      GUNLUK  append-only, only the tail is read
//   HATALAR  only grepped when an error appears                 OZET    for the owner
//   NOTLAR   owner -> agent (unread notes, DUR, ÖNCE:)          SORULAR agent -> owner (answers picked up)
import path from "node:path";
import { appendText, lines, readText, tail } from "../lib/util.js";
import { autonomyDir } from "../lib/config.js";

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
