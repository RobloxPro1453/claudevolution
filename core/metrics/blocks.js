// 5-hour Claude session block detection, burn-rate projection, and local quota estimation.
// Pure JS port of ccusage's block algorithm using node: built-ins only.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const HOUR_MS = 3600 * 1000;
const MINUTE_MS = 60 * 1000;
const WEEK_MS = 7 * 24 * HOUR_MS;
const SUBAGENT_PATH_RE = /[/\\]subagents[/\\][^/\\]+\.jsonl$/i;

export const DEFAULT_QUOTA = {
    fiveHourTokenLimit: 20_000_000,
    weeklyTokenLimit: 200_000_000,
    burnRateWarnShare: 0.85,
    sessionDurationHours: 5
};

function toMs(v) {
    if (typeof v === "number") return Number.isFinite(v) ? v : NaN;
    if (v instanceof Date) return v.getTime();
    if (typeof v === "string" && v.trim()) return Date.parse(v);
    return NaN;
}

function isDir(p) {
    try { return fs.statSync(p).isDirectory(); } catch (_) { return false; }
}

function expandHome(raw, homeDir) {
    const s = String(raw || "").trim();
    if (s === "~") return homeDir;
    if (s.startsWith("~/") || s.startsWith("~\\")) return path.join(homeDir, s.slice(2));
    return s;
}

// Floor a UTC timestamp (ms or ISO/Date) to its UTC hour boundary.
export function floorToHour(tsMs) {
    const ms = toMs(tsMs);
    if (!Number.isFinite(ms)) return NaN;
    return Math.floor(ms / HOUR_MS) * HOUR_MS;
}

// Discover local Claude Code projects directories from CLAUDE_CONFIG_DIR, ~/.config/claude/projects, and ~/.claude/projects.
export function collectClaudeDirs(env = process.env) {
    const homeDir = env.USERPROFILE || env.HOME || os.homedir();
    const out = [];
    const seen = new Set();
    const push = (p) => {
        const resolved = path.resolve(p);
        const key = process.platform === "win32" ? resolved.toLowerCase() : resolved;
        if (!seen.has(key) && isDir(resolved)) { seen.add(key); out.push(resolved); }
    };

    const rawEnv = env.CLAUDE_CONFIG_DIR;
    if (typeof rawEnv === "string" && rawEnv.trim()) {
        const sepRe = path.delimiter === ";" ? /[;,]/ : /[:,]/;
        for (const piece of rawEnv.split(sepRe).map((s) => s.trim()).filter(Boolean)) {
            const p = path.resolve(expandHome(piece, homeDir));
            const projects = path.join(p, "projects");
            if (path.basename(p) === "projects" && isDir(p)) push(p);
            else if (isDir(projects)) push(projects);
            else if (isDir(p)) push(p);
        }
        return out;
    }

    const xdgBase = env.XDG_CONFIG_HOME ? expandHome(env.XDG_CONFIG_HOME, homeDir) : path.join(homeDir, ".config");
    push(path.join(xdgBase, "claude", "projects"));
    push(path.join(homeDir, ".claude", "projects"));
    return out;
}

function normalizeEntry(raw, meta = {}) {
    if (!raw || typeof raw !== "object") return null;
    if (raw.type && raw.type !== "assistant") return null;
    const tsMs = toMs(raw.tsMs ?? raw.ts ?? raw.timestamp);
    if (!Number.isFinite(tsMs)) return null;

    const u = (raw.message && raw.message.usage) || raw.usage || raw.tokens ||
        ((typeof raw.input === "number" || typeof raw.output === "number" || typeof raw.total === "number") ? raw : null);
    if (!u || typeof u !== "object") return null;

    const rawModel = (raw.message && raw.message.model) || raw.model || null;
    if (rawModel === "<synthetic>") return null;
    const model = rawModel ? String(rawModel) : null;

    const input = Number(u.input_tokens ?? u.inputTokens ?? u.input ?? 0) || 0;
    const output = Number(u.output_tokens ?? u.outputTokens ?? u.output ?? 0) || 0;
    const ccObj = u.cache_creation && typeof u.cache_creation === "object" ? u.cache_creation : null;
    const cacheCreation = ccObj
        ? (Number(ccObj.ephemeral_5m_input_tokens || 0) || 0) + (Number(ccObj.ephemeral_1h_input_tokens || 0) || 0)
        : (Number(u.cache_creation_input_tokens ?? u.cacheCreationInputTokens ?? u.cacheCreationTokens ?? u.cacheCreation ?? 0) || 0);
    const cacheRead = Number(u.cache_read_input_tokens ?? u.cacheReadInputTokens ?? u.cacheReadTokens ?? u.cacheRead ?? 0) || 0;
    const summed = input + output + cacheCreation + cacheRead;
    const total = summed > 0 ? summed : (Number(u.total) || 0);

    const subagentFile = meta.subagentFile || raw.subagentFile || null;
    const isSidechain = Boolean(raw.isSidechain);
    const isSubagent = Boolean(subagentFile || meta.isSubagent || raw.isSubagent || isSidechain);

    return {
        tsMs,
        input,
        output,
        cacheCreation,
        cacheRead,
        total,
        model,
        id: (raw.message && raw.message.id) || raw.id || null,
        sessionId: raw.sessionId || meta.sessionId || null,
        agentId: raw.agentId || meta.agentId || null,
        subagentFile,
        isSidechain,
        isSubagent
    };
}

