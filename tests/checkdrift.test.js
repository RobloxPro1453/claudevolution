// cv check: two more pictures — the layout must hold still between frame 120 and frame 360 (a sidebar that
// grew every frame passed the old one-picture check) and the app must draw in a narrow window. A scripted
// stand-in runner writes the PNG files: no build, no real program, no window.
import fs from "node:fs";
import { eq, ok, test, tmpDir } from "./harness.js";
import { encodePng } from "../core/check/png.js";
import { diffShare } from "../core/check/image.js";
import { runChecks } from "../core/check/check.js";

const W = 40, H = 30;

// A small picture. `half` changes the right half far enough that every such pixel counts as moved
// ("the sidebar widens every frame").
function picture({ half = false } = {}) {
    const rgba = new Uint8Array(W * H * 4);
    for (let i = 0; i < W * H; i++) {
        const o = i * 4, x = i % W, y = (i / W) | 0, moved = half && x >= W / 2;
        rgba[o] = moved ? 250 : (x * 6) & 255;
        rgba[o + 1] = moved ? 10 : (y * 8) & 255;
        rgba[o + 2] = moved ? 10 : 120;
        rgba[o + 3] = 255;
    }
    return { width: W, height: H, rgba };
}

// Stands in for the app: writes a PNG wherever --screenshot points and records the environment it got.
function fakeApp({ late = null } = {}) {
    const calls = [];
    const runProgram = async (_program, args, options = {}) => {
        const env = options.env || {}, at = args.indexOf("--screenshot");
        const file = at < 0 ? null : args[at + 1];
        calls.push({ file, frames: env.CV_SHOT_FRAMES, size: env.CV_SHOT_SIZE, hasPath: !!env.PATH });
        if (file) fs.writeFileSync(file, encodePng(late && env.CV_SHOT_FRAMES === "360" ? late : picture()));
        return { code: 0, text: "", timedOut: false };
    };
    return { runProgram, calls };
}

const deps = (runProgram) => ({ program: { program: "x", args: [], why: "test" }, skipBuild: true, force: true, runProgram });
const shot = (round) => round.results.find((r) => r.id === "screenshot");

test("check: diffShare (aynı resim 0, yarısı değişmiş 0.5, farklı boyut 1)", () => {
    const a = picture(), b = picture({ half: true });
    eq(diffShare(a, a), 0, "aynı resim");
    eq(diffShare(a, b), 0.5, "yarısı değişmiş");
    eq(diffShare(a, { width: W + 1, height: H, rgba: new Uint8Array((W + 1) * H * 4) }), 1, "farklı boyut");
    // A change of 24 or less in every channel is noise, not a moved layout.
    const near = { width: W, height: H, rgba: Uint8Array.from(a.rgba) };
    for (let i = 0; i < W * H; i++) near.rgba[i * 4] = Math.min(255, near.rgba[i * 4] + 24);
    eq(diffShare(a, near), 0, "24 fark gürültü");
});

test("check: env'i yok sayan uygulama iki resimde aynı — kayma ve dar pencere iddiaları geçer", async () => {
    const cfg = { root: tmpDir("drift-same"), check: {} };
    const { runProgram, calls } = fakeApp();
    const round = await runChecks(cfg, { deps: deps(runProgram) });
    const r = shot(round);
    eq([round.passed, r.passed], [true, true], "tur geçer");
    eq(r.claims.map((c) => c.title), ["The window draws something", "Layout holds still (frame 120 vs 360)", "Draws in a narrow window"]);
    eq(calls.length, 3, "bir resim + iki ek resim");
    ok(calls.some((c) => c.frames === "360" && c.hasPath), "CV_SHOT_FRAMES=360, ortam korunur");
    ok(calls.some((c) => c.size === "800x560"), "CV_SHOT_SIZE=800x560");
    ok(r.artifacts.includes(".evrim/state/checks/round-1/screenshot-late.png"), r.artifacts.join(", "));
    ok(r.artifacts.includes(".evrim/state/checks/round-1/screenshot-narrow.png"), r.artifacts.join(", "));
});

test("check: geç gelen resim yarısı farklı — kayma iddiası ve tur kalır", async () => {
    const cfg = { root: tmpDir("drift-moved"), check: {} };
    const { runProgram } = fakeApp({ late: picture({ half: true }) });
    const round = await runChecks(cfg, { deps: deps(runProgram) });
    const r = shot(round);
    eq([round.passed, r.passed], [false, false], "tur kalır");
    const drift = r.claims.find((c) => c.title === "Layout holds still (frame 120 vs 360)");
    ok(drift && !drift.passed && /50%/.test(drift.detail), JSON.stringify(drift));
    ok(r.claims.find((c) => c.title === "Draws in a narrow window").passed, "dar pencere yine geçer");
});
