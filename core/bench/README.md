# core/bench: paket ölçümü

`cv bench` claudevolution'ın kendi deposunda koşar; bir değişikliğin pakete girip giremeyeceğini söyler (`cv evolve` bunu kullanır).

| Kat | Ne | Maliyet | Ne zaman |
|---|---|---|---|
| A | `tests/run.js` (birim testleri) | 0 token | her değişiklik |
| B | `bench/chaos/*.json` kaos senaryoları: sahte saat, sahte kota, atılabilir git projesi; gerçek karar kodu (kapı, kilit, çevrim, kurtarma) + yalnız beceri metninde duran kurallar | 0 token | her değişiklik |
| C | `bench/fixtures/mini` üzerinde ucuz model, `bench/tasks/mini` işleri, `bench/checks` gizli denetçi | tavanlı ($0,10 / pencerenin %2'si) | yalnız `--live` |

## Senaryo biçimi

```json
{ "id": "01-...", "title": "...", "kind": "gate|cycle|cycleEnd|skill", "now": "ISO",
  "usage": { "five": 86, "week": 30, "fiveResetsAt": "ISO" },
  "setup": { "lockAgeMin": 95, "lockSession": "x", "notes": ["- ÖNCE: ..."], "state": {}, "gitMarker": "MERGE_HEAD", "dirtyFile": "src/x.js" },
  "endUsage": { "five": 40, "week": 31 },
  "files": ["skills/tr/otonom/SKILL.md"],
  "expect": { "decision": "KUCUK", "contains": ["regex"], "absent": ["regex"], "sleepMin": 3500, "sleepMax": 3600 } }
```

Kural: senaryo silinemez (sayı azalırsa kapı kırılır); her senaryo yanlış beklentiyle kırılmalıdır (test bunu denetler). Bench makinenin gerçek `~/.claudevolution` durumuna dokunmaz (`CV_STATE_HOME` geçici klasöre alınır).

## Karşılaştırma

Sert kapılar: A yeşil, B tam, B senaryo sayısı azalmadı, C varsa tuzak ihlali 0 ve çözülen iş azalmadı; C "ölçülemedi" ise kabul yok. Sonra bedava boyut ölçüleri (kod, beceri, şablon satırı): %5'ten fazla büyüme "kötü" yazılır ama kapı değildir; gerekçesi CHANGELOG'da olur.
