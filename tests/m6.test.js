// ProMax M6: the quota guard (owner, 2026-11-21: a loop ran to 100% and died; quota and tempo control must
// always be on), calibration of the local meter to the account's plan, the knowledge store and its lossless
// migration step, hypothesis self-tuning (kept or reverted + lesson), usage readers. No network, no model.
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawn } from "node:child_process";
import { eq, ok, test, tmpDir } from "./harness.js";
import { git, readJson, readText, writeJson, writeText } from "../core/lib/util.js";
import { loadConfig } from "../core/lib/config.js";
import { init } from "../core/cli/init.js";
import { estimateQuota, weightOf } from "../core/metrics/blocks.js";
import * as calibrate from "../core/metrics/calibrate.js";
import { level, verdict } from "../core/autonomy/guard.js";
import { evaluate as guardEvaluate } from "../core/cli/guard.js";
import { mergeSettings, SETTINGS_REL } from "../core/lib/hooks.js";
import { planFiles, planUpdate, migrate } from "../core/cli/migrate.js";
import * as knowledge from "../core/autonomy/knowledge.js";
import * as autotune from "../core/autonomy/autotune.js";
import { codexEvents } from "../core/metrics/usage.js";
import { rememberQuota } from "../core/autonomy/cycle.js";

const NOW = new Date("2026-11-21T10:30:00Z");
const at = (min) => new Date(NOW.getTime() - min * 60000).toISOString();
// One assistant turn: mostly cache reads, as a long agent session is.
const turn = (min, { input = 2000, cacheRead = 100000, output = 1500, model = "claude-opus-5-5", id } = {}) =>
    ({ type: "assistant", timestamp: at(min), message: { id: id || `m${min}`, model, usage: { input_tokens: input, cache_read_input_tokens: cacheRead, output_tokens: output } } });
const session = (n, step = 2) => Array.from({ length: n }, (_, i) => turn((n - i) * step));

function project(label) {
    const dir = tmpDir(label);
    git(["init", "-q", "-b", "main"], dir);
    for (const [k, v] of [["user.email", "test@example.invalid"], ["user.name", "test"], ["commit.gpgsign", "false"]]) git(["config", k, v], dir);
    init(dir, { name: label });
    const c = readJson(path.join(dir, ".evrim/config.json"));
    c.kurulum = "tamam"; c.test = null; c.build = null;
    writeJson(path.join(dir, ".evrim/config.json"), c);
    return loadConfig(dir);
}
const resetCalibration = () => { try { fs.rmSync(calibrate.file()); } catch (_) { /* none */ } };

test("kota birimi: önbellek okuması ucuz, çıktı pahalı; tur ölçümüyle tek anlam; bilinmeyen model güvenli tarafta", () => {
    const e = { input: 1000, cacheRead: 100000, output: 1000, cacheCreation: 0, model: "claude-opus-5-5" };
    eq(weightOf(e), (1000 * 4 + 100000 * 0.2 + 1000 * 20) / 1e6, "tur ölçümüyle aynı yük birimi (metrics.weights)");
    ok(weightOf({ ...e, model: "claude-haiku-5-5" }) < weightOf({ ...e, model: "claude-sonnet-5-5" }), "haiku < sonnet");
    eq(weightOf({ ...e, model: "bilinmeyen" }), weightOf({ ...e, model: "claude-fable-5-2" }), "bilinmeyen model en pahalı sayılır");
    ok(weightOf({ ...e, cacheRead: 0 }) < weightOf(e), "önbellek de sayılır ama onda bir");
});

