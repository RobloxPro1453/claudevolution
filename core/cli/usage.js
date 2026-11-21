// cv usage [--days N] [--json]
// Where the tokens and the money go, from local files only: Claude (5-hour blocks, core/metrics/blocks.js),
// Codex and Antigravity (core/metrics/usage.js), and the cheap model's spend against the daily and the
// project budget (the brake: no new task once either is reached).
import { project } from "./_project.js";
import { antigravityUsage, codexUsage, lastDays, sumDays } from "../metrics/usage.js";
import { spentToday, spentTotal } from "../delegate/agent.js";

const k = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n));

export async function run(args) {
    const cfg = project(args);
    const days = Math.max(1, Number(args.days) || 7), range = lastDays(days);
    const codex = codexUsage(), ag = await antigravityUsage();
    const cx = sumDays(codex.byDay, range), agx = sumDays(ag.byDay, range);
    let claude = null;
    try { const { estimateQuota } = await import("../metrics/blocks.js"); const q = estimateQuota(cfg.root, cfg); if (q.available) claude = q; } catch (_) { /* optional */ }
    const today = spentToday(cfg), total = spentTotal(cfg), d = cfg.delegate;
    const brake = (typeof d.projectBudget === "number" && total >= d.projectBudget) ? "PROJE BÜTÇESİ DOLDU" : today >= d.dailyBudget ? "GÜNLÜK BÜTÇE DOLDU" : "açık";
    if (args.json) { console.log(JSON.stringify({ days, claude, codex: { ...cx, files: codex.files, skipped: codex.skipped }, antigravity: { ...agx, files: ag.files, skipped: ag.skipped, why: ag.why }, cheap: { today, total, dailyBudget: d.dailyBudget, projectBudget: d.projectBudget ?? null, brake } })); return 0; }
    console.log(`Kullanım (son ${days} gün, yalnız bu bilgisayarın kayıtları):`);
    console.log(`  Claude       ${claude ? `5 saatlik blok %${claude.fivePct}, yakma ${claude.burnRate} tok/dk` : "yerel blok verisi yok"}`);
    console.log(`  Codex        ${codex.files ? `girdi ${k(cx.input)} (önbellek ${k(cx.cached)}), çıktı ${k(cx.output)}, ${cx.calls} tur` : "kayıt yok"}${codex.skipped ? ` · ${codex.skipped} sıkıştırılmış dosya sayılmadı` : ""}`);
    console.log(`  Antigravity  ${ag.files ? `girdi ${k(agx.input)} (önbellek ${k(agx.cached)}), çıktı ${k(agx.output)}, ${agx.calls} çağrı` : ag.why || "kayıt yok"}`);
    console.log(`  Ucuz model   bugün $${today.toFixed(3)} / $${d.dailyBudget} · proje toplamı $${total.toFixed(3)}${typeof d.projectBudget === "number" ? ` / $${d.projectBudget}` : " (proje bütçesi yok: delegate.projectBudget)"} · fren: ${brake}`);
    return brake === "açık" ? 0 : 2;
}
