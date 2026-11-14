// Who does a delegated task. The cheap-model API when its key is in the environment; otherwise the
// configured fallback: "claude-subagent" (Claude Code's Agent tool on a cheaper Claude model), optional
// local secondary CLIs ("codex", "agy", "gemini") or "self" (the main model does it).
import path from "node:path";
import process from "node:process";
import { exists, isWindows, readText, run as sh } from "../lib/util.js";
import { forbiddenRegexes } from "../lib/config.js";

export const FALLBACKS = ["claude-subagent", "self"];
// delegate.policy: who may write delegated code. The owner picks it (cv-init asks); no policy = the old
// fallback list decides (api, else its first entry).
//   kendisi            never delegate: the main model writes everything, even with a key
//   yalniz-api         only the API model (e.g. DeepSeek); without a key code work waits (mode "bekle")
//   api-yoksa-kendisi  API model, else the main model (default)
//   api-yoksa-subagent API model, else a Claude subagent on delegate.subagentModel
export const POLICIES = ["kendisi", "yalniz-api", "api-yoksa-kendisi", "api-yoksa-subagent"];
export const LOCAL_CLIS = ["claude", "codex", "agy", "gemini"];
export const SECONDARY_CLIS = ["codex", "agy", "gemini"];

const cliCache = new Map();

// Probe whether a CLI command exists on PATH (injectable checkCmd for tests; cached per PATH).
export function hasCli(cmd, env = process.env, opts = {}) {
    if (typeof opts.checkCmd === "function") {
        const res = opts.checkCmd(cmd, env);
        if (res && typeof res === "object") return { ok: Boolean(res.ok), path: res.path || null };
        return { ok: Boolean(res), path: res ? cmd : null };
    }
    const pathVal = env.PATH || env.Path || "";
    const cacheKey = `${process.platform}\0${pathVal}\0${cmd}`;
    if (!opts.noCache && cliCache.has(cacheKey)) return cliCache.get(cacheKey);
    const r = sh(isWindows ? "where" : "which", [cmd], { env, timeoutMs: opts.timeoutMs || 3000 });
    const out = { ok: r.ok, path: r.ok ? (r.out.split(/\r?\n/)[0] || "").trim() || cmd : null };
    if (!opts.noCache) cliCache.set(cacheKey, out);
    return out;
}

export function detectSecondaryClis(opts = {}, env = process.env) {
    const list = Array.isArray(opts.clis) ? opts.clis : SECONDARY_CLIS;
    return list.filter((cmd) => hasCli(cmd, env, opts).ok);
}

export function workerPool(cfg, env = process.env, opts = {}) {
    const d = (cfg && cfg.delegate) || {}, p = d.providers && d.providers[d.provider];
    const apiAvailable = Boolean(p && env[p.keyEnv]);
    const cliOrder = Array.isArray(d.localCliOrder) && d.localCliOrder.length
        ? d.localCliOrder.filter((c) => SECONDARY_CLIS.includes(c))
        : SECONDARY_CLIS;
    const secondaryClis = cliOrder.map((name) => ({ name, ...hasCli(name, env, opts) }));
    const availableClis = secondaryClis.filter((c) => c.ok).map((c) => c.name);
    return {
        api: p ? { mode: "api", name: d.provider, model: p.model, keyEnv: p.keyEnv, available: apiAvailable } : null,
        subagent: { mode: "claude-subagent", name: "claude-subagent", model: d.subagentModel || "haiku" },
        secondaryClis,
        availableClis,
        self: { mode: "self", name: "self" }
    };
}

export function policyOf(d) {
    if (POLICIES.includes(d.policy)) return d.policy;
    const first = (d.fallback || []).find((f) => FALLBACKS.includes(f)) || "self";
    return first === "claude-subagent" ? "api-yoksa-subagent" : "api-yoksa-kendisi";
}

