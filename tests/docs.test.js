// Documents promise things to the owner and to agents; these tests keep the promises true.
import fs from "node:fs";
import path from "node:path";
import { test, eq, ok } from "./harness.js";
import { readText } from "../core/lib/util.js";
import { PKG_ROOT, TEMPLATE_DIR, defaults } from "../core/lib/config.js";

const doc = (rel) => readText(path.join(PKG_ROOT, rel));

test("belge: OWNER_GUIDE'ın gösterdiği dosyalar ve ayarlar gerçekten var", () => {
    const g = doc("docs/OWNER_GUIDE.md");
    for (const w of ["DUR", "ÖNCE:", "NOTLAR.md", "OZET.md", "SORULAR.md"]) ok(g.includes(w), "eksik: " + w);
    for (const rel of new Set(g.match(/\.evrim\/[\w./]+\.(md|json)/g))) ok(fs.existsSync(path.join(TEMPLATE_DIR, rel)), "şablonda yok: " + rel);
    ok(g.includes("dailyBudget") && typeof defaults().delegate.dailyBudget === "number", "dailyBudget config'de");
    const gates = defaults().autonomy.gates;
    ok(g.includes(`%${gates.fiveHourNoNewStep}`) && g.includes(`%${gates.fiveHourExit}`), "kapı yüzdeleri config ile aynı");
    ok(g.includes(`${defaults().autonomy.lockStaleMinutes} dakika`), "kilit bayatlığı config ile aynı");
    eq(/`(node|deno) /.test(g), false, "sahip rehberinde komut satırı yok");
});

test("belge: INVENTORY §4'teki 16 dersin her birinin 'nereye gitti' hücresi var ve gösterdiği dosyalar var", () => {
    const inv = doc("docs/INVENTORY.md");
    const sec = inv.slice(inv.indexOf("## 4. "), inv.indexOf("## 5. "));
    const rows = sec.split("\n").filter((l) => /^\| \d+ \|/.test(l));
    eq(rows.map((l) => Number(l.split("|")[1])), Array.from({ length: 16 }, (_, i) => i + 1), "16 ders sırayla");
    for (const r of rows) {
        const cell = r.replace(/\s*\|\s*$/, "").split(" | ").pop().trim();
        ok(cell.length > 10, "boş hücre: ders " + r.split("|")[1]);
        for (const m of cell.matchAll(/`((?:core|skills|templates|docs|tests|evolution|bin)\/[^`\s]+|\.evrim\/[^`\s]+)`/g)) {
            const rel = m[1].startsWith(".evrim/") ? "templates/project/" + m[1] : m[1];
            ok(fs.existsSync(path.join(PKG_ROOT, rel)), `ders ${r.split("|")[1]}: yok: ${m[1]}`);
        }
    }
});
