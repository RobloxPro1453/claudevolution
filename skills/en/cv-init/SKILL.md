---
name: cv-init
description: Sets up claudevolution in a project through conversation, or finishes the setup - installs the skeleton, confirms the configuration with the owner, fills VISION in the owner's words, explains the prerequisites for unattended work in plain language. When the owner says "set up claudevolution", "set up the project", "let's fill in the vision".
---

# Setup by conversation

The owner may not be technical. Short sentences, one question at a time, with options. Write their answer in their own words; never invent.

`cv` = `.evrim\cv.cmd` (Windows) or `.evrim/cv`. If the skeleton is not there yet, run the package's `bin/cv` (the owner tells you the path, or it is in the `CV_HOME` environment variable).

## 1. Skeleton

If `.evrim/config.json` is missing: `cv init --name <name> --lang en` (never overwrites an existing file; leaves a `.new` beside a differing one). Tell the owner about the `.new` files in the output: "You already had these files, I did not touch them; the new versions sit next to them." If `AGENTS.md.new` or `CLAUDE.md.new` appeared, at least add the template's `## claudevolution` section to the existing `AGENTS.md` and make sure `CLAUDE.md` has an `@AGENTS.md` line: a session outside the loop learns the lesson rule (`cv lesson`) only from there. `cv doctor` reports it if missing.

For an existing project with its own setup, run `cv adopt` and summarise the mapping plan for the owner; `--apply` only when the owner says "apply".

## 2. Confirm the configuration

Show what was detected in `.evrim/config.json` and ask only about what you are unsure of:
- Are the build and test commands right? (Run each once; if it fails, fix it together.)
- Which folders hold the code? (`codePaths`)
- **Where must the cheap model never write?** (`forbiddenWrite`: save/delete flows, generated files, documents the owner writes by hand.) When unsure, forbid; opening later is easy, undoing data loss is not.
- Main branch name (`baseBranch`).
- **Who writes the code?** (`delegate.policy`) Ask with options: "always me (Opus)" → `kendisi` (important projects) · "only DeepSeek, wait without a key" → `yalniz-api` · "DeepSeek, else me" → `api-yoksa-kendisi` (default) · "DeepSeek, else a cheaper Claude model" → `api-yoksa-subagent` (`subagentModel`, e.g. haiku). Then show the output of `cv delegate which`.

## 3. VISION

Fill the `docs.vision` template with the owner. In order, one at a time:
1. "When this project is done, what will you be able to do?" → Goal.
2. "Who will use it?" → Goal.
3. "What must have happened for you to say 'done'?" → Finish line (make it measurable, have the owner confirm).
4. "What does 'it turned out well' look like? Is there something you take as a model?" → Feel and quality measure (with how it is tested; counting tasks does not measure quality).
5. "What must never break, whatever happens?" → Invariants; write the same in AGENTS.md > hard rules as checkable sentences.

Fill AGENTS.md's first sentence (what the project is) and the critical areas under "division of work". Write the same rules for the cheap model in `docs/tasks/README.md` > Project rules (in English).

## 4. First roadmap

Turn the goal into 5-10 concrete items in `docs.roadmap`; have the owner confirm the order.

## 5. Preparing unattended work

Run `cv doctor`. For every ✗ line tell the owner **step by step, in plain words, what to do** (which settings window, which option). Do not change the setting yourself. If the cheap-model key is missing, explain how to add it (an environment variable; they must not type it to you or paste it in the chat).

The owner sets up the scheduled task; the plain text to give it: **"load the otonom skill and run one cycle"** (not a slash command). Details: the package's `docs/OWNER_GUIDE.md`.

## 6. Finish

Commit (`claudevolution installed`), one entry in `docs.progress`, three lines to the owner: what was installed, what happens when they type what ("durum", "calis"), the steps left for unattended work.
