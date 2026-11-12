// Shared entry for commands that need a configured project.
import path from "node:path";
import process from "node:process";
import { findRoot, loadConfig, validate } from "../lib/config.js";

export function project(args = {}) {
    const start = typeof args.dir === "string" ? path.resolve(args.dir) : process.cwd();
    const root = findRoot(start);
    if (!root) throw new Error("burada claudevolution kurulu değil (.evrim/config.json yok). Önce: cv init");
    const cfg = loadConfig(root);
    const v = validate(cfg);
    if (v.errors.length) throw new Error(".evrim/config.json hatalı:\n  - " + v.errors.join("\n  - "));
    return cfg;
}
