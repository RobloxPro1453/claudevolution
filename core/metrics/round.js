// Round metrics: measures one work round without the model reading anything.
// Sources: Claude Code session logs (read only), the cheap model's run records, git.
// Generalised from the first client's round script; every path and weight comes from .evrim/config.json.
//
// A round is global: its number comes from metrics.jsonl, never from a session. A round may span several
// sessions; every Claude log entry inside the round's time window counts, each message id once.
// Row format (one JSON object per line): see core/metrics/README.md.
import fs from "node:fs";
import path from "node:path";
import { exists, git, home, lines, readJson, readText, writeJson, writeText } from "../lib/util.js";

const r2 = (n) => Math.round(n * 100) / 100;
const r3 = (n) => Math.round(n * 1000) / 1000;
const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
const P = (cfg, rel) => path.resolve(cfg.root, rel);
const openFile = (cfg) => P(cfg, path.join(cfg.metrics.stateDir, "round-open.json"));
const tableFile = (cfg) => P(cfg, cfg.metrics.table || ".evrim/METRICS.md");

export function rows(cfg) {
    return lines(readText(P(cfg, cfg.metrics.file), "")).filter(Boolean).map((l) => { try { return JSON.parse(l); } catch (_) { return null; } }).filter(Boolean);
}
const nextNumber = (cfg) => rows(cfg).reduce((m, r) => Math.max(m, r.round || 0), 0) + 1;

// Claude Code keeps a project's logs in ~/.claude/projects/<the project path with every non-alphanumeric as "-">.
export function claudeDir(cfg) {
    const own = cfg.metrics.claudeProjectDir;
    if (own) return own.startsWith("~") ? path.join(home(), own.slice(1)) : path.resolve(cfg.root, own);
    return path.join(home(), ".claude", "projects", path.resolve(cfg.root).replace(/[^A-Za-z0-9]/g, "-"));
}

function jsonlFiles(dir, out = []) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch (_) { return out; }
    for (const e of entries) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) jsonlFiles(p, out); else if (e.name.endsWith(".jsonl")) out.push(p);
    }
    return out;
}
function modelFactor(cfg, model) {
    const f = cfg.metrics.weights.modelFactor || {};
    for (const k of Object.keys(f)) if (String(model).includes(k)) return f[k];
    return 1;
}

// Claude side: calls, weighted load (proportional to quota use), context size, active minutes.
export function claude(cfg, from, to, sessions = [], exclude = []) {
    const byId = new Map();
    for (const file of jsonlFiles(claudeDir(cfg))) {
        let text;
        try { text = fs.readFileSync(file, "utf8"); } catch (_) { continue; }
        for (const line of text.split("\n")) {
            if (!line.includes('"usage"')) continue;
            let e;
            try { e = JSON.parse(line); } catch (_) { continue; }
            if (e.type !== "assistant" || !e.message || !e.message.usage || !e.message.id || e.message.model === "<synthetic>") continue;
            const t = Date.parse(e.timestamp);
            if (!(t >= from && t <= to)) continue;
            if (sessions.length && !sessions.includes(e.sessionId)) continue;
            if (exclude.includes(e.sessionId)) continue;
            byId.set(e.message.id, e); // the entries of one message repeat its usage; keep one
        }
    }
    const w = cfg.metrics.weights;
    const calls = [...byId.values()].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
    const c = { calls: calls.length, sessions: [...new Set(calls.map((e) => e.sessionId))].length, output: 0, cacheRead: 0, cacheWrite: 0, input: 0, load: 0, sidechainCalls: 0, sidechainLoad: 0, models: {} };
    const ctx = [];
    for (const e of calls) {
        const u = e.message.usage;
        const out = u.output_tokens || 0, rd = u.cache_read_input_tokens || 0, wr = u.cache_creation_input_tokens || 0, inp = u.input_tokens || 0;
        const load = (out * w.output + rd * w.cacheRead + wr * w.cacheWrite + inp * w.input) / 1e6 * modelFactor(cfg, e.message.model);
        c.output += out; c.cacheRead += rd; c.cacheWrite += wr; c.input += inp; c.load += load;
        c.models[e.message.model] = (c.models[e.message.model] || 0) + 1;
        if (e.isSidechain) { c.sidechainCalls++; c.sidechainLoad += load; } else ctx.push(rd + wr + inp);
    }
    c.load = r3(c.load); c.sidechainLoad = r3(c.sidechainLoad);
    c.contextAvg = ctx.length ? Math.round(ctx.reduce((a, b) => a + b, 0) / ctx.length) : 0;
    c.contextLast = ctx[ctx.length - 1] || 0;
    c.contextMax = ctx.length ? Math.max(...ctx) : 0;
    // Active time: a gap over 3 minutes between calls counts as 3 minutes (waiting, reading).
    let active = 0;
    for (let i = 1; i < calls.length; i++) active += Math.min(180, (Date.parse(calls[i].timestamp) - Date.parse(calls[i - 1].timestamp)) / 1000);
    c.activeMin = r2(active / 60);
    return c;
}

