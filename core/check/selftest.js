// The --self-test contract for desktop apps (craft-anything rebuild/kinds/self_test.rs + engine/src/self_test.rs,
// MIT OR Apache-2.0, generalised from games to any app). The app drives itself with scripted input, measures
// each step of its core use from its own state, saves {"version":1,"steps":[{"step","passed","detail"}]} and
// exits. A greenfield app is held to this, not to looking like a picture (ERRATA E7).
// Note: the local copy of self_test.rs returns its verdict inverted (passes when steps fail, contradicting
// its own tests); this port follows the documented and tested meaning (ERRATA E18).

export const SELF_TEST_VERSION = 1;

export const SELF_TEST_CONTRACT = "Give the program a `--self-test <file.json>` option: start the way a person would, drive the app with scripted input for a few seconds, measure from the app's own state whether each step of its core use works, save the results to that file and exit: {\"version\": 1, \"steps\": [{\"step\": \"create\", \"passed\": true, \"detail\": \"made note 'a'\"}, {\"step\": \"save\", \"passed\": true, \"detail\": \"file on disk, 12 bytes\"}]}. Name the steps as the check asks (config check.selfTest.steps). Measure, never assume: a step passes only when the app's state shows it. Without the option the program starts as usual.";

export const SCREENSHOT_CONTRACT = "Give the program a `--screenshot <file.png>` option: start normally, draw about 120 frames, save the window's picture as a PNG to that file and exit. With the option open the window without taking focus (and on Windows behind other windows), and keep drawing while unfocused. In egui: `ViewportBuilder::with_active(false)` and on Windows `with_window_level(WindowLevel::AlwaysOnBottom)`. Started without the option, the program opens as usual. A build without the option, or with a blank picture, does not pass.";

// Reads a report; throws a plain reason when it cannot be used.
export function readReport(text) {
    let r;
    try { r = JSON.parse(String(text)); } catch (e) { throw new Error(`the --self-test file is not JSON (${e.message})`); }
    if (!r || !Array.isArray(r.steps) || !r.steps.every((s) => s && typeof s.step === "string" && typeof s.passed === "boolean")) throw new Error("the --self-test file has no valid steps ({step, passed, detail})");
    const version = r.version === undefined ? SELF_TEST_VERSION : r.version;
    if (version > SELF_TEST_VERSION) throw new Error(`the --self-test file says version ${version}; this package reads version ${SELF_TEST_VERSION}`);
    return { version, steps: r.steps.map((s) => ({ step: s.step.trim(), passed: s.passed, detail: String(s.detail || "").trim() })) };
}

const same = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

// One claim per required step (a step the app did not test fails as "not tested"), then up to 20 of the
// app's own extra steps. passed = every required step passed (and at least one step exists).
export function verdict(text, required = []) {
    let report;
    try { report = readReport(text); } catch (e) { return { passed: false, note: `${e.message}. ${SELF_TEST_CONTRACT}`, claims: [] }; }
    const claims = required.map((step) => {
        const s = report.steps.find((x) => same(x.step, step));
        return s ? { title: `Self-test: ${step}`, passed: s.passed, detail: s.passed ? s.detail : s.detail || "the app says it failed" } : { title: `Self-test: ${step}`, passed: false, detail: "not tested" };
    });
    for (const s of report.steps.filter((x) => !required.some((r) => same(r, x.step))).slice(0, 20)) claims.push({ title: `Self-test: ${s.step}`, passed: s.passed, detail: s.detail || (s.passed ? "" : "failed") });
    const failing = claims.filter((c) => !c.passed);
    const passed = claims.length > 0 && failing.length === 0;
    const note = passed
        ? `The self-test passes: ${claims.map((c) => c.title.replace(/^Self-test: /, "") + (c.detail ? ` (${c.detail})` : "")).join(", ")}.`
        : claims.length ? `The self-test does not pass yet: ${failing.length} of ${claims.length} steps fail (${failing.map((c) => `${c.title.replace(/^Self-test: /, "")}: ${c.detail}`).join("; ")}).` : "The self-test file lists no steps.";
    return { passed, note, claims };
}
