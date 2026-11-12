# claudevolution v1.0 standardı

Bu sayfa paketin **bitmiş** hâlini tanımlar. v1.0'dan sonra "şunu da ekleyelim" döngüsü yok; paket yalnız aşağıdaki kuralla değişir.

## Pakette ne var (v1.0)

| Parça | Komut / yer | Ne işe yarar |
|---|---|---|
| Kurulum | `cv init`, `cv adopt`, `cv update` | Yeni projeye iskelet; var olan düzeni göç ettirme; paket sürümünü projeye uygulama |
| Denetim | `cv doctor`, `cv status` | Gözetimsiz çalışma önkoşulları; tur, kota, hafıza özeti |
| İş dağıtımı | `cv delegate …`, `which`, `brief` | Ucuz API modeli (anahtar varsa) → Claude subagent → ana model; aynı kurallar, aynı gizli denetim |
| Otonomi | `cv cycle`, `cv gate`, `cv lock`, `cv recover`, `otonom` becerisi | Limit kapıları, kilit, kurtarma, sade hafıza (DERSLER, GUNLUK, HATALAR, OZET, SORULAR, NOTLAR) |
| Ölçüm | `cv round`, `cv bench` | Tur ölçüsü (saha); paket ölçümü: A testler + B 20 kaos senaryosu (0 token), C canlı (yalnız `--live`, tavanlı) |
| Evrim | `cv distill`, `damit` becerisi, `cv evolve` | Yerel ders projede kalır; genel ders `evrim/<ad>` dalından ölçülerek pakete girer ve GitHub'a push edilir |
| Yardımcı | `cv probe`, `cv ref` | Uygulamayı yoklama, referansla yan yana karşılaştırma |
| Beceriler | `durum`, `calis`, `otonom`, `damit`, `cv-init` (tr + en) | Claude'un oturumda izlediği yol |

## Değişiklik kuralı

Pakete yeni bir şey **yalnız** iki yoldan girer:

1. **Gerçek sorun:** bir projede gerçekten yaşanmış, `HATALAR`/`DERSLER`'e düşmüş bir durum.
2. **Sahibinin açık isteği.**

Her ikisi de aynı kapıdan geçer: `evrim/<ad>` dalı → `cv evolve`. Kapılar:
- A testleri yeşil, sayıları azalmadı.
- B kaos senaryolarının hepsi geçti, sayıları azalmadı.
- (`--live` ise) C'de tuzak ihlali 0, çözülen iş azalmadı.
- Gizlilik taraması temiz.

Geçen değişiklik sürüm alır, `evolution/CHANGELOG.md`'ye gerekçesi ve ölçü farkıyla yazılır, push edilir. Geçmeyen `evolution/REJECTED.md`'ye yazılır.

Değişmezler (evrim gevşetemez): yasak yollar, veri kaybı kuralları, kota eşikleri, "Asla" listeleri, ölçüm takımı. `bench/` değişikliği ayrı commit'le ve sahibine bildirilerek yapılır.

## Ölçüm maliyeti

Ölçüm normal kodlamadan fazla token yemez. A ve B her değişiklikte koşar ve model tokeni harcamaz. C yalnız `--live` ile koşar: tek koşu, 4 iş, $0,10 tavan, yalnız API modeliyle, yoğun saatte koşmaz. Evrim ve ölçümün toplam payı haftalık kotanın %10'unu geçmez.

## v1.0'ın dışında (ihtiyaç doğarsa yukarıdaki kuralla)

- Kat D (hafıza devir sınavı).
- İkinci ve sonraki sahte projeler, holdout işler.
- Subagent ile canlı ölçüm.
- Başka dil ya da platform için kabuk betikleri.