test("kalibrasyon: hata yeniden üretildi — küçük planda gerçek sayaç %90'dayken varsayılan sınır yarısını gösteriyordu; kalibre tahmin gerçeğe oturur", () => {
    resetCalibration();
    const entries = session(60);
    const raw = estimateQuota(".", {}, NOW.getTime(), { entries });
    ok(raw.available && raw.fivePct < 50, `kalibrasyonsuz yerel tahmin düşük kalıyordu (%${raw.fivePct}): eski hata`);
    // A real reading of 90% at this moment.
    const s = calibrate.sampleFrom({ five: 90, week: 20 }, raw, NOW);
    ok(s && s.fiveUnits > 0 && s.weekUnits > 0, "okuma + yerel birimden örnek çıktı");
    const cal = estimateQuota(".", {}, NOW.getTime(), { entries, calibrated: { fiveUnits: s.fiveUnits, weekUnits: s.weekUnits } });
    ok(Math.abs(cal.fivePct - 90) <= 0.5, `kalibre tahmin okumaya eşit (%${cal.fivePct})`);
    // More burn after the reading moves the calibrated estimate up by the same units.
    const more = [...entries, turn(0.5, { id: "late1" }), turn(0.2, { id: "late2" })];
    const later = estimateQuota(".", {}, NOW.getTime(), { entries: more, calibrated: { fiveUnits: s.fiveUnits } });
    ok(later.fivePct > 90, "okumadan sonraki yakım tahmine eklenir");
});

test("kalibrasyon: medyan tek tuhaf örnekten etkilenmez; az okuma (<%5) ve farklı pencere örnek sayılmaz", () => {
    const est = { fiveWeighted: 1, weekWeighted: 5, fiveResetsAt: "2026-11-21T12:00:00Z" };
    eq(calibrate.sampleFrom({ five: 3, week: 1 }, est, NOW), null, "çok küçük okuma gürültüdür");
    const other = calibrate.sampleFrom({ five: 50, week: 10, fiveResetsAt: "2026-11-21T15:00:00Z" }, est, NOW);
    ok(other && !other.fiveUnits && other.weekUnits === 50, "5 saatlik pencere uyuşmuyor: yalnız haftalık örnek");
    const lim = calibrate.limitsFrom({ samples: [{ kind: "reading", fiveUnits: 2 }, { kind: "reading", fiveUnits: 2.1 }, { kind: "reading", fiveUnits: 90 }] });
    eq(lim.fiveUnits, 2.1, "medyan");
    eq(lim.source, "kalibre");
});

test("kalibrasyon: döküm satırındaki 'limit reached' izi o bloğu %100 sayar (hiç okuma yokken)", () => {
    resetCalibration();
    const dir = tmpDir("claude-logs"), file = path.join(dir, "p", "s.jsonl");
    const lines = session(30).map((e) => JSON.stringify(e));
    lines.push(JSON.stringify({ type: "assistant", timestamp: at(1), message: { model: "<synthetic>", content: [{ type: "text", text: "Claude AI usage limit reached|1763730000" }] } }));
    writeText(file, lines.join("\n") + "\n");
    const est = estimateQuota(".", {}, NOW.getTime(), { dirs: [dir], skipMtimePrune: true });
    eq(est.limitHits.length, 1, "iz bulundu");
    const h = calibrate.hitSamples(est, [], NOW);
    eq(h.samples.length, 1);
    ok(Math.abs(h.samples[0].fiveUnits - est.activeBlock.tokens.weighted) < 1e-5, "blok o anda doluydu");
    eq(calibrate.hitSamples(est, h.seen, NOW).samples.length, 0, "aynı iz ikinci kez sayılmaz");
});

test("kalibrasyon: taze okuma + o andan beri yakılan = şimdiki yüzde; okuma bayatsa kalibre tahmin; hiçbiri yoksa 'varsayilan' (düşük güven)", () => {
    const data = { samples: [{ kind: "reading", fiveUnits: 10, weekUnits: 100 }], lastReading: { at: at(10), five: 40, week: 12, fiveWeighted: 4, weekWeighted: 12, fiveResetsAt: "2026-11-21T13:00:00Z" } };
    const est = { available: true, fiveWeighted: 5, weekWeighted: 13, fivePct: 50, weekPct: 13, calibration: "kalibre" };
    const c = calibrate.currentFrom(est, data, NOW);
    eq([c.five, c.week, c.source], [50, 13, "okuma+yerel"], "40 + 1000/10000·100");
    const stale = calibrate.currentFrom(est, { ...data, lastReading: { ...data.lastReading, at: at(200) } }, NOW);
    eq(stale.source, "kalibre");
    const none = calibrate.currentFrom({ ...est, calibration: "default" }, { samples: [] }, NOW);
    eq([none.source, none.trust], ["varsayilan", "dusuk"]);
});

