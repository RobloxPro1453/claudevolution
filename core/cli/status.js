// cv status — everything the `durum` skill needs in one bounded output: git, round, lanes, quota,
// autonomy state, memory, open roadmap items, last progress entry, manual checks.
import path from "node:path";
import { git, lines, readText } from "../lib/util.js";
import { VERSION } from "../lib/config.js";
import { project } from "./_project.js";
import { describe } from "./lock.js";
import { lastQuota, loadState } from "../autonomy/cycle.js";
import * as memory from "../autonomy/memory.js";

const section = (text, heading) => {
    const m = text.split(new RegExp(`^##\\s+${heading}\\s*$`, "m"))[1];
    return m ? m.split(/^##\s+/m)[0].trim() : "";
};
const noComments = (t) => t.replace(/<!--[\s\S]*?-->/g, "");

export async function run(args) {
    const cfg = project(args);
    const root = cfg.root, out = [];
    const doc = (k) => noComments(readText(path.join(root, cfg.docs[k]), ""));
    out.push(`# ${cfg.project} · claudevolution ${readText(path.join(root, ".evrim", "version"), "?").trim()} (paket ${VERSION})`);

    const st = git(["status", "--short"], root), log = git(["log", "--oneline", "-5"], root);
    out.push("", "## Git", st.ok ? (st.out ? st.out.split(/\r?\n/).slice(0, 15).join("\n") : "temiz") : "git deposu değil", log.ok ? log.out : "(commit yok)");

    out.push("", "## Otonom", describe(cfg));
    const cs = loadState(cfg), q = lastQuota(cfg);
    out.push(`çevrim: ${cs.total} (commit'siz üst üste: ${cs.idleCycles}, boşa giden toplam: ${cs.wasted}, son damıtmadan beri: ${cs.sinceDistill})`);
    out.push(q ? `son bilinen kota: 5s %${q.five}, haftalık %${q.week} (${q.at.slice(0, 16)}Z)` : "son bilinen kota: yok");
    const n = memory.notes(cfg), a = memory.answered(cfg);
    out.push(`hafıza: ${memory.lessons(cfg).length}/${cfg.evolution.lessonsMax} ders · okunmamış not: ${n.unread.length} · açık soru: ${a.openCount} (cevaplanmış: ${a.answered.length})`);
    const now = memory.summaryNow(cfg);
    if (now) out.push("özet: " + now);

    try { const round = await import("../metrics/round.js"); out.push("", "## Turlar", round.show(cfg)); } catch (e) { out.push("", "## Turlar", "(ölçüm okunamadı: " + e.message + ")"); }
    try { const lanes = await import("../delegate/lanes.js"); out.push("", "## Ucuz model", lanes.statusText(cfg)); } catch (e) { out.push("", "## Ucuz model", "(durum okunamadı: " + e.message + ")"); }

    const open = lines(doc("roadmap")).filter((l) => /^\s*- \[ \]/.test(l));
    out.push("", `## Yol haritası: ${open.length} açık madde`, ...open.slice(0, 15).map((l) => l.trim()), ...(open.length > 15 ? [`… ${open.length - 15} madde daha`] : []));
    const progress = doc("progress").split(/^##\s+/m)[1];
    out.push("", "## Son kayıt", progress ? "## " + lines(progress.trim()).slice(0, 6).join("\n") : "(kayıt yok)");
    const manual = section(doc("checkup"), "Elle bakılacak");
    out.push("", "## Elle bakılacak", manual ? lines(manual).filter((l) => /^\s*- \[ \]/.test(l)).slice(0, 10).join("\n") || "(yok)" : "(yok)");
    console.log(out.join("\n"));
    return 0;
}