function buildBlock(startTime, blockEntries, nowMs, durationMs) {
    const endTime = startTime + durationMs;
    const actualEndTime = blockEntries[blockEntries.length - 1].tsMs;
    const isActive = Number.isFinite(nowMs) && nowMs >= startTime && nowMs < endTime && (nowMs - actualEndTime) < durationMs;
    const tokens = { input: 0, output: 0, cacheCreation: 0, cacheRead: 0, total: 0 };
    const models = [];
    const seenModels = new Set();
    const subagentKeys = new Set();
    let subagentTokens = 0;

    for (let i = 0; i < blockEntries.length; i++) {
        const e = blockEntries[i];
        tokens.input += e.input;
        tokens.output += e.output;
        tokens.cacheCreation += e.cacheCreation;
        tokens.cacheRead += e.cacheRead;
        tokens.total += e.total;
        if (e.model && !seenModels.has(e.model)) { seenModels.add(e.model); models.push(e.model); }
        if (e.isSubagent) {
            subagentTokens += e.total;
            const key = e.subagentFile || e.agentId || (e.sessionId ? `side:${e.sessionId}` : `side:${i}`);
            subagentKeys.add(key);
        }
    }

    return {
        id: new Date(startTime).toISOString(),
        startTime,
        endTime,
        actualEndTime,
        isActive,
        isGap: false,
        tokens,
        models,
        entriesCount: blockEntries.length,
        subagentCount: subagentKeys.size,
        subagentTokens
    };
}

function buildGapBlock(lastTime, nextTime, durationMs) {
    const startTime = lastTime + durationMs;
    return {
        id: "gap-" + new Date(startTime).toISOString(),
        startTime,
        endTime: nextTime,
        actualEndTime: null,
        isActive: false,
        isGap: true,
        tokens: { input: 0, output: 0, cacheCreation: 0, cacheRead: 0, total: 0 },
        models: [],
        entriesCount: 0,
        subagentCount: 0,
        subagentTokens: 0
    };
}

// Group entries into 5-hour session blocks (with gap markers for inactive stretches > 5h).
export function identifySessionBlocks(entries, sessionDurationHours = 5, nowMs = Date.now()) {
    if (typeof sessionDurationHours === "object" && sessionDurationHours !== null) {
        nowMs = sessionDurationHours.nowMs ?? Date.now();
        sessionDurationHours = sessionDurationHours.sessionDurationHours ?? 5;
    }
    const now = toMs(nowMs);
    const durationMs = Math.round((Number(sessionDurationHours) || 5) * HOUR_MS);
    const normalized = [];
    for (const raw of entries || []) {
        const e = normalizeEntry(raw);
        if (e) normalized.push(e);
    }
    if (!normalized.length) return [];
    normalized.sort((a, b) => a.tsMs - b.tsMs);

    const blocks = [];
    let currentStart = null;
    let currentEntries = [];
    for (const entry of normalized) {
        if (currentStart === null) {
            currentStart = floorToHour(entry.tsMs);
            currentEntries.push(entry);
            continue;
        }
        const lastTime = currentEntries[currentEntries.length - 1].tsMs;
        const sinceStart = entry.tsMs - currentStart;
        const sinceLast = entry.tsMs - lastTime;
        if (sinceStart > durationMs || sinceLast > durationMs) {
            blocks.push(buildBlock(currentStart, currentEntries, now, durationMs));
            if (sinceLast > durationMs) blocks.push(buildGapBlock(lastTime, entry.tsMs, durationMs));
            currentStart = floorToHour(entry.tsMs);
            currentEntries = [entry];
        } else {
            currentEntries.push(entry);
        }
    }
    if (currentStart !== null && currentEntries.length) {
        blocks.push(buildBlock(currentStart, currentEntries, now, durationMs));
    }
    return blocks;
}

