// What a non-technical owner's machine is missing to build the planned app, and how to install it with one
// approval (owner decision #19 "Q11-B"; K14: `cv doctor` itself stays read-only and fast). `cv doctor
// --install-deps` prints the plan and asks; only `--install-deps --yes` (the owner said yes) runs the
// installers, one by one, through winget on Windows. Nothing else on the system is changed.
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { exists, isWindows, run as sh } from "../lib/util.js";
import { hasCli } from "../delegate/choose.js";

const WEBVIEW2_KEY = "HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\EdgeUpdate\\Clients\\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}";

// { id, title, why, winget, args?, url } for each missing tool. `have(cmd)` and `webview2()` are injectable.
export function missing(root, cfg = {}, { have = (c) => hasCli(c).ok, webview2 = defaultWebView2, platform = process.platform } = {}) {
    const out = [];
    const rust = exists(path.join(root, "Cargo.toml")) || /rust/.test(String((cfg.stack) || "")) || (Array.isArray(cfg.build) && cfg.build[0] === "cargo");
    const tauri = /tauri/.test(fs.existsSync(path.join(root, "Cargo.toml")) ? fs.readFileSync(path.join(root, "Cargo.toml"), "utf8") : "") || exists(path.join(root, "src-tauri"));
    if (!have("git")) out.push({ id: "git", title: "Git", why: "işlerin geçmişi ve geri alma için (döngü, şeritler, evrim)", winget: "Git.Git", url: "https://git-scm.com/download/win" });
    if (rust && !have("cargo")) {
        out.push({ id: "rust", title: "Rust (rustup)", why: "uygulamayı derlemek için", winget: "Rustlang.Rustup", url: "https://rustup.rs" });
        if (platform === "win32") out.push({ id: "vs-build-tools", title: "Visual Studio C++ Derleme Araçları", why: "Rust'ın Windows'ta .exe bağlayabilmesi için (yalnız derleme araçları, Visual Studio uygulaması değil)", winget: "Microsoft.VisualStudio.2022.BuildTools", args: ["--override", "--quiet --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"], url: "https://visualstudio.microsoft.com/visual-cpp-build-tools/" });
    }
    if (tauri && platform === "win32" && !webview2()) out.push({ id: "webview2", title: "Microsoft Edge WebView2", why: "Tauri uygulamasının penceresi için (Windows 11'de çoğunlukla zaten var)", winget: "Microsoft.EdgeWebView2Runtime", url: "https://developer.microsoft.com/microsoft-edge/webview2/" });
    return out;
}

function defaultWebView2() {
    if (!isWindows) return true;
    return sh("reg", ["query", WEBVIEW2_KEY, "/v", "pv"], { timeoutMs: 15000 }).ok;
}

// The one question, in the owner's words.
export function plan(items) {
    if (!items.length) return "Eksik araç yok: her şey kurulu.";
    return [`Şunlar eksik (${items.length}), senin yerine kurayım mı?`, ...items.map((i, n) => `  ${n + 1}. ${i.title} — ${i.why}`), "", "Onay verirsen tek tek kurarım (winget, Microsoft'un kendi paket aracı); her biri birkaç dakika sürebilir ve Windows bir kez \"izin ver\" sorabilir.", "Onay: cv doctor --install-deps --yes   (istemezsen elle: " + items.map((i) => i.url).join(" , ") + ")"].join("\n");
}

// Runs the installers (only after the owner's yes). Returns [{ id, ok, code }].
export function install(items, { runner = sh } = {}) {
    if (!isWindows) return items.map((i) => ({ id: i.id, ok: false, code: null, note: `bu sistemde elle kurun: ${i.url}` }));
    if (!runner("winget", ["--version"], { timeoutMs: 30000 }).ok) return items.map((i) => ({ id: i.id, ok: false, code: null, note: `winget yok; elle kurun: ${i.url}` }));
    return items.map((i) => {
        const r = runner("winget", ["install", "--id", i.winget, "-e", "--silent", "--accept-package-agreements", "--accept-source-agreements", ...(i.args || [])], { timeoutMs: 45 * 60000 });
        return { id: i.id, ok: r.ok, code: r.code, note: r.ok ? "kuruldu" : r.text.trim().split(/\r?\n/).slice(-2).join(" ") };
    });
}