test("kalibrasyon: gerçek okuma (cv gate / cycle) makine dosyasına örnek yazar; yerel tahmin okuması yazmaz", () => {
    resetCalibration();
    const cfg = project("cal-obs");
    const entries = session(40);
    rememberQuota(cfg, { five: 50, week: 20, source: "local-blocks" }, NOW, { quotaOpts: { entries } });
    ok(!fs.existsSync(calibrate.file()), "yerel tahmin kendini kalibre etmez");
    rememberQuota(cfg, { five: 50, week: 20 }, NOW, { quotaOpts: { entries } });
    const d = readJson(calibrate.file());
    eq(d.samples.length, 1);
    eq(d.lastReading.five, 50);
    ok(calibrate.limits().fiveUnits > 0);
    resetCalibration();
});

test("bekçi: seviye — tamam, tempo (pencere sıfırlanmadan dolacak), küçük (%85), dur (%90 ya da haftalık tavan)", () => {
    const g = { fiveHourNoNewStep: 85, fiveHourExit: 90 };
    eq(level({ five: 20, week: 10 }, g, NOW).level, "ok");
    const t = level({ five: 50, week: 10, projectedPct: 140, minutesLeft: 120 }, g, NOW);
    eq(t.level, "tempo");
    ok(t.toExit > 0 && t.toExit < 120, "dolma süresi dakika olarak");
    eq(level({ five: 86, week: 10 }, g, NOW).level, "kucuk");
    eq(level({ five: 91, week: 10 }, g, NOW).level, "cik");
    eq(level({ five: 10, week: 99 }, g, NOW).level, "cik", "haftalık tavan");
    eq(level({ five: null }, g, NOW).level, "bilinmiyor");
});

test("bekçi: gözetimsizken %90'da yeni iş (düzenleme, alt ajan, git dışı kabuk) ENGELLENİR; commit ve cv açık; sahibi başındayken asla engellemez", () => {
    const cik = { level: "cik", reason: "5 saatlik pencere %92" };
    const base = { event: "pre", autonomous: true, now: NOW };
    for (const tool of ["Edit", "Write", "Agent", "Task"]) eq(verdict(cik, { ...base, tool }).exit, 2, tool);
    eq(verdict(cik, { ...base, tool: "Bash", command: "cargo build --release" }).exit, 2, "derleme yeni iştir");
    eq(verdict(cik, { ...base, tool: "Bash", command: "git commit -m WIP" }).exit, 0, "commit açık");
    eq(verdict(cik, { ...base, tool: "Bash", command: ".evrim/cv cycle end --id x" }).exit, 0, "cv açık");
    eq(verdict(cik, { ...base, tool: "Read" }).exit, 0, "okuma engellenmez");
    eq(verdict(cik, { ...base, tool: "Edit", autonomous: false }).exit, 0, "sahibi başında: engel yok");
    const post = verdict(cik, { event: "post", tool: "Edit", autonomous: false, now: NOW });
    ok(post.exit === 2 && /KOTA_UYARI/.test(post.message), "sahibi başında: yalnız uyarı");
});

