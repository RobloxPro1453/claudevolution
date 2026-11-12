// A universal lesson goes to the package the moment it is written, not at the next distillation
// (lessons used to sit in a project's DERSLER.md marked [evrensel] and never leave it).
// Flow: privacy + project-name check on the text → branch evrim/ders-<slug> → one line appended to
// evolution/universal/DERSLER.md (or HATALAR.md) → commit → evolve() (measure, privacy scan of the whole
// package, merge, version, CHANGELOG, push). The branch is deleted afterwards either way.
import path from "node:path";
import { appendText, exists, git, today, writeText } from "../lib/util.js";
import { evolve, childBench } from "./evolve.js";
import { scanText } from "./privacy.js";

const MAIN = "main";
const FILES = { ders: "evolution/universal/DERSLER.md", hata: "evolution/universal/HATALAR.md" };
const HEADERS = {
    ders: "# Evrensel dersler\n\n",
    hata: "# Evrensel hatalar (belirti → neden → çözüm)\n\n"
};

// ASCII slug for the branch name: "Test koşarken derleme" -> "test-kosarken-derleme".
export function slug(text) {
    const map = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", Ç: "c", Ğ: "g", İ: "i", Ö: "o", Ş: "s", Ü: "u" };
    const s = String(text).replace(/[çğıöşüÇĞİÖŞÜ]/g, (c) => map[c]).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return s.split("-").slice(0, 5).join("-").slice(0, 40).replace(/-+$/g, "") || "ders";
}

// Why a lesson cannot be universal as written (empty list = fine).
export function problems(text, { projectWords = [] } = {}) {
    const out = [];
    const t = String(text || "").trim();
    if (t.length < 15) out.push("ders çok kısa");
    for (const f of scanText(t)) out.push(`gizlilik: ${f.rule} (${f.match})`);
    const low = t.toLowerCase();
    for (const w of projectWords.filter(Boolean).map((x) => String(x).toLowerCase())) {
        if (w.length > 2 && low.includes(w)) out.push(`proje adı geçiyor ("${w}"): genelleştir, adı "proje" yap`);
    }
    return out;
}

// opts: { root (package), text, kind: "ders"|"hata", source (project label, no path), push, remote, bench, stamp }
export function promote({ root, text, kind = "ders", source = "", projectWords = [], push = true, remote = "origin", bench = childBench, stamp = Date.now() }) {
    if (!FILES[kind]) throw new Error(`tür "ders" ya da "hata" olmalı: ${kind}`);
    const bad = problems(text, { projectWords });
    if (bad.length) throw new Error("evrensel olamaz:\n  - " + bad.join("\n  - "));
    if (git(["rev-parse", "--abbrev-ref", "HEAD"], root).out !== MAIN) throw new Error(`paket ${MAIN} dalında değil; önce oraya geçin`);
    if (git(["status", "--porcelain"], root).out) throw new Error("paketin çalışma ağacı temiz değil; önce commit edin ya da geri alın");

    const branch = `evrim/ders-${slug(text)}-${String(stamp).slice(-6)}`;
    const co = git(["checkout", "-q", "-b", branch], root);
    if (!co.ok) throw new Error("aday dalı açılamadı: " + co.text);
    try {
        const file = path.join(root, FILES[kind]);
        if (!exists(file)) writeText(file, HEADERS[kind]);
        const origin = [source, today()].filter(Boolean).join(" ");
        const line = kind === "hata" ? `\n## ${String(text).trim().split(/\r?\n/)[0].slice(0, 80)}\n- ${String(text).trim()} (${origin})\n` : `- ${String(text).trim()} (${origin})\n`;
        appendText(file, line);
        git(["add", FILES[kind]], root);
        const c = git(["commit", "-qm", `evrim: ${kind}: ${String(text).trim().slice(0, 60)}`], root);
        if (!c.ok) throw new Error("commit edilemedi: " + c.text);
    } finally {
        git(["checkout", "-q", MAIN], root);
    }
    let r;
    try {
        r = evolve({ root, branch, why: `evrensel ${kind}: ${String(text).trim().slice(0, 80)}`, push, remote, bench });
    } finally {
        git(["branch", "-D", branch], root);
    }
    return { ...r, branch };
}
