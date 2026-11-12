// cv setup
// Once per machine: writes a user-level Claude skill (~/.claude/skills/claudevolution/SKILL.md) that names
// where this package lives. Its description is in every new session's context, so a fresh session in a
// project where the package was dropped (or where the owner asks for it) knows what to do without a word.
// `cv init` runs it too. Idempotent; CLAUDE_CONFIG_DIR is respected.
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { exists, readText, writeText } from "../lib/util.js";
import { PKG_ROOT } from "../lib/config.js";

export const userSkillFile = (env = process.env) => path.join(env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude"), "skills", "claudevolution", "SKILL.md");
export const userSkillText = (pkg = PKG_ROOT) => readText(path.join(PKG_ROOT, "templates", "user", "claudevolution", "SKILL.md")).replace(/\{\{pkg\}\}/g, pkg.replace(/\\/g, "/"));

// Returns "yeni" | "güncellendi" | "aynı".
export function setup({ file = userSkillFile(), pkg = PKG_ROOT } = {}) {
    const want = userSkillText(pkg);
    if (exists(file) && readText(file).replace(/\r\n/g, "\n") === want.replace(/\r\n/g, "\n")) return "aynı";
    const had = exists(file);
    writeText(file, want);
    return had ? "güncellendi" : "yeni";
}

export async function run() {
    const file = userSkillFile();
    const r = setup({ file });
    console.log(`makine becerisi ${r}: ${file}`);
    console.log("Artık bu makinede açılan her Claude oturumu claudevolution'ı tanır; yeni projede `claudevrim init` sonrası ilk mesajda kurulum görüşmesini başlatır.");
    return 0;
}
