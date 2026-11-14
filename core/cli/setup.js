// cv setup
// Once per machine: writes user-level skills for Claude Code, Codex, and Antigravity that name
// where this package lives. Their descriptions are in every new session's context, so a fresh session
// in a project where the package was dropped (or where the owner asks for it) knows what to do without a word.
// `cv init` runs it too. Idempotent; CLAUDE_CONFIG_DIR and CODEX_HOME are respected.
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { exists, readText, writeText } from "../lib/util.js";
import { PKG_ROOT } from "../lib/config.js";

const resolveHome = (env = process.env) => env.USERPROFILE || env.HOME || os.homedir();

export const userSkillFile = (env = process.env) => path.join(env.CLAUDE_CONFIG_DIR || path.join(resolveHome(env), ".claude"), "skills", "claudevolution", "SKILL.md");
export const userSkillText = (pkg = PKG_ROOT) => readText(path.join(PKG_ROOT, "templates", "user", "claudevolution", "SKILL.md")).replace(/\{\{pkg\}\}/g, pkg.replace(/\\/g, "/"));

// Targets for all supported platforms (Claude Code, Codex Desktop & CLI, Antigravity Desktop & agy CLI).
export function userSkillTargets(env = process.env) {
    const homeDir = resolveHome(env);
    return [
        {
            id: "claude",
            platform: "Claude Code",
            file: userSkillFile(env),
        },
        {
            id: "codex",
            platform: "Codex",
            file: path.join(env.CODEX_HOME || path.join(homeDir, ".codex"), "skills", "claudevolution", "SKILL.md"),
        },
        {
            id: "antigravity",
            platform: "Antigravity",
            file: path.join(env.ANTIGRAVITY_HOME || path.join(homeDir, ".gemini", "antigravity"), "skills", "claudevolution", "SKILL.md"),
        },
    ];
}

// Returns "yeni" | "güncellendi" | "aynı".
export function setup({ file = userSkillFile(), pkg = PKG_ROOT } = {}) {
    const want = userSkillText(pkg);
    if (exists(file) && readText(file).replace(/\r\n/g, "\n") === want.replace(/\r\n/g, "\n")) return "aynı";
    const had = exists(file);
    writeText(file, want);
    return had ? "güncellendi" : "yeni";
}

// Installs or updates the user-level skill across all supported platforms.
export function setupAll({ pkg = PKG_ROOT, env = process.env } = {}) {
    return userSkillTargets(env).map((t) => ({
        ...t,
        status: setup({ file: t.file, pkg }),
    }));
}

export async function run() {
    const results = setupAll();
    for (const r of results) console.log(`makine becerisi (${r.platform}) ${r.status}: ${r.file}`);
    console.log("Artık bu makinede açılan her Claude, Codex ve Antigravity oturumu claudevolution'ı tanır; yeni projede `claudevrim init` sonrası ilk mesajda kurulum görüşmesini başlatır.");
    return 0;
}
