# .evrim

Bu klasör projenin **claudevolution** katmanıdır. Sahibi için sade anlatım paketteki `docs/OWNER_GUIDE.md` içindedir.

| Dosya | Ne | Git'e girer mi |
|---|---|---|
| `config.json` | Projeye özgü her ayar: derleme/test komutu, yasak yollar, belge adları, ucuz model, kota eşikleri | evet |
| `version` | Bu projeye kurulu claudevolution sürümü | evet |
| `otonom/DERSLER.md` | Birikmiş dersler (≤40 satır); her çevrim başında tamamı okunur | evet |
| `otonom/GUNLUK.md` | Çevrim günlüğü; sona eklenir, yalnız son 10 satır okunur | evet |
| `otonom/HATALAR.md` | Ciddi hata kayıtları; yalnız hata görülünce aranır | evet |
| `otonom/OZET.md` | Sahibi için sade durum özeti | evet |
| `otonom/SORULAR.md` | Ajanın sahibine bıraktığı, cevap beklemeyen sorular | evet |
| `otonom/NOTLAR.md` | **Sahibinin ajana notları** (her çevrim okunur) | evet |
| `otonom/lock` | "Şu an bir çevrim çalışıyor" işareti | hayır |
| `metrics.jsonl` | Tur ölçümleri | evet |
| `state/` | Geçici durum: şerit günlükleri, son bilinen kota, sayaçlar | hayır |
| `cv`, `cv.cmd`, `local.json` | Bu makinedeki paketin yerini bilen kısayollar (`cv init` yeniden üretir) | hayır |

## Sık kullanılan komutlar

```
.evrim/cv status      şu an ne durumda
.evrim/cv doctor      gözetimsiz çalışmaya hazır mı
.evrim/cv lock status döngü çalışıyor mu, uyuyor mu
```

Windows'ta `.evrim\cv.cmd status` biçiminde yazılır.

## config.json alanları (kısa)

- `build`, `test`: `["program", "argüman", ...]` biçiminde; kabuk kullanılmaz. `null` ise o adım atlanır ve `doctor` uyarır.
- `forbiddenWrite`: ucuz modelin yazamayacağı yollar. **Bu liste yalnız sahibinin sözüyle daraltılır.** `cv update` ve damıtma bu alana dokunmaz.
- `docs.*`: becerilerin okuduğu belge yolları.
- `delegate.providers.<ad>`: OpenAI uyumlu uç nokta. Anahtar yalnız `keyEnv` ile adı verilen ortam değişkeninden okunur.
- `autonomy.gates`: 5 saatlik pencerede %85'te yeni adım yok, %90'da çık; haftalık tavan `60 + 30·f`.
- `autonomy.share.weight`: aynı makinede birden çok proje varsa bu projenin kota payı ağırlığı.
- `evolution.*`: ders sınırı, damıtma sıklığı ve payı, seçilim süresi.
