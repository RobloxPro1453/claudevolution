// Which program a check starts: the one the project declares, never "the newest file in target/" (a test
// binary or a build script was started once instead of the app; craft-anything pitfall "The newest program
// isn't the app"). Order: config check.program, then finalForm.deliverable, then the Rust build the Cargo
// manifests name (default-run, then a package using a window library, then the root package), newest of
// release/debug. Ported from craft-anything crates/engine/src/outputs.rs (MIT OR Apache-2.0).
import fs from "node:fs";
import path from "node:path";
import { exists, isWindows, readText } from "../lib/util.js";

export const WINDOW_CRATES = ["eframe", "egui", "winit", "macroquad", "bevy", "iced", "slint", "ggez", "fltk", "gtk", "gtk4", "tauri", "sdl2", "minifb", "pixels", "glium", "raylib", "notan", "fyrox", "nannou", "druid", "xilem", "dioxus", "floem", "piston_window", "tetra", "comfy", "miniquad", "softbuffer"];

// Just enough TOML for Cargo manifests: [section], [a.b], [[bin]], key = "str" | [ "a", "b" ] | other.
export function readToml(text) {
    const root = {};
    let cur = root;
    const open = (keys, arrayTable) => {
        let t = root;
        keys.forEach((k, i) => {
            const last = i === keys.length - 1;
            if (last && arrayTable) { if (!Array.isArray(t[k])) t[k] = []; const n = {}; t[k].push(n); t = n; return; }
            if (t[k] === undefined) t[k] = {};
            t = Array.isArray(t[k]) ? t[k][t[k].length - 1] : t[k];
        });
        return t;
    };
    const keyParts = (s) => [...s.matchAll(/"([^"]*)"|'([^']*)'|([^.\s]+)/g)].map((m) => m[1] ?? m[2] ?? m[3]);
    const lines = String(text).split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i].replace(/\s+#.*$|^#.*$/, "").trim();
        if (!line) continue;
        let m;
        if ((m = line.match(/^\[\[(.+)\]\]$/))) { cur = open(keyParts(m[1]), true); continue; }
        if ((m = line.match(/^\[(.+)\]$/))) { cur = open(keyParts(m[1]), false); continue; }
        if (!(m = line.match(/^("[^"]+"|[\w.-]+)\s*=\s*(.*)$/))) continue;
        let value = m[2];
        if (value.startsWith("[") && !value.endsWith("]")) { while (++i < lines.length) { value += " " + lines[i].replace(/\s+#.*$/, "").trim(); if (value.trim().endsWith("]")) break; } }
        const ks = keyParts(m[1]);
        let t = cur;
        for (const k of ks.slice(0, -1)) t = t[k] ?? (t[k] = {});
        const v = value.trim();
        t[ks[ks.length - 1]] = v.startsWith('"') ? v.slice(1, v.indexOf('"', 1)) : v.startsWith("[") ? [...v.matchAll(/"([^"]*)"/g)].map((x) => x[1]) : v.startsWith("{") ? Object.fromEntries([...v.matchAll(/([\w-]+)\s*=\s*"([^"]*)"/g)].map((x) => [x[1], x[2]])) : v;
    }
    return root;
}

// The program names the project's Cargo manifests declare, best first.
export function cargoPrograms(app) {
    const read = (dir) => { try { return readToml(readText(path.join(dir, "Cargo.toml"))); } catch (_) { return null; } };
    const root = read(app);
    if (!root) return [];
    const dirs = [app];
    for (const m of (root.workspace && Array.isArray(root.workspace.members) ? root.workspace.members : [])) {
        if (m.endsWith("/*")) {
            const parent = path.join(app, m.slice(0, -2));
            let found = [];
            try { found = fs.readdirSync(parent).map((d) => path.join(parent, d)).filter((d) => exists(path.join(d, "Cargo.toml"))).sort(); } catch (_) { /* none */ }
            dirs.push(...found);
        } else if (m !== ".") dirs.push(path.join(app, m));
    }
    const defaultRun = [], windowed = [], rootBins = [], other = [];
    dirs.forEach((dir, i) => {
        const t = read(dir);
        const pkg = t && t.package;
        if (!pkg) return;
        let bins = Array.isArray(t.bin) ? t.bin.map((b) => b.name).filter(Boolean) : [];
        if (!bins.length && pkg.name && exists(path.join(dir, "src", "main.rs"))) bins = [pkg.name];
        if (pkg["default-run"]) defaultRun.push(pkg["default-run"]);
        const depTables = [t.dependencies, ...Object.values(t.target || {}).map((x) => x && x.dependencies)].filter(Boolean);
        if (depTables.some((d) => Object.keys(d).some((k) => WINDOW_CRATES.includes(k)))) windowed.push(...bins);
        (i === 0 ? rootBins : other).push(...bins);
    });
    return [...new Set([...defaultRun, ...windowed, ...rootBins, ...other])];
}

const isProgramFile = (p) => (isWindows ? /\.exe$/i.test(p) : !path.extname(p) || false);

// The Rust build to start in `app`, or null.
export function builtProgram(app) {
    if (!exists(path.join(app, "Cargo.toml"))) return null;
    const built = [];
    for (const d of ["release", "debug"]) {
        let names = [];
        try { names = fs.readdirSync(path.join(app, "target", d)); } catch (_) { continue; }
        for (const n of names) { const p = path.join(app, "target", d, n); try { if (fs.statSync(p).isFile() && isProgramFile(p)) built.push(p); } catch (_) { /* gone */ } }
    }
    const newest = (list) => list.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0] || null;
    const stem = (p) => path.basename(p).replace(/\.exe$/i, "");
    const wanted = cargoPrograms(app);
    if (!wanted.length) return newest(built);
    for (const name of wanted) { const hit = newest(built.filter((p) => stem(p) === name)); if (hit) return hit; }
    return null;
}

// { program, args, why } for a configured project, or null with a reason.
export function programFor(cfg) {
    const c = cfg.check || {};
    if (Array.isArray(c.program) && c.program.length) return { program: path.resolve(cfg.root, c.program[0]), args: c.program.slice(1), why: "check.program" };
    const deliverable = cfg.finalForm && cfg.finalForm.deliverable;
    if (deliverable && exists(path.resolve(cfg.root, deliverable))) return { program: path.resolve(cfg.root, deliverable), args: [], why: "finalForm.deliverable" };
    const rust = builtProgram(cfg.root);
    if (rust) return { program: rust, args: [], why: "Cargo.toml" };
    return null;
}
