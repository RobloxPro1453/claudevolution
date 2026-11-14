// Independent task verifier ("never self-grade"): combines adversarial binary rubric (PASS | FAIL),
// scope enforcement, forbidden write checks, secret scanning, test-assertion quality, and omk treeSha receipts.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { exists, git, readJson, readText, run as defaultRun, slash, writeJson } from "../lib/util.js";
import * as configLib from "../lib/config.js";
import { isSensitivePath } from "./agent.js";

const FALLBACK_SECRET_RES = [
    /(sk-[A-Za-z0-9_-]{20,})/g,
    /(gh[pousr]_[A-Za-z0-9]{20,})/g,
    /(github_pat_[A-Za-z0-9_]{20,})/g,
    /(AKIA[0-9A-Z]{16})/g,
    /(xox[baprs]-[A-Za-z0-9-]{10,})/g,
    /(AIza[0-9A-Za-z_-]{35})/g,
    /(-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----)/g
];

const TEST_FILE_RE = /(^|\/)(?:tests?|__tests__|specs?)\//i;
const TEST_NAME_RE = /(?:^|\/)(?:test|spec)[._-][^/]*$|\.(?:test|spec)\.[a-z0-9]+$|_test\.[a-z0-9]+$/i;
const isTestFile = (f) => TEST_FILE_RE.test(f) || TEST_NAME_RE.test(f);

