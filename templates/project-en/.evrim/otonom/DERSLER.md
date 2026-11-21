# Lessons (at most 40 lines; read in full at the start of every cycle)

Each line is one lesson: "doing X caused Y → now I do Z (GUNLUK: date time)". A lesson comes from something that repeats or proved expensive; an ordinary event is not a lesson. When full, merge similar lines and drop stale ones. Write lines with `cv lesson "<lesson>"`, not by hand (`[yerel]`: this project only). If it is true for other projects too: `cv lesson "<generalised lesson>" --evrensel` — it goes into the package at once and the line becomes `[evrensel→taşındı vX]`. Only a lesson that could not reach the package stays `[evrensel]`; distillation tries it again.

<!-- Example (keep it, it shows the format):
- Building while tests ran failed because the output file was locked → I now wait for the tests to finish (GUNLUK: 2026-01-15 00:00) [evrensel→taşındı v1.0.0]
-->
