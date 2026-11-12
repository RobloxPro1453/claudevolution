---
name: durum
description: At the start of a new session, or when the owner asks "where are we" / "status", reports the project's state and proposes the next round without changing anything.
---

Do not change product files, commit, or run the cheap model. Only read and summarise. The single write: opening the round (step 3, after the owner agrees).

`cv` = `.evrim\cv.cmd` (Windows) or `.evrim/cv`. Document paths live in `.evrim/config.json` > `docs` (referred to below as `docs.progress` and so on). `cv` prints in Turkish; its keywords are stable.

**Read narrowly.** Never read documents end to end; the following is enough. Send independent commands in one message.

1. In one message, in parallel:
   - `cv status` (git state, last commits, open round and last 5 rounds, lanes and branches waiting for review, last known quota, autonomy memory summary, open roadmap items, last PROGRESS entry, the "Elle bakılacak" (manual checks) list; all in one output)
   - `mcp__ccd_session_mgmt__get_usage` (if not loaded: `ToolSearch select:mcp__ccd_session_mgmt__get_usage`)
2. To the owner, in their language, briefly:
   - What was done last (2-3 points) and the measure of the last rounds (finished tasks / quota points; from `cv status` output, never numbers from memory).
   - What is open: unreviewed cheap-model branches, a dirty working tree, an open round, things the owner must try by hand, questions waiting for an answer (`SORULAR.md`).
   - Quota: 5-hour and weekly percentages.
   - **Next package:** 8-10 items in `docs.roadmap` order; which of them stays with Claude, if any (AGENTS.md > division of work); a rough cheap-model cost. Do not propose a scan round or a single-task round.
   - End with "Shall I start?".
3. If the owner agrees, open the round: `cv round start --quota <weekly %> --type <type>`, then the `calis` skill.

If this session is not new (a round already ran in it), suggest starting the round in a new session: the context is re-read on every call and that is what eats most of the quota.
