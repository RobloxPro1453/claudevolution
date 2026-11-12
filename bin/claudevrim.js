// claudevrim: the one file an owner downloads (GitHub Releases, compiled with `deno compile`; it carries its
// own runtime, so no Node or Deno is needed). Self-contained on purpose: it may only use node: built-ins,
// because the package code it runs lives in ~/.claudevrim/paket and is updated from GitHub, not from here.
//
//   claudevrim            (double-click, first time) install: copy itself to ~/.claudevrim/bin, put that on
//                         the user PATH, fetch the package from GitHub, write the machine skill (cv setup)
//   claudevrim init       in a project folder: refresh the package from GitHub, then `cv init`
//   claudevrim guncelle   refresh the package; inside a project also `cv update --apply`
//   claudevrim gelistirici <clone>   developer machine: use this git clone, lessons go to the package
//   claudevrim <any cv command>      e.g. status, doctor, lesson
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const LAUNCHER = "1";
const REPO = "https://github.com/RobloxPro1453/claudevolution";
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

// Bring ~/.claudevrim/paket to the GitHub state. Never fatal: offline, the copy on disk is used.
async function sync(k) {
    const dir = pkgDir(k);
    if (k && k.gelistirici) return "geliştirici klonu: elle yönetilir";
    if (process.env.CLAUDEVRIM_OFFLINE) return "çevrimdışı (CLAUDEVRIM_OFFLINE)";
    if (fs.existsSync(path.join(dir, ".git"))) {
        const r = sh("git", ["-C", dir, "pull", "--ff-only", "-q"], { timeout: 120000 });
        return r.ok ? "GitHub'dan güncellendi" : "güncellenemedi, diskteki sürüm kullanılıyor (" + r.out.split("\n")[0] + ")";
    }
    const tmp = dir + ".yeni";
    fs.rmSync(tmp, { recursive: true, force: true });
    if (sh("git", ["--version"]).ok) {
        const r = sh("git", ["clone", "-q", "--depth", "1", REPO + ".git", tmp], { timeout: 300000 });
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

async function install(args) {
    fs.mkdirSync(BIN, { recursive: true });
    const self = process.execPath;
    if (path.resolve(self).toLowerCase() !== path.resolve(EXE).toLowerCase() && !/[\\/]deno(\.exe)?$/i.test(self)) fs.copyFileSync(self, EXE);
    const k = readKur() || {};
    if (!k.gelistirici) writeKur({ paket: path.join(HOME, "paket"), gelistirici: false });
    say("claudevrim kuruluyor → " + HOME);
    say("  paket: " + await sync(readKur()));
    say("  " + (args.includes("--no-path") ? "PATH'e dokunulmadı (--no-path)" : addToPath()));
    for (const [f, h] of [["DERSLER.md", "# Bu makinenin evrensel dersleri\n\nHer projede geçerli, bu makinede öğrenilmiş dersler (`cv lesson \"...\" --evrensel`). Her yeni projeye `.evrim/evrensel.md` ile gider.\n\n"], ["HATALAR.md", "# Bu makinenin evrensel hata kalıpları\n\n"]]) {
        const p = path.join(HOME, "evrensel", f);
        if (!fs.existsSync(p)) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, h); }
    }
    const code = await runCv(["setup"]);
    say("");
    say("Hazır. Yeni bir proje için: proje klasöründe terminal aç, `claudevrim init` yaz.");
    say("Sonra Claude uygulamasında o klasörü aç ve \"merhaba\" yaz; gerisini Claude sorar.");
    return code;
}

async function main(argv) {
    const [cmd, ...rest] = argv;
    const runningInstalled = path.resolve(process.execPath).toLowerCase() === path.resolve(EXE).toLowerCase();
    if (cmd === "kur" || cmd === "install" || (!cmd && !runningInstalled)) {
        const code = await install(rest);
        if (!cmd && isWin && process.stdin.isTTY) { say("\nKapatmak için Enter'a basın."); try { const b = new Uint8Array(8); await Deno.stdin.read(b); } catch (_) { /* not interactive */ } }
        return code;
    }
    if (!cmd || cmd === "help" || cmd === "-h" || cmd === "--help") {
        say(`claudevrim (başlatıcı ${LAUNCHER})\n\n  claudevrim init                 bu klasörü claudevolution projesi yap\n  claudevrim guncelle             paketi GitHub'dan güncelle (projede: cv update --apply)\n  claudevrim gelistirici <klon>   geliştirici makinesi: bu git klonunu kullan\n  claudevrim surum                sürümler\n  claudevrim <cv komutu>          ör. status, doctor, lesson\n`);
        return cmd ? 0 : 1;
    }
    if (cmd === "surum" || cmd === "version" || cmd === "--version") {
        const p = path.join(pkgDir(readKur()), "package.json");
        say(`başlatıcı ${LAUNCHER}, paket ${fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")).version : "yok"}`);
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
        say("paket: " + await sync(readKur()));
        await runCv(["setup"]);
        if (fs.existsSync(path.join(process.cwd(), ".evrim", "config.json"))) return await runCv(["update", "--apply"]);
        return 0;
    }
    if (cmd === "init" && !rest.includes("--no-sync")) say("paket: " + await sync(readKur()));
    return await runCv([cmd, ...rest]);
}

process.exit(await main(typeof Deno !== "undefined" ? Deno.args : process.argv.slice(2)));
