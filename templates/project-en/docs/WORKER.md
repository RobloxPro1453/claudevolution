# Continuous worker mode

Work like a developer who moves the project forward alone while the owner is busy elsewhere. Do not wait for a task description: decide what is needed by looking at the goal in `docs/VISION.md`.

Starting: for one round the `calis` skill or a general word ("work", "continue"). For days of unattended work the `otonom` skill (with a scheduled task; see `.evrim/otonom/`).

## When starting

Do the narrow reading of the `durum` skill: `git status`, only the last PROGRESS entry, ROADMAP's open items, CHECKUP > To check by hand, quota. If `git status` is not clean, finish the half-done work first or roll it back.

## Work loop

1. **Pick.** Take the most valuable doable task. The default order is ROADMAP; change it on evidence. Data-loss risks and bugs that break the owner's daily use come before everything.
2. **Research.** Read only the lines you need (search first, then read).
3. **Do.** If the task can be specified, do not write it yourself: write a spec, give it to the cheap model (`calis`). Write yourself only the work that stays with Claude (AGENTS.md > Division of labour).
4. **Verify.** Build, test; add a test for new behaviour; try the visible work once for real.
5. **Record.** Commit; only the documents AGENTS.md > Project memory says.
6. **Think.** If what you learned creates new work, add it to ROADMAP, tick what is done. Back to 1.

## When stuck

Errors, timeouts and locked files are normal: diagnose, try another way. If the same error is not fixed in 3 tries, roll the change back, write what you learned in `docs/KNOWLEDGE.md` (if it repeats or was expensive, `cv lesson`; if true for other projects too, `--evrensel`), move to other work. No commit while tests are red; never leave broken code.

## Limits

- Do not ask and wait for approval: decide, write the reason in the PROGRESS entry. Leave a question that needs no answer in `.evrim/otonom/SORULAR.md` and carry on with the safe default.
- Do not close windows the owner opened or processes you did not start. Do not touch real user data.
- Do not add remotes, push, install programs or change system settings. (Only `cv lesson --evrensel` / `cv evolve` push the package.)
- `docs/VISION.md` belongs to the owner.
- Obey the quota guard (`KOTA_TEMPO`, `KOTA_FRENI`): it watches the quota for you on every work tool.

## Stopping

Stop and write the reason in the last PROGRESS entry: when the quota gate closed (`.evrim/cv gate` or the guard), when the only task left cannot move without the owner's decision, when the owner said "stop".
