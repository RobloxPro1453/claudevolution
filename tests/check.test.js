// ProMax M3: desktop app checks (cv check), pictures, self-test, program choice, licence modes. No network,
// no model: a scripted stand-in app (a small Node/Deno script) plays the program.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { Buffer } from "node:buffer";
import { pathToFileURL } from "node:url";
import { eq, ok, test, tmpDir } from "./harness.js";
import { git, readJson, writeJson, writeText } from "../core/lib/util.js";
import { loadConfig, validate } from "../core/lib/config.js";
import { init } from "../core/cli/init.js";
import { decodePng, encodePng } from "../core/check/png.js";
import { isBlank, likeness, resize, similarity } from "../core/check/image.js";
import { verdict } from "../core/check/selftest.js";
import { builtProgram, cargoPrograms, readToml } from "../core/check/program.js";
import { isConsoleProgram, runChecks, summary } from "../core/check/check.js";
import { detectLicense } from "../core/reference/license.js";
import { migrate, planUpdate } from "../core/cli/migrate.js";

const solid = (w, h, v = 200) => ({ width: w, height: h, rgba: new Uint8Array(w * h * 4).fill(v) });
function gradient(w, h, phase = 0) {
    const rgba = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = (y * w + x) * 4; rgba[o] = (x * 255 / w + phase) & 255; rgba[o + 1] = (y * 255 / h) | 0; rgba[o + 2] = ((x ^ y) * 4) & 255; rgba[o + 3] = 255; }
    return { width: w, height: h, rgba };
}