export function choose(cfg, env = process.env, opts = {}) {
    const d = cfg.delegate, p = d.providers && d.providers[d.provider], policy = policyOf(d);
    if (policy === "kendisi") return { mode: "self", name: "self", reason: "delegate.policy kendisi: iş dağıtılmaz" };
    if (p && env[p.keyEnv]) return { mode: "api", name: d.provider, reason: `${p.keyEnv} ortamda var` };
    const why = p ? `${p.keyEnv} ortamda yok` : `"${d.provider}" sağlayıcısı tanımlı değil`;
    if (policy === "yalniz-api") return { mode: "bekle", name: "bekle", reason: `${why}; delegate.policy yalniz-api: kod işi anahtar gelene kadar bekler` };

    const useLocalCli = Boolean(opts.allowLocalCli || opts.preferLocalCli || d.localCli);
    if (policy === "api-yoksa-subagent" && !(opts.preferLocalCli || d.localCli === "before-subagent")) {
        return { mode: "claude-subagent", name: "claude-subagent", model: d.subagentModel || "haiku", reason: why };
    }
    if (useLocalCli) {
        const order = Array.isArray(d.localCliOrder) && d.localCliOrder.length ? d.localCliOrder : SECONDARY_CLIS;
        const found = order.find((cli) => hasCli(cli, env, opts).ok);
        if (found) return { mode: "local-cli", name: found, cli: found, reason: `${why}; yerel CLI mevcut: ${found}` };
    }
    if (policy === "api-yoksa-subagent") return { mode: "claude-subagent", name: "claude-subagent", model: d.subagentModel || "haiku", reason: why };
    return { mode: "self", name: "self", reason: why };
}

// One line for skills and logs: "SAGLAYICI: <name> (<model>) - <reason>".
export const line = (c) => `SAGLAYICI: ${c.name}${c.model ? ` (${c.model})` : ""} - ${c.reason}`;

// The brief a Claude subagent (or the main model) follows: the same rules, spec, forbidden paths and
// checks the API agent gets, so the fallback is held to the same standard.
export function brief(cfg, task) {
    const specRel = `${cfg.tasks.dir}/${task}.md`, spec = path.join(cfg.root, specRel);
    if (!exists(spec)) throw new Error(`tarif yok: ${specRel}`);
    const rules = readText(path.join(cfg.root, cfg.tasks.rules), "");
    const cmd = (c) => (c ? c.join(" ") : "(tanımlı değil)");
    const forbidden = forbiddenRegexes(cfg).map((r) => r.source);
    return [
        cfg.delegate.intro,
        "",
        "## Kurallar",
        rules.trim() || "(kurallar dosyası boş)",
        "",
        "## Yazması yasak yollar (düzenli ifade, proje köküne göre)",
        ...forbidden.map((f) => "- `" + f + "`"),
        "",
        "## Doğrulama",
        `- Derleme: \`${cmd(cfg.build)}\``,
        `- Test: \`${cmd(cfg.test)}\``,
        "- Test kırmızıysa iş bitmiş sayılmaz. Testi silerek ya da gevşeterek yeşile çevirmek yasaktır.",
        `- Bağımsız doğrulama: \`cv delegate verify ${task}\` (kapsam, gizlilik, silinen assertion, temiz derleme/test ve makbuz kontrolü).`,
        "",
        "## Teslim",
        `- Yeni dal: \`${cfg.delegate.branchPrefix}${task}\` (\`${cfg.baseBranch}\`'dan). Yalnız bu dala commit; birleştirme yok, push yok.`,
        `- Commit satırı: \`${cfg.delegate.commitTrailer}\``,
        `- Rapor: \`${cfg.tasks.dir}/${task}.report.md\` (ne yapıldı, test sonucu, şüpheler; en çok 15 satır).`,
        "",
        cfg.delegate.workPlan,
        "",
        `## Tarif (${specRel})`,
        readText(spec).trim(),
        "",
    ].join("\n");
}