// Tokens/minute over the block's active span (actualEndTime - startTime).
export function computeBurnRate(block, nowMs = Date.now()) {
    if (!block || block.isGap || !block.entriesCount || !block.tokens) return 0;
    const now = toMs(nowMs);
    const endMs = block.actualEndTime != null && block.actualEndTime > block.startTime
        ? block.actualEndTime
        : (block.isActive && Number.isFinite(now) && now > block.startTime ? now : block.startTime);
    const spanMin = (endMs - block.startTime) / MINUTE_MS;
    if (!(spanMin > 0)) return 0;
    return Math.round((block.tokens.total / spanMin) * 100) / 100;
}

// Project remaining minutes and end-of-block total tokens for an active block.
export function projectBlockUsage(block, burnRate, nowMs = Date.now()) {
    if (!block || block.isGap) return null;
    const now = toMs(nowMs);
    const active = block.isActive !== undefined ? block.isActive : (Number.isFinite(now) && now < block.endTime);
    if (!active) return null;
    const rate = typeof burnRate === "number"
        ? burnRate
        : (burnRate && typeof burnRate.tokensPerMinute === "number" ? burnRate.tokensPerMinute : computeBurnRate(block, now));
    const remainingMinutes = Math.max(0, Math.round((block.endTime - now) / MINUTE_MS));
    const current = (block.tokens && block.tokens.total) || 0;
    const projectedTokens = Math.round(current + (Number.isFinite(rate) ? rate : 0) * remainingMinutes);
    return { remainingMinutes, projectedTokens };
}

function walkJsonl(dir, minMtimeMs, out = []) {
    let items;
    try { items = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return out; }
    for (const item of items) {
        const full = path.join(dir, item.name);
        if (item.isDirectory()) walkJsonl(full, minMtimeMs, out);
        else if (item.name.endsWith(".jsonl")) {
            if (minMtimeMs > 0) {
                try { if (fs.statSync(full).mtimeMs < minMtimeMs) continue; } catch (_) { /* keep unreadable mtime */ }
            }
            out.push(full);
        }
    }
    return out;
}

function loadEntriesFromDirs(dirs, minMtimeMs) {
    const byId = new Map();
    const anonymous = [];
    for (const dir of dirs) {
        for (const file of walkJsonl(dir, minMtimeMs)) {
            let text;
            try { text = fs.readFileSync(file, "utf8"); } catch (_) { continue; }
            const isSubagent = SUBAGENT_PATH_RE.test(file);
            for (const line of text.split(/\r?\n/)) {
                if (!line.includes('"usage"')) continue;
                let raw;
                try { raw = JSON.parse(line); } catch (_) { continue; }
                const entry = normalizeEntry(raw, { isSubagent, subagentFile: isSubagent ? file : null });
                if (!entry) continue;
                if (entry.id) {
                    const prev = byId.get(entry.id);
                    if (!prev || (prev.isSidechain && !entry.isSidechain) || entry.total >= prev.total) byId.set(entry.id, entry);
                } else {
                    anonymous.push(entry);
                }
            }
        }
    }
    return [...byId.values(), ...anonymous];
}

function weekWindowStartMs(nowMs, weeklyReset) {
    if (!weeklyReset || typeof weeklyReset.weekdayUtc !== "number" || typeof weeklyReset.hourUtc !== "number") {
        return nowMs - WEEK_MS;
    }
    const now = new Date(nowMs);
    const last = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), weeklyReset.hourUtc));
    let back = (now.getUTCDay() - weeklyReset.weekdayUtc + 7) % 7;
    if (back === 0 && nowMs < last.getTime()) back = 7;
    last.setUTCDate(last.getUTCDate() - back);
    return last.getTime();
}

