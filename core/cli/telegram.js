// cv telegram setup --chat <id> [--token <t>] | test | poll [--every <saniye>] | done
// Owner notifications and the authorised remote control (core/autonomy/telegram.js). The token belongs in
// the CV_TELEGRAM_TOKEN environment variable; --token writes it only to the git-ignored .evrim/telegram.json.
import { readJson, writeJson } from "../lib/util.js";
import { project } from "./_project.js";
import { CONFIG_FILE, api, notifyDone, poll, settings } from "../autonomy/telegram.js";
import { checkFinalForm } from "../autonomy/office.js";

const statusText = (cfg) => () => { const f = checkFinalForm(cfg, null, { skipVerify: true }); return `${cfg.project}: ${f.done ? "BİTTİ" : "devam ediyor"} — ${f.reason}`; };

export async function run(args) {
    const cfg = project(args);
    const [sub] = args._;
    if (sub === "setup") {
        if (typeof args.chat !== "string" && typeof args.chat !== "number") throw new Error("kullanım: cv telegram setup --chat <sohbet kimliği> [--token <bot belirteci>]");
        const cur = readJson(CONFIG_FILE(cfg), {}) || {};
        writeJson(CONFIG_FILE(cfg), { ...cur, chatId: String(args.chat), ...(typeof args.token === "string" ? { token: args.token } : {}) });
        console.log("Kaydedildi (.evrim/telegram.json, git dışı). Belirteç için en iyisi ortam değişkeni: CV_TELEGRAM_TOKEN. Deneme: cv telegram test");
        return 0;
    }
    const s = settings(cfg);
    if (!s.ready) { console.log("Telegram ayarlı değil: cv telegram setup --chat <id>, belirteç CV_TELEGRAM_TOKEN ortam değişkeninde."); return 1; }
    if (sub === "test") { await api(s.token, "sendMessage", { chat_id: s.chatId, text: `${cfg.project}: claudevolution bağlantısı çalışıyor.` }); console.log("Gönderildi."); return 0; }
    if (sub === "done") { const f = checkFinalForm(cfg, null, { skipVerify: true }); if (!f.done) { console.log("Henüz bitmedi: " + f.reason); return 1; } const r = await notifyDone(cfg, { deliverablePath: f.deliverablePath, summary: f.reason }); console.log(r.sent ? "Haber verildi." : r.why); return 0; }
    if (sub === "poll") {
        const every = Number(args.every) || 0;
        for (;;) {
            const r = await poll(cfg, { statusText: statusText(cfg) });
            if (r.handled || r.ignored) console.log(`işlenen ${r.handled}, yetkisiz yok sayılan ${r.ignored}${r.actions && r.actions.length ? " · " + r.actions.join(", ") : ""}`);
            if (!every || (r.actions || []).includes("shutdown")) return 0;
            await new Promise((res) => setTimeout(res, every * 1000));
        }
    }
    console.log("Kullanım: cv telegram setup --chat <id> | test | poll [--every <saniye>] | done");
    return 1;
}

