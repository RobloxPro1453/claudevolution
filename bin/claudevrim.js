// claudevrim: the one file an owner downloads (GitHub Releases, compiled with `deno compile`; it carries its
// own runtime, so no Node or Deno is needed). Self-contained on purpose: it may only use node: built-ins,
// because the package code it runs lives in ~/.claudevrim/paket and is updated from GitHub, not from here.
//
//   claudevrim            (double-click, first time) install: copy itself to ~/.claudevrim/bin, put that on
//                         the user PATH, fetch the package from GitHub, write the machine skills (cv setup)
//   claudevrim init       in a project folder: refresh the package from GitHub, then `cv init`
//   claudevrim adopt      in an existing repo: refresh the package, then `cv adopt --apply` (unless --dry-run/--out)
//   claudevrim guncelle   refresh the package; inside a project also `cv update --apply`
//   claudevrim gelistirici <clone>   developer machine: use this git clone, lessons go to the package
//   claudevrim <any cv command>      e.g. status, doctor, lesson
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import readline from "node:readline";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const LAUNCHER = "1";
const BUNDLE_VERSION = "1.0.27";
const REPO = process.env.CLAUDEVRIM_REPO || "https://github.com/RobloxPro1453/claudevolution";
const isWin = process.platform === "win32";
const HOME = process.env.CLAUDEVRIM_HOME || path.join(process.env.USERPROFILE || process.env.HOME || os.homedir(), ".claudevrim");
const KUR = path.join(HOME, "kurulum.json");
const BIN = path.join(HOME, "bin");
const EXE = path.join(BIN, isWin ? "claudevrim.exe" : "claudevrim");

const readKur = () => { try { return JSON.parse(fs.readFileSync(KUR, "utf8")); } catch (_) { return null; } };
const writeKur = (k) => { fs.mkdirSync(HOME, { recursive: true }); fs.writeFileSync(KUR, JSON.stringify({ repo: REPO, ...k }, null, 2) + "\n"); };
const sh = (cmd, args, opts = {}) => { const r = spawnSync(cmd, args, { encoding: "utf8", windowsHide: true, ...opts }); return { ok: r.status === 0, out: ((r.stdout || "") + (r.stderr || "")).trim() }; };
const pkgDir = (k) => (k && k.paket) || path.join(HOME, "paket");
const say = (s) => console.log(s);

function parseSemver(v) {
    const m = String(v || "").trim().replace(/^v/i, "").match(/^(\d+)\.(\d+)\.(\d+)/);
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}
function compareSemver(a, b) {
    const pa = parseSemver(a), pb = parseSemver(b);
    if (!pa && !pb) return 0;
    if (!pa) return -1;
    if (!pb) return 1;
    for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] > pb[i] ? 1 : -1;
    return 0;
}
function readPkgVersion(dir) {
    if (!dir) return null;
    try {
        const v = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")).version;
        return parseSemver(v) ? String(v).trim() : null;
    } catch (_) { return null; }
}

