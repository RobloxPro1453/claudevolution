// Lossless project update (owner decision #21): plan -> preview -> backup -> transactional apply -> check,
// and one-command rollback. Used by `cv update` (preview), `cv update --apply` and `cv update --rollback`.
//
// Rules, in order of weight:
//  1. Nothing the owner made is deleted or overwritten: memory (.evrim/otonom/*), metrics, docs/, task specs
//     and reports, and any skill folder the package does not ship are only listed as "kept".
//  2. .evrim/config.json is merged, never replaced: missing keys are added with their defaults, existing
//     values stay as written (model names included, ERRATA E1), safety lists only grow (repairs below).
//  3. A config that cannot be read is not "empty": the update stops and nothing is written
//     (craft-anything pitfall "A non-blocking read that falls back to defaults").
//  4. Every file the update changes is copied first to .evrim/backups/pre-<old>-to-<new>-<time>/ with a
//     manifest; if any write fails, every file already written is put back (craft-anything setup/plan.rs
//     apply_with); a file that changed after the plan was made is not touched (stale guard, same source).
//  5. After the apply the config is validated again; a new error rolls the whole update back.
// Format changes use numbered steps (craft-anything engine/src/versioned.rs, MIT OR Apache-2.0): a config
// schema newer than this package knows is refused, an older one is brought forward step by step.
import fs from "node:fs";
import path from "node:path";
import { deepMerge, exists, readText, writeText } from "../lib/util.js";
import { CONFIG_REL, TEMPLATE_DIR, VERSION, defaults, validate } from "../lib/config.js";
import { loopWorkflowText, skillSources, stampSkill, templateFile } from "./init.js";
import * as knowledge from "../autonomy/knowledge.js";
import { planSettings } from "../lib/hooks.js";

export const SKILL_DIRS = [".claude/skills", ".codex/skills", ".agent/skills"];
export const LOOP_REL = ".agent/workflows/loop.md";
export const BACKUP_DIR = ".evrim/backups";
// Owner data that an update must never touch; shown in the preview so the owner sees it is safe.
export const PROTECTED = [".evrim/otonom/", ".evrim/metrics.jsonl", ".evrim/METRICS.md", ".evrim/KARARNAMELER.md", "docs/", "AGENTS.md", "CLAUDE.md", "CHANGELOG.md"];

// ------------------------------------------------------------------ versioned steps (H1)
// Step i takes a raw config document from schema FIRST + i to FIRST + i + 1. Empty today: schema 1 is current.
export const FIRST_SCHEMA = 1;
export const SCHEMA_STEPS = [];
export function upgradeDoc(doc, from, first = FIRST_SCHEMA, steps = SCHEMA_STEPS) {
    const latest = first + steps.length;
    if (!Number.isInteger(from)) throw new Error(`şema sürümü okunamadı (${JSON.stringify(from)})`);
    if (from < first) throw new Error(`şema ${from}, bu paketin okuyabildiği en eski şemadan (${first}) eski`);
    if (from > latest) throw new Error(`şema ${from}, bu paketin bildiği en yeni şemadan (${latest}) yeni: paketi güncelleyin (claudevrim guncelle)`);
    for (const step of steps.slice(from - first)) step(doc);
    return latest;
}

// ------------------------------------------------------------------ config merge + repairs (H2, H3)
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
// Adds what `def` has and `own` lacks, recursively. Never changes a value the owner wrote; arrays are the
// owner's as a whole. A "_comment_x" travels only with a new key "x" (or a new object), so old projects
// do not fill up with notes. Returns the paths added.
export function fillMissing(own, def, at = "", added = []) {
    for (const k of Object.keys(def)) {
        if (k.startsWith("_comment")) continue;
        const p = at ? `${at}.${k}` : k;
        if (!(k in own)) {
            for (const ck of Object.keys(def)) if (ck === `_comment_${k}` && !(ck in own)) own[ck] = def[ck];
            own[k] = structuredClone(def[k]);
            added.push(p);
        } else if (isObj(own[k]) && isObj(def[k])) fillMissing(own[k], def[k], p, added);
    }
    return added;
}