const ASSERTION_RE = /(?:\bexpect\s*\(|\bassert(?:Equal|Equals|NotEqual|True|False|Throws|Rejects|Match|_eq!|_ne!|_ok)?\s*(?:\.|\()|\b(?:eq|ok|throws)\s*\(|\b(?:test|it)\s*\(|#\[test\]|\bdef\s+test_\w+)/;
const TRIVIAL_ASSERT_RE = /\b(?:ok|assert|assertTrue)\s*\(\s*true\s*\)|\bassert\.ok\s*\(\s*true\s*\)|\beq\s*\(\s*(?:true\s*,\s*true|false\s*,\s*false|1\s*,\s*1|0\s*,\s*0|(['"])([^'"]*)\1\s*,\s*\1\2\1)\s*\)|\bexpect\s*\(\s*(?:true|false|1|0)\s*\)\s*\.\s*(?:toBe|toEqual|toStrictEqual)\s*\(\s*(?:true|false|1|0)\s*\)|\bassert_eq!\s*\(\s*(?:true\s*,\s*true|1\s*,\s*1)\s*\)/;
const SKIP_TEST_RE = /\b(?:test|it|describe)\.skip\s*\(|\b(?:xit|xtest|xdescribe)\s*\(|#\[ignore\]|@pytest\.mark\.skip\b|\bt\.Skip\s*\(/;
const EMPTY_TEST_LINE_RE = /\b(?:test|it)\s*\([^,]+,\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{\s*\}\s*\)|^\s*def\s+test_\w+\s*\([^)]*\)\s*:\s*(?:pass|\.\.\.)\s*$/;
const PRESENCE_ONLY_RE = /\.\s*(?:toBeDefined|toBeTruthy)\s*\(\s*\)/;

function cleanScopeToken(tok) {
    return slash(String(tok || "").trim().replace(/^[`"']+|[`"',;]+$/g, "")).replace(/^\.\//, "");
}

// Parse Scope: / Files: / Kapsam: lines (inline or bullet list) from a task spec.
// Returns string[] if declared, or null if the spec does not declare an explicit file scope.
export function parseDeclaredScope(specText) {
    if (!specText) return null;
    const ls = String(specText).split(/\r?\n/);
    const out = [];
    let collecting = false, foundHeader = false;
    for (const line of ls) {
        const hdr = line.match(/^(?:#{1,3}\s*)?(?:Scope|Files|Kapsam)\s*:\s*(.*)$/i);
        const mdHdr = !hdr && line.match(/^#{1,3}\s*(?:Scope|Files|Kapsam)\s*$/i);
        if (hdr || mdHdr) {
            foundHeader = true;
            collecting = true;
            const rest = hdr ? hdr[1].trim() : "";
            if (rest && !/^(?:none|yok|-|\(none\))$/i.test(rest)) {
                for (const part of rest.split(/[\s,]+/)) {
                    const c = cleanScopeToken(part);
                    if (c) out.push(c);
                }
            }
            continue;
        }
        if (collecting) {
            const bullet = line.match(/^\s*[-*]\s+(.+)$/);
            if (bullet) {
                const raw = bullet[1].trim().split(/\s+[—-]\s+|\s+\(/)[0];
                const c = cleanScopeToken(raw);
                if (c) out.push(c);
                continue;
            }
            if (!line.trim()) continue;
            collecting = false;
        }
    }
    if (!foundHeader || !out.length) return null;
    return [...new Set(out)];
}

function globToRegExp(pat) {
    let re = "^";
    for (let i = 0; i < pat.length; i++) {
        if (pat[i] === "*" && pat[i + 1] === "*") { re += ".*"; i++; if (pat[i + 1] === "/") i++; }
        else if (pat[i] === "*") re += "[^/]*";
        else if (pat[i] === "?") re += "[^/]";
        else re += pat[i].replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
    return new RegExp(re + "$");
}

export function matchesScope(filePath, scopeList, allowedExtras = []) {
    const f = slash(String(filePath || "")).replace(/^\.\//, "");
    if (allowedExtras.some((e) => slash(e).replace(/^\.\//, "") === f)) return true;
    for (const raw of scopeList) {
        const pat = slash(raw).replace(/^\.\//, "");
        if (!pat) continue;
        if (f === pat) return true;
        if (pat.endsWith("/") && f.startsWith(pat)) return true;
        if (!/[*?]/.test(pat) && !/\.[A-Za-z0-9]+$/.test(pat) && f.startsWith(pat + "/")) return true;
        if (/[*?]/.test(pat) && globToRegExp(pat).test(f)) return true;
    }
    return false;
}

function resolveSecretRegexes(override) {
    const src = override || configLib.SECRET_RES || FALLBACK_SECRET_RES;
    return (Array.isArray(src) ? src : [src]).map((item) => {
        if (item instanceof RegExp) return new RegExp(item.source, item.flags.includes("g") ? item.flags : item.flags + "g");
        if (item && item.re instanceof RegExp) return new RegExp(item.re.source, item.re.flags.includes("g") ? item.re.flags : item.re.flags + "g");
        return new RegExp(String(item), "g");
    });
}

// Scan only added ("+") lines in a unified diff for leaked secrets.
export function scanDiffSecrets(diffText, secretRes = null) {
    const regexes = resolveSecretRegexes(secretRes);
    const hits = [];
    let file = "", lineNum = 0;
    for (const line of String(diffText || "").split(/\r?\n/)) {
        if (line.startsWith("+++ b/")) { file = slash(line.slice(6).trim()); continue; }
        if (line.startsWith("+++ ")) { file = ""; continue; }
        const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
        if (hunk) { lineNum = Number(hunk[1]) - 1; continue; }
        if (line.startsWith("+") && !line.startsWith("+++")) {
            lineNum++;
            const body = line.slice(1);
            for (const re of regexes) {
                re.lastIndex = 0;
                const m = re.exec(body);
                if (m) {
                    const tok = m[0];
                    hits.push({ file, line: lineNum, preview: tok.slice(0, 6) + "..." });
                    break;
                }
            }
        } else if (!line.startsWith("-")) {
            lineNum++;
        }
    }
    return hits;
}

// Adversarial test-quality audit: deleted test files, emptied tests, trivial assertions, skipped tests, deleted assertions.
export function inspectTestQuality(diffText, deletedFiles = []) {
    const findings = [];
    for (const raw of deletedFiles) {
        const f = slash(raw).replace(/^\.\//, "");
        if (isTestFile(f)) {
            findings.push({
                category: "test_quality",
                severity: "critical",
                blocker: true,
                file: f,
                protects: "No deleting tests to pass",
                evidence: `${f}: test file deleted`,
                description: `Deleted test file: ${f}`
            });
        }
    }

    let file = "", lineNum = 0;
    const perFile = new Map();
    const ensureFile = (f) => {
        if (!perFile.has(f)) perFile.set(f, { added: 0, removed: 0, presenceOnly: 0, addedLines: [] });
        return perFile.get(f);
    };
    const deletedSet = new Set(deletedFiles.map((d) => slash(d).replace(/^\.\//, "")));

    for (const line of String(diffText || "").split(/\r?\n/)) {
        if (line.startsWith("+++ b/")) { file = slash(line.slice(6).trim()); continue; }
        if (line.startsWith("+++ ")) { file = ""; continue; }
        const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
        if (hunk) { lineNum = Number(hunk[1]) - 1; continue; }
        if (!file || deletedSet.has(file)) continue;

        if (line.startsWith("+") && !line.startsWith("+++")) {
            lineNum++;
            const body = line.slice(1);
            const rec = ensureFile(file);
            rec.addedLines.push({ line: lineNum, body });
            if (SKIP_TEST_RE.test(body)) {
                findings.push({
                    category: "test_quality",
                    severity: "major",
                    blocker: true,
                    file,
                    line: lineNum,
                    protects: "No skipping tests",
                    evidence: `${file}:${lineNum} — ${body.trim().slice(0, 120)}`,
                    description: `Skipped/ignored test added in ${file}:${lineNum}`
                });
            }
            if (EMPTY_TEST_LINE_RE.test(body)) {
                findings.push({
                    category: "test_quality",
                    severity: "major",
                    blocker: true,
                    file,
                    line: lineNum,
                    protects: "Tests must contain real assertions",
                    evidence: `${file}:${lineNum} — ${body.trim().slice(0, 120)}`,
                    description: `Empty test body added in ${file}:${lineNum}`
                });
            }
            if (TRIVIAL_ASSERT_RE.test(body)) {
                findings.push({
                    category: "test_quality",
                    severity: "major",
                    blocker: true,
                    file,
                    line: lineNum,
                    protects: "Tests verify behavior, not tautologies",
                    evidence: `${file}:${lineNum} — ${body.trim().slice(0, 120)}`,
                    description: `Trivial/tautological assertion added in ${file}:${lineNum}`
                });
            } else if (isTestFile(file) && ASSERTION_RE.test(body)) {
                if (PRESENCE_ONLY_RE.test(body)) rec.presenceOnly++;
                else rec.added++;
            }
        } else if (line.startsWith("-") && !line.startsWith("---")) {
            if (isTestFile(file) && ASSERTION_RE.test(line.slice(1))) ensureFile(file).removed++;
        } else if (!line.startsWith("\\")) {
            lineNum++;
        }
    }

    for (const [f, rec] of perFile.entries()) {
        // Multi-line empty test body: `test("x", () => {` followed immediately by `});`
        for (let i = 0; i + 1 < rec.addedLines.length; i++) {
            const cur = rec.addedLines[i], nxt = rec.addedLines[i + 1];
            if (/\b(?:test|it)\s*\([^,]+,\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{\s*$/.test(cur.body) && /^\s*\}\s*\)\s*;?\s*$/.test(nxt.body)) {
                findings.push({
                    category: "test_quality",
                    severity: "major",
                    blocker: true,
                    file: f,
                    line: cur.line,
                    protects: "Tests must contain real assertions",
                    evidence: `${f}:${cur.line} — empty test block`,
                    description: `Empty test block added in ${f}:${cur.line}`
                });
            }
        }
        if (rec.presenceOnly > 0 && rec.added === 0) {
            findings.push({
                category: "test_quality",
                severity: "major",
                blocker: true,
                file: f,
                protects: "Tests verify behavior, not presence",
                evidence: `${f}: only toBeDefined/toBeTruthy assertions added (${rec.presenceOnly})`,
                description: `Presence-only test assertions without behavioral verification in ${f}`
            });
        }
        if (rec.removed > 0 && rec.added < rec.removed) {
            findings.push({
                category: "test_quality",
                severity: "major",
                blocker: true,
                file: f,
                protects: "No deleting or weakening test assertions",
                evidence: `${f}: ${rec.removed} test/assertion lines removed, only ${rec.added} added`,
                description: `Net deletion of test assertions in ${f} (${rec.removed} removed vs ${rec.added} added)`
            });
        }
    }
    return findings;
}

function findCleanWorktreeForSha(root, targetSha) {
    const wtList = git(["worktree", "list", "--porcelain"], root);
    if (!wtList.ok) return null;
    let curPath = null, curHead = null;
    const entries = [];
    for (const l of wtList.out.split(/\r?\n/)) {
        if (l.startsWith("worktree ")) { if (curPath) entries.push({ path: curPath, head: curHead }); curPath = l.slice(9).trim(); curHead = null; }
        else if (l.startsWith("HEAD ")) curHead = l.slice(5).trim();
    }
    if (curPath) entries.push({ path: curPath, head: curHead });
    for (const e of entries) {
        if (e.head !== targetSha) continue;
        const st = git(["status", "--porcelain"], e.path);
        if (st.ok && !st.out) return e.path;
    }
    return null;
}

function prepareExecWorktree(root, branch, cfg, opts) {
    if (opts.cwd) return { cwd: opts.cwd, cleanup: null };
    const headSha = git(["rev-parse", "HEAD"], root);
    const branchSha = git(["rev-parse", branch], root);
    if (headSha.ok && branchSha.ok) {
        if (headSha.out === branchSha.out && !git(["status", "--porcelain"], root).out) return { cwd: root, cleanup: null };
        const existingWt = findCleanWorktreeForSha(root, branchSha.out);
        if (existingWt) return { cwd: existingWt, cleanup: null };
    }
    const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), "cv-verify-"));
    const tmpWt = path.join(tmpBase, "wt");
    const add = git(["worktree", "add", "--detach", tmpWt, branch], root);
    if (!add.ok) {
        try { fs.rmSync(tmpBase, { recursive: true, force: true }); } catch (_) { /* ignore */ }
        return { cwd: null, error: add.text, cleanup: null };
    }
    const linked = [];
    for (const dir of (cfg.delegate && cfg.delegate.linkDirs) || []) {
        const src = path.join(root, dir), dst = path.join(tmpWt, dir);
        if (exists(src) && !exists(dst)) {
            try { fs.symlinkSync(src, dst, "junction"); linked.push(dst); } catch (_) { /* optional */ }
        }
    }
    return {
        cwd: tmpWt,
        cleanup: () => {
            for (const dst of linked) { try { fs.unlinkSync(dst); } catch (_) { /* ignore */ } }
            git(["worktree", "remove", "--force", tmpWt], root);
            try { fs.rmSync(tmpBase, { recursive: true, force: true }); } catch (_) { /* ignore */ }
        }
    };
}

// Independently verify a task branch using the adversarial binary rubric (PASS | FAIL).
export async function verifyTask(root, taskId, opts = {}) {
    const cfg = opts.cfg || (exists(path.join(root, configLib.CONFIG_REL)) ? configLib.loadConfig(root) : { ...configLib.defaults(), root });
    const base = opts.base || cfg.baseBranch || "main";
    const branch = opts.branch || ((cfg.delegate && cfg.delegate.branchPrefix) || "cv/") + taskId;
    const tasksDir = (cfg.tasks && cfg.tasks.dir) || "docs/tasks";
    const findings = [];
    const checks = {
        diff: { ok: false, files: [] },
        forbiddenWrite: { ok: true, violations: [] },
        scope: { ok: true, declared: null, violations: [] },
        secrets: { ok: true, hits: [] },
        testQuality: { ok: true, issues: 0 },
        build: { ok: true, skipped: true, code: 0 },
        test: { ok: true, skipped: true, code: 0 },
        receipt: { present: false, fresh: false, treeSha: null }
    };

    const brOk = git(["rev-parse", "--verify", branch], root);
    if (!brOk.ok) {
        findings.push({
            category: "branch",
            severity: "critical",
            blocker: true,
            protects: "Task deliverable branch must exist",
            evidence: `${branch}: not found`,
            description: `Branch ${branch} does not exist`
        });
        return { ok: false, verdict: "FAIL", taskId, branch, base, treeSha: null, checks, findings };
    }
    const baseOk = git(["rev-parse", "--verify", base], root);
    if (!baseOk.ok) {
        findings.push({
            category: "base",
            severity: "critical",
            blocker: true,
            protects: "Base branch must exist",
            evidence: `${base}: not found`,
            description: `Base branch ${base} does not exist`
        });
        return { ok: false, verdict: "FAIL", taskId, branch, base, treeSha: null, checks, findings };
    }

    const treeRes = git(["rev-parse", `${branch}^{tree}`], root);
    const treeSha = treeRes.ok ? treeRes.out : null;
    const mb = git(["merge-base", base, branch], root);
    const diffRange = mb.ok && mb.out ? `${base}...${branch}` : `${base}..${branch}`;
    const nameDiff = git(["diff", "--name-only", diffRange], root);
    const changedFiles = (nameDiff.ok ? nameDiff.out : "").split(/\r?\n/).map((s) => slash(s.trim())).filter(Boolean);
    const delDiff = git(["diff", "--diff-filter=D", "--name-only", diffRange], root);
    const deletedFiles = (delDiff.ok ? delDiff.out : "").split(/\r?\n/).map((s) => slash(s.trim())).filter(Boolean);
    const fullDiff = git(["diff", "-U3", diffRange], root);
    const diffText = fullDiff.ok ? fullDiff.out : "";

    checks.diff.files = changedFiles;
    const substantiveFiles = changedFiles.filter((f) => !f.endsWith(".report.md"));
    checks.diff.ok = substantiveFiles.length > 0;
    if (!checks.diff.ok) {
        findings.push({
            category: "empty_diff",
            severity: "major",
            blocker: true,
            protects: "Task must produce non-empty changes",
            evidence: `${base}..${branch}: ${changedFiles.length} files changed (substantive: 0)`,
            description: `No substantive file changes between ${base} and ${branch}`
        });
    }

    // 1. Forbidden writes + sensitive file paths
    const isForb = configLib.isForbiddenWrite || configLib.isForbidden;
    for (const f of changedFiles) {
        let forbiddenHit = false;
        try { forbiddenHit = isForb(cfg, f) || isSensitivePath(f); } catch (_) { forbiddenHit = true; }
        if (forbiddenHit) {
            checks.forbiddenWrite.ok = false;
            checks.forbiddenWrite.violations.push(f);
            findings.push({
                category: "forbidden_write",
                severity: "critical",
                blocker: true,
                file: f,
                protects: "Forbidden write policy",
                evidence: `${f}: violates forbiddenWrite/sensitive path rule`,
                description: `Forbidden or sensitive file modified: ${f}`
            });
        }
    }

    // 2. Declared Scope: / Files: / Kapsam: boundaries
    const specFile = path.join(root, tasksDir, `${taskId}.md`);
    const specText = exists(specFile) ? readText(specFile, "") : "";
    const declaredScope = parseDeclaredScope(specText);
    checks.scope.declared = declaredScope;
    if (declaredScope) {
        const reportRel = slash(path.join(tasksDir, `${taskId}.report.md`));
        for (const f of changedFiles) {
            if (!matchesScope(f, declaredScope, [reportRel])) {
                checks.scope.ok = false;
                checks.scope.violations.push(f);
                findings.push({
                    category: "scope_violation",
                    severity: "major",
                    blocker: true,
                    file: f,
                    protects: "Declared task file scope",
                    evidence: `${f} is outside declared scope [${declaredScope.join(", ")}]`,
                    description: `File modified outside declared Scope/Files/Kapsam: ${f}`
                });
            }
        }
    }

    // 3. Secret scan on added diff lines
    const secretHits = scanDiffSecrets(diffText, opts.secretRes);
    checks.secrets.hits = secretHits;
    checks.secrets.ok = secretHits.length === 0;
    for (const h of secretHits) {
        findings.push({
            category: "secret_leak",
            severity: "critical",
            blocker: true,
            file: h.file,
            line: h.line,
            protects: "No secrets in code",
            evidence: `${h.file}:${h.line} — added secret-like token (${h.preview})`,
            description: `Potential secret leaked in ${h.file}:${h.line}`
        });
    }

    // 4. Adversarial test quality (deleted/empty/trivial assertions)
    const testIssues = inspectTestQuality(diffText, deletedFiles);
    checks.testQuality.issues = testIssues.length;
    checks.testQuality.ok = testIssues.length === 0;
    findings.push(...testIssues);

    // 5. Independent build & test execution (unless skipRun) + receipt freshness
    const receiptPath = path.join(root, ".evrim", "receipts", `${taskId}.json`);
    const prevReceipt = readJson(receiptPath, null);
    checks.receipt.present = !!prevReceipt;
    checks.receipt.fresh = !!(prevReceipt && treeSha && prevReceipt.treeSha === treeSha);
    checks.receipt.treeSha = prevReceipt ? prevReceipt.treeSha || null : null;

    let buildOk = cfg.build ? null : true;
    let testOk = cfg.test ? null : true;
    const runImpl = opts.run || defaultRun;

    if (opts.skipRun) {
        if (prevReceipt && treeSha && prevReceipt.treeSha && prevReceipt.treeSha !== treeSha) {
            findings.push({
                category: "stale_receipt",
                severity: "major",
                blocker: true,
                protects: "Evidence must match current branch treeSha",
                evidence: `receipt treeSha=${prevReceipt.treeSha}, branch treeSha=${treeSha}`,
                description: `Stale receipt for ${taskId}: branch tree changed since last verification`
            });
        } else if (prevReceipt && (prevReceipt.buildOk === false || prevReceipt.testOk === false)) {
            findings.push({
                category: "failed_receipt",
                severity: "major",
                blocker: true,
                protects: "Build and tests must pass",
                evidence: `receipt buildOk=${prevReceipt.buildOk}, testOk=${prevReceipt.testOk}`,
                description: `Existing receipt records failing build/test for ${taskId}`
            });
        } else if (opts.requireReceipt && !prevReceipt) {
            findings.push({
                category: "missing_receipt",
                severity: "major",
                blocker: true,
                protects: "Verification receipt required",
                evidence: `missing ${slash(path.relative(root, receiptPath))}`,
                description: `Missing verification receipt for ${taskId}`
            });
        }
        if (prevReceipt && checks.receipt.fresh) {
            if (typeof prevReceipt.buildOk === "boolean") buildOk = prevReceipt.buildOk;
            if (typeof prevReceipt.testOk === "boolean") testOk = prevReceipt.testOk;
        }
    } else if (cfg.build || cfg.test) {
        const wt = prepareExecWorktree(root, branch, cfg, opts);
        try {
            if (!wt.cwd) {
                buildOk = false; testOk = false;
                checks.build = { ok: false, skipped: false, code: 1 };
                checks.test = { ok: false, skipped: true, code: 1 };
                findings.push({
                    category: "worktree_error",
                    severity: "critical",
                    blocker: true,
                    protects: "Independent build/test verification",
                    evidence: wt.error || "could not check out branch for verification",
                    description: `Could not prepare verification worktree for ${branch}`
                });
            } else {
                if (cfg.build) {
                    const br = runImpl(cfg.build[0], cfg.build.slice(1), { cwd: wt.cwd, timeoutMs: (cfg.buildMinutes || 10) * 60000 });
                    buildOk = !!br.ok;
                    checks.build = { ok: buildOk, skipped: false, code: br.code };
                    if (!buildOk) {
                        findings.push({
                            category: "build_failed",
                            severity: "critical",
                            blocker: true,
                            protects: "Build must pass",
                            evidence: `build exit ${br.code}: ${String(br.text || "").trim().split(/\r?\n/).slice(-3).join(" | ")}`,
                            description: `Independent build failed (exit ${br.code})`
                        });
                    }
                }
                if (cfg.test) {
                    if (buildOk === false) {
                        testOk = false;
                        checks.test = { ok: false, skipped: true, code: 1 };
                    } else {
                        const tr = runImpl(cfg.test[0], cfg.test.slice(1), { cwd: wt.cwd, timeoutMs: (cfg.testMinutes || 15) * 60000 });
                        testOk = !!tr.ok;
                        checks.test = { ok: testOk, skipped: false, code: tr.code };
                        if (!testOk) {
                            findings.push({
                                category: "test_failed",
                                severity: "critical",
                                blocker: true,
                                protects: "Tests must pass",
                                evidence: `test exit ${tr.code}: ${String(tr.text || "").trim().split(/\r?\n/).slice(-3).join(" | ")}`,
                                description: `Independent test run failed (exit ${tr.code})`
                            });
                        }
                    }
                }
            }
        } finally {
            if (wt.cleanup) wt.cleanup();
        }
    }

    const hasBlocker = findings.some((f) => f.blocker === true || f.blocker === "yes");
    const verdict = hasBlocker ? "FAIL" : "PASS";
    const ok = verdict === "PASS";
    const timestamp = new Date().toISOString();

    writeJson(receiptPath, {
        taskId,
        branch,
        base,
        treeSha,
        buildOk,
        testOk,
        verdict,
        ok,
        skippedRun: !!opts.skipRun,
        findingsCount: findings.length,
        timestamp
    });
    checks.receipt = { present: true, fresh: true, treeSha };

    return { ok, verdict, taskId, branch, base, treeSha, checks, findings };
}