// Bring ~/.claudevrim/paket to the GitHub state. Never fatal: offline, the copy on disk is used.
async function sync(k) {
    const dir = pkgDir(k);
    if (k && k.gelistirici) return "geliştirici klonu: elle yönetilir";
    if (process.env.CLAUDEVRIM_OFFLINE) return "çevrimdışı (CLAUDEVRIM_OFFLINE)";
    const isLocal = fs.existsSync(REPO);
    const cloneUrl = isLocal || REPO.endsWith(".git") ? REPO : REPO + ".git";
    if (fs.existsSync(path.join(dir, ".git"))) {
        const r = sh("git", ["-C", dir, "pull", "--ff-only", "-q"], { timeout: 120000 });
        if (r.ok) return "GitHub'dan güncellendi";
        const f = sh("git", ["-C", dir, "fetch", "origin", "main", "-q"], { timeout: 120000 });
        if (f.ok && sh("git", ["-C", dir, "reset", "--hard", "FETCH_HEAD", "-q"]).ok) return "GitHub'dan güncellendi (senkronize edildi)";
        return "güncellenemedi, diskteki sürüm kullanılıyor (" + r.out.split("\n")[0] + ")";
    }
    const tmp = dir + ".yeni";
    fs.rmSync(tmp, { recursive: true, force: true });
    if (sh("git", ["--version"]).ok) {
        const cloneArgs = isLocal ? ["clone", "-q", "-b", "main", cloneUrl, tmp] : ["clone", "-q", "-b", "main", "--depth", "1", cloneUrl, tmp];
        const r = sh("git", cloneArgs, { timeout: 300000 });
        if (!r.ok) return "indirilemedi: " + r.out.split("\n")[0];
    } else {
        // No git: the branch zip through tar (bsdtar ships with Windows 10+).
        const res = await fetch(REPO.replace("github.com", "codeload.github.com") + "/zip/refs/heads/main");
        if (!res.ok) return "indirilemedi: HTTP " + res.status;
        const zip = path.join(HOME, "paket.zip");
        fs.mkdirSync(tmp, { recursive: true });
        fs.writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
        const r = sh("tar", ["-xf", zip, "-C", tmp, "--strip-components", "1"]);
        fs.rmSync(zip, { force: true });
        if (!r.ok) return "açılamadı: " + r.out.split("\n")[0];
    }
    if (!fs.existsSync(path.join(tmp, "package.json"))) {
        fs.rmSync(tmp, { recursive: true, force: true });
        return "indirilemedi: paket eksik";
    }
    fs.rmSync(dir, { recursive: true, force: true });
    fs.renameSync(tmp, dir);
    return "GitHub'dan indirildi";
}

async function runCv(args) {
    const dir = pkgDir(readKur());
    const cli = path.join(dir, "bin", "cv.js");
    if (!fs.existsSync(cli)) { say("claudevrim kurulu değil ya da paket eksik. İndirdiğin claudevrim dosyasını bir kez çift tıklayıp çalıştır."); return 1; }
    const m = await import(pathToFileURL(cli).href);
    return await m.main(args);
}

function addToPath() {
    if (!isWin) return `PATH'e ekleyin: export PATH="${BIN}:$PATH" (kabuk profilinize)`;
    const get = sh("powershell", ["-NoProfile", "-Command", "[Environment]::GetEnvironmentVariable('Path','User')"]);
    const cur = get.ok ? get.out : "";
    if (cur.split(";").some((p) => p.replace(/\\+$/, "").toLowerCase() === BIN.toLowerCase())) return "PATH zaten tamam";
    const next = (cur ? cur.replace(/;+$/, "") + ";" : "") + BIN;
    const set = sh("powershell", ["-NoProfile", "-Command", `[Environment]::SetEnvironmentVariable('Path', $env:CV_NEWPATH, 'User')`], { env: { ...process.env, CV_NEWPATH: next } });
    return set.ok ? "PATH'e eklendi (yeni açılan terminallerde geçerli)" : "PATH'e eklenemedi: " + set.out;
}

function isStdinTty() {
    if (typeof Deno !== "undefined" && Deno.stdin && typeof Deno.stdin.isTerminal === "function") {
        try { return Deno.stdin.isTerminal(); } catch (_) { /* fall through */ }
    }
    return !!(process.stdin && process.stdin.isTTY);
}

async function waitForEnter() {
    if (!isStdinTty()) return;
    say("\nKapatmak için Enter'a basın.");
    try {
        if (typeof Deno !== "undefined" && Deno.stdin && typeof Deno.stdin.read === "function") {
            await Deno.stdin.read(new Uint8Array(64));
            return;
        }
        try {
            fs.readSync(0, Buffer.alloc(64), 0, 64, null);
        } catch (_) {
            await new Promise((resolve) => {
                const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
                rl.once("close", resolve);
                rl.question("", () => { rl.close(); resolve(); });
            });
        }
    } catch (_) { /* not interactive */ }
}

