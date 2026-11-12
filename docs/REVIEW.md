# İnceleme (Opus 5.5)

## 2026-11-12 05:50 · Fable v0.1.0 kurulumu

Fable 5.2 limit freninde (%76) durdu, 8 commit. Bitiş ölçüsü (FABLE_PROMPT §5):

| # | Şart | Durum | Kanıt |
|---|---|---|---|
| 1 | `cv init` tam iskelet + doctor; ikinci init bir şey ezmez | GEÇTİ | Boş klasörde 30 dosya (AGENTS, docs, 5 beceri, .evrim); doctor türkçe rapor; ikinci init sonrası `.new` yok, değişiklik yok |
| 2 | Testler yeşil | GEÇTİ | `deno run -A tests/run.js` 32/32 (Node yok, Deno; DECISIONS K1) |
| 3 | Fotosop adopt planı | KALDI | `cv adopt` ve `docs/examples/fotosop-adopt-plan.md` yok |
| 4 | Becerilerde Fotosop adı yok | GEÇTİ | `skills templates core bin` grep boş |
| 5 | OWNER_GUIDE sade dil | KALDI | dosya yok |
| 6 | 16 dersin nereye gittiği sütunu | KALDI | INVENTORY sütunu yok |
| 7 | Anahtar/e-posta/kişisel bilgi yok | GEÇTİ | grep'te yalnız testteki sahte `sk-abc…` dizgeleri |

**Karar: DEVAM.** Temel sağlam; eksikler Opus tarafından saat başı birer adım tamamlanır.

### Eksik listesi (önem sırası)
- [x] 1. `core/metrics/round.js` + `cv round` (beceriler bunu çağırıyor)
- [x] 2. `cv adopt` (+ `--dry-run`) ve `docs/examples/fotosop-adopt-plan.md`
- [x] 3. `docs/OWNER_GUIDE.md`
- [x] 4. INVENTORY §4 "nereye gitti" sütunu
- [x] 5. `docs/METHOD.md`
- [x] 6. `core/{delegate,metrics,probe,reference}/README.md` yer tutucuları
- [x] 7. probe/reference (`cv ref`)
- [x] 8. İngilizce beceriler
