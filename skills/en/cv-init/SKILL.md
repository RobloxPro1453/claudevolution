---
name: cv-init
description: Completes the claudevolution setup through an outcome-oriented chief architect conversation - silently scans existing code on the owner's first message (even "hello") while kurulum is "bekliyor", weighs plan/quota and distribution intent, convenes the council when needed, locks the finalForm contract, and guides loop startup.
---

# Discovery conversation and chief architect setup

The owner may not be technical. Speak their language warmly in short, plain sentences; avoid uninvited technical jargon, and when a concept matters (e.g., *clean-room* = recreating behaviour from scratch without copying source; *custom design* = tailored architecture from first principles), explain it in **one simple sentence**. You are the **lead architect**: not a passive note-taker, but an experienced team lead who reasons about the outcome. How long the conversation is depends on the request: for a concrete job it is a sentence or two and the work starts at once (§0b).

`cv` = `.evrim\cv.cmd` (Windows) or `.evrim/cv`; if `claudevrim` is installed, `claudevrim <command>` is identical. Full package details live in `README.md` in the package folder (`.evrim/local.json` > `packageHome`).

## 0. Skeleton

If `.evrim/config.json` is missing, first run `cv init --name <folder name> --lang en` (or `claudevrim init`). It never overwrites existing files; if `AGENTS.md.new` or `CLAUDE.md.new` appeared, add the template's `## claudevolution` section to `AGENTS.md` and ensure `CLAUDE.md` has `@AGENTS.md`. For a project with its own established layout, show `cv adopt` first; pass `--apply` only once the owner confirms.

## 0b. Read the request first (every message, even while setup is waiting)

`kurulum: "bekliyor"` does not mean "talk first"; it means "the setup documents are missing, complete them while working". Classify the owner's message and **say in one line which one you picked** in your first sentence ("Concrete job: building it now." and the like):

| Request | Sign | What you do |
|---|---|---|
| **Concrete job** | What to make is clear ("make an X app", "fix this bug", a stack or language named) | **Do it now.** At most one round of questions (only where a wrong guess is expensive, with options). The first delivery is a **working vertical slice**: it really opens, reads, writes and saves files; no mock-up. Derive `finalForm` from the request yourself; the documents are filled with a few lines as the work ends. |
| **Vague idea** | "I want to make something but..." | Short discovery (§1-2). A mock-up only here, and only when the owner will choose between looks (§2b). |
| **Existing code** | Product code in the folder | §1 quiet scan + two-sentence summary + question. |
| **Greeting / status** | "hello", "where are we" | §1 short greeting. |

When unsure, look at the verb in the owner's sentence: "make", "fix", "add" ask for work. A default, not a law: the owner's word always comes first. The invariants (no data loss, no secrets written, the quota guard, `forbiddenWrite`) bend in no class.

## 0c. Commands: what each gives (do not read the package code)

This table is enough; do not read the package's JS files or templates to understand `cv` commands (in the benchmark that cost 10 minutes and ~30k tokens).

| Command | What it gives |
|---|---|
| `cv intent "<request>"` | The intent card: kind, unsaid expectations `[E:id]`, stack suggestion, the questions worth asking. `--apply` → fills `docs/INTENT.md`, `finalForm.criteria`, `check.selfTest.steps`. |
| `cv stack new <stack> --name "<name>"` | A skeleton that builds (engine / storage / thin UI, `--screenshot` and `--self-test` ready). |
| `cv check --self` | Builds, checks the layer boundary and the window, pictures under `.evrim/state/checks/round-0/`; prints the result as plain text. |
| `cv intent coverage --delivered` | For every `finalForm` item: ✓ tried / ✗ failed / ~ not tried (from the last `cv check` round). |
| `cv intent coverage` | Did every `[E:id]` reach the roadmap ("KAPSAM TAMAM"). |
| `cv council --topic "<topic>"` | Views from several angles on a hard choice (costs quota; only when really needed). |
| `cv doctor` | Prerequisites for unattended work; every `✗` is a to-do. |

## 1. "hello" — Silent scan and warm greeting

- **If existing code is present** (`.evrim/config.json` > `projectMode` is `"adopted"` or product code, manifests, or README already exist): silently scan the codebase first (directory layout, README, build/test manifests) before asking questions. Then greet the owner warmly, summarise what you understood in **two plain sentences**, and ask what goal they want to achieve. Never ask the owner for facts you can already read from the repository.
- **If the folder is empty (`greenfield`):** greet briefly and warmly ("I set up this workspace to plan and build your project."), and ask what they want to create and what they want to hold in their hands when it is finished.

## 2. Reason, don't just obey

Treat the owner's words as a desired **outcome**, not a rigid low-level spec, and weigh the situation like an experienced team lead:

- **Plan, quota, and tool balance:** Weigh the owner's plan/quota constraints (`Pro`, `Max`, available API keys, or secondary CLIs like `codex`/`agy`/`gemini`) against task difficulty.
- **Autonomous Council decision:** When hard architectural trade-offs, risks, or multi-perspective design choices matter and budget fits, invoke `cv council --topic "<topic>"`; for simple or narrow scopes, save tokens and reason solo. Never spam heavy Opus subagents on a constrained `Pro` plan when `Haiku`/`Sonnet`, a secondary CLI, or cheap API fits better.
- **Tailored, natural questions:** Do NOT dump a rigid 9-item questionnaire. Ask only what actually matters for *this* project in natural flow (users and environment, must-haves vs later, what "good" looks like, what must never break, technical preferences — if they say "you choose", decide with clear reasoning). When something is vague or unrealistic, never guess: clarify with concrete options and propose a smaller first milestone if needed.
- **Use & distribution intent (`licensePolicy`):** Clarify whether this is for **personal use (`personal`)** or **distribution / commercial / open-source (`commercial` or `open-source`)**, and record it in `.evrim/config.json` > `licensePolicy`. Personal use permits broader *clean-room* reference study; commercial or open-source distribution restricts external GitHub/OSS scouting strictly to permissive licenses (`MIT`, `Apache-2.0`, `BSD`, `ISC`).
- **Who writes the code (`delegate.policy`):** Explain the choices plainly with cost and speed impact:
  - `kendisi`: Main model writes everything (critical work; consumes session quota faster; if they want "Opus only", remind them to open sessions on Opus and note it in VISION).
  - `yalniz-api` / `api-yoksa-kendisi`: Cheap API model (`deepseek`, etc.) writes while the main model plans and verifies (if no key is in the environment, either wait or fall back to the main model).
  - `api-yoksa-subagent`: If no cheap API is available, a smaller subagent (`delegate.subagentModel`) or available secondary CLI writes code.