test("check: PNG okuma/yazma (beş süzgeç), boş ekran ve benzerlik ölçüsü", () => {
    const img = gradient(37, 21);
    eq(Buffer.from(decodePng(encodePng(img)).rgba).equals(Buffer.from(img.rgba)), true, "RGBA gidiş-dönüş");
    // Every filter, written by hand (filter byte f on each row, RGB 8-bit), must decode to the same pixels.
    const w = 5, h = 4, rgb = Buffer.alloc(w * h * 3);
    for (let i = 0; i < rgb.length; i++) rgb[i] = (i * 37) & 255;
    for (const f of [0, 1, 2, 3, 4]) {
        const raw = Buffer.alloc((w * 3 + 1) * h);
        for (let y = 0; y < h; y++) {
            raw[y * (w * 3 + 1)] = f;
            for (let x = 0; x < w * 3; x++) {
                const v = rgb[y * w * 3 + x], a = x >= 3 ? rgb[y * w * 3 + x - 3] : 0, b = y ? rgb[(y - 1) * w * 3 + x] : 0, c = x >= 3 && y ? rgb[(y - 1) * w * 3 + x - 3] : 0;
                const p = a + b - c, pr = Math.abs(p - a) <= Math.abs(p - b) && Math.abs(p - a) <= Math.abs(p - c) ? a : Math.abs(p - b) <= Math.abs(p - c) ? b : c;
                raw[y * (w * 3 + 1) + 1 + x] = (v - [0, a, b, (a + b) >> 1, pr][f]) & 255;
            }
        }
        const png = encodePng(solid(w, h)); // reuse the signature and IHDR layout, then swap colour type and data
        const ihdr = png.subarray(8, 33);
        const hdr = Buffer.from(ihdr); hdr[17] = 2; // colour type RGB
        const crc = (t, d) => { let c = 0xffffffff; for (const x of Buffer.concat([Buffer.from(t), d])) { c ^= x; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; } return (c ^ 0xffffffff) >>> 0; };
        const chunk = (t, d) => { const o = Buffer.alloc(12 + d.length); o.writeUInt32BE(d.length, 0); o.write(t, 4, "latin1"); d.copy(o, 8); o.writeUInt32BE(crc(t, d), 8 + d.length); return o; };
        const body = hdr.subarray(8, 21);
        const file = Buffer.concat([png.subarray(0, 8), chunk("IHDR", body), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
        const got = decodePng(file);
        const back = Buffer.alloc(w * h * 3);
        for (let i = 0; i < w * h; i++) { back[i * 3] = got.rgba[i * 4]; back[i * 3 + 1] = got.rgba[i * 4 + 1]; back[i * 3 + 2] = got.rgba[i * 4 + 2]; }
        eq(back.equals(rgb), true, `süzgeç ${f}`);
    }
    eq([isBlank(solid(800, 600)), isBlank(gradient(800, 600))], [true, false], "tek renk boş sayılır");
    eq(similarity(gradient(100, 60), gradient(100, 60)), 1);
    const inv = gradient(100, 60); for (let i = 0; i < inv.rgba.length; i += 4) for (let k = 0; k < 3; k++) inv.rgba[i + k] = 255 - inv.rgba[i + k];
    ok(similarity(gradient(100, 60), inv) < 0.5, "ters çevrilmiş resim düşük puan");
    const inv2 = gradient(320, 180); for (let i = 0; i < inv2.rgba.length; i += 4) for (let k = 0; k < 3; k++) inv2.rgba[i + k] = 255 - inv2.rgba[i + k];
    ok(likeness(gradient(320, 180), inv2) < 70, "ters resim aynı sayılmaz");
    const g640 = gradient(640, 360);
    ok(likeness(g640, resize(g640, 1280, 720)) >= 95, "büyütülmüş aynı resim neredeyse aynı");
    eq(likeness(g640, g640), 100);
    eq(resize(solid(4, 4, 10), 2, 2).rgba[0], 10);
});

test("check: self-test hükmü (eksik adım 'not tested'; başarısız adım asla geçmez — kaynaktaki ters mantık E18)", () => {
    const req = ["create", "save", "reopen"];
    const all = verdict(JSON.stringify({ version: 1, steps: [{ step: "Create", passed: true, detail: "note a" }, { step: "save", passed: true }, { step: "reopen", passed: true }, { step: "export", passed: true }] }), req);
    eq([all.passed, all.claims.length], [true, 4]);
    const part = verdict(JSON.stringify({ steps: [{ step: "create", passed: true }, { step: "save", passed: false, detail: "file empty" }] }), req);
    eq([part.passed, part.claims.map((c) => [c.passed, c.detail])], [false, [[true, ""], [false, "file empty"], [false, "not tested"]]]);
    ok(/2 of 3 steps fail/.test(part.note), part.note);
    eq(verdict("{}", req).passed, false);
    ok(/version 2/.test(verdict(JSON.stringify({ version: 2, steps: [] }), req).note));
    eq(verdict(JSON.stringify({ steps: [] }), []).passed, false, "adımsız rapor geçmez");
});

test("check: başlatılacak program Cargo bildiriminden seçilir, en yeni dosyadan değil", () => {
    const app = tmpDir("cargo-ws");
    writeText(path.join(app, "Cargo.toml"), "[workspace]\nmembers = [\n  \"crates/*\",\n  \"tools\",\n]\n");
    writeText(path.join(app, "crates/core/Cargo.toml"), "[package]\nname = \"core\"\n[dependencies]\nserde = \"1\"\n");
    writeText(path.join(app, "crates/gui/Cargo.toml"), "[package]\nname = \"notlar\"\n\n[[bin]]\nname = \"notlar\"\n\n[target.'cfg(windows)'.dependencies]\neframe = { version = \"0.31\" }\n");
    writeText(path.join(app, "tools/Cargo.toml"), "[package]\nname = \"gen\"\n");
    writeText(path.join(app, "tools/src/main.rs"), "fn main(){}\n");
    eq(cargoPrograms(app), ["notlar", "gen"], "pencere paketi önce");
    eq(readToml("[package]\nname = \"x\" # yorum\ndefault-run = \"y\"\n").package, { name: "x", "default-run": "y" });
    const ext = process.platform === "win32" ? ".exe" : "";
    writeText(path.join(app, "target/release/notlar" + ext), "MZ");
    writeText(path.join(app, "target/debug/gen" + ext), "MZ newer");
    const t = Date.now() / 1000;
    fs.utimesSync(path.join(app, "target/release/notlar" + ext), t - 100, t - 100);
    eq(path.basename(builtProgram(app)), "notlar" + ext, "bildirilen pencere programı, daha yeni araç değil");
    eq(isConsoleProgram(process.execPath), process.platform === "win32", "node.exe konsol programıdır");
});

function appProject(label, mode) {
    const dir = tmpDir(label);
    git(["init", "-q", "-b", "main"], dir);
    for (const [k, v] of [["user.email", "test@example.invalid"], ["user.name", "test"], ["commit.gpgsign", "false"]]) git(["config", k, v], dir);
    init(dir, { name: label });
    const png = pathToFileURL(path.resolve("core/check/png.js")).href;
    writeText(path.join(dir, "app.mjs"), `import fs from "node:fs";\nimport process from "node:process";\nimport { encodePng } from ${JSON.stringify(png)};\nconst a = process.argv, mode = ${JSON.stringify(mode)};\nconst at = (f) => { const i = a.indexOf(f); return i < 0 ? null : a[i + 1]; };\nif (at("--screenshot")) { const w = 320, h = 200, rgba = new Uint8Array(w * h * 4); for (let i = 0; i < w * h; i++) { const v = mode === "blank" ? 40 : (i % w) & 255; rgba.set([v, v ^ 90, 128, 255], i * 4); } fs.writeFileSync(at("--screenshot"), encodePng({ width: w, height: h, rgba })); }\nif (at("--self-test")) fs.writeFileSync(at("--self-test"), JSON.stringify({ version: 1, steps: [{ step: "create", passed: true, detail: "note made" }, { step: "save", passed: mode !== "nosave", detail: mode === "nosave" ? "nothing on disk" : "12 bytes" }] }));\n`);
    const cfgFile = path.join(dir, ".evrim/config.json"), c = readJson(cfgFile);
    c.check = { ...c.check, kind: "window", program: [process.execPath, ...(process.versions.deno ? ["run", "-A"] : []), "app.mjs"], selfTest: { steps: ["create", "save"] }, runSeconds: 60 };
    writeJson(cfgFile, c);
    git(["add", "-A"], dir); git(["commit", "-qm", "app"], dir);
    return loadConfig(dir);
}

test("check: uçtan uca tur — çizen uygulama geçer, değişmeyince sonuç geçerli kalır, boş ekran ve eksik self-test kalır", async () => {
    const cfg = appProject("app-good", "good");
    eq(validate(cfg).errors, []);
    const r1 = await runChecks(cfg);
    ok(r1.passed, summary(r1));
    eq([r1.round, r1.results.map((r) => r.id), r1.program.why], [1, ["screenshot", "self-test"], "check.program"]);
    ok(fs.existsSync(path.join(cfg.root, ".evrim/state/checks/round-1/check.json")) && fs.existsSync(path.join(cfg.root, ".evrim/state/checks/round-1/screenshot.png")));
    const r2 = await runChecks(cfg);
    eq([r2.round, r2.kept, r2.passed], [2, 1, true], "hiçbir şey değişmedi: tur 1 geçerli");
    writeText(path.join(cfg.root, "src.txt"), "değişiklik\n");
    eq((await runChecks(cfg)).kept, undefined, "içerik değişince yeniden koşar");
    eq((await runChecks(cfg, { self: true })).round, 0, "--self tur 0");

    const blank = appProject("app-blank", "blank");
    const rb = await runChecks(blank);
    eq([rb.passed, rb.results[0].passed], [false, false]);
    ok(/blank/.test(rb.results[0].note));
    const nosave = appProject("app-nosave", "nosave");
    const rn = await runChecks(nosave);
    ok(!rn.passed && rn.results[1].claims.some((c) => c.title === "Self-test: save" && !c.passed && c.detail === "nothing on disk"), summary(rn));
    const rr = await runChecks(nosave);
    ok(!rr.kept, "başarısız tur saklanmaz, yeniden koşar");
});

test("check: lisans kipleri (uyarla / yalnız fikir / clean-room) ve M3 göçü (check bloğu eski projeye gelir)", () => {
    const d = (files) => { const dir = tmpDir("lic"); for (const [f, t] of Object.entries(files)) writeText(path.join(dir, f), t); return dir; };
    eq(detectLicense(d({ LICENSE: "Permission is hereby granted, free of charge, to any person obtaining a copy" })).mode, "adapt");
    eq(detectLicense(d({ "Cargo.toml": "[package]\nlicense = \"MIT OR Apache-2.0\"\n" })).ids, ["MIT", "Apache-2.0"]);
    eq(detectLicense(d({ COPYING: "GNU GENERAL PUBLIC LICENSE\n Version 3, 29 June 2007" })).mode, "ideas-only");
    eq(detectLicense(d({ "package.json": JSON.stringify({ license: "MPL-2.0" }) })).mode, "ideas-only", "MPL dosya düzeyinde copyleft");
    eq(detectLicense(d({ "README.md": "closed" })).mode, "clean-room");

    const cfg = appProject("mig-check", "good");
    const own = readJson(path.join(cfg.root, ".evrim/config.json"));
    delete own.check;
    writeJson(path.join(cfg.root, ".evrim/config.json"), own);
    git(["add", "-A"], cfg.root); git(["commit", "-qm", "old"], cfg.root);
    const p = planUpdate(cfg.root);
    ok(p.items.find((i) => i.rel === ".evrim/config.json").added.includes("check"));
    migrate(cfg.root, p);
    eq(readJson(path.join(cfg.root, ".evrim/config.json")).check.kind, "auto");
});

test("check: ajan run(check) ile kendi uygulamasına bakar; görüntü yalnız görebilen sağlayıcıya, kullanıcı mesajında gider (E4)", async () => {
    const agent = await import("../core/delegate/agent.js");
    const cfg = appProject("agent-check", "good");
    cfg.delegate.providers.deepseek.vision = true;
    const ctx = { cfg, wt: cfg.root, readRoot: cfg.root, plugins: [], track: { clock: 0, lastWrite: 0, seen: new Map() } };
    ctx.kit = agent.makeTools(ctx);
    let step = 0, seen = null;
    const fake = async (_c, messages) => {
        step++;
        if (step === 2) seen = messages[messages.length - 1];
        const call = step === 1 ? ["run", { command: "check" }] : ["finish", { status: "blocked", report: "x" }];
        return { message: { content: "", tool_calls: [{ id: "c" + step, type: "function", function: { name: call[0], arguments: JSON.stringify(call[1]) } }] }, cost: 0, tokens: { hit: 0, miss: 0, out: 0 } };
    };
    const msgs = [{ role: "system", content: "s" }, { role: "user", content: "u" }];
    await agent.loop(ctx, msgs, "k", ctx.kit.taskTools, 5, 1, "finish", fake);
    const tool = msgs.find((m) => m.role === "tool");
    ok(/^exit 0\ncv check · tur 0/.test(tool.content), tool.content.slice(0, 200));
    ok(seen && seen.role === "user" && Array.isArray(seen.content) && seen.content[1].image_url.detail === "low" && seen.content[1].image_url.url.startsWith("data:image/png;base64,"), "görüntü kullanıcı mesajında, düşük ayrıntı");
    cfg.delegate.providers.deepseek.vision = false;
    const msgs2 = [{ role: "system", content: "s" }, { role: "user", content: "u" }];
    step = 0;
    await agent.loop(ctx, msgs2, "k", ctx.kit.taskTools, 5, 1, "finish", fake);
    ok(!msgs2.some((m) => Array.isArray(m.content)), "görmeyen sağlayıcıya resim gitmez");
});