// Cheap model side: runs whose end time falls inside the window (records written by core/delegate/agent.js).
export function delegate(cfg, from, to) {
    const dir = P(cfg, cfg.delegate.stateDir);
    let files = [];
    try { files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort(); } catch (_) { /* no runs yet */ }
    const d = { tasks: 0, runs: 0, fixRuns: 0, firstTryDone: 0, endedDone: 0, steps: 0, wastedSteps: 0, cost: 0, tokens: null, runMin: null, loopStops: 0, asks: 0, list: [] };
    const addTokens = (t) => { if (!t) return; d.tokens = d.tokens || { hit: 0, miss: 0, out: 0 }; d.tokens.hit += t.hit || 0; d.tokens.miss += t.miss || 0; d.tokens.out += t.out || 0; };
    for (const f of files) {
        const s = readJson(path.join(dir, f), null);
        if (!s || !Array.isArray(s.runs)) continue;
        const runs = s.runs.filter((r) => { const t = Date.parse(r.at); return t >= from && t <= to; });
        if (!runs.length) continue;
        d.tasks++; d.runs += runs.length;
        d.fixRuns += runs.filter((r) => r.kind === "fix").length;
        if (runs.length === 1 && runs[0].kind === "first" && runs[0].status === "done") d.firstTryDone++;
        if (runs[runs.length - 1].status === "done") d.endedDone++;
        for (const r of runs) {
            d.steps += r.steps || 0; d.cost += r.cost || 0;
            if (r.status !== "done") d.wastedSteps += r.steps || 0; // a blocked run produced no accepted result
            if (r.stopReason === "loop") d.loopStops++;
            addTokens(r.tokens);
            if (r.startedAt) d.runMin = r2((d.runMin || 0) + (Date.parse(r.at) - Date.parse(r.startedAt)) / 60000);
        }
        d.list.push(`${s.task}:${runs.map((r) => (r.kind === "fix" ? "fix" : "1st") + "/" + r.status).join(",")}`);
    }
    for (const l of lines(readText(path.join(dir, "asks.jsonl"), "")).filter(Boolean)) {
        let a; try { a = JSON.parse(l); } catch (_) { continue; }
        const t = Date.parse(a.at);
        if (!(t >= from && t <= to)) continue;
        d.asks++; d.cost += a.cost || 0; addTokens(a.tokens);
    }
    d.cost = r3(d.cost);
    return d;
}

// git side: commits in base..head, code lines, spec lines, who wrote the code (cheap model = commit trailer).
export function gitStats(cfg, base, head, from, to) {
    const codePaths = cfg.codePaths || [];
    const code = (f) => codePaths.some((p) => f.startsWith(p));
    const taskRe = new RegExp(cfg.tasks.pattern), tdir = cfg.tasks.dir.replace(/\/$/, "");
    const isSpec = (f) => f.startsWith(tdir + "/") && taskRe.test(f.slice(tdir.length + 1));
    const trailer = String(cfg.delegate.commitTrailer || "").replace(/^[^:]*:\s*/, "");
    const g = { base, head, commits: 0, files: 0, codeAdded: 0, codeRemoved: 0, agentCodeAdded: 0, claudeCodeAdded: 0, specLines: 0, reviewLines: 0 };
    const count = git(["rev-list", "--count", `${base}..${head}`], cfg.root);
    g.commits = count.ok ? Number(count.out) || 0 : 0;
    const diff = git(["diff", "--numstat", base, head], cfg.root);
    for (const l of (diff.ok ? diff.out : "").split("\n").filter(Boolean)) {
        const [a, d, f] = l.split("\t");
        g.files++;
        if (code(f)) { g.codeAdded += Number(a) || 0; g.codeRemoved += Number(d) || 0; }
    }
    const log = git(["log", "--no-merges", "--format=@@%(trailers:key=Co-Authored-By,valueonly,separator=;)", "--numstat", `${base}..${head}`], cfg.root);
    let agent = false;
    for (const l of (log.ok ? log.out : "").split("\n")) {
        if (l.startsWith("@@")) { agent = !!trailer && l.includes(trailer); continue; }
        const [a, , f] = l.split("\t");
        if (!f) continue;
        if (code(f)) { if (agent) g.agentCodeAdded += Number(a) || 0; else g.claudeCodeAdded += Number(a) || 0; }
        if (!agent && isSpec(f)) g.specLines += Number(a) || 0;
    }
    // Review notes live in the delegate state folder (not in git): count those written inside the window.
    const dir = P(cfg, cfg.delegate.stateDir);
    let notes = [];
    try { notes = fs.readdirSync(dir).filter((f) => f.endsWith(".review.md")); } catch (_) { /* none */ }
    for (const f of notes) {
        const t = fs.statSync(path.join(dir, f)).mtime.getTime();
        if (t >= from && t <= to) g.reviewLines += lines(readText(path.join(dir, f), "")).filter(Boolean).length;
    }
    g.specPerCode = g.codeAdded ? r2(g.specLines / g.codeAdded) : null;
    g.handoffPerCode = g.codeAdded ? r2((g.specLines + g.reviewLines) / g.codeAdded) : null;
    return g;
}

