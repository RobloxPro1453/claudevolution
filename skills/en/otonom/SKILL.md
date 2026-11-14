---
name: otonom
description: Advances the project unattended while the owner is away - runs one cycle (lock, quota gate, office reasoning, memory, one work step, completion gate, record) and exits. Called from a scheduled task ("load the otonom skill and run one cycle") or from /loop ("/loop başla": "başla" means one cycle); also answers when the owner asks "what did you do" or "stop".
---

# Autonomous cycle

The owner is not here; **you stand in for them.** Do not ask questions, do not wait for approval, do not get stuck. Put no question or button in the closing box (wrap_up) either, only a recap: a button pressed while the owner sleeps sends an expensive second message to an old session. For every decision: "Would the owner approve this if they looked at the screen right now?" If unsure, pick the smaller, reversible option and leave the question in `SORULAR.md`.

`cv` = `.evrim\cv.cmd` (Windows) or `.evrim/cv`. Thresholds, document names, `finalForm` and `licensePolicy` live in `.evrim/config.json`; numbers in this text are defaults, config wins. Memory folder: `.evrim/otonom/`. `cv` prints in Turkish; the `KARAR` (decision) codes below are stable.

**One call = one cycle.** The scheduled task opens a clean session every time; exit when the cycle is done. State lives only in files, `KARARNAMELER.md`, and commits.

## 1. Open (one message)

1. Inside `/loop`, first the safety wake: `ScheduleWakeup(1800, prompt = the same loop text, reason "safety")`. Not needed in a scheduled task (the next trigger is the safety net). In the first cycle of a `/loop`, turn Remote Control on so the owner can watch from the phone (`set_remote_control`, `session_id: "self"`, `enabled: true`; load it with ToolSearch if deferred); if refused or "unavailable", move on and write one OZET line.
2. `mcp__ccd_session_mgmt__get_usage` (if missing: `ToolSearch select:mcp__ccd_session_mgmt__get_usage`).
3. `cv cycle begin --five <5h %> --week <weekly %> --five-resets <resetsAt> --week-resets <resetsAt>`

If `get_usage` is missing or cannot be read, pass `--five unknown --week unknown`: `cv cycle begin` falls back to local 5h session blocks (`local-blocks`); if no local block exists either, the command allows one small step and holds after three unreadable cycles in a row.

Follow the `KARAR` line of the output:

| KARAR | What you do |
|---|---|
| `GO` | Run the cycle (§2). |
| `KUCUK` / `KISITLI` | Start no large/parallel step; only finish a small half-done job or one narrow step (commit, build), then §4. |
| `CIK` | Do no work. `cv cycle sleep --reason "<reason from the output>"`, then §5. |
| `MESGUL` | Another session is working. Exit without touching any file. |
| `DUR` | The owner wrote DUR in `NOTLAR.md`. Exit doing nothing; inside `/loop` also `ScheduleWakeup stop: true`. |
| `SIRA_DEGIL` | The quota belongs to another project on this machine right now. Exit. |
| `BITTI` | `finalForm` and roadmap are complete. Verify the deliverable file/command, write the **exact executable/output path** (`DELIVERABLE`) in `OZET.md` so the owner can open and use it right away, stop `/loop` with `ScheduleWakeup stop: true`, and exit cleanly. |

The output also gives you: `TEMPO` (`HIZLAN` / `YAVAS` / `NORMAL`), `KARARNAME`, `OFIS_MUHAKEMESI`, `ACIK_CERCEVE`, DERSLER, GUNLUK tail, the owner's **unread notes**, answered questions, `KURTARMA`, `DAMITMA`, and the cycle id. Check `.evrim/otonom/KARARNAMELER.md` for persistent project decrees.

## 2. Cycle, Software Office & Open-Ended Self-Governance (KARAR = GO)

Order:
1. **Recovery findings first** (§6). No work on top of a broken build or a half merge.
2. **The owner's notes.** A note starting with `ÖNCE:` goes before the next job. If an objection came ("don't like it", "don't do that"), fix or revert that first. After handling each note, prefix it in `NOTLAR.md` with `[okundu <date>]`. Apply answered questions and move them to "Kapananlar" in `SORULAR.md`.
3. **If `DAMITMA: evet`**, this cycle's job is distillation: load the `damit` skill and do only that.
4. **Tempo, Office Reasoning & Initiative:**
   - **`TEMPO` (`HIZLAN` / `YAVAS` / `NORMAL`):** Evaluate **work achieved vs quota used**, not raw `%` alone. When a window is ending with large unused quota and light work (`HIZLAN`), raise batch weight and parallel lane count (`delegate.lanes`). On `YAVAS`, stick to lean, high-leverage steps.
   - **Strategy pivot (`OFIS_MUHAKEMESI`):** If Approach X stalls across turns or burns quota without progress, stop forcing it — pivot decisively to Approach Y (invoke `cv council --topic "<topic>"` for multi-angle reasoning if warranted) and record why in `.evrim/otonom/KARARNAMELER.md` or via `cv lesson`.
   - **Open-ended self-improvement (`ACIK_CERCEVE`):** Never follow old habits blindly when a better architecture, custom validation/test script, or workflow rule is needed: take initiative, author new project decrees in `.evrim/otonom/KARARNAMELER.md`, or generalize cross-project insights with `cv lesson "<generalised lesson>" --evrensel`.
5. **One work step:** one step of the loop in `docs.worker` (open items of `docs.roadmap` and `docs.checkup`; honor `licensePolicy` when scouting references). If the code job can be specified, give it to the cheap model (`calis` steps 3-8; lanes are detached processes and keep running after this cycle; the next cycle collects them). If there is no key (`cv delegate which` names a fallback), follow the fallback path of `calis` step 5; do not stop. Write critical parts yourself (AGENTS.md > division of work).

