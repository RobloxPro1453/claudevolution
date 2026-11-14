# Değişiklikler

Büyük sürümler burada; her yama sürümü (1.0.1, 1.0.2, …) gerekçesi ve ölçü farkıyla `evolution/CHANGELOG.md` içinde (`cv evolve` yazar).

## 1.0.0 · 2026-11-12

Paket standart hâline geldi; kapsam dondu (`docs/STANDARD.md`).

- DeepSeek anahtarı yoksa iş durmuyor: Claude subagent'ına ya da ana modele geçiyor, aynı kurallarla (`cv delegate which`, `cv delegate brief`).
- Ölçüm takımı `cv bench`: birim testleri + 20 kaos senaryosu (limit, kilit, çöküş, sahibinin notu, kapanışta soru yok...), hiç model tokeni harcamadan. İsteğe bağlı ücretli canlı kat (`--live`): küçük bir sahte projede 4 iş, biri tuzak, $0,10 tavan.
- Evrensel evrim `cv evolve`: bir değişiklik ölçülür, kötüleştirmiyorsa pakete girer, sürüm alır ve GitHub'a gönderilir; kötüleştiriyorsa reddedilip kaydedilir. Ölçüm takımını değiştiren değişiklik kabul edilmez.
- Push öncesi gizlilik taraması: anahtar, e-posta, kişisel klasör yolu.

## 0.1.0 · 2026-11-12

İlk kurulum: `cv init/adopt/doctor/status/round/distill/update/probe/ref`, ucuz model ajanı ve şeritler, otonom çevrim, Türkçe ve İngilizce beceriler, sahip rehberi.