- **Unattended work:** If it will run while they are away, explain in one sentence that the loop watches quota automatically, and run `cv doctor`; for each `✗`, give plain step-by-step instructions (never edit system settings yourself; never let them paste API keys into chat).

## 2b. When a desktop program is wanted: subtext, first slice, done contract

The owner says the idea briefly; the purpose, feeling and expectations left unsaid are where revisions come from. Work them out yourself before asking:

1. **Intent card:** `cv intent "<the owner's sentence>"` → kind, unsaid expectations (`[E:...]`), stack suggestion, the few questions worth asking. Fill the card's «...» lines (who, when, why, the wanted feeling, what "perfect" means, what would annoy them, which side of "like X" is meant) **yourself** from the conversation; `--apply` writes `docs/INTENT.md` and fills `check.selfTest.steps` and `finalForm.criteria`.
2. **Few, smart questions:** only where the choice is the owner's and a wrong guess is expensive; with options, in batches of 1-3, at most 7 in all. Already said in the request? Don't ask (the card says "said in the request"). The owner's word beats every default.
3. **First slice:** on the `cv stack new <stack> --name "<name>"` skeleton build the real work at once (for a concrete job); take its picture with `cv check --self` and score it item by item against the `desktop-design` checklist. A **mock-up** (empty screens filled with made-up data) only when the request is vague and the owner will choose a look; a mock-up is never offered as a delivery.
4. **"What I understood":** show the card's 5-8 line summary, the picture and the `cv intent coverage --delivered` table (✓ tried / ✗ failed / ~ not tried) **together**; the owner corrects once. Never hide a missing item.
5. **Done contract:** `finalForm` = one `.exe` (`deliverable`), `cv check` passes (the window draws, every `--self-test` step passes), the card's acceptance lines. No endless additions: a new wish goes to the next version. Reviews stop a delivery only for a real usage bug; taste and small polish notes do not (metaswarm delivery-scope principle).
6. **Coverage:** write the roadmap, tag each item with the `[E:...]` ids it covers; do not present the plan before `cv intent coverage` says "KAPSAM TAMAM".

## 3. Defaults and when to deviate — you define the framework

Every step in this document is a **default**: read it as "in this situation, do this"; when the situation does not fit, deviate and say why in one line. Examples, directory layouts and patterns are not walls. As Chief Architect, **you define the best engineering framework**, verification method, and workflow for this project. If the project needs a custom validation script, domain-specific review gate, or custom operating discipline, establish it upfront and record persistent project decrees in `.evrim/otonom/KARARNAMELER.md`.

## 4. Final Form Contract (`finalForm`) and handover

Before ending discovery, lock the **Final Form Contract** so the autonomous loop knows the exact finish line and does not polish forever:

1. Write `finalForm` into `.evrim/config.json`: `deliverable` (the exact output/executable/app path the owner can open and use), `verifyCmd` (command or script proving readiness), and `criteria` (observable acceptance checks).
2. Update project docs: `docs.vision` (goal, quality bar, invariants), `docs.roadmap` (concrete, ordered work items), `AGENTS.md` (first sentence, division of work, new docs listed, hard rules; English agent rules in `docs/tasks/README.md`), `.evrim/config.json` (`delegate.policy`, `licensePolicy`, `build`/`test`, `codePaths`, `forbiddenWrite`, `baseBranch`).
3. Summarise the plan to the owner in a few plain sentences and confirm approval. For a concrete job no separate approval is awaited: the coverage table is shown with the first delivery.
4. Set `.evrim/config.json` > `kurulum`: `"tamam"`, add one entry to `docs.progress`, and commit (`claudevolution kuruldu: <project>`).
5. **Detect the runtime platform from your `<identity>` and available tools**; never confuse the owner with another tool's command — tell them only the real startup trigger for their current environment:
   - **Inside Antigravity** (when your identity is Antigravity, or `schedule` / `/goal` / `/schedule` exist): Antigravity has **no** `/loop` command! Tell the owner:
     > Everything is ready. To start clean, open a new session and simply write **"başla"** (or **"start"**), use **`/goal`** (e.g., `/goal başla`) for continuous execution until the final goal is achieved, or **`/schedule`** for a recurring cycle. I will build in the order we planned and notify you once finished. You can watch progress in `.evrim/otonom/OZET.md` and write "stop" anytime to pause.
   - **Inside Claude Code** (when `/loop` and `ScheduleWakeup` exist): Tell the owner:
     > Everything is ready. For the remaining work write **`/loop başla`** (if the discovery talk ran very long, opening a new session first is cleaner). I will build in the order we planned and notify you once finished. You can watch progress in `.evrim/otonom/OZET.md` and write "stop" anytime to pause.
   - **Inside Codex:** Tell the owner to open a new session and write **"başla"** or **"çalış"** directly.
