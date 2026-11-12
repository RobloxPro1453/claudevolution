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

## 2026-11-12 · Eksik listesi bitti, yeniden ölçüm (Opus 5.5)

8 maddenin hepsi kapandı (commit'ler `2b5b1ef` → `fb983c5`, kararlar K17-K24). Bitiş ölçüsü yeniden:

| # | Şart | Durum | Kanıt |
|---|---|---|---|
| 1 | `cv init` tam iskelet + doctor; ikinci init bir şey ezmez | GEÇTİ | Geçici klasörde `cv init`: 26 yeni dosya (+ makineye özgü başlatıcılar, toplam 30) ve doctor raporu; ikinci çalıştırma: 0 yeni, 0 `.new` |
| 2 | Testler yeşil | GEÇTİ | `deno run -A tests/run.js` → 46/46 (32'den; 14 yeni test: tur ölçümü, adopt, probe/ref, belge ve beceri eşliği) |
| 3 | Fotosop adopt planı, her INVENTORY satırı eşlendi | GEÇTİ | `docs/examples/fotosop-adopt-plan.md`, 70 satır, 8 eylem türü + config alan eşlemesi; Fotosop'a yalnız `--dry-run`, `git status` önce/sonra temiz (K18) |
| 4 | Becerilerde Fotosop adı yok | GEÇTİ | `grep -rniE "fotosop\|photopea" skills templates core bin` boş (`skills/en` dahil). Ad yalnız `docs/` altındaki tarihçe belgelerinde (INVENTORY, examples, DECISIONS, PROGRESS, REVIEW, FABLE_PROMPT, README) |
| 5 | OWNER_GUIDE sade dil | GEÇTİ | `docs/OWNER_GUIDE.md`: komut satırı yok, "Claude'a şunu yaz / şu dosyaya şunu yaz"; sayıları testle config'e bağlı (K19) |
| 6 | 16 dersin nereye gittiği sütunu | GEÇTİ | INVENTORY §4 tablo; 15 ders koda/config'e/beceriye/şablona, 1'i METHOD + DERSLER; hücrelerdeki yollar testle denetleniyor (K20) |
| 7 | Anahtar/e-posta/kişisel bilgi/makine yolu yok | GEÇTİ | Anahtar, e-posta, kullanıcı adı ve `C:\Users\` taraması: FABLE_PROMPT ve INVENTORY dışında yalnız gizli değer denetleyicisinin düzenli ifadesi ve testteki sahte `sk-abc…` dizgeleri |

**Karar: HAZIR** (v0.1.0 için). Bilinen sınırlar (bitiş ölçüsünün dışında, sıradaki işler):
- Şeritlerin gerçek ayrık süreçle ucuz model çalıştırması ağ ve anahtar ister; yalnız sahte modelle sınandı.
- Fotosop'a `cv adopt --apply` henüz yapılmadı (bilerek; sahibinin onayıyla Opus yapar). Ardından Fotosop'un iki yerel eklentisi yazılmalı: `engine-search` (ajan aracı) ve `probe` (`scripts/probe.ps1`'i saran).
- İlk gerçek damıtma, en az birkaç tur ölçümü biriktikten sonra.
