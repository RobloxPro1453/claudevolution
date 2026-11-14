// Two universal layers reach every project as one file, .evrim/evrensel.md:
//   1. the package's evolution/universal/ (the maintainer's, updated from GitHub)
//   2. this machine's ~/.claudevrim/evrensel/ (lessons of an owner who cannot push to the package)
// Same lesson in both (dates and spacing ignored) is listed once; nothing in either layer is ever dropped.
import path from "node:path";
import process from "node:process";
import { exists, lines, readText, writeText } from "../lib/util.js";
import { PKG_ROOT } from "../lib/config.js";
import { userUniversal } from "../lib/home.js";

const bullets = (text) => lines(String(text).replace(/<!--[\s\S]*?-->/g, "")).filter((l) => /^\s*-\s+\S/.test(l)).map((l) => l.trim());
export const keyOf = (line) => line.replace(/^-\s+/, "").replace(/\s*\(\d{4}-\d{2}-\d{2}[^)]*\)\s*$/, "").replace(/\s+/g, " ").trim().toLowerCase();
const blocks = (text) => String(text).split(/\n(?=## )/).filter((b) => b.startsWith("## ")).map((b) => b.trim());

export function merged({ pkg = PKG_ROOT, env = process.env } = {}) {
    const fromPkg = bullets(readText(path.join(pkg, "evolution", "universal", "DERSLER.md"), ""));
    const seen = new Set(fromPkg.map(keyOf));
    const fromMachine = bullets(readText(userUniversal("ders", env), "")).filter((l) => !seen.has(keyOf(l)) && seen.add(keyOf(l)));
    const errPkg = blocks(readText(path.join(pkg, "evolution", "universal", "HATALAR.md"), ""));
    const heads = new Set(errPkg.map((b) => keyOf(b.split("\n")[0].replace(/^##\s+/, ""))));
    const errMachine = blocks(readText(userUniversal("hata", env), "")).filter((b) => !heads.has(keyOf(b.split("\n")[0].replace(/^##\s+/, ""))));
    return { fromPkg, fromMachine, errPkg, errMachine };
}

export function render(m) {
    return ["# Evrensel dersler (üretilmiş; elle düzenlenmez)", "",
        "Her projede geçerli dersler. Kaynak: paketin `evolution/universal/` (GitHub) + bu makinenin `~/.claudevrim/evrensel/`. `cv update` ve `claudevrim init` yeniden üretir.", "",
        "## Paket", ...(m.fromPkg.length ? m.fromPkg : ["- (yok)"]), "",
        "## Bu makine", ...(m.fromMachine.length ? m.fromMachine : ["- (yok)"]), "",
        ...(m.errPkg.length || m.errMachine.length ? ["# Evrensel hata kalıpları", "", ...m.errPkg, "", ...m.errMachine, ""] : [])].join("\n").replace(/\n{3,}/g, "\n\n") + "\n";
}

export const projectFile = (root) => path.join(root, ".evrim", "evrensel.md");
export function writeProject(root, opts = {}) {
    const m = merged(opts);
    writeText(projectFile(root), render(m));
    return { pkg: m.fromPkg.length, machine: m.fromMachine.length };
}
// The lesson lines only, for the cycle output (bounded).
export const projectLessons = (root) => (exists(projectFile(root)) ? bullets(readText(projectFile(root)).split(/^# Evrensel hata/m)[0]).filter((l) => l !== "- (yok)") : []);
