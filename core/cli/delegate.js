// cv delegate batch [--lanes N] [--from N] <TASK>...   start detached lanes and return
// cv delegate status | stop <lane>
// cv delegate run <TASK> | fix <TASK> <notes-file> | scout <TASK> | auto <TASK>   [--lane N]  (foreground)
// cv delegate ask "<question>"
// cv delegate which | brief <TASK>   who does the work (API key or fallback) and the fallback brief
// cv delegate api-ok                  clear the API hand-off after a top-up (balance gone / key refused, K25)
// cv delegate verify <TASK> [--base <branch>] [--skip-run] [--review]   independent adversarial verifier + receipt
import { num } from "../lib/util.js";
import { project } from "./_project.js";
import * as agent from "../delegate/agent.js";
import * as lanes from "../delegate/lanes.js";
import * as choose from "../delegate/choose.js";
import * as verify from "../delegate/verify.js";

export async function run(args) {
    const cfg = project(args);
    const [sub, ...rest] = args._;
    const p = agent.provider(cfg);
    if (sub === "which") { console.log(choose.line(choose.choose(cfg))); return 0; }
    // The owner topped up the balance or fixed the key: the API path opens again (K25 hand-off).
    if (sub === "api-ok") { const had = choose.readHandoff(cfg); choose.clearHandoff(cfg); console.log(had ? `API devri kaldırıldı (${had.kind}); şeritler yeniden API ile çalışır.` : "Açık API devri yok."); return 0; }
    if (sub === "brief" && rest[0]) { console.log(choose.brief(cfg, rest[0])); return 0; }
    // The code map the scout gets (files under codePaths + top-level symbols); handy when writing specs.
    if (sub === "map") { const { repoMap } = await import("../delegate/repomap.js"); console.log(repoMap(cfg, { maxChars: num(args.chars, 6000) }) || "(codePaths altında git'in izlediği dosya yok)"); return 0; }
    if (sub === "verify") {
        const task = rest[0] || (typeof args["skip-run"] === "string" ? args["skip-run"] : (typeof args.review === "string" ? args.review : null));
        if (!task) throw new Error("kullanım: cv delegate verify <iş> [--base <dal>] [--skip-run] [--review]");
        const base = typeof args.base === "string" ? args.base : undefined;
        const skipRun = Boolean(args["skip-run"]);
        const review = Boolean(args.review);
        const res = await verify.verifyTask(cfg.root, task, { cfg, base, skipRun, review });
        console.log(`${res.verdict} ${res.taskId} (${res.branch}${res.treeSha ? ", tree " + res.treeSha.slice(0, 8) : ""})`);
        for (const f of res.findings) {
            console.log(`- [${f.blocker ? "BLOCKER" : "WARN"}] ${f.category}: ${f.description || f.evidence}`);
        }
        return res.ok ? 0 : 1;
    }
    const picked = choose.choose(cfg);
    if (picked.mode !== "api" && ["batch", "lane", "run", "fix", "scout", "auto", "ask"].includes(sub)) {
        console.log(`${choose.line(picked)}
API işi başlatılmadı. ${picked.mode === "bekle" ? "Kod işi yapılmaz (delegate.policy yalniz-api): durumu SORULAR.md'ye yaz, kod dışı işlere geç. " : ""}Yedek (bekle değilse): \`cv delegate brief <iş>\` çıktısını ${picked.mode === "claude-subagent" ? `Agent aracına (model: ${picked.model}) ver` : "kendin uygula"}; kurallar aynıdır.`);
        return 3;
    }
    if (sub === "status") { const h = choose.readHandoff(cfg); console.log((h ? `API DEVRİ: ${h.kind === "billing" ? "bakiye bitti" : "anahtar reddedildi"} (${h.at.slice(0, 16)} UTC); kalan işler "handoff": cv delegate brief <iş> ile ana model yapar. Yükleyince: cv delegate api-ok\n` : "") + lanes.statusText(cfg)); return 0; }
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
        // fix and scout work on the task's own branch too: the lane worktree may still sit on another task's
        // branch from its last run, and a fix committed there landed on the wrong branch.
        if (sub === "scout") { await agent.syncForTask(ctx, rest[0]); await agent.scout(ctx, rest[0]); return 0; }
        if (sub === "fix") { if (!rest[1]) throw new Error("kullanım: cv delegate fix <iş> <notlar dosyası>"); await agent.syncForTask(ctx, rest[0]); await agent.runTask(ctx, rest[0], rest[1]); return 0; }
        await agent.syncForTask(ctx, rest[0]);
        await agent.runTask(ctx, rest[0], null);
        return 0;
    }
    throw new Error("kullanım: cv delegate batch [--lanes N] [--from N] <iş>... | status | stop <şerit> | run|fix|scout|auto <iş> [--lane N] | verify <iş> [--base <dal>] [--skip-run] [--review] | ask \"<soru>\" | which | brief <iş>");
}
