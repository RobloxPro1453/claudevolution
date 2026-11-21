// T-001: the delivered-criteria table (`cv intent coverage --delivered`). After a build the owner must see
// whether every finalForm criterion was really tried (✓ passed, ✗ failed, ~ not tried), not just "done".
import path from "node:path";
import { eq, ok, test, tmpDir } from "./harness.js";
import { writeJson } from "../core/lib/util.js";
import { delivered, renderDelivered } from "../core/intent/intent.js";
import { main as cliMain } from "../bin/cv.js";

// The owner's list: two criteria with a self-test step, one with an id that no step covers, one plain line.
const cfg = {
    root: "yok/boyle/bir/yer",
    finalForm: { criteria: ["[E:create] Yeni not tek tuşla açılır", "[E:undo] Her değişiklik geri alınır", "[E:search] Tüm notlarda arama", "Tek .exe çift tıkla açılır, kurulum istemez"] }
};
// A fake round whose self-test claims say: create passed, search failed; undo was never tested.
const round = {
    round: 3, passed: false,
    results: [
        { id: "build", passed: true, claims: [] },
        { id: "self-test", passed: false, claims: [
            { title: "Self-test: create", passed: true, detail: "" },
            { title: "Self-test: search", passed: false, detail: "2/4 arama adımı geçti" }
        ] }
    ]
};

test("delivered: her ölçüt ✓ geçti / ✗ kaldı / ~ denenmedi olarak eşlenir", () => {
    const d = delivered(cfg, round);
    eq(d.items.map((i) => i.state), ["pass", "untried", "fail", "untried"], "durumlar");
    eq(d.items.map((i) => i.id), ["create", "undo", "search", null], "kimlikler");
    eq(d.totals, { pass: 1, fail: 1, untried: 2 }, "toplamlar");
    ok(d.items[2].detail.includes("2/4"), "kalanın nedeni iddiadan gelir");
    const text = renderDelivered(d);
    ok(text.includes("✓ [E:create]"), text);
    ok(text.includes("✗ [E:search]") && text.includes("2/4 arama adımı geçti"), "kalan satırı nedeniyle: " + text);
    ok(text.includes("~ [E:undo]"), text);
    ok(text.includes("Karşılanan: 1/4 · denenmedi: 2 · kalan: 1"), text);
});

test("delivered: [E:] olmayan ölçüt yalnız `cv check` der ve tur geçtiyse denenmiş sayılır", () => {
    const c = { ...cfg, finalForm: { criteria: ["cv check geçer", "Tek .exe çift tıkla açılır"] } };
    eq(delivered(c, round).items.map((i) => i.state), ["untried", "untried"], "tur kaldı: denenmedi");
    eq(delivered(c, { ...round, passed: true }).items.map((i) => i.state), ["pass", "untried"]);
    eq(delivered(c, { ...round, passed: true }).items[0].id, null);
});

test("delivered: tur yoksa hepsi denenmedi", () => {
    const d = delivered(cfg, null);
    eq(d.items.map((i) => i.state), ["untried", "untried", "untried", "untried"]);
    eq(d.totals, { pass: 0, fail: 0, untried: 4 });
    ok(renderDelivered(d).includes("Karşılanan: 0/4"));
});

test("cli: cv intent coverage --delivered tabloyu yazar, çıkış kodu 0 (denetim turu yokken de)", async () => {
    const dir = tmpDir("delivered");
    writeJson(path.join(dir, ".evrim/config.json"), { schema: 1, project: "delivered", baseBranch: "main", finalForm: { deliverable: null, verifyCmd: null, criteria: ["[E:create] Yeni not", "Tek .exe"] } });
    const quiet = async (argv) => { const o = console.log; const logs = []; console.log = (...a) => logs.push(a.join(" ")); try { return { code: await cliMain(argv), out: logs.join("\n") }; } finally { console.log = o; } };
    const r = await quiet(["intent", "coverage", "--delivered", "--dir", dir]);
    eq(r.code, 0, r.out);
    ok(r.out.includes("cv check"), "tur yok uyarısı: " + r.out);
    ok(r.out.includes("~ [E:create] Yeni not") && r.out.includes("Karşılanan: 0/2"), r.out);
    const j = await quiet(["intent", "coverage", "--delivered", "--json", "--dir", dir]);
    eq(j.code, 0, j.out);
    eq(JSON.parse(j.out).totals, { pass: 0, fail: 0, untried: 2 });
});