// Scan local Claude session transcripts (including <session>/subagents/*.jsonl) to estimate 5h and weekly quota.
export function estimateQuota(root, cfg = {}, nowMs = Date.now(), opts = {}) {
    const now = toMs(nowMs);
    const config = cfg || {};
    const qCfg = { ...DEFAULT_QUOTA, ...(config.quota || {}), ...(opts.quota || {}) };
    const fiveLimit = Math.max(1, Number(qCfg.fiveHourTokenLimit ?? qCfg.tokenLimit ?? DEFAULT_QUOTA.fiveHourTokenLimit) || DEFAULT_QUOTA.fiveHourTokenLimit);
    const weekLimit = Math.max(1, Number(qCfg.weeklyTokenLimit ?? DEFAULT_QUOTA.weeklyTokenLimit) || DEFAULT_QUOTA.weeklyTokenLimit);
    const warnShare = Number(qCfg.burnRateWarnShare ?? DEFAULT_QUOTA.burnRateWarnShare);
    const sessionHours = Number(qCfg.sessionDurationHours ?? DEFAULT_QUOTA.sessionDurationHours) || 5;

    let entries = [];
    const mockEntries = Array.isArray(opts.entries) ? opts.entries : (Array.isArray(config.entries) ? config.entries : null);
    if (mockEntries) {
        for (const raw of mockEntries) {
            const e = normalizeEntry(raw);
            if (e) entries.push(e);
        }
    } else {
        let dirs = null;
        if (Array.isArray(opts.dirs)) dirs = opts.dirs;
        else if (Array.isArray(config.quota && config.quota.dirs)) dirs = config.quota.dirs;
        else if (Array.isArray(config.dirs)) dirs = config.dirs;
        else if (config.metrics && config.metrics.claudeProjectDir) {
            const homeDir = process.env.USERPROFILE || process.env.HOME || os.homedir();
            const own = config.metrics.claudeProjectDir;
            const resolved = own.startsWith("~") ? path.join(homeDir, own.slice(1)) : path.resolve(root || config.root || ".", own);
            dirs = isDir(resolved) ? [resolved] : [];
        } else {
            dirs = collectClaudeDirs();
        }
        const minMtimeMs = opts.skipMtimePrune ? 0 : Math.max(0, Math.min(now, Date.now()) - 8 * 24 * HOUR_MS);
        entries = loadEntriesFromDirs(dirs, minMtimeMs);
    }

    const blocks = identifySessionBlocks(entries, sessionHours, now);
    const activeBlock = blocks.find((b) => b.isActive && !b.isGap) || null;
    const weekStart = weekWindowStartMs(now, config.autonomy && config.autonomy.weeklyReset);
    let weekTokens = 0;
    for (const e of entries) {
        if (e.tsMs >= weekStart && e.tsMs <= now) weekTokens += e.total;
    }
    const weekPct = weekTokens > 0 ? Math.min(100, Math.round((weekTokens / weekLimit) * 1000) / 10) : (activeBlock ? 0 : null);

    if (!activeBlock) {
        return {
            available: false,
            fivePct: null,
            weekPct,
            activeBlock: null,
            burnRate: 0,
            projectedTokens: 0,
            subagentCount: 0,
            subagentTokens: 0,
            quotaSource: "local-blocks"
        };
    }

    const burnRate = computeBurnRate(activeBlock, now);
    const proj = projectBlockUsage(activeBlock, burnRate, now);
    const projectedTokens = proj ? proj.projectedTokens : activeBlock.tokens.total;
    const fivePct = Math.min(100, Math.round((activeBlock.tokens.total / fiveLimit) * 1000) / 10);
    const approachingCap = projectedTokens >= fiveLimit * warnShare;

    return {
        available: true,
        fivePct,
        weekPct: weekPct ?? 0,
        activeBlock,
        burnRate,
        projectedTokens,
        subagentCount: activeBlock.subagentCount || 0,
        subagentTokens: activeBlock.subagentTokens || 0,
        fiveResetsAt: new Date(activeBlock.endTime).toISOString(),
        approachingCap,
        tokenLimit: fiveLimit,
        quotaSource: "local-blocks"
    };
}