// Idempotent repairs: each checks first and changes only what is missing. Safety lists only grow.
export const REPAIRS = [
    {
        id: "forbidden-platform-dirs",
        why: "Codex ve Antigravity beceri klasörleri ucuz modele yasak listesinde olmalı (yalnız .claude vardı)",
        run(cfg) {
            if (!Array.isArray(cfg.forbiddenWrite)) return false;
            const want = ["^\\.codex/", "^\\.agent/"].filter((r) => !cfg.forbiddenWrite.includes(r));
            if (!want.length) return false;
            const at = cfg.forbiddenWrite.indexOf("^\\.claude/");
            cfg.forbiddenWrite.splice(at < 0 ? cfg.forbiddenWrite.length : at + 1, 0, ...want);
            return true;
        }
    },
    {
        id: "forbidden-scripts-lesson-30",
        why: "evrensel ders 30: derleme/test betikleri (scripts/) ucuz modele yasak",
        run(cfg) {
            if (!Array.isArray(cfg.forbiddenWrite) || cfg.forbiddenWrite.includes("^scripts/")) return false;
            // scripts/ declared as the project's own code: the owner decides, the preview says so.
            if (Array.isArray(cfg.codePaths) && cfg.codePaths.some((c) => /^scripts\/?$/.test(String(c)))) return false;
            cfg.forbiddenWrite.push("^scripts/");
            return true;
        }
    }
];

const jsonText = (v) => JSON.stringify(v, null, 2) + "\n";

// Reads the config for an update. A missing file is "nothing to merge"; anything else unreadable blocks.
export function readConfigForUpdate(root) {
    const file = path.join(root, CONFIG_REL);
    let raw;
    try { raw = fs.readFileSync(file, "utf8"); } catch (e) {
        if (e.code === "ENOENT") return { raw: null, own: null, error: null };
        return { raw: null, own: null, error: `${CONFIG_REL} okunamadı (${e.code || e.message}); başka bir program tutuyor olabilir, sonra yeniden deneyin` };
    }
    try {
        const own = JSON.parse(raw.replace(/^﻿/, ""));
        if (!isObj(own)) throw new Error("nesne değil");
        return { raw, own, error: null };
    } catch (e) {
        return { raw, own: null, error: `${CONFIG_REL} bozuk JSON (${e.message}); üzerine yazmıyorum. Dosyayı düzeltin ya da git geçmişinden geri alın, sonra yeniden deneyin` };
    }
}

export function planConfig(root) {
    const r = readConfigForUpdate(root);
    if (r.error) return { blocked: r.error };
    if (!r.own) return { item: null, notes: ["config.json yok: önce cv init"] };
    const doc = structuredClone(r.own), notes = [];
    try { doc.schema = upgradeDoc(doc, doc.schema ?? FIRST_SCHEMA); } catch (e) { return { blocked: e.message }; }
    const added = fillMissing(doc, defaults());
    const repaired = REPAIRS.filter((rep) => rep.run(doc));
    if (Array.isArray(doc.codePaths) && doc.codePaths.some((c) => /^scripts\/?$/.test(String(c))) && !(doc.forbiddenWrite || []).includes("^scripts/")) {
        notes.push("scripts/ kod klasörünüz olarak tanımlı: ucuz modele yasaklamadım (ders 30). Derleme/test betikleriyse forbiddenWrite'a \"^scripts/\" ekleyin.");
    }
    const want = jsonText(doc);
    if (!added.length && !repaired.length) return { item: null, notes };
    return {
        item: { rel: CONFIG_REL, kind: "onarım", old: r.raw, want, added, repaired: repaired.map((x) => ({ id: x.id, why: x.why })) },
        notes
    };
}

// ------------------------------------------------------------------ file plan
const norm = (s) => String(s).replace(/\r\n/g, "\n").replace(/<!-- claudevolution [\d.]+ -->/, "").trim();
function delta(a, b) {
    const A = norm(a).split("\n"), B = norm(b).split("\n"), sa = new Set(A), sb = new Set(B);
    return { added: B.filter((l) => !sa.has(l)).length, removed: A.filter((l) => !sb.has(l)).length };
}

