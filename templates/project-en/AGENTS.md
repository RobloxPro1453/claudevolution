# Guide for AI agents

{{project}}: <one sentence: what this project is, who it is for>. Read [docs/VISION.md](docs/VISION.md) before you start. The owner may not be technical: explain plainly.

## First thing in a session

- If `.evrim/config.json` > `kurulum` is `"bekliyor"`, apply the `cv-init` skill; read the request first (§0b): **a concrete job is done at once** (a working first slice, no mock-up); for a vague idea or a greeting: quiet scan, lead-architect conversation, the `finalForm` contract, and at the end the real way to start on your own platform (**Antigravity**: `"başla"`, `/goal` or `/schedule` — there is no `/loop`; **Claude Code**: `/loop başla`; **Codex**: `"başla"`).
- Once set up: answer a greeting with the `durum` skill (short status and the right way to start unattended work on this platform). `"başla"`, `"otonom başla"`, `/goal` / `/schedule` / `.agent/workflows/loop.md` in Antigravity, or `/loop başla` in Claude Code = one cycle of the `otonom` skill; when `finalForm` is complete, `KARAR: BITTI` stops the loop.

## claudevolution

This project runs on **claudevolution** (works with `Claude`, `Codex`, `Antigravity`). The whole system is in the package README: the package location is `.evrim/local.json` > `packageHome` (`<packageHome>/README.md`). In short:

- `cv` = `.evrim\cv.cmd` (Windows) or `.evrim/cv`. Settings: `.evrim/config.json` (`licensePolicy`, `finalForm`, `delegate`, `autonomy`); unattended memory: `.evrim/otonom/` (including `KARARNAMELER.md`).
- Skills (`.claude/skills/`, `.codex/skills/`, `.agent/skills/`): `durum` ("where are we"), `calis` ("work": one round), `otonom` (one unattended cycle; `TEMPO`, `OFIS_MUHAKEMESI`, `KARAR: BITTI`), `damit` ("distill"), `cv-init` (setup, VISION). For hard decisions and cost trade-offs, `cv council` can be used.
- **Quota guard (always on):** in Claude Code the `cv guard` hook checks the quota around every work tool. Obey `KOTA_TEMPO` / `KOTA_FRENI` notes; when it blocks new work, commit and sleep.
- **Lesson rule, in every session (outside the loop too):** the moment you learn something that repeats or proved expensive, write one line. Only true for this project: `cv lesson "<lesson>"` (`.evrim/otonom/DERSLER.md`); a lasting method/architecture rule of this project: `.evrim/otonom/KARARNAMELER.md`. Still true without the project name: `cv lesson "<generalised lesson>" --evrensel` — it reaches every project at once (on a developer machine into the package: measured, pushed to GitHub; on other machines into this machine's universal layer, `~/.claudevrim/evrensel/`); do not wait for distillation. Universal lessons this project sees (package + this machine, merged): `.evrim/evrensel.md`. A serious error pattern: `--hata`.
- **Push:** none in this project's repository (unless the owner asks). Only `cv lesson --evrensel` and `cv evolve` push the package. If the package has a new version: `claudevrim guncelle` (or `cv update --apply`).

## Where to look

| Question | Document |
|---|---|
| What is wanted, which decisions were made? | `docs/VISION.md` |
| How does the system work? | `docs/ARCHITECTURE.md` |
| Build, test, adding a feature? | `docs/DEVELOPMENT.md` |
| Knowledge learned by trying, pitfalls? | `docs/KNOWLEDGE.md` |
| What was done last? | `docs/PROGRESS.md` (top entry only) |
| What is next? | `docs/ROADMAP.md` (open items only) |
| Known bugs, things to try by hand? | `docs/CHECKUP.md` |
| Working on your own continuously? | `docs/WORKER.md`; unattended loop: the `otonom` skill |
| How do I hand code work to the cheap model? | the `calis` skill; agent rules and specs in `docs/tasks/` |
| The unattended loop's memory, decrees, the owner's notes? | `.evrim/otonom/` (DERSLER, GUNLUK, HATALAR, KARARNAMELER, OZET, SORULAR, NOTLAR) |

Do not read documents end to end: follow the "only" notes in the table, `grep` for the rest.

## Hard rules

1. Data loss is the worst kind of bug: save, delete and move flows are not changed without tests.
2. The cheap model cannot write the paths in `.evrim/config.json` > `forbiddenWrite`; only the owner narrows this list.
3. Keys, passwords and personal details never go into a file, a log or a commit; keys are read from environment variables only.
4. <project rule>
5. <project rule>

## After every change

```
{{build}}
```

```
{{test}}
```

- Add a test for new behaviour; a check that is always true is not a test.
- A passing test does not prove real use: try the flow the owner will see once, for real.
- Take every number you report (test count, lines, cost) from a command's output; never from memory.

## Division of labour

Claude thinks, plans, reviews and documents; the coding labour goes to the cheap model (`calis` skill: 8-30 short specs per round, parallel lanes, review, merge). **Stays with Claude:** flows with data-loss risk, work whose shape is not yet clear, small fixes whose spec would be longer than the code, <project-specific critical areas>. If you are the cheap model, your rules are `docs/tasks/README.md`.

## Moving the project forward

The owner does not want to describe every step; the goal is in `docs/VISION.md`, you decide.

- If you were given a specific task, do that first. On a general word ("work", "continue") follow `docs/WORKER.md`.
- Work is committed to the `{{baseBranch}}` branch. No remote is added, nothing is pushed (unless the owner asks).
- Fix small bugs you pass by; if big, write it in `docs/CHECKUP.md` and continue your task.
- The roadmap order may change on evidence; write why.

## Project memory

Goal: every agent continues where the previous one stopped. Not every change goes into every document.

| Event | Where to write |
|---|---|
| Small fix (typo, colour, one line) | Commit message only |
| A feature or bug fix the user will notice | `CHANGELOG.md`; tick the roadmap item if done |
| Meaningful work finished in a session | One entry at the top of `docs/PROGRESS.md` (≤5 lines) |
| A pitfall the code does not show, a path tried and dropped | `docs/KNOWLEDGE.md` |
| A bug reported but not fixed, or something to try by hand | `docs/CHECKUP.md` |
| Architecture, folders or flow changed | `docs/ARCHITECTURE.md` or `docs/DEVELOPMENT.md` |
| The goal or an owner decision changed | `docs/VISION.md` (only on the owner's word) |
| Something that repeats or proved expensive | `cv lesson "<lesson>"` (local) or `cv lesson "<generalised lesson>" --evrensel` (package); see § claudevolution |

**Document diet:** in a round only CHANGELOG lines, ROADMAP ticks and one short PROGRESS entry are written. KNOWLEDGE and CHECKUP only for really new findings, a few lines. No new plan or report document is opened. Fix old or wrong information the moment you see it; never write the unverified as verified.
