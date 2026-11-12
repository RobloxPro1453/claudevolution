// cv doctor [--run] [--dir PATH]
// Checks what unattended work needs. Changes nothing; reports, and tells the owner in plain words what to do.
// --run also runs the build and test commands (bounded by buildMinutes / testMinutes).
import path from "node:path";
import process from "node:process";
import { exists, git, isWindows, readText, run as sh } from "../lib/util.js";
import { CONFIG_REL, VERSION, findRoot, loadConfig, validate, autonomyDir } from "../lib/config.js";

// powercfg output is localized; only GUIDs and hex values are stable. In a setting's block the last two
// hex values are the current AC and DC indexes.
export function powerSetting(text, guid) {
    const at = text.toLowerCase().indexOf(guid);
    if (at < 0) return null;
    const rest = text.slice(at + guid.length);
    const next = rest.search(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    const hex = (next < 0 ? rest : rest.slice(0, next)).match(/0x[0-9a-f]{8}/gi) || [];
    if (hex.length < 2) return null;
    return { ac: parseInt(hex[hex.length - 2], 16), dc: parseInt(hex[hex.length - 1], 16) };
}
const GUID = { sleep: "29f6c1db-86da-48c5-9fdb-f2b67b1f44da", hibernate: "9d7815a6-7ee4-497e-8888-515a05f02364", lid: "5ca83367-6e45-459f-a27b-476b1d01c936" };

function onPath(program) {
    if (/[\\/]/.test(program)) return exists(program);
    return sh(isWindows ? "where" : "which", [program], { timeoutMs: 15000 }).ok;
}

export function check(root, { runCommands = false } = {}) {
    const rows = [], todo = [];
    const ok = (t) => rows.push(["✓", t]), bad = (t, action) => { rows.push(["✗", t]); if (action) todo.push(action); }, info = (t, action) => { rows.push(["!", t]); if (action) todo.push(action); };

    // --- .evrim
    let cfg = null;
    if (!exists(path.join(root, CONFIG_REL))) bad(".evrim/config.json yok", "Proje klasöründe `cv init` çalıştırın.");
    else {
        try {
            cfg = loadConfig(root);
            const v = validate(cfg);
            if (v.errors.length) { for (const e of v.errors) bad("config: " + e); todo.push(".evrim/config.json içindeki hataları düzeltin (yukarıdaki ✗ satırları)."); }
            else ok("config.json geçerli");
            for (const w of v.warnings) info("config: " + w);
        } catch (e) { bad(e.message, ".evrim/config.json dosyasını düzeltin (geçerli JSON olmalı)."); }
    }
    if (cfg) {
        const missing = [];
        for (const f of ["DERSLER", "GUNLUK", "HATALAR", "OZET", "SORULAR", "NOTLAR"]) if (!exists(path.join(autonomyDir(cfg), f + ".md"))) missing.push(`${cfg.autonomy.dir}/${f}.md`);
        for (const k of ["agents", "vision", "progress", "roadmap", "checkup", "worker"]) if (!exists(path.join(root, cfg.docs[k]))) missing.push(cfg.docs[k]);
        for (const s of ["durum", "calis", "otonom", "damit"]) if (!exists(path.join(root, ".claude", "skills", s, "SKILL.md"))) missing.push(`.claude/skills/${s}/SKILL.md`);
        if (!exists(path.join(root, cfg.tasks.rules))) missing.push(cfg.tasks.rules);
        if (missing.length) bad("eksik dosyalar: " + missing.join(", "), "`cv init` yeniden çalıştırın; eksikleri tamamlar, var olana dokunmaz.");
        else ok(".evrim, belgeler ve beceriler tam");
        const ver = readText(path.join(root, ".evrim", "version"), "").trim();
        if (!ver) bad(".evrim/version yok", "`cv init` yeniden çalıştırın.");
        else if (ver !== VERSION) info(`proje sürümü ${ver}, paket ${VERSION}`, "`cv update` ile farkı görün.");
        else ok(`sürüm ${ver}`);
        if (/<[^>\n]{3,}>/.test(readText(path.join(root, cfg.docs.vision), "").replace(/<!--[\s\S]*?-->/g, ""))) info("VISION henüz doldurulmamış (şablon yer tutucuları duruyor)", "Claude'a \"vizyonu dolduralım\" yazın (cv-init becerisi).");
    }

    // --- git
    if (!git(["rev-parse", "--git-dir"], root).ok) bad("git deposu değil", "Proje klasöründe `git init` çalıştırın.");
    else {
        const dirty = git(["status", "--porcelain"], root);
        if (dirty.out) info(`git temiz değil (${dirty.out.split(/\r?\n/).length} değişiklik)`, "Gözetimsiz çalışmadan önce değişiklikleri commit edin ya da geri alın.");
        else ok("git temiz");
        if (!git(["rev-parse", "HEAD"], root).ok) info("henüz hiç commit yok", "İlk commit'i atın (şeritler ana daldan dal açar).");
    }

    // --- build / test
    if (cfg) {
        for (const [k, minutes] of [["build", cfg.buildMinutes], ["test", cfg.testMinutes]]) {
            const c = cfg[k];
            const label = k === "build" ? "derleme" : "test";
            if (!c) { info(`${label} komutu tanımlı değil`, `.evrim/config.json içine "${k}" komutunu yazın; yoksa ajan işini denetleyemez.`); continue; }
            if (!onPath(c[0])) { bad(`${label} komutunun programı bulunamadı: ${c[0]}`, `"${c[0]}" kurulu ve PATH'te olmalı, ya da .evrim/config.json içindeki "${k}" komutunu düzeltin.`); continue; }
            if (!runCommands) { ok(`${label} komutu: ${c.join(" ")} (çalıştırmak için: cv doctor --run)`); continue; }
            const r = sh(c[0], c.slice(1), { cwd: root, timeoutMs: minutes * 60000 });
            if (r.ok) ok(`${label} geçti`); else bad(`${label} ${r.timedOut ? `${minutes} dakikada bitmedi` : "başarısız (çıkış " + r.code + ")"}`, `${label} komutunu elle çalıştırıp hatayı görün: ${c.join(" ")}`);
        }
        const p = cfg.delegate.providers[cfg.delegate.provider];
        if (p && process.env[p.keyEnv]) ok(`ucuz model anahtarı ortamda var (${p.keyEnv})`);
        else if (p) info(`ucuz model anahtarı yok (${p.keyEnv})`, `Ucuz modele iş vermek için ${p.keyEnv} ortam değişkenini tanımlayın (Windows: Ayarlar > "ortam değişkenleri" araması > Kullanıcı değişkenleri > Yeni). Anahtarı hiçbir dosyaya yazmayın.`);
    }

    // --- machine
    if (isWindows) {
        const q = sh("powercfg", ["/q"], { timeoutMs: 30000 });
        if (!q.ok) info("güç ayarları okunamadı (powercfg)", "Uyku ve kapak ayarlarını elle denetleyin: Ayarlar > Sistem > Güç.");
        else {
            const sleep = powerSetting(q.text, GUID.sleep), hib = powerSetting(q.text, GUID.hibernate), lid = powerSetting(q.text, GUID.lid);
            if (!sleep) info("uyku ayarı bulunamadı", "Ayarlar > Sistem > Güç > Ekran ve uyku: \"prize takılıyken uyku\" = Hiçbir zaman.");
            else if (sleep.ac === 0) ok("prizdeyken uyku kapalı"); else bad(`prizdeyken ${Math.round(sleep.ac / 60)} dakika sonra uyuyor`, "Ayarlar > Sistem > Güç > Ekran ve uyku: \"Prize takılıyken cihazımı şu süreden sonra uyku moduna geçir\" = Hiçbir zaman. (Ekranın kararması sorun değil.)");
            if (hib && hib.ac !== 0) bad(`prizdeyken ${Math.round(hib.ac / 60)} dakika sonra hazırda bekletmeye geçiyor`, "Denetim Masası > Güç Seçenekleri > Plan ayarlarını değiştir > Gelişmiş > Uyku > Hazırda beklet: Hiçbir zaman.");
            else if (hib) ok("prizdeyken hazırda bekletme kapalı");
            if (!lid) info("kapak ayarı görünmüyor (masaüstü bilgisayarda olmaz)", "Dizüstüyse: Denetim Masası > Güç Seçenekleri > \"Kapağı kapatınca ne olacağını seçin\" > Prize takılı: Hiçbir şey yapma.");
            else if (lid.ac === 0) ok("kapak kapanınca (prizde) hiçbir şey yapma"); else bad("kapak kapanınca bilgisayar uyuyor ya da kapanıyor", "Denetim Masası > Güç Seçenekleri > \"Kapağı kapatınca ne olacağını seçin\" > Prize takılı: Hiçbir şey yapma. (Önceki durmanın sebebi buydu.)");
        }
        const bat = sh("powershell", ["-NoProfile", "-Command", "$b = Get-CimInstance Win32_Battery -ErrorAction SilentlyContinue; if ($b) { $b[0].BatteryStatus } else { 'none' }"], { timeoutMs: 30000 });
        const status = bat.out.trim();
        if (status === "none") ok("pil yok (masaüstü): güç kaynağı sorun değil");
        else if (status === "2" || status === "6" || status === "7" || status === "8" || status === "9" || status === "3") ok("prize takılı");
        else if (status === "1") bad("pilde çalışıyor", "Bilgisayarı prize takın; pil bitince döngü ölür.");
        else info("güç kaynağı okunamadı", "Bilgisayarın prize takılı olduğundan emin olun.");
        const wu = sh("reg", ["query", "HKLM\\SOFTWARE\\Microsoft\\WindowsUpdate\\UX\\Settings", "/v", "PauseUpdatesExpiryTime"], { timeoutMs: 15000 });
        const until = (wu.text.match(/(\d{4}-\d{2}-\d{2}T[\d:]+Z)/) || [])[1];
        if (until && new Date(until).getTime() > Date.now()) ok(`Windows Update ${until.slice(0, 10)} tarihine kadar duraklatılmış`);
        else info("Windows Update duraklatılmamış: gece yeniden başlatma döngüyü öldürebilir", "Ayarlar > Windows Update > \"Güncelleştirmeleri duraklat\" (gözetimsiz çalışma süresince).");
    } else info("güç/uyku ayarları bu işletim sisteminde otomatik denetlenmiyor", "Uykunun kapalı ve bilgisayarın prize takılı olduğunu elle denetleyin.");

    // --- cannot be checked from here
    todo.push("Claude uygulaması açık kalmalı ve izin modu \"Otomatik\" olmalı (izin penceresi döngüyü kilitler). İlk 10 dakika başında durun.");
    return { rows, todo, cfg };
}

export async function run(args) {
    const start = typeof args.dir === "string" ? path.resolve(args.dir) : process.cwd();
    const root = findRoot(start) || start;
    const r = check(root, { runCommands: !!args.run });
    console.log(`Denetim (${root}):`);
    for (const [mark, text] of r.rows) console.log(`  ${mark} ${text}`);
    console.log("\nYapmanız gerekenler:");
    r.todo.forEach((t, i) => console.log(`  ${i + 1}. ${t}`));
    console.log("\n(cv doctor hiçbir ayarı değiştirmez; yalnız bakar.)");
    return r.rows.some(([m, t]) => m === "✗" && t.startsWith("config")) ? 1 : 0;
}