export function measure(cfg, o, fromIso, toIso, base, head, number, extra = {}) {
    const from = Date.parse(fromIso), to = Date.parse(toIso);
    if (!(from < to)) throw new Error(`geçersiz zaman aralığı: ${fromIso} .. ${toIso}`);
    const list = (v) => (v === undefined || v === true ? [] : [].concat(v)).map(String);
    const c = claude(cfg, from, to, list(o.session), list(o["exclude-session"]));
    const d = delegate(cfg, from, to);
    const g = gitStats(cfg, base, head, from, to);
    return {
        round: number,
        date: new Date(from).toISOString().slice(0, 10),
        from: new Date(from).toISOString(), to: new Date(to).toISOString(),
        minutes: r2((to - from) / 60000),
        type: (typeof o.type === "string" ? o.type : null) || extra.type || null,
        mode: (typeof o.mode === "string" ? o.mode : null) || extra.mode || "hybrid",
        quotaStart: num(o["quota-start"] ?? extra.quotaStart), quotaEnd: num(o.quota ?? o["quota-end"]),
        claude: c, delegate: d, git: g,
        loadPer100Lines: g.codeAdded ? r3(c.load / g.codeAdded * 100) : null,
        delegateWaitShare: d.runMin != null ? r2(d.runMin / ((to - from) / 60000)) : null,
        bugs: typeof o.bugs === "string" ? o.bugs : null, waste: typeof o.waste === "string" ? o.waste : null, note: typeof o.note === "string" ? o.note : null
    };
}

function append(cfg, row) {
    if (rows(cfg).some((r) => r.round === row.round)) throw new Error(`tur ${row.round} zaten ${cfg.metrics.file} içinde`);
    const file = P(cfg, cfg.metrics.file);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, JSON.stringify(row) + "\n");
    table(cfg);
}

const headOf = (cfg) => { const r = git(["rev-parse", "HEAD"], cfg.root); return r.ok ? r.out : null; };

export function start(cfg, o = {}, now = new Date()) {
    const existing = readJson(openFile(cfg), null);
    if (existing) throw new Error(`tur ${existing.round} zaten açık (önce: cv round end)`);
    const base = headOf(cfg);
    if (!base) throw new Error("git deposunda en az bir commit gerekli (turun başlangıç noktası)");
    const open = { round: nextNumber(cfg), from: now.toISOString(), base, quotaStart: num(o.quota), type: typeof o.type === "string" ? o.type : null, mode: typeof o.mode === "string" ? o.mode : "hybrid" };
    writeJson(openFile(cfg), open);
    return open;
}

export function end(cfg, o = {}, now = new Date()) {
    const open = readJson(openFile(cfg), null);
    if (!open) throw new Error("açık tur yok (önce: cv round start)");
    const row = measure(cfg, o, open.from, now.toISOString(), open.base, headOf(cfg), open.round, open);
    if (o.dry) return row;
    append(cfg, row);
    fs.rmSync(openFile(cfg), { force: true });
    return row;
}

// A past round, measured afterwards from a time window and two revisions.
export function add(cfg, o = {}) {
    for (const f of ["from", "to", "base", "head"]) if (!o[f] || o[f] === true) throw new Error(`add için --${f} gerekli`);
    const row = measure(cfg, o, o.from, o.to, o.base, o.head, o.round ? Number(o.round) : nextNumber(cfg), {});
    if (!o.dry) append(cfg, row);
    return row;
}

const k = (n) => n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : n >= 1e3 ? Math.round(n / 1e3) + "k" : String(n);
const pct = (a, b) => b ? Math.round(a / b * 100) + "%" : "-";
const dash = (v) => v == null ? "-" : String(v).replace(".", ",");

