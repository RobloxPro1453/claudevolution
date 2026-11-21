// Starting other programs safely on Windows, adapted from craft-anything crates/platform/src/{process,which}.rs
// (MIT OR Apache-2.0):
//  - npm installs tools as `.cmd` shims; through cmd.exe an argument with a line break is refused, `%` is
//    expanded and a line stops at 8191 characters. A shim's script is started by its interpreter directly
//    (`node.exe <script>`), and a `.cmd` that only wraps one `.exe` starts that `.exe`.
//  - what a log or an error shows of a command masks secret-looking flags and leaves out very long arguments;
//    `redact` masks key-looking values in any text before it reaches a log (SECRET_RES, the same patterns the
//    privacy scan uses).
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { SECRET_RES } from "./secrets.js";

// What an npm/pnpm `.cmd` shim runs: { interpreter: "node" | path | null, target } or null.
export function parseNpmShim(text) {
    const exe = exeWrapperTarget(text);
    if (exe) return { interpreter: null, target: exe };
    const run = String(text).split(/\r?\n/).find((l) => l.includes("%*"));
    if (!run) return null;
    const quoted = run.split('"').filter((_, i) => i % 2 === 1);
    const target = [...quoted].reverse().map((q) => (q.startsWith("%dp0%\\") ? q.slice(6) : q.startsWith("%~dp0\\") ? q.slice(6) : null)).find(Boolean);
    if (!target) return null;
    if (/\.exe$/i.test(target)) return { interpreter: null, target };
    let interpreter = null;
    if (quoted.includes("%_prog%")) interpreter = String(text).split(/\r?\n/).map((l) => l.trim().match(/^SET "_prog=(.*)"$/)).filter(Boolean).map((m) => m[1]).find((p) => !p.includes("%")) || null;
    else if (quoted.some((q) => /\\node\.exe$/i.test(q))) interpreter = "node";
    return interpreter ? { interpreter, target } : null;
}

function exeWrapperTarget(text) {
    let target = null;
    for (const raw of String(text).split(/\r?\n/)) {
        const line = raw.trim(), lower = line.toLowerCase().replace(/^@/, "");
        if (!line || lower === "echo off" || lower === "rem" || lower.startsWith("rem ") || lower.startsWith("::")) continue;
        const m = line.replace(/^@/, "").match(/^"([^"]+)"\s*(.*)$/);
        if (!m || target || m[2].trim() !== "%*" || !/^(?:[A-Za-z]:\\|\\\\)/.test(m[1]) || m[1].includes("%") || !/\.exe$/i.test(m[1])) return null;
        target = m[1];
    }
    return target;
}

// On Windows a bare name ("npm", "cargo") is looked up on PATH with PATHEXT, like a shell would: Node's
// spawn without a shell finds only "<name>.exe"-less files never, so ["npm", "run", "build"] failed with
// ENOENT although npm was installed (npm is npm.cmd). Returns the full path, or the name unchanged.
export function whichWin(name, env = process.env) {
    if (/[\\/]/.test(name) || path.extname(name)) return name;
    const exts = String(env.PATHEXT || ".COM;.EXE;.BAT;.CMD").split(";").filter(Boolean);
    for (const dir of String(env.PATH || env.Path || "").split(";").filter(Boolean)) {
        for (const ext of exts) { const f = path.join(dir, name + ext.toLowerCase()); try { if (fs.statSync(f).isFile()) return f; } catch (_) { /* next */ } }
    }
    return name;
}

// [program, ...args] that start `file` (a .cmd shim becomes its interpreter + script); other files unchanged.
export function launchTarget(file, args = [], env = process.env) {
    if (process.platform === "win32") file = whichWin(file, env);
    if (!/\.(cmd|bat)$/i.test(file)) return [file, ...args];
    let text = "";
    try { text = fs.readFileSync(file, "utf8"); } catch (_) { return [file, ...args]; }
    const dir = path.dirname(file);
    const shim = parseNpmShim(text);
    if (!shim) { const v = variableShim(text, dir); return v ? [...v, ...args] : [file, ...args]; }
    const target = path.join(dir, shim.target);
    if (!shim.interpreter) return [path.isAbsolute(shim.target) ? shim.target : target, ...args];
    const interp = shim.interpreter.startsWith("%dp0%\\") ? path.join(dir, shim.interpreter.slice(6)) : fs.existsSync(path.join(dir, "node.exe")) ? path.join(dir, "node.exe") : shim.interpreter;
    return [interp, target, ...args];
}

// npm's own npm.cmd (and similar) name the interpreter and script through variables:
//   SET "NODE_EXE=%~dp0\node.exe" ... SET "NPM_CLI_JS=%~dp0\node_modules\npm\bin\npm-cli.js" ... "%NODE_EXE%" "%NPM_CLI_JS%" %*
// The first SET of each variable is used (later conditional overrides are ignored); both parts must exist.
export function variableShim(text, dir) {
    const lines = String(text).split(/\r?\n/);
    const vars = {};
    for (const l of lines) { const m = l.trim().match(/^SET "([A-Za-z_][\w]*)=([^"]*)"$/i); if (m && !(m[1] in vars)) vars[m[1]] = m[2]; }
    const run = lines.find((l) => /^\s*"%[\w]+%"\s+"%[\w]+%"\s+%\*\s*$/.test(l));
    if (!run) return null;
    const parts = [...run.matchAll(/"%([\w]+)%"/g)].map((m) => vars[m[1]]);
    if (parts.some((p) => !p)) return null;
    const full = parts.map((p) => p.replace(/^%~?dp0%?\\?/i, dir + path.sep));
    if (!full.every((p) => fs.existsSync(p))) return null;
    return full;
}

const SECRET_FLAG =/token|secret|password|passwd|api[-_]?key|apikey|credential/i;
export function printableCommand(program, args = []) {
    const words = [program];
    let maskNext = false;
    for (const a of args.map(String)) {
        const secret = a.startsWith("-") && SECRET_FLAG.test(a.split("=")[0]);
        words.push(maskNext ? "<hidden>" : secret && a.includes("=") ? `${a.split("=")[0]}=<hidden>` : a.length > 200 ? `<${a.length} characters left out>` : /[\s"']/.test(a) ? JSON.stringify(a) : a);
        maskNext = secret && !a.includes("=");
    }
    return words.join(" ");
}

// Key-looking values in free text become "<hidden>" (logs, reports, Telegram messages).
export function redact(text) {
    let s = String(text);
    for (const re of SECRET_RES) s = s.replace(new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g"), "<hidden>");
    return s.replace(/\b(\d{6,12}:[A-Za-z0-9_-]{30,})\b/g, "<hidden>"); // Telegram bot tokens
}
