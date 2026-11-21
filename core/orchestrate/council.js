// Plan-aware adaptive council & multi-CLI/multi-model pool orchestrator.
// Evaluates quota/plan headroom and task complexity before convening a council (solo / light / deep),
// mixes available CLI and API engines, enforces license boundaries, and supports blind synthesis.
import path from "node:path";
import process from "node:process";
import { defaults, findRoot, loadConfig, stateDir, autonomyDir } from "../lib/config.js";
import { nowIso, readJson, run as runCmd, writeText } from "../lib/util.js";
import { chat as agentChat } from "../delegate/agent.js";
import { LOCAL_CLIS, hasCli } from "../delegate/choose.js";
import { estimateQuota } from "../metrics/blocks.js";

export const PERMISSIVE_LICENSES = ["MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC"];

export const KNOWN_API_PROVIDERS = {
    deepseek: { apiBase: "https://api.deepseek.com", model: "deepseek-flash", keyEnv: "DEEPSEEK_API_KEY", tier: "economy" },
    openai: { apiBase: "https://api.openai.com/v1", model: "gpt-4o-mini", keyEnv: "OPENAI_API_KEY", tier: "standard" },
    anthropic: { apiBase: "https://api.anthropic.com/v1", model: "claude-3-5-sonnet-latest", keyEnv: "ANTHROPIC_API_KEY", tier: "standard" },
    gemini: { apiBase: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-2.5-flash", keyEnv: "GEMINI_API_KEY", tier: "economy" }
};

const PERSPECTIVES = {
    arch: {
        id: "arch",
        role: "Mimari & Sistem",
        perspective: "Sistem sınırları, veri akışı, modülerlik, geriye dönük uyumluluk ve bakım yükü."
    },
    ux: {
        id: "ux",
        role: "Ürün & Kullanıcı Deneyimi",
        perspective: "Sahip deneyimi, sıfır sürtünme, anlaşılır çıktılar, hata mesajları ve pratik fayda."
    },
    risk: {
        id: "risk",
        role: "Şeytanın Avukatı & Risk/Lisans",
        perspective: "Kör noktalar, başarısızlık kipleri, güvenlik açıkları, gizli varsayımlar ve lisans uyumu."
    },
    cost: {
        id: "cost",
        role: "Verimlilik & Maliyet",
        perspective: "Token/kota maliyeti, karmaşıklık bütçesi, en sade çalışan yol ve gereksiz soyutlamadan kaçınma."
    }
};

function resolveCfg(cfg, dir) {
    if (cfg && cfg.delegate && cfg.autonomy) return cfg.root ? cfg : { ...cfg, root: dir || process.cwd() };
    const start = path.resolve(dir || (cfg && cfg.root) || process.cwd());
    const found = findRoot(start);
    if (found) {
        try { return loadConfig(found); } catch (_) { /* fall back to defaults merged with root */ }
    }
    return { ...defaults(), ...(cfg || {}), root: found || start };
}

function numOrNull(v) {
    return typeof v === "number" && Number.isFinite(v) ? v : null;
}

// Detect available local CLIs, configured API providers/keys, latest quota state, and plan constraints.
export function detectPool(cfg, env = process.env, opts = {}) {
    const effectiveCfg = resolveCfg(cfg, opts.dir);
    const safeEnv = env || {};
    const clis = {};
    const availableClis = [];
    for (const cmd of LOCAL_CLIS) {
        const probe = hasCli(cmd, safeEnv, opts);
        clis[cmd] = { available: probe.ok, path: probe.path };
        if (probe.ok) availableClis.push(cmd);
    }

    const mergedProviders = { ...KNOWN_API_PROVIDERS, ...((effectiveCfg.delegate && effectiveCfg.delegate.providers) || {}) };
    const apis = {};
    const availableApis = [];
    for (const [name, spec] of Object.entries(mergedProviders)) {
        if (!spec || typeof spec !== "object") continue;
        const keyEnv = spec.keyEnv || "";
        const hasKey = Boolean(keyEnv && safeEnv[keyEnv]);
        apis[name] = {
            provider: name,
            keyEnv,
            model: spec.model || null,
            apiBase: spec.apiBase || null,
            tier: spec.tier || (name === "deepseek" || name === "gemini" ? "economy" : "standard"),
            hasKey
        };
        if (hasKey) availableApis.push(name);
    }

    let quota = opts.quota || null;
    if (!quota && effectiveCfg.root) {
        quota = readJson(path.join(stateDir(effectiveCfg), "quota.json"), null);
    }
    if ((!quota || (numOrNull(quota.five) === null && numOrNull(quota.week) === null)) && opts.probeLocalBlocks) {
        try {
            const local = estimateQuota(effectiveCfg.root || ".", effectiveCfg);
            if (local && local.available) {
                quota = { five: local.fivePct, week: local.weekPct, fiveResetsAt: local.fiveResetsAt || null, source: "local-blocks" };
            }
        } catch (_) { /* optional local telemetry */ }
    }

    const five = numOrNull(quota && quota.five);
    const week = numOrNull(quota && quota.week);
    const fiveHeadroom = five !== null ? Math.max(0, Math.round((100 - five) * 10) / 10) : null;
    const weeklyHeadroom = week !== null ? Math.max(0, Math.round((100 - week) * 10) / 10) : null;

    const rawPlan = opts.plan || (effectiveCfg.delegate && effectiveCfg.delegate.plan) || safeEnv.CV_PLAN || "auto";
    const plan = String(rawPlan || "auto").toLowerCase();
    const tightFive = five !== null && five >= 75;
    const tightWeek = weeklyHeadroom !== null && weeklyHeadroom < 35;
    const tightPro = plan === "pro" && ((five !== null && five >= 60) || (weeklyHeadroom !== null && weeklyHeadroom < 50));
    const constrained = Boolean(tightFive || tightWeek || tightPro);
    const critical = Boolean((five !== null && five >= 88) || (weeklyHeadroom !== null && weeklyHeadroom < 15));

    return {
        clis,
        availableClis,
        apis,
        availableApis,
        quota: quota || null,
        plan,
        headroom: { five, week, fiveHeadroom, weeklyHeadroom },
        constrained,
        critical,
        diversityCount: availableClis.length + availableApis.length
    };
}

const WORD_START = "(?:^|[^a-zçğıöşü0-9_])";
const WORD_END = "(?=$|[^a-zçğıöşü0-9_])";
const termRe = (alts) => new RegExp(`${WORD_START}(?:${alts})${WORD_END}`);

const LOW_COMPLEXITY_RE = termRe([
    "typo[a-z]*", "yaz[ıi]m", "renk", "etiket[a-zçğıöşü]*",
    "tek dosya[a-zçğıöşü]*", "single-?file", "small fix",
    "küçük", "basit", "rename", "copy", "metin düzelt[a-zçğıöşü]*"
].join("|"));

const HIGH_COMPLEXITY_RE = termRe([
    "mimari[a-zçğıöşü]*", "architectur[a-z]*", "sistem[a-zçğıöşü]*", "systems?",
    "migrations?", "göç[a-zçğıöşü]*", "güvenli[kğ][a-zçğıöşü]*", "security",
    "sıfırdan", "from scratch", "multi(?:-[a-z]+)?", "çoklu",
    "orkestrasyon[a-zçğıöşü]*", "orchestrat[a-z]*", "tasar[ıi]m[a-zçğıöşü]*", "design[a-z]*",
    "refactor[a-z]*", "dağıtık", "distributed", "ölçek[a-zçğıöşü]*", "scal(?:e|ing|able|ability)",
    "motor[a-zçğıöşü]*", "engines?", "meclis[a-zçğıöşü]*", "council[a-z]*"
].join("|"));

export function inferComplexity(topic = "") {
    const s = String(topic || "").replace(/İ/g, "i").toLowerCase();
    if (!s.trim()) return "medium";
    if (HIGH_COMPLEXITY_RE.test(s)) return "high";
    if (LOW_COMPLEXITY_RE.test(s)) return "low";
    return "medium";
}

export function evaluateLicensePolicy(licensePolicy, cfg) {
    let raw = String(licensePolicy || (cfg && cfg.licensePolicy) || "auto").trim().toLowerCase();
    if (raw === "oss" || raw === "opensource") raw = "open-source";
    if (!["personal", "open-source", "commercial", "auto"].includes(raw)) raw = "auto";

    if (raw === "commercial" || raw === "open-source") {
        return {
            policy: raw,
            restricted: true,
            allowedLicenses: [...PERMISSIVE_LICENSES],
            scoutRule: `Yalnız izin verici lisanslar (${PERMISSIVE_LICENSES.join(", ")}) incelenir; copyleft/lisanssız koddan uyarlama yasaktır.`,
            guidance: `Dağıtım/ticari kullanım politikası (${raw}): Açık kaynak referans ve kod incelemelerini YALNIZCA ${PERMISSIVE_LICENSES.join(", ")} lisanslı projelerle sınırlandırın; GPL/AGPL/SSPL veya lisanssız depolardan kod/tasarım kopyalamayın.`
        };
    }
    if (raw === "personal") {
        return {
            policy: "personal",
            restricted: false,
            allowedLicenses: null,
            scoutRule: "Kişisel kullanım: geniş çaplı clean-room mimari ve tasarım incelemesi serbesttir.",
            guidance: "Kişisel kullanım politikası (personal): Geniş çaplı temiz-oda (clean-room) mimari çalışma ve referans analizi yapılabilir; doğrudan üçüncü taraf kütüphane eklenecekse lisansını yine de not edin."
        };
    }
    return {
        policy: "auto",
        restricted: true,
        allowedLicenses: [...PERMISSIVE_LICENSES],
        scoutRule: `Varsayılan güvenli mod: ${PERMISSIVE_LICENSES.join(", ")} dışı referanslardan kopyalama yapılmaz.`,
        guidance: `Lisans politikası henüz seçilmedi (auto): Güvenli varsayılan olarak açık kaynak kod incelemesini ${PERMISSIVE_LICENSES.join(", ")} ile sınırlandırın ve sahibine kullanım amacını (personal / open-source / commercial) sorun.`
    };
}

function quotaText(pool) {
    const { five, week, weeklyHeadroom } = pool.headroom;
    const parts = [];
    if (five !== null) parts.push(`5s %${five}`);
    if (week !== null) parts.push(`hafta %${week} (kalan %${weeklyHeadroom})`);
    if (pool.plan && pool.plan !== "auto") parts.push(`plan: ${pool.plan}`);
    return parts.length ? parts.join(", ") : "kota verisi yok";
}

function buildEngineChoices(mode, pool) {
    const apiOrder = ["deepseek", "gemini", "openai", "anthropic", ...Object.keys(pool.apis)];
    const economyApis = [...new Set(apiOrder)].filter((n) => pool.apis[n]?.hasKey);
    const secondaryClis = ["codex", "agy", "gemini"].filter((n) => pool.clis[n]?.available);
    const subagentTier = (mode === "light" || pool.constrained || pool.plan === "pro") ? "haiku" : "sonnet";
    const list = [];

    if (mode === "light") {
        for (const api of economyApis) {
            list.push({ engine: api, kind: "api", tier: pool.apis[api].tier === "economy" ? "economy" : "sonnet", model: pool.apis[api].model });
        }
        for (const cli of secondaryClis) {
            list.push({ engine: cli, kind: "cli", tier: "cli-local", model: cli });
        }
        list.push({ engine: "claude-subagent", kind: "subagent", tier: subagentTier, model: subagentTier });
        if (list.length < 2) {
            list.push({ engine: "claude-subagent", kind: "subagent", tier: "haiku", model: "haiku" });
        }
        return list;
    }

    // Deep mode: maximize CLI + API diversity without repeating heavy Opus seats.
    const primaryArchTier = (pool.plan === "max" && !pool.constrained && (pool.headroom.five === null || pool.headroom.five < 50))
        ? "opus"
        : "sonnet";
    if (pool.clis.claude?.available || !secondaryClis.length) {
        list.push({ engine: "claude-subagent", kind: "subagent", tier: primaryArchTier, model: primaryArchTier });
    }
    for (const cli of secondaryClis) {
        list.push({ engine: cli, kind: "cli", tier: "cli-local", model: cli });
    }
    for (const api of economyApis) {
        list.push({ engine: api, kind: "api", tier: pool.apis[api].tier === "economy" ? "economy" : "standard", model: pool.apis[api].model });
    }
    const fallbacks = [
        { engine: "claude-subagent", kind: "subagent", tier: "sonnet", model: "sonnet" },
        { engine: "claude-subagent", kind: "subagent", tier: "haiku", model: "haiku" }
    ];
    for (const fb of fallbacks) {
        if (list.length >= 4) break;
        if (!list.some((x) => x.engine === fb.engine && x.tier === fb.tier)) list.push(fb);
    }
    while (list.length < 4) list.push({ engine: "claude-subagent", kind: "subagent", tier: "haiku", model: "haiku" });
    return list;
}

function buildSeatPrompt(topic, spec, seatEngine, license, pool) {
    return [
        `<role id="${spec.id}" engine="${seatEngine.engine}" tier="${seatEngine.tier}">`,
        `Sen "${spec.role}" koltuğundaki bağımsız meclis üyesisin.`,
        `Odak açın: ${spec.perspective}`,
        `</role>`,
        "",
        `<topic>`,
        topic,
        `</topic>`,
        "",
        `<license_policy mode="${license.policy}" restricted="${license.restricted}">`,
        license.guidance,
        `</license_policy>`,
        "",
        `<context>`,
        `Plan/Kota: ${quotaText(pool)}.`,
        `</context>`,
        "",
        `<instructions>`,
        "1. Diğer üyelerin görüşünü görmeden tamamen bağımsız analiz yap (kör müzakere).",
        "2. Kendi açından en önemli 3-5 somut bulguyu, riski veya mimari öneriyi kısa maddeler halinde yaz.",
        "3. Varsa daha basit veya daha ucuz bir alternatif öner; belirsizlik varsa açıkça işaretle.",
        "4. Gereksiz uzun anlatımdan ve kapsam dışı özellik önermekten kaçın.",
        `</instructions>`
    ].join("\n");
}

function buildSynthesis(topic, mode, seats, license) {
    const prompt = [
        "<synthesis_protocol>",
        "Kör sentez kuralı (consilium + mco): Koltuklar birbirinin taslağını görmeden bağımsız yanıt üretir.",
        "Baş Mimar olarak tüm koltuk yanıtlarını şu sırayla sentezle:",
        "1. Ortak uzlaşı noktalarını tek listede topla.",
        "2. Koltuklar arası gerçek çatışmaları ve ödünleşimleri (trade-off) gizlemeden karşılaştır.",
        `3. Lisans politikasını (${license.policy}) doğrula: ${license.scoutRule}`,
        "4. En yüksek kaldıraçlı, en az karmaşıklık üreten somut karar ve uygulama sırasını seç.",
        "5. Meclis sonucunu gerekirse .evrim/otonom/KARARNAMELER.md veya ROADMAP.md ile kilitle.",
        "</synthesis_protocol>",
        "",
        `<topic>${topic}</topic>`,
        `<mode>${mode} (${seats.length} koltuk)</mode>`
    ].join("\n");
    return {
        strategy: "blind-synthesis",
        steps: [
            "Koltuk yanıtlarını birbirinden yalıtılmış (kör) biçimde topla.",
            "Uzlaşı ve çatışma noktalarını ayrıştır; çoğunluk baskısına değil kanıta bak.",
            `Lisans kuralını (${license.policy}) doğrula.`,
            "Tek bir net mimari karar ve en küçük sonraki adımı çıkar."
        ],
        prompt
    };
}

// Estimate cost/benefit and design a solo, light (2-seat), or deep (3-4 seat) deliberation plan.
export function planCouncil(cfg, opts = {}) {
    const effectiveCfg = resolveCfg(cfg, opts.dir);
    const topic = String(opts.topic || "").trim() || "Genel mimari, risk ve uygulama stratejisi";
    const requestedComplexity = ["auto", "low", "medium", "high"].includes(opts.complexity) ? opts.complexity : "auto";
    const requestedDepth = ["auto", "solo", "light", "deep"].includes(opts.depth) ? opts.depth : "auto";
    const pool = opts.pool || detectPool(effectiveCfg, opts.env || process.env, {
        quota: opts.quota,
        checkCmd: opts.checkCmd,
        plan: opts.plan,
        dir: effectiveCfg.root,
        probeLocalBlocks: opts.probeLocalBlocks
    });
    const complexity = requestedComplexity === "auto" ? inferComplexity(topic) : requestedComplexity;
    const license = evaluateLicensePolicy(opts.licensePolicy || opts.license, effectiveCfg);
    const hasExternalApi = pool.availableApis.length > 0;
    const qInfo = quotaText(pool);

    let mode;
    let verdict;
    let reason;

    if (requestedDepth === "solo" || (complexity === "low" && requestedDepth !== "light" && requestedDepth !== "deep")) {
        mode = "solo";
        verdict = "Gereksiz (Solo)";
        reason = requestedDepth === "solo"
            ? "Derinlik açıkça 'solo' seçildi; meclis toplanmadan doğrudan tek ajanla ilerlenir."
            : `Görev karmaşıklığı düşük ('low'): meclis toplamak gereksiz token maliyeti yaratır; tek oturumda doğrudan çözün.`;
    } else if (requestedDepth === "light") {
        mode = "light";
        verdict = "Hafif Meclis (2 koltuk)";
        reason = `Hafif meclis istendi (${qInfo}): 2 odaklı koltuk ekonomik katmanlarla (haiku/sonnet/yerel CLI/ucuz API) çalışır.`;
    } else if (requestedDepth === "deep") {
        if (pool.critical && !hasExternalApi) {
            mode = "light";
            verdict = "Hafif Meclis (kotayı korumak için düşürüldü)";
            reason = `Derin meclis istendi ancak kota kritik (${qInfo}) ve harici API anahtarı yok; 4 ağır koltuk yerine 2 ekonomik koltuk seçildi.`;
        } else {
            mode = "deep";
            verdict = "Derin Meclis";
            reason = `Derin meclis seçildi (${qInfo}): çoklu bakış açısı ve havuz çeşitliliği kullanılıyor.`;
        }
    } else if (complexity === "medium") {
        mode = "light";
        verdict = "Hafif Meclis (2 koltuk)";
        reason = pool.constrained
            ? `Orta karmaşıklık + sıkı kota/plan (${qInfo}): 4 ağır Opus koltuğu yerine 2 odaklı ekonomik koltuk (haiku/sonnet/yerel CLI/API) seçildi.`
            : `Orta karmaşıklık (${qInfo}): tam 4 koltuk yerine 2 odaklı koltuk en iyi maliyet/fayda dengesini verir.`;
    } else {
        // complexity === "high" && requestedDepth === "auto"
        if (pool.constrained && !hasExternalApi && pool.plan !== "max") {
            mode = "light";
            verdict = "Hafif Meclis (kota sınırı nedeniyle 2 koltuk)";
            reason = `Yüksek karmaşıklık ancak kota/plan sıkı (${qInfo}) ve harici API yok: kotayı yakmamak için ağır Opus meclisi yerine 2 ekonomik koltuk seçildi.`;
        } else {
            mode = "deep";
            verdict = "Derin Meclis";
            reason = `Yüksek karmaşıklık ve uygun bütçe (${qInfo}): 3-4 farklı bakış açısı ile çoklu motor/model meclisi değer üretir.`;
        }
    }

    let seatKeys = [];
    if (mode === "light") seatKeys = ["arch", "risk"];
    else if (mode === "deep") {
        const useFour = pool.diversityCount >= 2 || pool.plan === "max" || hasExternalApi || !pool.constrained;
        seatKeys = useFour ? ["arch", "ux", "risk", "cost"] : ["arch", "ux", "risk"];
    }

    const enginePool = mode === "solo" ? [] : buildEngineChoices(mode, pool);
    const seats = seatKeys.map((key, idx) => {
        const spec = PERSPECTIVES[key];
        const assigned = enginePool[idx % enginePool.length];
        const safeTier = mode === "light" && assigned.tier === "opus" ? "haiku" : assigned.tier;
        const safeModel = mode === "light" && assigned.model === "opus" ? "haiku" : assigned.model;
        return {
            id: spec.id,
            role: spec.role,
            perspective: spec.perspective,
            tier: safeTier,
            engine: assigned.engine,
            kind: assigned.kind,
            model: safeModel,
            prompt: buildSeatPrompt(topic, spec, { ...assigned, tier: safeTier }, license, pool)
        };
    });

    const costBenefit = {
        worthwhile: mode !== "solo",
        verdict,
        reason,
        estimatedCostTier: mode === "solo" ? "minimal" : mode === "light" ? "low" : "moderate"
    };

    return {
        topic,
        complexity,
        requestedComplexity,
        requestedDepth,
        mode,
        costBenefit,
        pool,
        license,
        seats,
        synthesis: buildSynthesis(topic, mode, seats, license)
    };
}

async function executeApiSeat(cfg, seat, plan, opts = {}) {
    const safeEnv = opts.env || process.env;
    const providerSpec = (cfg.delegate && cfg.delegate.providers && cfg.delegate.providers[seat.engine]) || KNOWN_API_PROVIDERS[seat.engine];
    const key = providerSpec && providerSpec.keyEnv ? safeEnv[providerSpec.keyEnv] : null;
    const messages = [
        { role: "system", content: `You are "${seat.role}" on an independent technical council. Be concise, concrete, and critical.` },
        { role: "user", content: seat.prompt }
    ];

    if (typeof opts.chat === "function") {
        const res = await opts.chat(cfg, messages, key || "test-key", undefined, { seat });
        return { seatId: seat.id, role: seat.role, engine: seat.engine, tier: seat.tier, model: res.model || seat.model, status: "ok", output: String(res.message?.content || "").trim(), cost: res.cost || 0 };
    }
    if (!key || !providerSpec) {
        return { seatId: seat.id, role: seat.role, engine: seat.engine, tier: seat.tier, status: "skipped", output: null, note: "API anahtarı ortamda yok" };
    }

    if (seat.engine === "anthropic" || /anthropic\.com/i.test(providerSpec.apiBase || "")) {
        const fetchImpl = opts.fetch || fetch;
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), opts.timeoutMs || 60000);
        try {
            const res = await fetchImpl(providerSpec.apiBase.replace(/\/$/, "") + "/messages", {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
                body: JSON.stringify({ model: providerSpec.model, max_tokens: 2048, system: messages[0].content, messages: [{ role: "user", content: messages[1].content }] }),
                signal: ctl.signal
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
            const data = await res.json();
            const text = (data.content || []).map((c) => c.text).filter(Boolean).join("\n").trim();
            return { seatId: seat.id, role: seat.role, engine: seat.engine, tier: seat.tier, model: providerSpec.model, status: "ok", output: text, cost: 0 };
        } finally {
            clearTimeout(timer);
        }
    }

    const seatCfg = {
        ...cfg,
        delegate: {
            ...(cfg.delegate || {}),
            provider: seat.engine,
            providers: { ...((cfg.delegate && cfg.delegate.providers) || {}), [seat.engine]: providerSpec }
        }
    };
    const res = await agentChat(seatCfg, messages, key, undefined, {
        fetch: opts.fetch || fetch,
        maxRetries: opts.maxRetries ?? 1,
        backoffBaseMs: opts.backoffBaseMs ?? 300
    });
    return { seatId: seat.id, role: seat.role, engine: seat.engine, tier: seat.tier, model: res.model || seat.model, status: "ok", output: String(res.message?.content || "").trim(), cost: res.cost || 0 };
}

function cliArgsFor(engine, prompt) {
    if (engine === "codex") return ["exec", prompt];
    return ["-p", prompt];
}

async function executeSeat(cfg, seat, plan, opts = {}) {
    try {
        if (typeof opts.execSeat === "function") {
            const out = await opts.execSeat(seat, plan);
            if (typeof out === "string") return { seatId: seat.id, role: seat.role, engine: seat.engine, tier: seat.tier, status: "ok", output: out };
            return { seatId: seat.id, role: seat.role, engine: seat.engine, tier: seat.tier, status: out?.status || "ok", output: out?.output || null, error: out?.error || null, cost: out?.cost || 0 };
        }
        if (seat.kind === "api" || typeof opts.chat === "function") {
            return await executeApiSeat(cfg, seat, plan, opts);
        }
        if (seat.kind === "cli" && opts.runCli === true) {
            const args = typeof opts.cliArgs === "function" ? opts.cliArgs(seat.engine, seat.prompt) : cliArgsFor(seat.engine, seat.prompt);
            const r = runCmd(seat.engine, args, { cwd: cfg.root, env: opts.env || process.env, timeoutMs: opts.timeoutMs || 60000 });
            if (!r.ok) return { seatId: seat.id, role: seat.role, engine: seat.engine, tier: seat.tier, status: "error", error: (r.text || `exit ${r.code}`).slice(0, 300), fallbackPrompt: seat.prompt };
            return { seatId: seat.id, role: seat.role, engine: seat.engine, tier: seat.tier, status: "ok", output: r.out };
        }
        return {
            seatId: seat.id,
            role: seat.role,
            engine: seat.engine,
            tier: seat.tier,
            status: "brief-ready",
            output: null,
            note: "İstem hazır (.evrim/otonom/MECLIS.md); alt ajan veya yerel CLI ile çalıştırılabilir."
        };
    } catch (err) {
        return {
            seatId: seat.id,
            role: seat.role,
            engine: seat.engine,
            tier: seat.tier,
            status: "error",
            error: String(err && err.message ? err.message : err).slice(0, 300),
            fallbackPrompt: seat.prompt
        };
    }
}

async function runSynthesis(cfg, plan, executions, opts = {}) {
    const okSeats = executions.filter((e) => e.status === "ok" && e.output);
    if (!okSeats.length) return null;
    const combined = okSeats.map((e) => `## ${e.role} (${e.engine}/${e.tier})\n${e.output}`).join("\n\n");
    if (typeof opts.synthesize === "function") {
        return await opts.synthesize(plan, okSeats, combined);
    }
    const apiCandidate = plan.pool.availableApis[0];
    if (apiCandidate || typeof opts.chat === "function") {
        try {
            const synthSeat = {
                id: "synthesis",
                role: "Baş Mimar Sentezi",
                engine: apiCandidate || (cfg.delegate && cfg.delegate.provider) || "deepseek",
                tier: "synthesis",
                model: apiCandidate ? plan.pool.apis[apiCandidate]?.model : null,
                prompt: `${plan.synthesis.prompt}\n\n<seat_outputs>\n${combined}\n</seat_outputs>`
            };
            const r = await executeApiSeat(cfg, synthSeat, plan, opts);
            if (r.status === "ok" && r.output) return { status: "ok", engine: synthSeat.engine, output: r.output };
        } catch (err) {
            return { status: "fallback", error: String(err && err.message ? err.message : err), output: combined };
        }
    }
    return { status: "local", engine: "deterministic", output: combined };
}

export function formatCouncilMarkdown(plan, executions = null, synthesisResult = null) {
    const lines = [
        "# Meclis Müzakere Planı",
        "",
        `- Tarih: ${nowIso()}`,
        `- Konu: ${plan.topic}`,
        `- Karar / Kip: \`${plan.mode}\` — ${plan.costBenefit.verdict}`,
        `- Gerekçe: ${plan.costBenefit.reason}`,
        `- Karmaşıklık: \`${plan.complexity}\` (istenen: \`${plan.requestedComplexity}\`, derinlik: \`${plan.requestedDepth}\`)`,
        `- Plan / Kota: ${quotaText(plan.pool)}`,
        `- Yerel CLI'lar: ${plan.pool.availableClis.length ? plan.pool.availableClis.join(", ") : "(yok)"}`,
        `- API Anahtarları: ${plan.pool.availableApis.length ? plan.pool.availableApis.join(", ") : "(yok)"}`,
        `- Lisans Politikası: \`${plan.license.policy}\` (${plan.license.scoutRule})`,
        "",
        "## Lisans ve Araştırma Rehberi",
        "",
        plan.license.guidance
    ];

    if (plan.mode === "solo") {
        lines.push("", "## Karar: Meclis Toplanmadı (Solo)", "", "Bu görev için çoklu ajan meclisi maliyet/fayda açısından gereksiz bulundu. Doğrudan tek oturumda ilerleyin.");
    } else {
        lines.push("", "## Koltuk Dağılımı", "", "| Koltuk | Rol | Motor | Katman | Model |", "|---|---|---|---|---|");
        for (const s of plan.seats) {
            lines.push(`| \`${s.id}\` | ${s.role} | \`${s.engine}\` | \`${s.tier}\` | \`${s.model || "-"}\` |`);
        }
        lines.push("", "## Kör Sentez Protokolü", "");
        plan.synthesis.steps.forEach((st, i) => lines.push(`${i + 1}. ${st}`));
        lines.push("", "## Koltuk İstemleri (Kör Müzakere)");
        for (const s of plan.seats) {
            lines.push("", `### ${s.role} (\`${s.id}\` · \`${s.engine}/${s.tier}\`)`, "", "```xml", s.prompt, "```");
        }
    }

    if (Array.isArray(executions) && executions.length) {
        lines.push("", "## Yürütme Sonuçları");
        for (const e of executions) {
            lines.push("", `### ${e.role} (${e.engine}/${e.tier}) — ${e.status}`);
            if (e.output) lines.push("", e.output);
            else if (e.error) lines.push("", `HATA (yedek istem korundu): ${e.error}`);
            else if (e.note) lines.push("", e.note);
        }
    }
    if (synthesisResult && synthesisResult.output) {
        lines.push("", `## Sentez (${synthesisResult.status}${synthesisResult.engine ? " · " + synthesisResult.engine : ""})`, "", synthesisResult.output);
    }
    return lines.join("\n") + "\n";
}

export function formatCouncilLines(plan, mdPath, executions = null, synthesisResult = null) {
    const p = plan.pool;
    const lines = [
        `MECLIS: ${plan.mode.toUpperCase()} — ${plan.costBenefit.verdict}`,
        `KONU: ${plan.topic}`,
        `GEREKCE: ${plan.costBenefit.reason}`,
        `HAVUZ: CLI [${p.availableClis.join(", ") || "yok"}] · API [${p.availableApis.join(", ") || "yok"}] · ${quotaText(p)}`,
        `LISANS: ${plan.license.policy} — ${plan.license.scoutRule}`
    ];
    if (plan.seats.length) {
        lines.push(`KOLTUKLAR (${plan.seats.length}):`);
        for (const s of plan.seats) lines.push(`  - [${s.id}] ${s.role} → ${s.engine} (${s.tier})`);
    } else {
        lines.push("KOLTUKLAR: 0 (solo çalışma önerildi)");
    }
    if (Array.isArray(executions) && executions.length) {
        lines.push("YURUTME:");
        for (const e of executions) {
            lines.push(`  - [${e.seatId}] ${e.engine}: ${e.status}${e.error ? " (" + e.error + ")" : ""}`);
        }
    }
    if (synthesisResult) {
        lines.push(`SENTEZ: ${synthesisResult.status}`);
    }
    if (mdPath) lines.push(`DOSYA: ${mdPath}`);
    return lines;
}

// Plan the council, optionally execute API/CLI seats in parallel, and write .evrim/otonom/MECLIS.md.
export async function runCouncil(cfg, opts = {}) {
    const effectiveCfg = resolveCfg(cfg, opts.dir);
    const plan = planCouncil(effectiveCfg, opts);

    let executions = null;
    let synthesisResult = null;
    if (opts.execute && plan.mode !== "solo" && plan.seats.length > 0) {
        executions = await Promise.all(plan.seats.map((seat) => executeSeat(effectiveCfg, seat, plan, opts)));
        synthesisResult = await runSynthesis(effectiveCfg, plan, executions, opts);
    }

    const mdPath = opts.out
        ? path.resolve(effectiveCfg.root, opts.out)
        : path.join(autonomyDir(effectiveCfg), "MECLIS.md");
    if (opts.write !== false) {
        writeText(mdPath, formatCouncilMarkdown(plan, executions, synthesisResult));
    }

    const lines = formatCouncilLines(plan, opts.write !== false ? mdPath : null, executions, synthesisResult);
    return {
        plan,
        mdPath: opts.write !== false ? mdPath : null,
        lines,
        ...(executions ? { executions } : {}),
        ...(synthesisResult ? { synthesis: synthesisResult } : {})
    };
}