export function summary(r) {
    const c = r.claude, d = r.delegate || r.deepseek || {}, g = r.git;
    return `tur ${r.round} (${r.date}, ${r.type || "?"}, ${r.mode}): Claude ${c.calls} çağrı, yük ${c.load}, bağlam ort ${k(c.contextAvg)} son ${k(c.contextLast)}; ` +
        `kod +${g.codeAdded} (ucuz model +${g.agentCodeAdded}), tarif ${g.specLines} (tarif/kod ${dash(g.specPerCode)}); ucuz model ${d.tasks || 0} iş ${d.runs || 0} çalıştırma ${d.steps || 0} adım $${d.cost || 0}; ${Math.round(r.minutes)} dk`;
}

// Bounded text for `cv round show` and `cv status`: the open round and the last five rows.
export function show(cfg) {
    const open = readJson(openFile(cfg), null);
    const out = [open ? `açık: tur ${open.round}, ${open.from.slice(0, 16)}Z'den beri${open.type ? ` (${open.type})` : ""}` : "açık tur yok"];
    const all = rows(cfg);
    for (const r of all.slice(-5)) out.push(summary(r));
    if (!all.length) out.push("(henüz ölçülmüş tur yok)");
    return out.join("\n");
}

// Rebuilds the human table from metrics.jsonl. Generated; never edited by hand.
export function table(cfg) {
    const all = rows(cfg);
    const head = "| Tur | Tarih | Tür | Mod | Çağrı | Claude yükü | Bağlam ort / son | Kod satırı | Yük / 100 satır | Ucuz iş / çalıştırma | İlk denemede | Adım (boşa) | Ucuz $ | Tarif / kod | Süre dk | Kota % | Not |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|";
    const line = (r) => {
        const c = r.claude, d = r.delegate || r.deepseek || {}, g = r.git;
        const quota = r.quotaStart != null || r.quotaEnd != null ? `${dash(r.quotaStart)} → ${dash(r.quotaEnd)}` : "-";
        const note = [r.bugs && "hata: " + r.bugs, r.waste && "israf: " + r.waste, r.note].filter(Boolean).join("; ").replace(/\|/g, "/");
        return `| ${r.round} | ${r.date} | ${r.type || "-"} | ${r.mode} | ${c.calls}${c.sidechainCalls ? ` (${c.sidechainCalls} yan)` : ""} | ${dash(r2(c.load))} | ${k(c.contextAvg)} / ${k(c.contextLast)} | ${g.codeAdded} | ${dash(r.loadPer100Lines)} | ${d.tasks || 0} / ${d.runs || 0} | ${d.tasks ? `${d.firstTryDone}/${d.tasks}` : "-"} | ${d.steps || 0} (${pct(d.wastedSteps, d.steps)}) | ${dash(d.cost)} | ${dash(g.specPerCode)} | ${dash(Math.round(r.minutes))} | ${quota} | ${note} |`;
    };
    const last = all.slice(-5);
    const avg = (f) => { const v = last.map(f).filter((x) => x != null); return v.length ? r2(v.reduce((a, b) => a + b, 0) / v.length) : null; };
    const md = `# Tur ölçümleri

Bu dosya \`cv round\` tarafından üretilir, elle düzenlenmez. Ham veri: \`${cfg.metrics.file}\`. Alanlar: paketteki \`core/metrics/README.md\`.

- **Claude yükü:** (çıktı × ${cfg.metrics.weights.output} + önbellekten okuma × ${cfg.metrics.weights.cacheRead} + önbelleğe yazma × ${cfg.metrics.weights.cacheWrite} + girdi × ${cfg.metrics.weights.input}) / 1 M, model katsayısıyla. Kota tüketimiyle orantılı kabul edilir.
- **Kod satırı:** turun başı ile sonu arasında \`${(cfg.codePaths || []).join("`, `")}\` altına eklenen satırlar.
- **Tarif / kod:** ucuz modele yazılan tarif satırı / kod satırı. 0,5 üstü: iş Claude'da kalmalıydı.
- **Adım (boşa):** "blocked" biten çalıştırmaların adımları boşa sayılır.

${head}
${all.map(line).join("\n")}

## Son ${last.length} turun ortalaması

| Claude yükü | Çağrı | Yük / 100 satır | Tarif / kod | Ucuz $ | Süre dk |
|---|---|---|---|---|---|
| ${dash(avg((r) => r.claude.load))} | ${dash(avg((r) => r.claude.calls))} | ${dash(avg((r) => r.loadPer100Lines))} | ${dash(avg((r) => r.git.specPerCode))} | ${dash(avg((r) => (r.delegate || r.deepseek || {}).cost))} | ${dash(avg((r) => r.minutes))} |
`;
    writeText(tableFile(cfg), md);
    return tableFile(cfg);
}

export const isOpen = (cfg) => exists(openFile(cfg));
