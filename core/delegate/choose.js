// Who does a delegated task. The cheap-model API when its key is in the environment; otherwise the
// configured fallback: "claude-subagent" (Claude Code's Agent tool on a cheaper Claude model) or "self"
// (the main model does it). The work never stops just because a key is missing.
import path from "node:path";
import process from "node:process";
import { exists, readText } from "../lib/util.js";
import { forbiddenRegexes } from "../lib/config.js";

export const FALLBACKS = ["claude-subagent", "self"];

export function choose(cfg, env = process.env) {
    const d = cfg.delegate, p = d.providers && d.providers[d.provider];
    if (p && env[p.keyEnv]) return { mode: "api", name: d.provider, reason: `${p.keyEnv} ortamda var` };
    const why = p ? `${p.keyEnv} ortamda yok` : `"${d.provider}" sağlayıcısı tanımlı değil`;
    const first = (d.fallback || []).find((f) => FALLBACKS.includes(f)) || "self";
    if (first === "claude-subagent") return { mode: "claude-subagent", name: first, model: d.subagentModel || "haiku", reason: why };
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
