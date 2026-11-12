// Several projects on one machine share one account's limits. Design (docs/DECISIONS.md K7):
//
//   1. Machine lock:  <state home>/lock  — only one project runs a cycle at a time, so two loops never
//                     burn the same 5-hour window in parallel.
//   2. Fair turns:    <state home>/projects.json keeps, per project, its weight and the working cycles it
//                     used this quota week. A project may run when used/weight is not ahead of the least
//                     served active project by more than one cycle. A project not seen for 48 h is inactive
//                     and does not hold the others back.
//
// The gates (gates.js) still apply to the shared total; this file only decides whose turn it is.
// State home: CV_STATE_HOME, else ~/.claudevolution. It is created on first use by a cycle, never by init.
import path from "node:path";
import process from "node:process";
import { home, nowIso, readJson, writeJson } from "../lib/util.js";

export const stateHome = () => process.env.CV_STATE_HOME || path.join(home(), ".claudevolution");
export const machineLock = () => path.join(stateHome(), "lock");
const registry = () => path.join(stateHome(), "projects.json");
const ACTIVE_MS = 48 * 3600 * 1000;
const key = (root) => path.resolve(root).replace(/\\/g, "/").toLowerCase();

function load(weekStart) {
    const reg = readJson(registry(), { weekStart: null, projects: {} });
    if (weekStart && reg.weekStart !== weekStart) {
        // New quota week: everyone starts from zero.
        for (const p of Object.values(reg.projects)) p.used = 0;
        reg.weekStart = weekStart;
    }
    return reg;
}

// Mark this project as alive and return whether it is its turn.
export function turn(root, name, weight, now = new Date(), weekStart = null) {
    const reg = load(weekStart);
    const k = key(root);
    reg.projects[k] = { used: 0, ...(reg.projects[k] || {}), name, weight, seenAt: nowIso(now) };
    writeJson(registry(), reg);
    const active = Object.entries(reg.projects).filter(([, p]) => now.getTime() - new Date(p.seenAt).getTime() < ACTIVE_MS);
    const score = (p) => p.used / p.weight;
    const least = Math.min(...active.map(([, p]) => score(p)));
    const mine = reg.projects[k];
    const ok = score(mine) <= least + 1 / mine.weight + 1e-9;
    return { ok, active: active.map(([, p]) => ({ name: p.name, weight: p.weight, used: p.used })), mine: { used: mine.used, weight: mine.weight } };
}

// Count one working cycle (sleep cycles are free).
export function charge(root, now = new Date()) {
    const reg = load(null);
    const p = reg.projects[key(root)];
    if (!p) return;
    p.used = (p.used || 0) + 1;
    p.lastCycleAt = nowIso(now);
    writeJson(registry(), reg);
}

export const listProjects = () => Object.values(load(null).projects);