// Package-owned files: skill copies on all three platforms, the Antigravity loop workflow, .evrim/README.md.
export function planFiles(root, lang = "tr") {
    const items = [];
    const add = (rel, want) => {
        const dest = path.join(root, rel);
        if (!exists(dest)) { items.push({ rel, want, old: null, kind: "yeni", added: norm(want).split("\n").length, removed: 0 }); return; }
        const have = readText(dest);
        if (norm(have) !== norm(want)) items.push({ rel, want, old: have, kind: "değişti", ...delta(have, want) });
    };
    for (const [skill, src] of Object.entries(skillSources(lang))) {
        const stamped = stampSkill(readText(src));
        for (const base of SKILL_DIRS) add(`${base}/${skill}/SKILL.md`, stamped);
    }
    add(LOOP_REL, stampSkill(loopWorkflowText(lang)));
    add(".evrim/README.md", readText(templateFile(".evrim/README.md", lang)));
    // M6: the quota guard hooks, merged into the owner's Claude Code settings (unreadable file: left alone).
    const hk = planSettings(root);
    if (hk.changed) items.push({ rel: hk.rel, want: hk.text, old: hk.old, kind: hk.old === null ? "yeni" : "birleşim", added: 2, removed: 0, why: "kota bekçisi kancası (cv guard)" });
    return items;
}

// The owner's own things the update keeps as they are (listed, never read into the plan).
export function keptList(root, lang = "tr") {
    const ours = new Set(Object.keys(skillSources(lang)));
    const out = [];
    for (const p of PROTECTED) if (exists(path.join(root, p))) out.push(p);
    for (const base of SKILL_DIRS) {
        let names = [];
        try { names = fs.readdirSync(path.join(root, base), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name); } catch (_) { /* none */ }
        for (const n of names) if (!ours.has(n)) out.push(`${base}/${n}/ (sizin beceriniz)`);
    }
    return out;
}

export function planUpdate(root, { lang } = {}) {
    const c = planConfig(root);
    const language = lang || (readConfigForUpdate(root).own || {}).lang || "tr";
    const from = readText(path.join(root, ".evrim", "version"), "?").trim();
    if (c.blocked) return { from, to: VERSION, blocked: c.blocked, items: [], kept: keptList(root, language), notes: [] };
    const items = [...(c.item ? [c.item] : []), ...planFiles(root, language), ...planKnowledge(root)];
    return { from, to: VERSION, blocked: null, items, kept: keptList(root, language), notes: c.notes || [] };
}

// M6 data step: the lessons and error lines of DERSLER.md / HATALAR.md are copied (never moved) into
// .evrim/knowledge.jsonl, so retrieval and the hypothesis loop can use them. The memory files stay as they
// are; existing knowledge entries stay; running it again adds nothing. Backed up and rolled back like any file.
export function planKnowledge(root) {
    const own = readConfigForUpdate(root).own || {};
    const dir = (own.autonomy && own.autonomy.dir) || ".evrim/otonom";
    const want = knowledge.migratedText(root, dir);
    const rel = ".evrim/knowledge.jsonl", dest = path.join(root, rel);
    const have = exists(dest) ? readText(dest) : null;
    if (!want || want === have) return [];
    const count = want.split("\n").filter(Boolean).length - (have ? have.split("\n").filter(Boolean).length : 0);
    return [{ rel, want, old: have, kind: have === null ? "yeni" : "değişti", added: count, removed: 0, note: "dersler bilgi deposuna kopyalanır; DERSLER.md aynen kalır" }];
}

// ------------------------------------------------------------------ backup, apply, rollback
const stampNow = (d = new Date()) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z").replace("T", "-");
const safeName = (s) => String(s).replace(/[^0-9A-Za-z.+-]/g, "_");

// Copies every file the plan changes (and the version file and config) into a new backup folder.
export function backup(root, plan, now = new Date()) {
    const id = `pre-${safeName(plan.from)}-to-${safeName(plan.to)}-${stampNow(now)}`;
    let dir = path.join(root, BACKUP_DIR, id);
    for (let n = 2; exists(dir); n++) dir = path.join(root, BACKUP_DIR, `${id}-${n}`);
    const rels = [...new Set([...plan.items.map((i) => i.rel), CONFIG_REL, ".evrim/version"])];
    const files = [];
    for (const rel of rels) {
        const src = path.join(root, rel);
        const existed = exists(src);
        if (existed) {
            const dst = path.join(dir, "files", rel);
            fs.mkdirSync(path.dirname(dst), { recursive: true });
            fs.copyFileSync(src, dst);
            // A backup that differs from its source is no backup: stop before anything is written.
            if (!fs.readFileSync(src).equals(fs.readFileSync(dst))) throw new Error(`yedek doğrulanamadı: ${rel}`);
        }
        files.push({ rel, existed });
    }
    const manifest = { from: plan.from, to: plan.to, at: now.toISOString(), files };
    writeText(path.join(dir, "manifest.json"), jsonText(manifest));
    return { dir, id: path.basename(dir), manifest };
}

