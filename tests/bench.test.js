// Tier B chaos scenarios and the bench comparison. Zero model tokens; tier A is not re-run here (recursion).
import { test, eq, ok } from "./harness.js";
import * as chaos from "../core/bench/chaos.js";
import * as bench from "../core/bench/bench.js";

test("kaos: bütün senaryolar geçer ve en az 13 senaryo var", () => {
    const r = chaos.runAll();
    ok(r.total >= 13, "senaryo sayısı " + r.total);
    eq(r.failed.map((f) => `${f.id}: ${f.fails.join("; ")}`), [], "kalan");
});
test("kaos: yanlış beklenti her senaryoda yakalanır (boş senaryo yok)", () => {
    for (const s of chaos.load()) {
        const bad = structuredClone(s);
        if (bad.expect.decision) bad.expect.decision = bad.expect.decision === "GO" ? "CIK" : "GO";
        else bad.expect.contains = ["BU_METIN_YOK_XYZ"];
        ok(chaos.runOne(bad).length > 0, "yanlış beklenti geçti: " + s.id);
    }
});
test("bench: kapılar ve boyut karşılaştırması", () => {
    const base = { A: { ok: true, passed: 10, total: 10 }, B: { passed: 20, total: 20, failed: [] }, sizes: { codeLines: 1000, skillLines: 100, templateLines: 100 } };
    eq(bench.compare(base, base).ok, true, "aynısı geçer");
    const fewer = { ...base, B: { passed: 19, total: 19, failed: [] } };
    ok(bench.compare(fewer, base).gates.some((g) => /azaldı/.test(g)), "senaryo silmek kapıya takılır");
    const red = { ...base, A: { ok: false, passed: 9, total: 10 } };
    eq(bench.compare(red, base).ok, false, "kırmızı test");
    const trap = { ...base, C: { status: "tamam", solved: 3, total: 4, trapViolations: 1 } };
    eq(bench.compare(trap, base).ok, false, "tuzak ihlali");
    const unmeasured = { ...base, C: { status: "olculemedi", reason: "tavan" } };
    eq(bench.compare(unmeasured, base).ok, false, "ölçülemedi kabul edilmez");
    const big = { ...base, sizes: { ...base.sizes, codeLines: 1200 } };
    ok(bench.compare(big, base).worse.length === 1 && bench.compare(big, base).ok, "büyüme kötü sayılır ama kapı değildir");
});
