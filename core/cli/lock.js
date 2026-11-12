// cv lock status | acquire --session ID | release [--session ID] [--force]
import path from "node:path";
import { project } from "./_project.js";
import { autonomyDir } from "../lib/config.js";
import { acquire, lockInfo, release } from "../autonomy/lock.js";
import { lastQuota } from "../autonomy/cycle.js";
import { notes } from "../autonomy/memory.js";

// One plain sentence for the owner: working / sleeping / stopped.
export function describe(cfg, now = new Date()) {
    const info = lockInfo(path.join(autonomyDir(cfg), "lock"), cfg.autonomy.lockStaleMinutes, now);
    if (notes(cfg).stop) return "DURDU: NOTLAR.md'de DUR yazıyor; o satır silinene kadar çalışmaz.";
    if (info.held && !info.stale) return `ÇALIŞIYOR: bir çevrim ${info.ageMin} dakikadır sürüyor (oturum ${info.session}).`;
    if (info.held) return `ÖLMÜŞ OLABİLİR: kilit ${info.ageMin} dakikadır duruyor; sonraki tetik devralır (ya da: cv recover --fix).`;
    const q = lastQuota(cfg);
    if (!q) return "BEKLİYOR: şu an çevrim yok; henüz hiç çevrim kaydı da yok.";
    const ago = Math.round((now.getTime() - new Date(q.at).getTime()) / 60000);
    return `UYUYOR: şu an çevrim yok; son kota kaydı ${ago} dakika önce (5s %${q.five}, haftalık %${q.week}).` + (ago > 180 ? " 3 saatten uzun sessizlik: zamanlanmış görev açık mı, bilgisayar uyudu mu? (cv doctor)" : "");
}

export async function run(args) {
    const cfg = project(args);
    const file = path.join(autonomyDir(cfg), "lock");
    const sub = args._[0] || "status";
    const session = typeof args.session === "string" ? args.session : null;
    if (sub === "status") { console.log(describe(cfg)); return 0; }
    if (sub === "acquire") {
        if (!session) throw new Error("--session gerekli");
        const r = acquire(file, session, cfg.autonomy.lockStaleMinutes);
        console.log(r.ok ? (r.takenOver ? "ALINDI (bayat kilit devralındı)" : "ALINDI") : `MESGUL: oturum ${r.holder.session}, ${r.holder.ageMin} dakikadır`);
        return r.ok ? 0 : 2;
    }
    if (sub === "release") {
        const r = release(file, session, !!args.force || !session);
        console.log(r.ok ? "BIRAKILDI" : `BIRAKILMADI: kilit başka oturumda (${r.was}); zorlamak için --force`);
        return r.ok ? 0 : 2;
    }
    throw new Error("kullanım: cv lock status | acquire --session ID | release [--session ID] [--force]");
}
