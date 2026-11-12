// cv adopt [--dir PATH] [--dry-run] [--out FILE] [--apply]
// Reads an existing hand-grown setup (rules, docs, workflow config, cheap-model scripts, skills, autonomy memory)
// and maps every piece onto the claudevolution layout.
//   --dry-run   print the plan, write nothing in the project
//   (default)   write the plan to .evrim/adopt-plan.md
//   --apply     write the plan, then: cv init (never overwrites), the mapped .evrim/config.json, copies of memory,
//               metrics and cheap-model records. Nothing is moved or deleted; old scripts keep working.
// The scan only looks at known places (no recursive walk): product code, vendored and third-party folders are
// listed by name and never read.
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { exists, git, readJson, readText, writeJson, writeText } from "../lib/util.js";
import { CONFIG_REL, defaults } from "../lib/config.js";
import { init, place } from "./init.js";

const ls = (dir) => { try { return fs.readdirSync(dir, { withFileTypes: true }).map((e) => ({ name: e.name, dir: e.isDirectory() })); } catch (_) { return []; } };
const LEGACY_CONFIGS = ["docs/workflow/config.json", "workflow/config.json", ".workflow/config.json"];
const STD_DOCS = ["VISION", "PROGRESS", "ROADMAP", "CHECKUP", "KNOWLEDGE", "ARCHITECTURE", "DEVELOPMENT", "WORKER"];
const MEMORY = ["DERSLER", "GUNLUK", "HATALAR", "OZET", "SORULAR", "NOTLAR"];
// Folders that are never read: dependencies, build output, third-party material.
const NEVER_READ = /^(\.git|node_modules|vendor|dist|target|original|.*-readable|\.tools)$/i;

export function findLegacyConfig(root) {
    for (const rel of LEGACY_CONFIGS) if (exists(path.join(root, rel))) return { rel, cfg: readJson(path.join(root, rel), null) };
    return null;
}

// Old flat workflow config → .evrim/config.json. Machine-specific paths are dropped (derived again on each machine).
export function mapConfig(legacy, root) {
    const cfg = defaults(), notes = [];
    const set = (key, value, why) => { if (value !== undefined && value !== null) notes.push({ key, why }); return value; };
    const L = legacy || {};
    cfg.project = L.project || path.basename(root);
    const head = git(["symbolic-ref", "--short", "HEAD"], root);
    cfg.baseBranch = L.baseBranch || (head.ok && head.out) || cfg.baseBranch;
    if (Array.isArray(L.build)) cfg.build = set("build", L.build, "derleme komutu aynen");
    if (Array.isArray(L.test)) cfg.test = set("test", L.test, "test komutu aynen");
    if (L.testMinutes) cfg.testMinutes = set("testMinutes", L.testMinutes, "süre sınırı aynen");
    if (Array.isArray(L.codePaths)) cfg.codePaths = set("codePaths", L.codePaths, "ölçümde kod sayılan klasörler aynen");
    if (Array.isArray(L.forbiddenWrite)) {
        // The project's own list stays as written; the package's core paths are added (they are also enforced in code).
        const extra = ["^\\.evrim/", "^\\.claude/"].filter((p) => !L.forbiddenWrite.includes(p));
        cfg.forbiddenWrite = set("forbiddenWrite", [...L.forbiddenWrite, ...extra], `projenin listesi aynen${extra.length ? " + " + extra.join(", ") : ""}`);
    }
    if (L.skipDirs) cfg.skipDirs = set("skipDirs", L.skipDirs, "aynen");
    if (L.tasksDir) cfg.tasks.dir = set("tasks.dir", L.tasksDir, "tarif klasörü aynen");
    if (L.agentRules) cfg.tasks.rules = set("tasks.rules", L.agentRules, "ajan kuralları aynen");
    if (L.taskPattern) {
        cfg.tasks.pattern = set("tasks.pattern", L.taskPattern, "tarif adı kalıbı aynen");
        const m = String(L.taskPattern).match(/^\^?([A-Za-z]+)-/);
        if (m) cfg.tasks.prefix = set("tasks.prefix", m[1], "kalıptan çıkarıldı");
    }
    if (L.agentIntro) cfg.delegate.intro = set("delegate.intro", L.agentIntro, "ajanın tanıtım cümlesi aynen");
    if (L.worktree) cfg.delegate.worktreeRoot = set("delegate.worktreeRoot", "~/" + path.basename(path.dirname(path.resolve(root, L.worktree))) + "/{project}", "eski göreli yol ev klasörüne göre yazıldı (makineye özgü değil)");
    if (L.agentCommitTrailer) cfg.delegate.commitTrailer = set("delegate.commitTrailer", `Co-Authored-By: ${L.agentCommitTrailer} <noreply@${String(L.agentCommitTrailer).toLowerCase().replace(/[^a-z0-9]/g, "")}.com>`, "eski commit'ler ölçümde ucuz modelin sayılsın diye aynı imza");
    if (L.engineSearch) {
        // Not added to delegate.plugins yet: a missing plugin file would stop every cheap-model run.
        cfg.delegate.engineSearch = set("delegate.engineSearch", L.engineSearch, "projeye özgü arama aracının ayarları; eklenti .evrim/plugins/engine-search.js yazılınca delegate.plugins'e eklenir");
    }
    if (L.claudeWeights) {
        const { _comment, ...w } = L.claudeWeights;
        cfg.metrics.weights = set("metrics.weights", { ...cfg.metrics.weights, ...w, modelFactor: { ...cfg.metrics.weights.modelFactor, ...(w.modelFactor || {}) } }, "ağırlıklar aynen (eski turlar karşılaştırılabilir kalsın)");
    }
    if (L.metricsTable) cfg.metrics.table = set("metrics.table", L.metricsTable, "tablo eski yerinde üretilmeye devam eder");
    if (L.claudeProjectDir) notes.push({ key: "metrics.claudeProjectDir", why: "alınmadı: makineye özgü; proje yolundan türetilir" });
    if (L.probe) { cfg.probe.legacy = L.probe; notes.push({ key: "probe", why: "eski yoklama ayarları probe.legacy altında; eklenti yazılınca probe.plugin doldurulur" }); }
    return { cfg, notes };
}

