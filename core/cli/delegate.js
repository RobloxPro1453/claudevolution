// cv delegate batch [--lanes N] [--from N] <TASK>...   start detached lanes and return
// cv delegate status | stop <lane>
// cv delegate run <TASK> | fix <TASK> <notes-file> | scout <TASK> | auto <TASK>   [--lane N]  (foreground)
// cv delegate ask "<question>"
// cv delegate which | brief <TASK>   who does the work (API key or fallback) and the fallback brief
import { num } from "../lib/util.js";
import { project } from "./_project.js";
import * as agent from "../delegate/agent.js";
import * as lanes from "../delegate/lanes.js";
import * as choose from "../delegate/choose.js";

export async function run(args) {
    const cfg = project(args);
    const [sub, ...rest] = args._;
    const p = agent.provider(cfg);
    if (sub === "which") { console.log(choose.line(choose.choose(cfg))); return 0; }
    if (sub === "brief" && rest[0]) { console.log(choose.brief(cfg, rest[0])); return 0; }
    const picked = choose.choose(cfg);
    if (picked.mode !== "api" && ["batch", "lane", "run", "fix", "scout", "auto", "ask"].includes(sub)) {
        console.log(`${choose.line(picked)}
API işi başlatılmadı. ${picked.mode === "bekle" ? "Kod işi yapılmaz (delegate.policy yalniz-api): durumu SORULAR.md'ye yaz, kod dışı işlere geç. " : ""}Yedek (bekle değilse): \`cv delegate brief <iş>\` çıktısını ${picked.mode === "claude-subagent" ? `Agent aracına (model: ${picked.model}) ver` : "kendin uygula"}; kurallar aynıdır.`);
        return 3;
    }
    if (sub === "status") { console.log(lanes.statusText(cfg)); return 0; }
    if (sub === "stop" && rest[0]) { console.log(lanes.stop(cfg, parseInt(rest[0], 10))); return 0; }
    if (sub === "batch" && rest.length) {
        const started = lanes.batch(cfg, rest, { lanes: num(args.lanes, cfg.delegate.lanes), from: num(args.from, 1) });
        for (const s of started) console.log(`şerit ${s.lane}: ${s.tasks.join(", ")} → ${s.log}`);
        const until = agent.peakUntil(p);
        console.log(`Şeritler ayrık süreç olarak başladı; bu oturum kapansa da çalışırlar.${until && !process.env.CV_PEAK_OK ? ` Yoğun saat: ${until.toISOString().slice(11, 16)} UTC'ye kadar bekleyecekler.` : ""} Durum: cv delegate status`);
        return 0;
    }
    if (sub === "lane" && rest.length > 1) { await lanes.runLane(cfg, parseInt(rest[0], 10), rest.slice(1)); return 0; }

    const ctx = await agent.newCtx(cfg, num(args.lane, 1));
    if (sub === "ask" && rest.length) {
        const r = await agent.ask(ctx, rest.join(" "));
        console.log(`${r.answer}\n\n(ask: ${r.steps} adım, $${r.cost.toFixed(4)}, durma: ${r.stop})`);
        return 0;
    }
    if (["run", "fix", "scout", "auto"].includes(sub) && rest[0]) {
        const until = agent.peakUntil(p);
        if (until && !process.env.CV_PEAK_OK) { console.log(`Yoğun saat (pahalı) ${until.toISOString().slice(11, 16)} UTC'ye kadar; başlatılmadı. Geçersiz kılmak için CV_PEAK_OK=1.`); return 2; }
        await agent.ensureLane(ctx);
        if (sub === "auto") { await agent.auto(ctx, rest[0]); return 0; }
        if (sub === "scout") { await agent.scout(ctx, rest[0]); return 0; }
        if (sub === "fix") { if (!rest[1]) throw new Error("kullanım: cv delegate fix <iş> <notlar dosyası>"); await agent.runTask(ctx, rest[0], rest[1]); return 0; }
        await agent.syncForTask(ctx, rest[0]);
        await agent.runTask(ctx, rest[0], null);
        return 0;
    }
    throw new Error("kullanım: cv delegate batch [--lanes N] [--from N] <iş>... | status | stop <şerit> | run|fix|scout|auto <iş> [--lane N] | ask \"<soru>\" | which | brief <iş>");
}