test("bekçi: uyarılar seyrek (warnEveryMinutes) ve tamam seviyesinde sessiz (sıfır token)", () => {
    const k = { level: "kucuk", reason: "%86" };
    const first = verdict(k, { event: "post", tool: "Edit", now: NOW, warnEveryMinutes: 10 });
    ok(first.exit === 2 && /KUCUK/.test(first.message));
    eq(verdict(k, { event: "post", tool: "Edit", now: NOW, lastWarnAt: at(3), warnEveryMinutes: 10 }).exit, 0, "3 dk önce uyarıldı");
    eq(verdict(k, { event: "post", tool: "Edit", now: NOW, lastWarnAt: at(11), warnEveryMinutes: 10 }).exit, 2, "11 dk sonra yeniden");
    eq(verdict({ level: "ok", reason: "" }, { event: "post", tool: "Edit", now: NOW }).exit, 0);
    const low = verdict(k, { event: "post", tool: "Edit", now: NOW, autonomous: true, trust: "dusuk" });
    ok(/kalibre değil/.test(low.message), "düşük güvende bir kez okuma istenir");
});

test("bekçi: proje durumu — önbellek aralığı, gözetimsiz kilit, uyarı zamanı kaydı", async () => {
    resetCalibration();
    const cfg = project("guard-eval");
    writeJson(calibrate.file(), { samples: [{ kind: "reading", fiveUnits: 1000 }], lastReading: { at: NOW.toISOString(), five: 93, week: 10, fiveWeighted: 0, weekWeighted: 0, fiveResetsAt: "2026-11-21T12:00:00Z" } });
    const r = await guardEvaluate(cfg, { hook_event_name: "PreToolUse", tool_name: "Write" }, NOW, { autonomous: true });
    eq([r.level, r.exit], ["cik", 2]);
    ok(/KOTA_FRENI \(DUR\)/.test(r.message));
    const st = readJson(path.join(cfg.root, ".evrim/state/guard.json"));
    ok(st.q && st.q.five === 93 && st.lastWarnAt, "önbellek ve uyarı zamanı yazıldı");
    // Inside everySeconds the cached value is used even if the machine file changed.
    writeJson(calibrate.file(), { samples: [], lastReading: null });
    const again = await guardEvaluate(cfg, { hook_event_name: "PreToolUse", tool_name: "Write" }, new Date(NOW.getTime() + 20000), { autonomous: true });
    eq(again.q.five, 93, "60 sn içinde yeniden hesaplanmaz");
    const owner = await guardEvaluate(cfg, { hook_event_name: "PreToolUse", tool_name: "Write" }, new Date(NOW.getTime() + 30000), { autonomous: false });
    eq(owner.exit, 0, "sahibi başında engel yok");
    resetCalibration();
});

test("bekçi kancası uçtan uca: gerçek süreç, stdin'den kanca JSON'u, çıkış 2 + stderr; .evrim yoksa ve hata olursa izin (0)", async () => {
    resetCalibration();
    const cfg = project("guard-cli");
    writeJson(calibrate.file(), { samples: [], lastReading: { at: new Date().toISOString(), five: 95, week: 10, fiveWeighted: 0, weekWeighted: 0, fiveResetsAt: new Date(Date.now() + 3600e3).toISOString() } });
    const runGuard = (dir, input, env = {}) => new Promise((resolve) => {
        const args = process.versions.deno ? ["run", "-A", "--quiet", path.resolve("bin/cv.js"), "guard", "--event", "pre"] : [path.resolve("bin/cv.js"), "guard", "--event", "pre"];
        const p = spawn(process.execPath, args, { cwd: dir, env: { ...process.env, CLAUDE_PROJECT_DIR: dir, ...env } });
        let err = "";
        p.stderr.on("data", (c) => { err += c; });
        p.on("close", (code) => resolve({ code, err }));
        p.stdin.end(input);
    });
    const blocked = await runGuard(cfg.root, JSON.stringify({ hook_event_name: "PreToolUse", tool_name: "Edit", tool_input: { file_path: "x" } }), { CV_AUTONOMOUS: "1" });
    eq(blocked.code, 2, "engellendi");
    ok(/KOTA_FRENI/.test(blocked.err), "modele neden söylendi");
    const commit = await runGuard(cfg.root, JSON.stringify({ hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "git commit -m WIP" } }), { CV_AUTONOMOUS: "1" });
    eq(commit.code, 0, "commit geçer");
    eq((await runGuard(tmpDir("no-evrim"), "{}", { CV_AUTONOMOUS: "1" })).code, 0, ".evrim yok: izin");
    eq((await runGuard(cfg.root, "bozuk json", { CV_AUTONOMOUS: "1" })).code, 0, "bozuk girdi oturumu kırmaz");
    resetCalibration();
});