async function install(args) {
    fs.mkdirSync(BIN, { recursive: true });
    const k = readKur() || {};
    const beforeVer = readPkgVersion(pkgDir(k));
    const offline = !!process.env.CLAUDEVRIM_OFFLINE;

    say("claudevrim kuruluyor → " + HOME);
    say("  kurulu sürüm: " + (beforeVer ? "v" + beforeVer : "yok") + ` (bu yükleyici: v${BUNDLE_VERSION})`);

    const self = process.execPath;
    const shouldCopyExe = path.resolve(self).toLowerCase() !== path.resolve(EXE).toLowerCase() && !/[\\/](deno|node)(\.exe)?$/i.test(self);
    if (shouldCopyExe) {
        if (!fs.existsSync(EXE) || !beforeVer || compareSemver(BUNDLE_VERSION, beforeVer) >= 0) {
            fs.copyFileSync(self, EXE);
        } else {
            say(`  yürütülebilir dosya: kurulu sürüm (v${beforeVer}) daha güncel; üzerine yazılmadı`);
        }
    }

    let switchedFromDev = false;
    if (!k.gelistirici) {
        writeKur({ paket: path.join(HOME, "paket"), gelistirici: false });
    } else if ((!beforeVer || compareSemver(BUNDLE_VERSION, beforeVer) > 0) && !offline) {
        say(`  geliştirici klonu (v${beforeVer || "?"}) yeni sürümden (v${BUNDLE_VERSION}) eski → standart GitHub paketine geçiriliyor`);
        writeKur({ paket: path.join(HOME, "paket"), gelistirici: false });
        switchedFromDev = true;
    }

    let syncFailedRollback = false;
    const syncMsg = await sync(readKur());
    if (switchedFromDev && !readPkgVersion(pkgDir(readKur())) && beforeVer && fs.existsSync(path.join(k.paket || "", "bin", "cv.js"))) {
        writeKur(k);
        syncFailedRollback = true;
        say("  uyarı: yeni paket indirilemedi, önceki geliştirici klonu korundu");
    } else {
        say("  paket: " + syncMsg);
    }

    const afterVer = readPkgVersion(pkgDir(readKur())) || BUNDLE_VERSION;
    let versionMsg, bannerVersion;
    if (!beforeVer) {
        versionMsg = `ilk kurulum tamamlandı (v${afterVer})`;
        bannerVersion = `İlk kurulum: v${afterVer}`;
    } else if (compareSemver(afterVer, beforeVer) > 0) {
        versionMsg = `yeni sürüm kuruldu (v${beforeVer} → v${afterVer})`;
        bannerVersion = `Sürüm güncellendi: v${beforeVer} → v${afterVer}`;
    } else if (compareSemver(beforeVer, BUNDLE_VERSION) > 0 || compareSemver(beforeVer, afterVer) > 0) {
        const newerVer = compareSemver(beforeVer, afterVer) >= 0 ? beforeVer : afterVer;
        versionMsg = `kurulu sürüm (v${newerVer}) bu yükleyiciden (v${BUNDLE_VERSION}) zaten daha güncel; korundu`;
        bannerVersion = `Zaten güncel sürüm kurulu (v${newerVer})`;
    } else if (syncFailedRollback || (beforeVer && compareSemver(BUNDLE_VERSION, afterVer) > 0)) {
        versionMsg = `yeni sürüm (v${BUNDLE_VERSION}) indirilemedi; kurulu sürüm (v${afterVer}) korundu`;
        bannerVersion = `Kurulu sürüm korundu (v${afterVer})`;
    } else {
        versionMsg = `zaten en güncel sürüm kurulu (v${afterVer})`;
        bannerVersion = `Zaten güncel sürüm kurulu (v${afterVer})`;
    }
    say("  sürüm durumu: " + versionMsg);
    say("  " + (args.includes("--no-path") ? "PATH'e dokunulmadı (--no-path)" : addToPath()));
    for (const [f, h] of [["DERSLER.md", "# Bu makinenin evrensel dersleri\n\nHer projede geçerli, bu makinede öğrenilmiş dersler (`cv lesson \"...\" --evrensel`). Her yeni projeye `.evrim/evrensel.md` ile gider.\n\n"], ["HATALAR.md", "# Bu makinenin evrensel hata kalıpları\n\n"]]) {
        const p = path.join(HOME, "evrensel", f);
        if (!fs.existsSync(p)) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, h); }
    }
    const code = await runCv(["setup"]);
    if (code === 0) {
        const line1 = "✓ Her şey tamamlandı, başlamaya hazırsınız!";
        const line2 = bannerVersion;
        const w = Math.max(line1.length, line2.length) + 4;
        const bar = "═".repeat(w);
        const pad = (s) => "  " + s + " ".repeat(w - s.length - 2);
        say("");
        say(`╔${bar}╗`);
        say(`║${pad(line1)}║`);
        say(`║${pad(line2)}║`);
        say(`╚${bar}╝`);
        say("");
        say("Yeni proje için: proje klasöründe terminal açıp `claudevrim init` yazın.");
        say("Var olan proje için: proje klasöründe `claudevrim adopt` yazın.");
        say("Sonra Claude, Codex veya Antigravity uygulamasında o klasörü açıp \"merhaba\" yazın; gerisini sistem sorar.");
    } else {
        say("");
        say(`! Kurulum tamamlanamadı (çıkış ${code}); yukarıdaki adımı kontrol edin.`);
    }
    return code;
}