// Writes the plan's files; on any failure puts back every file already written. Returns the written list.
export function applyPlan(root, plan, { write = writeText } = {}) {
    for (const i of plan.items) {
        const now = exists(path.join(root, i.rel)) ? readText(path.join(root, i.rel)) : null;
        if (now !== i.old) throw new Error(`${i.rel} plan yapıldıktan sonra değişti; hiçbir şey yazılmadı. cv update ile yeniden bakın`);
    }
    const done = [];
    try {
        for (const i of plan.items) {
            write(path.join(root, i.rel), i.want);
            done.push(i);
            if (i.rel === CONFIG_REL) JSON.parse(readText(path.join(root, i.rel))); // read back
        }
    } catch (e) {
        for (const i of done.reverse()) {
            const p = path.join(root, i.rel);
            try { if (i.old === null) fs.rmSync(p, { force: true }); else writeText(p, i.old); } catch (_) { /* reported below */ }
        }
        throw new Error(`güncelleme yazılamadı (${e.message}); yazılan ${done.length} dosya eski hâline döndü`);
    }
    return done.map((i) => i.rel);
}

export function listBackups(root) {
    const dir = path.join(root, BACKUP_DIR);
    let names = [];
    try { names = fs.readdirSync(dir).filter((n) => exists(path.join(dir, n, "manifest.json"))); } catch (_) { /* none */ }
    return names.map((n) => ({ id: n, dir: path.join(dir, n), manifest: JSON.parse(readText(path.join(dir, n, "manifest.json"))) }))
        .sort((a, b) => String(a.manifest.at).localeCompare(String(b.manifest.at)) || a.id.localeCompare(b.id));
}

// Puts every file of a backup back as it was: files that existed get their old bytes, files the update
// created are removed. The newest backup not yet rolled back, unless an id is given.
export function rollback(root, id = null) {
    const all = listBackups(root);
    const b = id ? all.find((x) => x.id === id) : [...all].reverse().find((x) => !x.manifest.rolledBackAt);
    if (!b) throw new Error(id ? `yedek yok: ${id}` : "geri alınacak yedek yok (.evrim/backups/ boş)");
    const restored = [], removed = [];
    for (const f of b.manifest.files) {
        const dst = path.join(root, f.rel);
        if (f.existed) {
            const src = path.join(b.dir, "files", f.rel);
            if (!exists(src)) throw new Error(`yedekte dosya eksik: ${f.rel}`);
            fs.mkdirSync(path.dirname(dst), { recursive: true });
            writeText(dst, fs.readFileSync(src));
            restored.push(f.rel);
        } else if (exists(dst)) { fs.rmSync(dst, { force: true }); removed.push(f.rel); }
    }
    b.manifest.rolledBackAt = new Date().toISOString();
    writeText(path.join(b.dir, "manifest.json"), jsonText(b.manifest));
    return { id: b.id, restored, removed, manifest: b.manifest };
}

// The whole apply: backup, write, update the version, validate; a new config error rolls everything back.
export function migrate(root, plan, { write } = {}) {
    if (plan.blocked) throw new Error(plan.blocked);
    const before = configErrors(root);
    const b = backup(root, plan);
    const written = applyPlan(root, plan, { write });
    writeText(path.join(root, ".evrim", "version"), VERSION + "\n");
    const after = configErrors(root).filter((e) => !before.includes(e));
    if (after.length) {
        rollback(root, b.id);
        throw new Error("güncelleme sonrası config denetimi yeni hata verdi, her şey geri alındı:\n  - " + after.join("\n  - "));
    }
    return { backup: b, written };
}

function configErrors(root) {
    const r = readConfigForUpdate(root);
    if (r.error || !r.own) return r.error ? [r.error] : [];
    const cfg = deepMerge(defaults(), r.own); // as loadConfig reads it
    if (Array.isArray(r.own.forbiddenWrite)) cfg.forbiddenWrite = r.own.forbiddenWrite;
    cfg.root = root;
    return validate(cfg).errors;
}