// One row per found piece: source → target, action, reason.
//   kalır: stays where it is (config points at it) · birleştir: package template placed beside as .new
//   config: becomes config fields · kopya: copied into the new place (original stays)
//   emekli: replaced by a package command (original stays until the owner deletes it)
//   eklenti: project-specific part becomes a local plugin · dokunulmaz: product code, never read
export function plan(root) {
    const rows = [], add = (src, target, action, why) => rows.push({ src, target, action, why });
    const has = (rel) => exists(path.join(root, rel));
    const legacy = findLegacyConfig(root);
    const { cfg, notes } = mapConfig(legacy && legacy.cfg, root);
    const tdir = cfg.tasks.dir, taskRe = new RegExp(cfg.tasks.pattern);

    // 1. Rules and documents
    for (const f of ["AGENTS.md", "CLAUDE.md"]) if (has(f)) add(f, f, "birleştir", "projenin kuralları kalır; şablonun 'nereye bakmalı', hafıza tablosu ve belge diyeti bölümleri AGENTS.md.new olarak yanına, elle birleştirilir");
    for (const e of ls(root)) if (!e.dir && /^(GEMINI|CODEX|COPILOT|CURSOR)\w*\.md$/i.test(e.name)) add(e.name, e.name, "kalır", "başka modele devir notu; şablonu yok, olduğu gibi kalır");
    for (const f of ["README.md", "CHANGELOG.md"]) if (has(f)) add(f, f, "kalır", f === "CHANGELOG.md" ? "config docs.changelog" : "projenin tanıtımı");
    for (const d of STD_DOCS) if (has(`docs/${d}.md`)) add(`docs/${d}.md`, `docs/${d}.md`, "kalır", `config docs.${d.toLowerCase()}; şablonu yalnız eksikse yazılır`);
    for (const d of STD_DOCS) if (!has(`docs/${d}.md`)) add("(yok)", `docs/${d}.md`, "yeni", "şablondan oluşturulur");
    for (const e of ls(path.join(root, "docs"))) {
        if (e.dir && e.name !== "workflow" && e.name !== path.basename(tdir)) add(`docs/${e.name}/`, `docs/${e.name}/`, "kalır", "projeye özgü belge klasörü");
        else if (!e.dir && /\.md$/.test(e.name) && !STD_DOCS.includes(e.name.replace(/\.md$/, ""))) add(`docs/${e.name}`, `docs/${e.name}`, "kalır", "projeye özgü bilgi (ürün, motor, hukuk, kaynaklar)");
    }

    // 2. Delegation workflow
    if (legacy) {
        add(legacy.rel, CONFIG_REL, "config", "alan alan eşleme aşağıda; eski dosya eski betikler için kalır");
        const wdir = path.dirname(legacy.rel);
        for (const e of ls(path.join(root, wdir))) {
            const rel = `${wdir}/${e.name}`;
            if (rel === legacy.rel) continue;
            if (e.name === "metrics.jsonl") add(rel, cfg.metrics.file, "kopya", "tur satırları; eski 'deepseek' alanı cv round tarafından okunur");
            else if (e.name === path.basename(cfg.metrics.table)) add(rel, rel, "kalır", "cv round table aynı yere üretir (metrics.table)");
            else if (/^(README|OPTIMIZATION|ENGINE_IDEA)\.md$/i.test(e.name)) add(rel, "paket: docs/METHOD.md", "kalır", "yöntem pakete damıtıldı; yerel kopya tarihçe olarak kalır");
            else add(rel + (e.dir ? "/" : ""), rel + (e.dir ? "/" : ""), "kalır", "deney kaydı / raporlar: yerel veri");
        }
    }
    if (has(tdir)) {
        const files = ls(path.join(root, tdir)).filter((e) => !e.dir).map((e) => e.name);
        if (files.includes("README.md")) add(`${tdir}/README.md`, cfg.tasks.rules, "birleştir", "ucuz ajan kuralları: genel kısım paket şablonuyla karşılaştırılır (.new), 'Project rules' bölümü projede kalır");
        if (files.includes("TEMPLATE.md")) add(`${tdir}/TEMPLATE.md`, `${tdir}/TEMPLATE.md`, "kalır", "tarif şablonu");
        const specs = files.filter((f) => taskRe.test(f)), reports = files.filter((f) => /\.report\.md$/.test(f));
        if (specs.length) add(`${tdir}/${cfg.tasks.prefix}-*.md (${specs.length} tarif, ${reports.length} rapor)`, `${tdir}/`, "kalır", "tarifler ve raporlar; tasks.pattern ile tanınır, numaralama devam eder");
        const other = files.filter((f) => !taskRe.test(f) && !/\.report\.md$/.test(f) && !["README.md", "TEMPLATE.md"].includes(f));
        if (other.length) add(`${tdir}/{${other.join(",")}}`, `${tdir}/`, "kalır", "büyük model briefleri / diğer");
    }
    const scripts = (sub) => ls(path.join(root, "scripts", sub)).map((e) => e.name);
    if (scripts("ds").includes("agent.js") || has("scripts/agent.js")) add(has("scripts/ds/agent.js") ? "scripts/ds/agent.js" : "scripts/agent.js", "paket: core/delegate/agent.js (cv delegate run|fix|ask|scout|auto)", "emekli", "genel ajan pakette; eski betik yedek olarak kalır");
    if (legacy && legacy.cfg && legacy.cfg.engineSearch) add("(ajan içindeki engine_search)", ".evrim/plugins/engine-search.js", "eklenti", "projeye özgü arama aracı; core/delegate eklenti arayüzüyle yazılacak");
    for (const e of ls(path.join(root, "scripts"))) {
        const n = e.name, rel = `scripts/${n}${e.dir ? "/" : ""}`;
        if (e.dir && n === "ds") continue;
        if (/^ds\.(ps1|sh|cmd)$/.test(n)) add(rel, "paket: cv delegate batch|status|stop", "emekli", "şeritler ayrık süreç (K12); worktree yolu delegate.worktreeRoot");
        else if (/^round\.(js|ps1|sh)$/.test(n)) add(rel, "paket: cv round", "emekli", "aynı ölçüm, aynı formül (K17)");
        else if (/^probe\./.test(n)) add(rel, "probe.plugin (.evrim/plugins/probe.js)", "eklenti", "uygulamayı yoklama projeye özgü; arayüz core/probe/README.md");
        else if (e.dir && n === "capture") {
            for (const c of scripts("capture")) {
                if (/^ref_index\./.test(c)) add(`scripts/capture/${c}`, "paket: cv ref index", "emekli", "referans indeksi genel");
                else if (/^compare\./.test(c)) add(`scripts/capture/${c}`, "paket: cv ref compare", "emekli", "yan yana karşılaştırma sayfası genel");
                else add(`scripts/capture/${c}`, `scripts/capture/${c}`, "kalır", "referans uygulamadan yakalama projeye/makineye özgü; çıktısı reference.dir'e");
            }
        } else add(rel, rel, "kalır", "projeye özgü betik");
    }

    // 3. Skills and autonomy
    const skillMap = { durum: "durum", calis: "calis", fullotonom: "otonom", otonom: "otonom", damit: "damit" };
    for (const e of ls(path.join(root, ".claude", "skills"))) {
        if (!e.dir) continue;
        const to = skillMap[e.name];
        if (to) add(`.claude/skills/${e.name}/`, `.claude/skills/${to}/`, to === e.name ? "birleştir" : "emekli", to === e.name ? "paket becerisi yanına .new olarak gelir; projeye özgü adımlar AGENTS/config'e taşınır" : `paket '${to}' becerisi yerini alır; faz içerikleri ROADMAP'e`);
        else add(`.claude/skills/${e.name}/`, `.claude/skills/${e.name}/`, "kalır", "projeye özgü beceri");
    }
    if (has(".claude/loop.md")) add(".claude/loop.md", "paket: otonom becerisi + zamanlanmış görev", "emekli", "eski /loop istemi (ders 9)");
    for (const base of ["build/otonom", ".otonom", "otonom"]) {
        for (const e of ls(path.join(root, base))) {
            const stem = e.name.replace(/\.md$/, "");
            if (!e.dir && MEMORY.includes(stem)) add(`${base}/${e.name}`, `.evrim/otonom/${e.name}`, "kopya", "otonom hafıza artık git'te (K9); kopya, eski dosya kalır");
            else add(`${base}/${e.name}${e.dir ? "/" : ""}`, `${base}/${e.name}${e.dir ? "/" : ""}`, "kalır", "geçici çıktı");
        }
    }
    if (legacy && legacy.cfg && legacy.cfg.stateDir && has(legacy.cfg.stateDir)) {
        const n = ls(path.join(root, legacy.cfg.stateDir)).filter((e) => !e.dir && /\.json$|^asks\.jsonl$/.test(e.name)).length;
        add(`${legacy.cfg.stateDir}/*.json (${n})`, `${cfg.delegate.stateDir}/`, "kopya", "ucuz model çalıştırma kayıtları (günlük bütçe ve tur ölçümü okur)");
    }
    add("~/.claude/projects/<proje>/memory/", ".evrim/otonom/DERSLER.md (aday)", "kalır", "Claude'un kendi hafızası; ilk damıtmada dersler oradan okunur, dosyalara dokunulmaz");

    // 4. Everything else at the top: product code and third-party material, listed by name only.
    const seen = new Set(["docs", "scripts", ".claude", ".evrim", "build", ".git"]);
    for (const e of ls(root)) {
        if (!e.dir || seen.has(e.name)) continue;
        add(`${e.name}/`, `${e.name}/`, "dokunulmaz", NEVER_READ.test(e.name) ? "bağımlılık / üçüncü taraf / çıktı: okunmadı" : "ürün kodu ya da verisi");
    }
    for (const e of ls(root)) if (!e.dir && /\.(ps1|sh|cmd|js|py)$/.test(e.name)) add(e.name, e.name, "kalır", cfg.build && cfg.build.join(" ").includes(e.name) ? "derleme komutu (config build)" : "proje betiği");

    return { root, legacy: legacy && legacy.rel, cfg, notes, rows };
}

