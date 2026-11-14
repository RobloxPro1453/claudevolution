// Best-effort, non-blocking owner notification when a project reaches BITTI (final form ready).
// Updates .evrim/otonom/OZET.md with the runnable output path and triggers an optional OS toast + bell.
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { readText, stamp, writeText } from "../lib/util.js";
import { autonomyDir } from "../lib/config.js";

function ozetPath(cfg) {
    if (!cfg || !cfg.root) return null;
    if (cfg.autonomy && cfg.autonomy.dir) return path.join(autonomyDir(cfg), "OZET.md");
    return path.join(cfg.root, ".evrim", "otonom", "OZET.md");
}

function updateOzet(file, { project, deliverablePath, message, criteria, now }) {
    const existing = readText(file, "# Özet (sahibi için; sade Türkçe, teknik terimsiz; en yeni üstte)\n\n## Şu an\n\n");
    const statusLine = `Tamamlandı — kullanıma hazır: ${deliverablePath}`;
    const bannerLines = [
        "## Tamamlandı (BITTI)",
        "",
        `- **Proje:** ${project}`,
        `- **Tarih:** ${stamp(now)}`,
        `- **Çalıştırma / çıktı konumu:** \`${deliverablePath}\``,
        `- **Durum:** ${message}`,
        ...(Array.isArray(criteria) && criteria.length ? [`- **Doğrulanan ölçütler:** ${criteria.join("; ")}`] : []),
    ];
    const banner = bannerLines.join("\n");

    // Strip any prior Tamamlandı (BITTI) block so repeated calls refresh rather than duplicate.
    let updated = existing.replace(/\n*## Tamamlandı \(BITTI\)\r?\n[\s\S]*?(?=\r?\n## |\r?\n<!--|$)/, "");
    if (/^##\s+Şu an\s*$/m.test(updated)) {
        updated = updated.replace(/(^##\s+Şu an\s*\r?\n)[\s\S]*?(?=\r?\n## |\r?\n<!--|$)/m, `$1\n${statusLine}\n\n${banner}\n`);
    } else {
        updated = `${updated.trimEnd()}\n\n## Şu an\n\n${statusLine}\n\n${banner}\n`;
    }
    writeText(file, updated);
    return true;
}

function dispatchToast({ title, message, platform, spawnFn }) {
    const env = { ...process.env, CV_NOTIFY_TITLE: title, CV_NOTIFY_MSG: message };
    const opts = { detached: true, stdio: "ignore", windowsHide: true, env };
    let child = null;
    let method = "bell";

    if (platform === "win32") {
        const psScript = [
            "try {",
            "  Add-Type -AssemblyName System.Windows.Forms;",
            "  $n = New-Object System.Windows.Forms.NotifyIcon;",
            "  $n.Icon = [System.Drawing.SystemIcons]::Information;",
            "  $n.BalloonTipTitle = $env:CV_NOTIFY_TITLE;",
            "  $n.BalloonTipText = $env:CV_NOTIFY_MSG;",
            "  $n.Visible = $true;",
            "  $n.ShowBalloonTip(8000);",
            "  Start-Sleep -Milliseconds 1500;",
            "  $n.Dispose()",
            "} catch {}"
        ].join(" ");
        child = spawnFn("powershell", ["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", psScript], opts);
        method = "powershell-balloon";
    } else if (platform === "darwin") {
        const script = 'display notification (system attribute "CV_NOTIFY_MSG") with title (system attribute "CV_NOTIFY_TITLE")';
        child = spawnFn("osascript", ["-e", script], opts);
        method = "osascript";
    } else {
        child = spawnFn("notify-send", [title, message], opts);
        method = "notify-send";
    }

    if (child) {
        if (typeof child.on === "function") child.on("error", () => {});
        if (typeof child.unref === "function") child.unref();
    }
    return method;
}

// Cross-platform, best-effort owner notification. Never throws when GUI/OS tools are absent.
export function notifyOwner(cfg, info = {}) {
    const now = info.now instanceof Date ? info.now : new Date(info.now || Date.now());
    const project = info.project || (cfg && cfg.project) || "proje";
    const deliverablePath = info.deliverablePath
        || (cfg && cfg.root && cfg.finalForm && cfg.finalForm.deliverable
            ? path.resolve(cfg.root, cfg.finalForm.deliverable)
            : (cfg && cfg.root) || ".");
    const title = info.title || `${project} hazır (BITTI)`;
    const message = info.message || `Proje tamamlandı. Çıktı konumu: ${deliverablePath}`;

    let ozetUpdated = false;
    const ozet = ozetPath(cfg);
    if (ozet && info.writeSummary !== false) {
        try {
            ozetUpdated = updateOzet(ozet, { project, deliverablePath, message, criteria: info.criteria, now });
        } catch { /* summary update must never break cycle exit */ }
    }

    const silent = Boolean(info.silent || process.env.CV_NO_NOTIFY === "1" || process.env.NODE_ENV === "test");
    let notified = false;
    let method = "silent";

    if (!silent) {
        try {
            if (process.stdout && process.stdout.isTTY) process.stdout.write("\x07");
        } catch { /* ignore bell errors */ }
        try {
            const spawnFn = typeof info.spawn === "function" ? info.spawn : spawn;
            method = dispatchToast({ title, message, platform: info.platform || process.platform, spawnFn });
            notified = true;
        } catch {
            notified = false;
            method = "unavailable";
        }
    }

    return { ok: true, ozetUpdated, ozetPath: ozet, notified, method, deliverablePath, title, message };
}
