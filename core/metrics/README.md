# core/metrics — tur ölçümü

`round.js` bir **turu** (bir iş paketi: planla → ucuz modele yaptır → birleştir → belgele) modelin hiçbir şey okumasına gerek kalmadan ölçer. Üç kaynak:

1. **Claude Code oturum kayıtları** (`~/.claude/projects/<proje yolu, harf/rakam dışı her karakter "-">/**/*.jsonl`; yalnız okunur, `metrics.claudeProjectDir` ile değiştirilebilir). Turun zaman penceresindeki her yanıt bir kez sayılır (aynı mesaj kimliği tekrar ederse bir kez).
2. **Ucuz model kayıtları** (`delegate.stateDir/<iş>.json` ve `asks.jsonl`; `core/delegate/agent.js` yazar). Bitiş zamanı pencere içinde olan çalıştırmalar.
3. **git**: turun başındaki ve sonundaki commit arası fark.

## Komutlar

```
cv round start [--quota N] [--type T] [--mode hybrid|solo]   tur aç (N = haftalık kota %)
cv round end   [--quota N] [--bugs ".."] [--waste ".."] [--note ".."] [--session ID] [--exclude-session ID] [--dry]
cv round add   --from ISO --to ISO --base REV --head REV [...]  geçmiş bir turu sonradan ölç
cv round show                                                  açık tur + son 5 tur (cv status da gösterir)
cv round table                                                 metrics.table'ı yeniden üret
```

Tur numarası küreseldir: `metrics.jsonl`'deki en büyük numara + 1; bir tur birden çok oturuma yayılabilir. Açık tur `metrics.stateDir/round-open.json`'da durur.

## `metrics.jsonl` satırı

| Alan | Birim | Anlam |
|---|---|---|
| `round`, `date`, `from`, `to`, `minutes` | sayı, gün, ISO, dk | tur numarası ve zaman penceresi |
| `type`, `mode` | metin | iş türü (serbest), `hybrid` (Claude + ucuz model) ya da `solo` |
| `quotaStart`, `quotaEnd` | haftalık % | turun başında/sonunda kota (`get_usage`'dan elle verilir) |
| `claude.calls`, `sessions`, `sidechainCalls` | adet | yanıt sayısı, oturum sayısı, alt ajan yanıtları |
| `claude.output`, `cacheRead`, `cacheWrite`, `input` | token | ham token toplamları |
| `claude.load`, `sidechainLoad` | yük birimi | `(çıktı·w.output + önbellekOkuma·w.cacheRead + önbellekYazma·w.cacheWrite + girdi·w.input) / 1e6 × model katsayısı`; kotayla orantılı kabul edilir |
| `claude.contextAvg`, `contextLast`, `contextMax` | token | ana oturum çağrılarının okuduğu bağlam |
| `claude.activeMin` | dk | çağrılar arası boşluklar (3 dk üstü 3 dk sayılır) |
| `delegate.tasks`, `runs`, `fixRuns`, `asks` | adet | ucuz model işleri, çalıştırmaları, düzeltme turları, salt-okur sorular |
| `delegate.firstTryDone`, `endedDone` | adet | tek çalıştırmada biten / sonunda biten işler |
| `delegate.steps`, `wastedSteps`, `loopStops` | adet | adımlar; `blocked` biten çalıştırmaların adımları boşa |
| `delegate.cost` | $ | ucuz model harcaması |
| `delegate.tokens` | token | `{hit, miss, out}` |
| `delegate.runMin` | dk | çalıştırmaların toplam süresi |
| `git.commits`, `files` | adet | |
| `git.codeAdded`, `codeRemoved` | satır | `codePaths` altındaki değişim |
| `git.agentCodeAdded`, `claudeCodeAdded` | satır | `delegate.commitTrailer` taşıyan commit'ler ucuz modelin sayılır |
| `git.specLines`, `reviewLines` | satır | tarif (`tasks.pattern`) ve inceleme notu satırları |
| `git.specPerCode`, `handoffPerCode` | oran | 0,5 üstü: iş Claude'da kalmalıydı |
| `loadPer100Lines` | yük | 100 kod satırı başına Claude yükü |
| `delegateWaitShare` | oran | turun ne kadarı ucuz modeli beklemekle geçti |
| `bugs`, `waste`, `note` | metin | elle verilen gözlem |

`cv distill` dört seçilim ölçüsünü bu satırlardan hesaplar (`quotaStart/End`, `delegate.endedDone`, `delegate.tasks`, `delegate.firstTryDone`).
