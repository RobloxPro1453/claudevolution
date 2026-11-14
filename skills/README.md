# skills

Claude becerileri; `cv init` bunları projenin `.claude/skills/` klasörüne **sürüm damgalı kopya** olarak koyar (gerekçe: `docs/DECISIONS.md` K3), `cv update` farkı gösterir.

| Beceri | Ne zaman | Ne yapar |
|---|---|---|
| `durum` | oturum başı, "neredeyiz" | değiştirmeden durum + sıradaki paket önerisi |
| `calis` | "çalış", "devam et" | bir tur: paket planla, şeritleri başlat, gözden geçir, birleştir, belgele, ölç |
| `otonom` | zamanlanmış görev ya da `/loop` | tek gözetimsiz çevrim: kilit, kota kapısı, hafıza, bir adım, kayıt |
| `damit` | otonom "DAMITMA: evet" ya da "damıt" | yerel dersleri sınıfla, evrenseli pakete taşı, ölç, kötüleşeni geri al |
| `cv-init` | "claudevolution kur" | konuşarak kurulum, VISION doldurma |

Diller: `tr/` tam; `en/` aynı becerilerin İngilizcesi. Dil `.evrim/config.json` > `lang`.

Kurallar (beceri metni yazarken):
- Projeye özgü hiçbir ad, yol, komut yazılmaz; hepsi `.evrim/config.json`'dan okunur (`docs.*`, `build`, `test`, `tasks.*`, `delegate.*`).
- Sayılar (eşikler) metinde varsayılan olarak geçer; kaynağı config'dir.
- Hesap ve durum işi `cv` komutlarındadır (kapı, kilit, sayaç, günlük); beceri yalnız karar ve sırayı anlatır. Böylece beceri kısa kalır ve her yüklenişte az kota yer.