const ORDER = ["config", "kopya", "birleştir", "yeni", "emekli", "eklenti", "kalır", "dokunulmaz"];
export function render(p, { date = new Date().toISOString().slice(0, 10) } = {}) {
    const count = Object.fromEntries(ORDER.map((a) => [a, p.rows.filter((r) => r.action === a).length]));
    const esc = (s) => String(s).replace(/\|/g, "\\|");
    const out = [`# Göç planı: ${p.cfg.project}`, "", `\`cv adopt\` ile ${date} tarihinde üretildi. Hiçbir dosya taşınmaz ya da silinmez; \`--apply\` yalnız yeni dosya yazar (var olanı ezmez, farklıysa yanına \`.new\` bırakır).`, "",
        "Eylemler: **config** = alanları `.evrim/config.json`'a · **kopya** = yeni yere kopyalanır, eskisi kalır · **birleştir** = paket şablonu yanına `.new`, elle birleştirilir · **yeni** = şablondan · **emekli** = paket komutu yerini alır, eski dosya sahibi silene kadar kalır · **eklenti** = projeye özgü parça yerel eklenti olur · **kalır** = yerinde, config gösterir · **dokunulmaz** = ürün kodu, okunmadı.", "",
        `Özet: ${ORDER.filter((a) => count[a]).map((a) => `${a} ${count[a]}`).join(" · ")}`, "",
        "## Eşleme", "", "| Kaynak | Hedef | Eylem | Neden |", "|---|---|---|---|",
        ...ORDER.flatMap((a) => p.rows.filter((r) => r.action === a)).map((r) => `| \`${esc(r.src)}\` | ${/^paket:|^\(/.test(r.target) ? esc(r.target) : "`" + esc(r.target) + "`"} | ${r.action} | ${esc(r.why)} |`), ""];
    out.push("## Config eşlemesi", "", p.legacy ? `Kaynak: \`${p.legacy}\`.` : "Eski yapılandırma bulunamadı; algılama + varsayılanlar.", "", "| Alan | Not |", "|---|---|", ...p.notes.map((n) => `| \`${n.key}\` | ${esc(n.why)} |`), "");
    out.push("## `--apply` ne yapar", "", "1. `cv init`: eksik belge, şablon, beceri yazılır; var olan farklıysa yanına `.new`.", "2. Yukarıdaki config `.evrim/config.json` yoksa yazılır.", "3. **kopya** satırları hedef yoksa kopyalanır.", "4. Bu plan `.evrim/adopt-plan.md`'ye yazılır.", "", "Sonra elle: `.new` dosyalarını birleştir, **eklenti** satırlarını yaz, `cv doctor`, bir deneme turu (`cv round start` → `cv round end`). **emekli** dosyalar ancak yeni komut bir tur sorunsuz çalıştıktan sonra silinir.", "");
    return out.join("\n");
}

