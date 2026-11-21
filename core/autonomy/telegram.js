// Telegram for the owner (decision #18 "Q10-B"): no messages in the middle of the night; one message when the
// work is really finished (BITTI: roadmap done, the .exe there, cv check passed). Replies come only from the one
// authorised chat: "durum" (status), "yeni: <iş>" (a new job, written to NOTLAR.md as ÖNCE:), "kapat" (asks
// for a one-time code; "kapat <kod>" within 10 minutes shuts the computer down after 2 minutes, which lets
// programs save). Standard library only (fetch). The bot token comes from CV_TELEGRAM_TOKEN or the git-ignored
// .evrim/telegram.json, never a tracked file; the chat id lives there too. Nothing is sent in tests.
import crypto from "node:crypto";
import path from "node:path";
import process from "node:process";
import { appendText, readJson, readText, run, writeJson } from "../lib/util.js";
import { redact } from "../lib/process.js";

export const CONFIG_FILE = (cfg) => path.join(cfg.root, ".evrim", "telegram.json");
const STATE_FILE = (cfg) => path.join(cfg.root, ".evrim", "state", "telegram.json");
const CODE_MINUTES = 10;

export function settings(cfg, env = process.env) {
    const f = readJson(CONFIG_FILE(cfg), {}) || {};
    const token = env.CV_TELEGRAM_TOKEN || f.token || null;
    const chatId = f.chatId != null ? String(f.chatId) : env.CV_TELEGRAM_CHAT || null;
    return { token, chatId, ready: !!(token && chatId) };
}

export async function api(token, method, body, { fetch: f = fetch } = {}) {
    const res = await f(`https://api.telegram.org/bot${token}/${method}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({ ok: false }));
    if (!data.ok) throw new Error(`Telegram ${method} başarısız: ${redact(JSON.stringify(data).slice(0, 200))}`);
    return data.result;
}

const send = (s, text, opts) => api(s.token, "sendMessage", { chat_id: s.chatId, text: redact(text) }, opts);

// The one "it is ready" message, sent once per finished deliverable (state remembers which).
export async function notifyDone(cfg, { deliverablePath, summary = "" } = {}, opts = {}) {
    const s = settings(cfg, opts.env);
    if (!s.ready) return { sent: false, why: "Telegram ayarlı değil" };
    const st = readJson(STATE_FILE(cfg), {}) || {};
    const key = `${deliverablePath || ""}`;
    if (st.doneFor === key && !opts.force) return { sent: false, why: "bu teslim için zaten haber verildi" };
    await send(s, `${cfg.project} hazır ✓\nÇıktı: ${deliverablePath || cfg.root}\n${summary ? summary + "\n" : ""}\nYanıtla: "durum" · "yeni: <iş>" · "kapat"`, opts);
    writeJson(STATE_FILE(cfg), { ...st, doneFor: key, doneAt: new Date().toISOString() });
    return { sent: true };
}

// One answer for one message text from the authorised chat. { reply, action }.
export function handle(cfg, text, { now = new Date(), statusText = () => "durum okunamadı" } = {}) {
    const t = String(text || "").trim();
    const st = readJson(STATE_FILE(cfg), {}) || {};
    if (/^durum$/i.test(t)) return { reply: statusText(), action: "status" };
    const job = t.match(/^yeni\s*:\s*(.+)$/is);
    if (job) {
        const notes = path.join(cfg.root, (cfg.autonomy && cfg.autonomy.dir) || ".evrim/otonom", "NOTLAR.md");
        if (!/^##\s+Notlar\s*$/m.test(readText(notes, ""))) appendText(notes, "\n## Notlar\n");
        appendText(notes, `- ÖNCE: ${job[1].trim().replace(/\s+/g, " ")}\n`);
        return { reply: "Eklendi: bir sonraki çevrimde ilk iş bu.", action: "job" };
    }
    const off = t.match(/^kapat(?:\s+(\d{4}))?$/i);
    if (off && !off[1]) {
        const code = String(crypto.randomInt(1000, 10000));
        writeJson(STATE_FILE(cfg), { ...st, shutdownCode: code, codeAt: now.toISOString() });
        return { reply: `Bilgisayarı kapatmak için ${CODE_MINUTES} dakika içinde "kapat ${code}" yaz. Kapanış 2 dakika sonra olur; açık programlar kaydetme fırsatı bulur.`, action: "ask-code" };
    }
    if (off && off[1]) {
        const fresh = st.shutdownCode && now.getTime() - Date.parse(st.codeAt || 0) < CODE_MINUTES * 60000;
        if (!fresh || off[1] !== st.shutdownCode) return { reply: "Kod geçersiz ya da süresi doldu: yeniden \"kapat\" yaz.", action: "bad-code" };
        writeJson(STATE_FILE(cfg), { ...st, shutdownCode: null, codeAt: null });
        return { reply: "Tamam: bilgisayar 2 dakika içinde kapanıyor.", action: "shutdown" };
    }
    return { reply: "Anlamadım. Yazabileceklerin: durum · yeni: <iş> · kapat", action: "help" };
}

// Shuts the machine down after 120 s (Windows: shutdown /s /t 120; others: shutdown -h +2). Injectable.
export function shutdown({ exec = run, platform = process.platform } = {}) {
    return platform === "win32" ? exec("shutdown", ["/s", "/t", "120", "/c", "claudevolution: sahibin isteği (Telegram)"]) : exec("shutdown", ["-h", "+2"]);
}

// Reads new messages once; answers only the authorised chat; others are counted and ignored.
export async function poll(cfg, opts = {}) {
    const s = settings(cfg, opts.env);
    if (!s.ready) return { handled: 0, ignored: 0, why: "Telegram ayarlı değil" };
    const st = readJson(STATE_FILE(cfg), {}) || {};
    const updates = await api(s.token, "getUpdates", { offset: (st.offset || 0) + 1, timeout: 0 }, opts);
    let handled = 0, ignored = 0, offset = st.offset || 0;
    const actions = [];
    for (const u of updates || []) {
        offset = Math.max(offset, u.update_id);
        const m = u.message || u.edited_message;
        if (!m || String(m.chat && m.chat.id) !== s.chatId) { ignored++; continue; }
        writeJson(STATE_FILE(cfg), { ...(readJson(STATE_FILE(cfg), {}) || {}), offset });
        const r = handle(cfg, m.text, opts);
        await send(s, r.reply, opts);
        actions.push(r.action);
        handled++;
        if (r.action === "shutdown") (opts.shutdown || shutdown)(opts);
    }
    writeJson(STATE_FILE(cfg), { ...(readJson(STATE_FILE(cfg), {}) || {}), offset });
    return { handled, ignored, actions };
}