async function main(argv) {
    const [cmd, ...rest] = argv;
    const runningInstalled = path.resolve(process.execPath).toLowerCase() === path.resolve(EXE).toLowerCase();
    if (cmd === "kur" || cmd === "install" || (!cmd && !runningInstalled)) {
        const code = await install(rest);
        if (!cmd && isWin) await waitForEnter();
        return code;
    }
    if (!cmd || cmd === "help" || cmd === "-h" || cmd === "--help") {
        say(`claudevrim (başlatıcı ${LAUNCHER}, sürüm v${BUNDLE_VERSION})\n\n  claudevrim init                 bu klasörü claudevolution projesi yap\n  claudevrim adopt                var olan projeyi claudevolution'a geçir (--apply varsayılan)\n  claudevrim kur                  sürüm denetimi yap ve kur/güncelle\n  claudevrim guncelle             paketi GitHub'dan güncelle (projede: cv update --apply)\n  claudevrim gelistirici <klon>   geliştirici makinesi: bu git klonunu kullan\n  claudevrim surum                sürümler\n  claudevrim <cv komutu>          ör. status, doctor, lesson\n`);
        return cmd ? 0 : 1;
    }
    if (cmd === "surum" || cmd === "version" || cmd === "--version") {
        const ver = readPkgVersion(pkgDir(readKur()));
        say(`başlatıcı ${LAUNCHER} (v${BUNDLE_VERSION}), paket ${ver || "yok"}`);
        return 0;
    }
    if (cmd === "gelistirici") {
        const clone = path.resolve(rest[0] || "");
        if (!fs.existsSync(path.join(clone, "bin", "cv.js"))) { say("kullanım: claudevrim gelistirici <claudevolution git klonunun yolu>"); return 1; }
        writeKur({ paket: clone, gelistirici: true });
        say("geliştirici makinesi: paket = " + clone + " (evrensel dersler pakete gider)");
        return await runCv(["setup"]);
    }
    if (cmd === "guncelle" || cmd === "update-paket") {
        const k = readKur();
        const beforeVer = readPkgVersion(pkgDir(k));
        say("paket: " + await sync(k));
        const afterVer = readPkgVersion(pkgDir(readKur())) || BUNDLE_VERSION;
        if (!beforeVer) say(`sürüm: kuruldu (v${afterVer})`);
        else if (compareSemver(afterVer, beforeVer) > 0) say(`sürüm: yeni sürüm kuruldu (v${beforeVer} → v${afterVer})`);
        else say(`sürüm: zaten güncel sürüm kurulu (v${afterVer})`);
        await runCv(["setup"]);
        if (fs.existsSync(path.join(process.cwd(), ".evrim", "config.json"))) return await runCv(["update", "--apply"]);
        return 0;
    }
    if (cmd === "adopt") {
        if (!rest.includes("--no-sync")) say("paket: " + await sync(readKur()));
        const cleanRest = rest.filter((a) => a !== "--no-sync");
        const hasMode = cleanRest.some((a) => a === "--dry-run" || a === "--apply" || a === "--out" || a.startsWith("--out=") || a === "-h" || a === "--help");
        return await runCv(["adopt", ...(hasMode ? cleanRest : [...cleanRest, "--apply"])]);
    }
    if (cmd === "init" && !rest.includes("--no-sync")) say("paket: " + await sync(readKur()));
    return await runCv([cmd, ...rest]);
}

process.exit(await main(typeof Deno !== "undefined" ? Deno.args : process.argv.slice(2)));