Inside the cycle, **every 5-6 tool calls and after every commit**: `get_usage` + `cv gate --five .. --week ..` (if `get_usage` is missing, `cv gate --auto` falls back to local 5h session blocks). On `KUCUK`/`CIK`, commit what you have (`WIP:` is fine, in a building state) and go to §4. A cycle should not eat more than 8% of the 5-hour window; if it does, make the next cycle smaller.

After context compaction, run `cv cycle prime` (with `--task <id>` if needed) to refresh the current phase, blockers, and task-relevant lessons.

## 3. Damage watch

You, not the owner, must notice wasted money and quota:

- **Cheap model:** if a task you started makes no commit within 15 min, repeats the same step, or spends 60% of its budget without passing tests → `cv delegate stop <lane>` (the half-done work stays on its branch), shrink the task or do it yourself. After two failed tasks in a row, start no more this cycle.
- **Your own error:** if the same error survives 3 attempts, revert the change (`git checkout -- <file>` / `git revert`), write it in `docs.checkup`, move on. No commit in a broken state.
- **Cycle without progress:** `cv cycle begin` reports commit-less cycles in a row. At 2, change approach (shrink the job, pivot strategy, or take the next); at 3, write "stuck: …" in OZET and close this cycle as sleep.
- **Time box:** at most 4 cycles per roadmap item. Then commit what was reached, write what is missing in OZET and `docs.checkup`, move on. If the measure does not hold, write "could not measure"; do not polish forever.
- **Expensive step:** if one step ate more than 15% of the window, stop, find why (reading a big file whole, reading images, long output) and write it in DERSLER.
- **Long commands:** each gets a time limit; run tests in the background and wait for the finish, do not poll. Do not start a build while tests run.

## 4. Close

1. Working tree clean or committed as `WIP:`; the build passes (if not, revert the last commit).
2. **Lesson & decree:** if something repeated or was expensive this cycle, one line: project-specific, `cv lesson "<lesson>"`. If it would hold in another project as well (still true without the project name), **right away** `cv lesson "<generalised lesson>" --evrensel`: it enters the package now, is measured, committed and pushed to GitHub; do not wait for distillation. For a serious error the same command with `--hata` (`grep` `HATALAR.md` for a similar one first). If the command says it did not reach the package, the lesson stays `[evrensel]` locally and distillation looks again. Record lasting project-level workflow or architecture improvements in `.evrim/otonom/KARARNAMELER.md`.
3. Update **OZET.md**: plain language, no jargon, in the owner's language; sections "Şu an" (now), "Bitenler" (done, with where to look), "Karar verdiklerim" (decisions), "Takıldıklarım" (stuck), "Harcama" (spending), "Senin bakman gerekenler" (for you to check).
4. `get_usage`, then: `cv cycle end --id <id> --did "<what I did>" --cost "<quota %, $>" --worth evet|hayir --five .. --week .. --next "<next>"`. It writes GUNLUK, updates the counters, releases the lock and prints `UYKU` and `SONRAKI_KAPI`. Every number you report comes from a command output.
5. Commit the memory files (`otonom: çevrim <date>`).
6. **If `SONRAKI_KAPI` returns `BITTI`:** verify the deliverable path and check command, write the exact executable/output path the owner can open right away in `OZET.md`, and stop `/loop` with `ScheduleWakeup stop: true`.

## 5. Exit or sleep

- **Scheduled task:** write a one-sentence last word and stop. No rescheduling.
- **Session getting long?** Past the 8th cycle in the same `/loop` session, or when the context has grown large (every call gets expensive), do not break the loop, but write in OZET's "for you to check" part and in your last word, in the owner's language: "This session got long; when convenient, open a new session, write 'merhaba', then write `/loop başla`. I continue where I left off." Not every cycle; at most once every 4 cycles.
- **`/loop`:** unless `BITTI` or `DUR`, call `ScheduleWakeup(<UYKU>, prompt = the same text, reason "<one sentence>")`. Work going on: 60-120 s; waiting for background tests/lanes: 1200 s; gate closed: the command's value (in chunks of at most 3600). Do no work in sleep cycles.

## 6. Recovery (sticking points)

`cv recover` lists findings; `cv recover --fix` does the safe ones (removes a stale lock, abandons a half merge with `git merge --abort`, clears dead lane records).

- **Hung process:** stop only processes you started (in the lane records). Never touch a window the owner opened.
- **Broken build:** revert the last commit; the project must open at the end of every cycle.
- **Git mess:** if conflict-marked files or a half merge cannot be cleaned, drop that job, write it in OZET, take another item.
- **Permission denied:** do not repeat the same call; do it another way or skip the item, note it in GUNLUK.

## 7. Never

- Change system settings, install/uninstall programs, download files from the internet, delete files outside the project and your own working copies.
- Push the project, touch a remote, merge a branch waiting for the owner's approval. (Only exception is the package: `cv lesson --evrensel` does its own measured push; never push by hand.)
- Loosen `.evrim/config.json` > `forbiddenWrite` or the quota thresholds.
- Write the key anywhere. Touch another project's files.

## 8. If the owner writes in the session

- **"what did you do":** give the gist of `OZET.md` (plainly) and answer the question. Inside `/loop` and not finished yet, afterwards **always** set the loop up again with `ScheduleWakeup`.
- **"stop":** commit, OZET, `cv lock release`; inside `/loop` also `ScheduleWakeup stop: true`. For a scheduled task tell the owner: "write a single line DUR in `NOTLAR.md`, or turn the scheduled task off."
- **Is it running?** `cv lock status` and `cv status` answer clearly: running / sleeping (until when) / stopped.
