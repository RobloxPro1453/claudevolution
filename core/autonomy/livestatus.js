// .evrim/STATUS.md: what is happening now, in the owner's words, every number from the files the work leaves
// (lane records, blackboard, spend ledger, check rounds, API hand-off). It says why something waits: peak price
// hours (with the local time it starts; ERRATA E5: the lanes already wait, this only explains), the daily
// budget, an API hand-off. Rewritten by `cv watch`; never edited by hand (git-ignored).
import fs from "node:fs";
import path from "node:path";
import { pidAlive, readJson, writeText } from "../lib/util.js";
import { checkFinalForm } from "./office.js";
import { peakUntil, provider, spentToday, stateDir } from "../delegate/agent.js";
import { readHandoff } from "../delegate/choose.js";

const localTime = (d) => d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });

export function lanes(cfg) {
    const dir = path.join(stateDir(cfg), "lanes");
    let files = [];
    try { files = fs.readdirSync(dir).filter((f) => /^lane-\d+\.json$/.test(f)); } catch (_) { return []; }
    return files.map((f) => readJson(path.join(dir, f), null)).filter(Boolean).map((l) => ({ ...l, alive: l.state === "running" && pidAlive(l.pid) }));
}

export function statusDoc(cfg, { now = new Date(), lastRound = null, alive } = {}) {
    const out = [`# Durum — ${cfg.project}`, "", `Güncellendi: ${now.toLocaleString("tr-TR")} (her \`cv watch\` yeniden yazar; sayılar kayıtlardan)`, ""];
    const f = checkFinalForm(cfg, null, { skipVerify: true, lastRound: lastRound ? () => lastRound : undefined });
    out.push(f.done ? `**Bitti.** Çıktı: ${f.deliverablePath}` : `**Devam ediyor:** ${f.reason}.`, "");
    const ls = alive ? alive : lanes(cfg);
    const running = ls.filter((l) => l.alive);
    out.push("## Ucuz model şeritleri", "");
    if (!ls.length) out.push("- Şerit yok.");
    for (const l of ls) out.push(`- Şerit ${l.lane}: ${l.alive ? "çalışıyor" : "durdu"}${l.current ? `, şu an ${l.current}` : ""}${l.waiting ? ` (bekliyor: ${l.waiting})` : ""} · biten: ${(l.done || []).join(", ") || "yok"}`);
    out.push("", "## Bekliyorsa neden", "");
    const reasons = [];
    const p = provider(cfg);
    const peak = p && peakUntil(p, now);
    if (peak) reasons.push(`Yoğun (pahalı) saat: ucuz model ${localTime(peak)}'de (bu bilgisayarın saatiyle) başlar; o zamana kadar ağır işler bekler.`);
    const spent = spentToday(cfg, now), cap = cfg.delegate && cfg.delegate.dailyBudget;
    if (cap && spent >= cap) reasons.push(`Günlük ucuz model bütçesi doldu ($${spent.toFixed(2)} / $${cap}); yeni iş yarın başlar.`);
    const h = readHandoff(cfg, now);
    if (h) reasons.push(`API ${h.kind === "billing" ? "bakiyesi bitti" : "anahtarı reddedildi"}: kalan işleri ana model yapıyor (yükleyince: cv delegate api-ok).`);
    if (!running.length && !f.done && !reasons.length) reasons.push("Şu an çalışan şerit yok; sıradaki çevrim yeni paketi başlatır.");
    out.push(...(reasons.length ? reasons.map((r) => `- ${r}`) : ["- Beklemiyor."]));
    out.push("", `Bugünkü ucuz model harcaması: $${spent.toFixed(3)}${cap ? ` / $${cap}` : ""}`);
    if (lastRound) {
        out.push("", "## Son uygulama denetimi (cv check)", "", `Tur ${lastRound.round}: ${lastRound.passed ? "geçti" : "kaldı"}`);
        for (const r of lastRound.results || []) out.push(`- ${r.passed ? "✓" : "✗"} ${r.id}: ${r.note}`);
    }
    return out.join("\n") + "\n";
}

export function writeStatus(cfg, opts = {}) {
    const file = path.join(cfg.root, ".evrim", "STATUS.md");
    writeText(file, statusDoc(cfg, opts));
    return file;
}
