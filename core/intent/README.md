# core/intent — alt-metin motoru (`cv intent`)

Sahibin şartı (2026-11-20): teknik olmayan sahip fikrini kısa söyler; söylemediği amaç, his ve beklenti çıkarılır ki revizyon döngüsü baştan kesilsin. Bu modül işin **0-token, belirlenimci** yarısıdır; boşlukları ana model tek turda sohbetten doldurur.

| Parça | Ne yapar |
|---|---|
| `classify(istek)` | `templates/expectations/<tür>.json` anahtar sözcükleriyle tür (not, görev, dosya, medya, çizim, tablo, sohbet, araç) |
| `card(istek)` | Türün **söylenmeyen beklentileri** (`[E:id]`), en çok 7 seçenekli soru (yalnız sahibin seçimi ve yanlışı pahalı olanlar; istekte cevaplanmış olan sorulmaz ama listelenir), "X gibi" benzetmesinin hangi yanının kastedildiği sorusu, `--self-test` adımları |
| `renderIntent(kart)` | `docs/INTENT.md`: "Anladığım şu" (kim/ne zaman/neden/his/mükemmel/sinir), kararlar ("aksi söylenmedikçe" varsayılanlar), kabul ölçütleri, ölçüm |
| `coverage(cfg)` | Her `[E:id]` yol haritasına ya da bir tarife ulaştı mı; eksik = plan onaylanmaz |
| `delivered(cfg, tur)` | Her `finalForm.criteria` gerçekten denendi mi: ✓ geçti, ✗ kaldı, ~ denenmedi (self-test iddiaları `Self-test: <adım>`) |
| `renderDelivered(sonuç)` | Ölçüt tablosu (✓/✗/~, kalanın nedeni) + `Karşılanan: P/N · denenmedi: U · kalan: F` |

## Komutlar

```
cv intent "<istek>" [--kind tür] [--apply] [--json]   kart (+ yığın önerisi); --apply: docs/INTENT.md + check.selfTest.steps + finalForm.criteria (boşsa)
cv intent coverage                                     [E:...] maddeleri planda mı
cv intent coverage --delivered                         her ölçüt denendi mi (✓/✗/~); --json: nesne
cv intent kinds                                        katalog
```

## Kurallar (LoopTroop PROM4/PROM5 görüşme ilkeleri, MIT)

Sorular 1-3'lük değişken partilerde, seçenekli, sade dille; üst sınır hedef değildir. İstekte örtük cevaplanmış soru sorulmaz, karta "istekte söylendi" diye yazılır. Sahibin kelimesi varsayılandan üstündür. Kapsam denetimi kod yazılmadan önce, maket görüntüsüyle birlikte "Anladığım şu" gösterilirken yapılır: revizyonun en ucuz anı.
