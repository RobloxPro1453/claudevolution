---
name: cv-init
description: Completes the claudevolution setup by conversation - in a new project it starts with the owner's first message (even "hello"), learns the project through plain questions (what, for whom, what done means, who writes the code), weighs it as the lead architect, writes it into the documents and tells the owner how to start the loop. While .evrim/config.json > kurulum is "bekliyor", or when the owner says "set up claudevolution" or "let's fill in the vision".
---

# Discovery conversation and setup

The owner may not be technical. Speak their language in short sentences; avoid jargon or explain it in one sentence. You are the **lead architect**: you do not copy the owner's idea as is, you weigh it, make it realistic and order it. No digging (code) in this conversation; by its end everything is settled before the loop starts.

`cv` = `.evrim\cv.cmd` (Windows) or `.evrim/cv`; if `claudevrim` is installed, `claudevrim <command>` is the same. The full description of the package is `README.md` in the package folder (`.evrim/local.json` > `packageHome`).

## 0. Skeleton

If `.evrim/config.json` is missing, first `cv init --name <folder name> --lang en` (or `claudevrim init`). It never overwrites; if `AGENTS.md.new` or `CLAUDE.md.new` appeared, add the template's `## claudevolution` section to the existing `AGENTS.md` and make sure `CLAUDE.md` has an `@AGENTS.md` line. For a large project with its own layout: `cv adopt` (plan), `--apply` only when the owner says "apply".

## 1. Greet and read the project

Short greeting: say in one sentence what this is ("A system that will work for you was set up in this folder; first I need to understand your project"). If the folder has code, look yourself first (layout, README, package files), say what you understood in two sentences and ask only what you do not know. If the folder is empty, you learn everything from the owner.

## 2. Questions

Ask all of them at once as a numbered list; the owner answers in any order and length. Give an example answer for each so it is clear what you expect.

1. **What do you want to build?** One or two sentences; name a similar thing you know ("like X, but with this difference").
2. **Who will use it, where?** (Only you or others too; computer, phone, web?)
3. **Must-have features** and **not needed for now.**
4. **What does "done" mean?** On which day do you say "fine, this does the job"?
5. **What does "good" look like?** Look, speed, simplicity… something you take as a model.
6. **What must never break?** (E.g. "my notes must never be lost".)
7. **Who writes the code?** Explain plainly, with the cost:
   - "I (Claude, the strongest model) write all of it: the safest way, but your Claude usage limit fills faster." → `kendisi`
   - "A cheap AI (DeepSeek) writes, I plan and review: your limit lasts long, you pay a small fee; you need a DeepSeek key on your computer (I explain step by step)." Without the key: "wait" → `yalniz-api`, "you write" → `api-yoksa-kendisi`.
   - "If the cheap model is missing, a smaller Claude model writes." → `api-yoksa-subagent` (`subagentModel`).
8. **Should it work while you are away?** (At night, at school. If yes, I explain the computer settings later.)
9. Any technical preference (language, framework, platform)? Otherwise "you choose" is enough.

## 3. Understand; if not, ask again

Summarise the answers in your own words. Where something is vague, contradictory or unrealistic, do not guess: ask that point again with options ("By sync, do you mean a) between your own computers, b) through a server on the internet?"). Several rounds if needed. Say kindly what is unrealistic and propose a smaller first goal.

## 4. Weigh as the architect and write

Turn the answers into a technical plan: architecture, technology choice (yours, with reasons, if the owner left it), scope of the first version, ordered work list, how it is verified (build and test commands). **You decide what goes where**; you see this project's documents and template. At the end of the conversation these must be written and findable by the next session:

- Goal, user, finish line, quality measure, invariants (in the owner's words; usually `docs.vision`).
- Ordered, concrete first work list (usually `docs.roadmap`; the loop picks work from it).
- Architecture sketch and technology decisions with reasons (in the document you see fit).
- Checkable invariants: `AGENTS.md` > hard rules; the English version for the cheap model in `docs/tasks/README.md` > Project rules.
- `.evrim/config.json`: `delegate.policy` (question 7), `build`/`test` (in an empty project setting them up is the first job, then the first ROADMAP item), `codePaths`, `forbiddenWrite` (forbid when unsure), `baseBranch`.
- The first sentence of `AGENTS.md` (what the project is), the critical areas in "division of work", and the "where to look" table: every document you created or used must be listed there.

Summarise the plan to the owner briefly and plainly ("We will build this, in this order, the first visible result is this") and get their approval. Change it if they ask.

## 5. Preparing unattended work

If question 8 was "yes", run `cv doctor`; for each ✗ say step by step and plainly what to do (which settings window, which option). Do not change settings yourself. If a key is needed, explain how to add it; the owner must not paste it into the chat.

## 6. Finish and hand over

1. `.evrim/config.json` > `kurulum`: `"tamam"`.
2. Commit (`claudevolution kuruldu: <project>`), one entry in `docs.progress`.
3. Tell the owner exactly this (in their language):
   > Everything is ready. This conversation was long; to start clean, **open a new session**, first write **"hello"**, then only **`/loop başla`**. I will start working in the order we planned. You can see what I did in `.evrim/otonom/OZET.md` or by asking me "what did you do"; to stop, write "stop".