export function apply(p) {
    const root = p.root, done = [];
    const cfgFile = path.join(root, CONFIG_REL);
    if (!exists(cfgFile)) {
        const { root: _r, ...clean } = p.cfg;
        writeJson(cfgFile, clean); done.push(CONFIG_REL);
    }
    const report = { created: [], same: [], kept: [], newFiles: [] };
    for (const row of p.rows.filter((x) => x.action === "kopya")) {
        const m = row.src.match(/^(.+)\/\*\.json \(\d+\)$/);
        if (m) {
            const dir = path.join(root, m[1]);
            for (const e of ls(dir)) if (!e.dir && /\.json$|^asks\.jsonl$/.test(e.name)) { const dest = path.join(root, row.target, e.name); if (!exists(dest)) { writeText(dest, readText(path.join(dir, e.name))); done.push(path.posix.join(row.target, e.name)); } }
            continue;
        }
        const src = path.join(root, row.src);
        if (!exists(src)) continue;
        place(path.join(root, row.target), readText(src), report, row.target);
    }
    done.push(...report.created);
    // Init last: copied memory files must land before the empty templates would.
    const r = init(root, {});
    done.push(...r.created);
    writeText(path.join(root, ".evrim", "adopt-plan.md"), render(p));
    return { written: done, newFiles: [...r.newFiles, ...report.newFiles] };
}

export function run(args) {
    const root = path.resolve(typeof args.dir === "string" ? args.dir : process.cwd());
    if (!exists(root)) throw new Error("klasör yok: " + root);
    const p = plan(root), text = render(p);
    if (typeof args.out === "string") { writeText(path.resolve(args.out), text); console.log("plan yazıldı: " + path.resolve(args.out)); }
    if (args["dry-run"]) { if (typeof args.out !== "string") console.log(text); console.log(`\n(deneme: projeye hiçbir şey yazılmadı; ${p.rows.length} satır)`); return 0; }
    if (args.apply) {
        const r = apply(p);
        console.log(`uygulandı: ${r.written.length} yeni dosya; yanına bırakılan: ${r.newFiles.length}`);
        for (const f of r.newFiles) console.log("  " + f);
        console.log("plan: .evrim/adopt-plan.md · sonra: cv doctor");
        return 0;
    }
    writeText(path.join(root, ".evrim", "adopt-plan.md"), text);
    console.log(`plan yazıldı: .evrim/adopt-plan.md (${p.rows.length} satır). Uygulamak için: cv adopt --apply`);
    return 0;
}
