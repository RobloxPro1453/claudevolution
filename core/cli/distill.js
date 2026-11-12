// cv distill [--mark]
// The helper output for the `damit` skill: new local lessons, universal candidates, the four selection
// measures, and evolution changes waiting for their verdict. --mark records that a distillation was done.
// It classifies nothing itself beyond the obvious hint; judgement belongs to the skill.
import path from "node:path";
import { lines, readJson, readText, writeJson } from "../lib/util.js";
import { PKG_ROOT, stateDir } from "../lib/config.js";
import { project } from "./_project.js";
import * as memory from "../autonomy/memory.js";
import { loadState, markDistilled } from "../autonomy/cycle.js";

const seenFile = (cfg) => path.join(stateDir(cfg), "distill.json");
const strip = (l) => l.replace(/^\s*-\s*/, "").replace(/\s*\[(evrensel|yerel)[^\]]*\]\s*$/i, "").trim();

// A lesson is a universal candidate if tagged so, or untagged and free of project-specific words.
export function classify(lesson, cfg) {
    if (/\[yerel\]/i.test(lesson)) return "yerel";
    if (/\[evrensel→taşındı\]/i.test(lesson)) return "taşındı";
    if (/\[evrensel\]/i.test(lesson)) return "aday";
    const local = [cfg.project, ...(cfg.codePaths || [])].filter(Boolean).map((s) => String(s).toLowerCase());
    const text = lesson.toLowerCase();
    return local.some((w) => text.includes(w)) || /[\w-]+\.(js|ts|py|rs|cpp|css|json|ps1)\b/.test(text) ? "yerel?" : "aday?";
}

export function measures(cfg) {
    const s = loadState(cfg);
    const rows = lines(readText(path.join(cfg.root, cfg.metrics.file), "")).filter(Boolean).map((l) => { try { return JSON.parse(l); } catch (_) { return null; } }).filter(Boolean).slice(-5);
    const sum = (f) => rows.reduce((a, r) => a + (f(r) || 0), 0);
    const quota = sum((r) => Math.max(0, (r.quotaEnd ?? 0) - (r.quotaStart ?? 0))), doneItems = sum((r) => r.delegate && r.delegate.endedDone);
    const tasks = sum((r) => r.delegate && r.delegate.tasks), first = sum((r) => r.delegate && r.delegate.firstTryDone);
    const r2 = (n) => Math.round(n * 100) / 100;
    return {
        "is-basina-kota": rows.length && doneItems ? r2(quota / doneItems) : null,      // weekly quota points per finished task (lower is better)
        "ilk-deneme-orani": tasks ? r2(first / tasks) : null,                            // cheap model done on first try (higher is better)
        "bosa-cevrim": s.total ? r2(s.wasted / s.total) : null,                           // share of cycles without a commit (lower is better)
        "sahip-itirazi": memory.notes(cfg).objections,                                    // owner objections in NOTLAR (lower is better)
        _basis: { rounds: rows.length, cycles: s.total }
    };
}

// Changelog lines still waiting for a verdict: "... · K=5 · sonuç: bekliyor".
export function pending(changelogText) {
    return lines(changelogText).filter((l) => /^\s*-\s/.test(l) && /sonuç:\s*bekliyor/i.test(l)).map((l) => l.trim());
}

export async function run(args) {
    const cfg = project(args);
    const all = memory.lessons(cfg);
    if (args.mark) {
        writeJson(seenFile(cfg), { at: new Date().toISOString(), seen: all.map(strip) });
        markDistilled(cfg);
        console.log(`İşaretlendi: ${all.length} ders görüldü sayıldı; damıtma sayacı sıfırlandı.`);
        return 0;
    }
    const seen = new Set((readJson(seenFile(cfg), { seen: [] }).seen || []));
    const fresh = all.filter((l) => !seen.has(strip(l)));
    const out = [`PAKET: ${PKG_ROOT}`, "", `YENI YEREL DERSLER (${fresh.length}; toplam ${all.length}/${cfg.evolution.lessonsMax}):`];
    for (const l of fresh) out.push(`  [${classify(l, cfg)}] ${strip(l)}`);
    if (!fresh.length) out.push("  (son damıtmadan beri yeni ders yok)");
    out.push("", "  aday = [evrensel] etiketli · aday? = etiketsiz, projeye özgü söz geçmiyor · yerel? = projeye özgü söz geçiyor; son kararı sen ver");
    const m = measures(cfg);
    out.push("", `OLCULER (son ${m._basis.rounds} tur, ${m._basis.cycles} çevrim; — = henüz veri yok):`);
    for (const k of ["is-basina-kota", "ilk-deneme-orani", "bosa-cevrim", "sahip-itirazi"]) out.push(`  ${k}: ${m[k] === null ? "—" : m[k]}`);
    const wait = pending(readText(path.join(PKG_ROOT, "evolution", "CHANGELOG.md"), ""));
    out.push("", `BEKLEYEN EVRIM DEGISIKLIKLERI (${wait.length}; K=${cfg.evolution.selectionK} çevrim sonra ölçülür, şu an ${loadState(cfg).total}. çevrim):`, ...(wait.length ? wait.map((l) => "  " + l) : ["  (yok)"]));
    console.log(out.join("\n"));
    return 0;
}
