---
name: damit
description: Evolution step - classifies the project's new lessons, moves the general ones into the claudevolution package (universal lessons, or straight into a skill/template text), records every change with a measured hypothesis, and measures earlier changes, reverting those that made things worse. Runs when the autonomous cycle says "DAMITMA: evet" or the owner says "distill".
---

# Distillation

Goal: what this project learned the hard way comes free to the next project; but no junk enters the package. Budget: at most 10% of the total quota (`evolution.distillQuotaShare`); one cycle.

`cv` = `.evrim\cv.cmd` (Windows) or `.evrim/cv`. The package location is on the first line of `cv distill` output (`PAKET: <path>`); below it is `<package>`.

## 1. Collect

Run `cv distill`. The output has:
- **New local lessons** (added to `DERSLER.md` since the last distillation, with their tags),
- **Universal candidates** (tagged `[evrensel]`, or untagged and free of the project's name/paths),
- **Measures** (recent rounds and cycles: quota per finished task, cheap-model first-try rate, wasted cycles, owner objections),
- **Pending evolution changes** (entries in `<package>/evolution/CHANGELOG.md` whose result is "bekliyor" (pending) and that are due for measuring).

## 2. Selection (measure the old ones first)

For each pending entry that is due, compare its own measure with the earlier value:
- Better or unchanged → set the result to `tuttu` (held).
- Worse → **revert** the change (restore the old text in the file the entry names), set the result to `geri alındı` (reverted), give the reason in one sentence.
- Not enough data (K cycles not reached, or the measure never formed) → leave it.

Never decide on one measurement: a small difference (under 10%) counts as `tuttu`; do not mistake noise for evolution.

## 3. Classify

One question per new lesson: **"Would this happen exactly the same in another project?"**

| Class | Sign | Where |
|---|---|---|
| Local | Names a file, tool or product of this project; meaningless elsewhere | Stays where it is (`[yerel]` tag) |
| Universal lesson | About tools, quota, git, the cheap model, talking to the owner; still true with the project name removed | `<package>/evolution/universal/DERSLER.md` (one line, source project and date in parentheses) |
| Universal rule | The same lesson came up a second time (another project, or 2+ times here), or it reads "always do this" | Straight into the relevant **skill or template text** (`<package>/skills/...`, `<package>/templates/project/...`); removed from DERSLER |
| Recurring error pattern | Symptom → cause → fix is clear | `<package>/evolution/universal/HATALAR.md` |

When unsure, keep it local; the next distillation looks again.

## 4. Protection (non-negotiable)

A universal change:
- **May never loosen any project's rules.** `forbiddenWrite`, data-loss rules, quota thresholds and "Never" lists can only be tightened. A loosening proposal goes to the owner in `SORULAR.md`, not applied.
- May not contain a project name, path, personal information or key. Generalise the lesson before moving it ("the project", the tool by its kind).
- Must be small: at most 5 moves per distillation; at most one paragraph at a time in a skill text.
- Commit the change in the package repository on a branch `evrim/<short-name>` (never straight to main), then in the package folder run `cv evolve evrim/<short-name> --why "<expected effect>"`. It measures (free tiers), and if the gates hold it merges into main, bumps the version, writes CHANGELOG and pushes; otherwise it rejects and writes `evolution/REJECTED.md`. A candidate that touches `bench/` is always rejected. `cv evolve` writes the CHANGELOG line of step 5; put the measure and K into `--why`.

## 5. Record

For each move, one line in `<package>/evolution/CHANGELOG.md`:

`- <date> · <change: which file, what was added/changed> · beklenen etki: <what should improve> · ölçü: <which, current value> · K=<cycles> · sonuç: bekliyor`

The measure is one of these four and its current value comes from `cv distill`: `is-basina-kota`, `ilk-deneme-orani`, `bosa-cevrim`, `sahip-itirazi`. No change without a measure.

Then:
1. Delete moved lessons from local `DERSLER.md` (if they became a universal rule) or mark them `[evrensel→taşındı]`.
2. If `DERSLER.md` is over 40 lines, merge similar ones, delete stale ones.
3. `cv distill --mark` (records the distillation time and the lessons handled).
4. Commit in this project (`evrim: damıtma <date>`); two plain lines in OZET, in the owner's language: "I learned these and turned them into lasting rules: …".

If the package version changed (a skill/template text changed), projects see it with `cv update`; run `cv update` here right away and apply the difference so this project is the first to benefit from its own lessons.
