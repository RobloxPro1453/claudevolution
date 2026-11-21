# .evrim

This folder is the project's **claudevolution** layer. A plain explanation for the owner is in the package's `docs/OWNER_GUIDE.md`.

| File | What | In git? |
|---|---|---|
| `config.json` | Every project setting: build/test command, forbidden paths, document names, cheap model, quota lines | yes |
| `version` | The claudevolution version installed in this project | yes |
| `otonom/DERSLER.md` | Lessons (≤40 lines); read in full at the start of every cycle | yes |
| `otonom/GUNLUK.md` | Cycle journal; appended, only the last 10 lines are read | yes |
| `otonom/HATALAR.md` | Serious error records; searched only when an error shows up | yes |
| `otonom/OZET.md` | Plain status summary for the owner | yes |
| `otonom/SORULAR.md` | Questions the agent leaves for the owner, no answer awaited | yes |
| `otonom/NOTLAR.md` | **The owner's notes to the agent** (read every cycle) | yes |
| `knowledge.jsonl` | The lasting knowledge store (lessons, pitfalls, kept and rejected hypotheses) | yes |
| `otonom/lock` | "A cycle is running now" mark | no |
| `metrics.jsonl` | Round measurements | yes |
| `state/` | Temporary state: lane logs, last known quota, the quota guard's cache, counters | no |
| `cv`, `cv.cmd`, `local.json` | Shortcuts that know where the package is on this machine (`cv init` rebuilds them) | no |

## Common commands

```
.evrim/cv status      where things stand
.evrim/cv doctor      ready for unattended work? (also checks the quota guard hook)
.evrim/cv guard --show what the quota guard sees now
.evrim/cv lock status is the loop running or sleeping
.evrim/cv lesson "<lesson>" [--evrensel]   write a lesson (evrensel: into the package at once)
.evrim/cv update      show the package's new version (--apply to take it)
```

On Windows write `.evrim\cv.cmd status`.

## config.json fields (short)

- `build`, `test`: as `["program", "argument", ...]`; no shell. `null` skips that step and `doctor` warns.
- `forbiddenWrite`: paths the cheap model cannot write. **This list is narrowed only on the owner's word.** `cv update` and distillation never touch it.
- `docs.*`: the document paths the skills read.
- `delegate.providers.<name>`: an OpenAI-compatible endpoint. The key is read only from the environment variable named by `keyEnv`.
- `autonomy.gates`: in the 5-hour window no new step at 85%, exit at 90%; weekly ceiling `60 + 30·f`.
- `autonomy.guard`: the quota guard hook (warns on tempo and at 85%; blocks new unattended work at 90%).
- `autonomy.share.weight`: this project's quota share weight when several projects run on one machine.
- `evolution.*`: lesson limit, distillation frequency and share, selection period.
