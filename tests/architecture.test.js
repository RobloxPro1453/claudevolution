// The package's shape, checked: zero dependencies, layers that only point down, no file growing without end,
// and the command list matching the command files. Cheap, no network; catches drift a review would miss.
import fs from "node:fs";
import path from "node:path";
import { eq, ok, test } from "./harness.js";
import { PKG_ROOT } from "../core/lib/config.js";

const rel = (p) => path.relative(PKG_ROOT, p).replace(/\\/g, "/");
function jsFiles(dir) {
    const out = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) out.push(...jsFiles(p));
        else if (e.name.endsWith(".js")) out.push(p);
    }
    return out;
}
const code = [...jsFiles(path.join(PKG_ROOT, "core")), ...jsFiles(path.join(PKG_ROOT, "bin"))];
const imports = (file) => [...fs.readFileSync(file, "utf8").matchAll(/^\s*import\s[^;]*?from\s+"([^"]+)"|import\("([^"]+)"\)/gm)].map((m) => m[1] || m[2]);
export const MAX_LINES = 1000;

test("mimari: sıfır bağımlılık — core/ ve bin/ yalnız node: yerleşiklerini ve kendi dosyalarını içe aktarır", () => {
    const bad = [];
    for (const f of code) for (const s of imports(f)) if (!s.startsWith("node:") && !s.startsWith(".") && !s.includes("${")) bad.push(`${rel(f)} → ${s}`);
    eq(bad, [], "paket dışı modül");
});

test("mimari: katmanlar yalnız aşağı bakar — iş mantığı komut katmanını (core/cli) içe aktarmaz; core/lib yalnız core/lib'e bakar", () => {
    const bad = [];
    for (const f of code) {
        const r = rel(f);
        // The command layer and the measuring kit (core/bench builds throwaway projects with init, like a test) sit on top.
        if (r.startsWith("core/cli/") || r.startsWith("bin/") || r.startsWith("core/bench/")) continue;
        for (const s of imports(f)) {
            if (!s.startsWith(".")) continue;
            const target = rel(path.resolve(path.dirname(f), s));
            if (target.startsWith("core/cli/")) bad.push(`${r} → ${target}`);
            if (r.startsWith("core/lib/") && !target.startsWith("core/lib/")) bad.push(`${r} → ${target} (lib en alt katman)`);
        }
    }
    eq(bad, [], "yukarı bakan içe aktarma");
});

test(`mimari: şişkinlik freni — hiçbir kod dosyası ${MAX_LINES} satırı geçmez (geçerse böl, büyütme)`, () => {
    const big = code.map((f) => [rel(f), fs.readFileSync(f, "utf8").split("\n").length]).filter(([, n]) => n > MAX_LINES);
    eq(big, [], "çok büyük dosya");
});

test("mimari: cv yardım listesi ile core/cli komut dosyaları birebir", async () => {
    // A command file exports run(); helpers in core/cli (migrate, prereq) do not and are not commands.
    const dir = path.join(PKG_ROOT, "core", "cli");
    const isCommand = (f) => /export\s+(async\s+)?function\s+run\s*\(/.test(fs.readFileSync(path.join(dir, f), "utf8"));
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".js") && !f.startsWith("_") && isCommand(f)).map((f) => f.replace(/\.js$/, "")).sort();
    const listed = [...fs.readFileSync(path.join(PKG_ROOT, "bin", "cv.js"), "utf8").matchAll(/^\s{4}(\w+):\s"/gm)].map((m) => m[1]).sort();
    eq(listed, files, "COMMANDS ↔ core/cli");
    ok(files.includes("guard"), "kota bekçisi komutu kayıtlı");
});