test("kanca kurulumu: init ekler; sahibinin ayar ve kancaları korunur; ikinci kez eklemez; okunamayan dosyaya dokunmaz", () => {
    const cfg = project("hooks");
    const s = readJson(path.join(cfg.root, SETTINGS_REL));
    ok(s.hooks.PreToolUse[0].hooks[0].command.includes("guard --event pre"), "init kancayı yazdı");
    ok(s.hooks.PostToolUse[0].hooks[0].command.includes("guard --event post"));
    const own = JSON.stringify({ permissions: { allow: ["Bash(npm test)"] }, hooks: { PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "echo mine" }] }] } });
    const m = mergeSettings(own);
    const doc = JSON.parse(m.text);
    eq(doc.permissions.allow, ["Bash(npm test)"], "izinler aynen");
    eq(doc.hooks.PreToolUse.length, 2, "sahibinin kancası + bekçi");
    eq(doc.hooks.PreToolUse[0].hooks[0].command, "echo mine");
    eq(mergeSettings(m.text).changed, false, "ikinci kez değişmez");
    const bad = mergeSettings("{ bozuk");
    ok(!bad.changed && /okunamadı/.test(bad.error), "bozuk dosya: dokunmaz, söyler");
});

test("göç: eski projeye (kancasız settings, DERSLER.md) bekçi kancası ve bilgi deposu yedekli eklenir, geri alınabilir; veri silinmez", () => {
    const cfg = project("migrate-m6");
    const root = cfg.root;
    writeText(path.join(root, SETTINGS_REL), JSON.stringify({ permissions: { allow: ["Bash(ls)"] } }, null, 2) + "\n");
    writeText(path.join(root, ".evrim/otonom/DERSLER.md"), "# Dersler\n\n- Windows'ta cargo kilidi: önce eski süreci kapat (src/build.rs)\n- Sahip uzun yanıt istemiyor\n");
    try { fs.rmSync(path.join(root, ".evrim/knowledge.jsonl")); } catch (_) { /* none */ }
    const p = planUpdate(root);
    const rels = p.items.map((i) => i.rel);
    ok(rels.includes(SETTINGS_REL) && rels.includes(".evrim/knowledge.jsonl"), `plan: ${rels.join(", ")}`);
    migrate(root, p);
    const s = readJson(path.join(root, SETTINGS_REL));
    eq(s.permissions.allow, ["Bash(ls)"], "sahibinin izni duruyor");
    ok(s.hooks.PreToolUse.length === 1, "bekçi eklendi");
    eq(knowledge.load(root).length, 2, "iki ders depoya kopyalandı");
    ok(readText(path.join(root, ".evrim/otonom/DERSLER.md")).includes("cargo kilidi"), "DERSLER.md aynen kaldı");
    eq(planFiles(root).filter((i) => i.rel === SETTINGS_REL).length, 0, "ikinci planda yok (idempotent)");
});

