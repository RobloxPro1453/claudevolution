// The machine home of claudevrim (default ~/.claudevrim, or CLAUDEVRIM_HOME):
//   paket/                 the package, kept in sync with GitHub by `claudevrim guncelle` (and before each init)
//   evrensel/DERSLER.md    this machine's own universal lessons (an owner without push rights to the package)
//   evrensel/HATALAR.md
//   bin/claudevrim(.exe)   the launcher, on the user's PATH
//   kurulum.json           { paket, gelistirici, repo }
// A developer machine (the package's maintainer) points `paket` at its git clone and keeps pushing lessons
// to the package itself; everyone else writes universal lessons to evrensel/ and they reach every project
// through the merged .evrim/evrensel.md (core/evolve/merge.js).
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { readJson, writeJson } from "./util.js";

export const REPO = "https://github.com/RobloxPro1453/claudevolution";
export const homeDir = (env = process.env) => env.CLAUDEVRIM_HOME || path.join(env.USERPROFILE || env.HOME || os.homedir(), ".claudevrim");
export const homeFile = (env = process.env) => path.join(homeDir(env), "kurulum.json");
export const readHome = (env = process.env) => readJson(homeFile(env), null);
export const writeHome = (data, env = process.env) => writeJson(homeFile(env), { repo: REPO, ...data });
export const userUniversal = (kind = "ders", env = process.env) => path.join(homeDir(env), "evrensel", kind === "hata" ? "HATALAR.md" : "DERSLER.md");

// Lessons go to the package (branch, measure, push) only on a developer machine, or where claudevrim was
// never installed (the package clone is used directly, as before claudevrim).
export function lessonTarget(env = process.env) {
    const h = readHome(env);
    return !h || h.gelistirici ? "paket" : "makine";
}
