// Claude Code hooks the package installs into a project's .claude/settings.json: the quota guard (cv guard)
// before and after every work tool. Merged, never replaced: the owner's own settings and hooks stay; an
// unreadable settings file is left alone (and reported) rather than overwritten.
import path from "node:path";
import { exists, readText } from "./util.js";

export const SETTINGS_REL = ".claude/settings.json";
export const MARK = "cv\" guard";
// Work tools only: reading tools are cheap and frequent, a process per Read would cost time for nothing.
export const MATCHER = "Edit|Write|MultiEdit|NotebookEdit|Agent|Task|Workflow|Bash|PowerShell";
const cmd = (event) => `"$CLAUDE_PROJECT_DIR/.evrim/cv" guard --event ${event}`;
export const wantGroups = () => ({
    PreToolUse: { matcher: MATCHER, hooks: [{ type: "command", command: cmd("pre"), timeout: 15 }] },
    PostToolUse: { matcher: MATCHER, hooks: [{ type: "command", command: cmd("post"), timeout: 15 }] }
});

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const hasGuard = (groups) => Array.isArray(groups) && groups.some((g) => isObj(g) && Array.isArray(g.hooks) && g.hooks.some((h) => isObj(h) && String(h.command || "").includes(MARK)));

// Pure: { text, changed, error }. text is the merged settings (2-space JSON) when changed.
export function mergeSettings(oldText) {
    let doc = {};
    if (oldText !== null && oldText !== undefined && String(oldText).trim()) {
        try { doc = JSON.parse(String(oldText).replace(/^﻿/, "")); } catch (e) { return { changed: false, error: `${SETTINGS_REL} okunamadı (${e.message}); kota bekçisi kancası eklenmedi, elle bakın` }; }
        if (!isObj(doc)) return { changed: false, error: `${SETTINGS_REL} nesne değil; kota bekçisi kancası eklenmedi` };
    }
    if (doc.hooks !== undefined && !isObj(doc.hooks)) return { changed: false, error: `${SETTINGS_REL} > hooks beklenmedik biçimde; kanca eklenmedi` };
    let changed = false;
    const hooks = doc.hooks ? { ...doc.hooks } : {};
    for (const [event, group] of Object.entries(wantGroups())) {
        const list = Array.isArray(hooks[event]) ? [...hooks[event]] : [];
        if (hasGuard(list)) continue;
        list.push(group);
        hooks[event] = list;
        changed = true;
    }
    if (!changed) return { changed: false, error: null };
    return { changed: true, error: null, text: JSON.stringify({ ...doc, hooks }, null, 2) + "\n" };
}

export function planSettings(root) {
    const file = path.join(root, SETTINGS_REL);
    const old = exists(file) ? readText(file, "") : null;
    const m = mergeSettings(old);
    return { rel: SETTINGS_REL, old, ...m };
}