test("bilgi deposu: aynı ders iki kez yazılmaz (kanonik kimlik + Jaccard ikiz), dosyası silinen ders bayatlar, en güçlü eşleşme önce gelir", () => {
    const root = tmpDir("kn");
    const a = knowledge.makeEntry({ type: "gotcha", fact: "src/save.rs atomik yazmazsa veri kaybolur", now: NOW });
    const b = knowledge.makeEntry({ type: "gotcha", fact: "src/save.rs atomik yazmazsa  veri kaybolur", now: NOW });
    eq(a.id, b.id, "aynı olgu aynı kimlik");
    knowledge.add(root, [a]);
    const r = knowledge.add(root, [b]);
    eq([r.added, r.merged, knowledge.load(root).length], [0, 1, 1]);
    knowledge.note(root, { type: "lesson", fact: "kullanıcı kısa yanıt sever", now: NOW });
    ok(knowledge.isOutdated(root, a), "src/save.rs yok: bayat");
    writeText(path.join(root, "src/save.rs"), "fn main(){}\n");
    ok(!knowledge.isOutdated(root, a));
    const hits = knowledge.retrieve(root, { files: ["src/save.rs"], text: "kısa yanıt" });
    eq(hits[0].entry.id, a.id, "dosya eşleşmesi kelime eşleşmesinden güçlü");
});

test("öz-ayar: az kanıtla öneri yok; sinyal net → tek sınırlı deneme; K koşu sonra iyileşmediyse ayar geri alınır ve ders yazılır", () => {
    const cfg = project("tune");
    const dir = path.join(cfg.root, cfg.delegate.stateDir);
    const writeRuns = (name, list) => writeJson(path.join(dir, `${name}.json`), { runs: list });
    const bad = (i) => ({ at: `2026-11-20T0${i % 10}:00:00Z`, steps: 200, stopReason: "steps", status: "fail", kind: "first" });
    writeRuns("T-001", [bad(1), bad(2)]);
    ok(!autotune.propose(cfg).proposal, "2 koşu kanıt değil");
    writeRuns("T-001", Array.from({ length: 8 }, (_, i) => bad(i)));
    const p = autotune.propose(cfg);
    ok(p.proposal && p.proposal.key === "delegate.defaultSteps", "adım sınırı hipotezi");
    const before = cfg.delegate.defaultSteps;
    const t = autotune.apply(cfg, p.proposal, NOW);
    eq(readJson(path.join(cfg.root, ".evrim/config.json")).delegate.defaultSteps, p.proposal.to, "ayar denendi");
    ok(!autotune.propose(cfg).proposal, "açık deneme varken ikinci öneri yok");
    writeRuns("T-002", Array.from({ length: 6 }, (_, i) => ({ ...bad(i), at: `2026-11-21T0${i}:00:00Z` })));
    const e = autotune.evaluate(cfg, autotune.runs(cfg), NOW);
    eq(e.result, "rejected", "iyileşme yok");
    eq(readJson(path.join(cfg.root, ".evrim/config.json")).delegate.defaultSteps, before ?? t.from, "geri alındı");
    ok(knowledge.load(cfg.root).some((k) => k.type === "rejected-hypothesis"), "ders kaldı");
    let threw = false;
    try { autotune.apply(cfg, { key: "forbiddenWrite", to: [] }, NOW); } catch (_) { threw = true; }
    ok(threw, "güvenlik listesine dokunamaz");
});

test("kullanım: Codex token_count olayları (son tur ya da toplam farkı) güne göre okunur", () => {
    const l = (ts, total, last) => JSON.stringify({ type: "event_msg", timestamp: ts, payload: { type: "token_count", info: { total_token_usage: total, last_token_usage: last } } });
    const text = [
        l("2026-11-20T10:00:00Z", { input_tokens: 100, output_tokens: 10 }, null),
        l("2026-11-20T10:05:00Z", { input_tokens: 250, output_tokens: 30 }, null),
        l("2026-11-21T09:00:00Z", null, { input_tokens: 40, cached_input_tokens: 20, output_tokens: 5 })
    ].join("\n");
    const ev = codexEvents(text);
    eq(ev.map((e) => [e.day, e.input, e.output]), [["2026-11-20", 100, 10], ["2026-11-20", 150, 20], ["2026-11-21", 40, 5]]);
});
