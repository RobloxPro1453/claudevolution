# Evrim günlüğü

Her satır: tarih · değişiklik · beklenen etki · doğrulama ölçüsü · sonuç (bekliyor / tuttu / geri alındı).

- 2026-11-12 · v0 tohum dersleri (fotosop haftası) · — · — · tohum
- 2026-11-12 · yedek-ana-model (v1.0.1) · sahibinin isteği: anahtar yoksa ana model (Opus) devam etsin, kod kalitesi düşmesin; ölçü: Kat A/B aynı kalmalı · ölçüler eşit · kabul
- 2026-11-12 · uzaktan-izleme (v1.0.2) · sahibinin isteği: okuldayken telefondan izleyebilsin; ölçü: A/B aynı kalmalı · ölçüler eşit · kabul
- 2026-11-12 · kullanim-karti (v1.0.3) · sahibinin isteği: telefonda ve PC'de duracak tek sayfalık kullanım kartı · ölçüler eşit · kabul
- 2026-11-12 · sayac-tum-dallar (v1.0.4) · Ayrı çalışma kopyasında commit edilen iş 'commit'siz çevrim' sayılmasın; ölçü: bosa-cevrim (şimdi 1), K=5 · ölçüler eşit · kabul
- 2026-11-12 · izin-red-dal (v1.0.5) · reddedilen geri alınamaz git işini tekrar denemekle yanan çevrim azalır; ölçü bosa-cevrim şimdi 0.46, K=5 · ölçüler eşit · kabul
- 2026-11-12 · ders-aninda (v1.0.6) · evrensel ders aninda pakete (cv lesson --evrensel); olcu: bosa-cevrim 0.46, K=5; gunluk bozulmasi (cv.cmd call) duzeldi · test 61 → 66 · kabul
- 2026-11-12 · temizlik-yuzde39 (v1.0.7) · yanlislikla eklenen %39 dosyasi silindi · ölçüler eşit · kabul
- 2026-11-12 · ders-test-takimi-arka-planda-kosarken-926289 (v1.0.8) · evrensel ders: Test takımı arka planda koşarken aynı uygulamayı derleme: çıktı dosyası kilitli  · ölçüler eşit · kabul
- 2026-11-12 · ders-yardimci-betige-yoklama-test-araci-024715 (v1.0.9) · evrensel ders: Yardımcı betiğe (yoklama, test aracı) çok satırlı ya da tırnaklı kodu komut satı · ölçüler eşit · kabul
- 2026-11-12 · ders-arayuz-isinde-her-adimda-gercek-116356 (v1.0.10) · evrensel ders: Arayüz işinde her adımda gerçek uygulamadan ekran görüntüsü al ve referans görse · ölçüler eşit · kabul
- 2026-11-12 · ders-ara-sira-dusen-bir-test-205631 (v1.0.11) · evrensel ders: Ara sıra düşen bir test ilk kez görülünce yeniden koşmadan önce hata yakalayıcıs · ölçüler eşit · kabul
- 2026-11-12 · sifir-baslangic (v1.0.12) · soğuk başlayan model sistemi tek giriş noktasından anlasın: README + şablon AGENTS claudevolution bölümü + CLAUDE.md; ölçü: sahip-itirazi, COLD_START testi; K=10 · test 66 → 68 · kabul
- 2026-11-12 · is-dagitimi-ayari (v1.0.13) · sahibi kodu kimin yazacağını seçer (delegate.policy); Haiku yalnız açıkça · test 68 → 69 · kabul
- 2026-11-12 · claudevrim (v1.0.14) · sahibi exe'yi indirip claudevrim init + merhaba ile projeye başlar; evrensel dersler iki katmanla her projeye gider; ölçü: sahip-itirazi, COLD_START · test 69 → 74; kötü: codeLines %9 arttı (3168 → 3454); kötü: skillLines %5 arttı (529 → 557) · kabul
- 2026-11-12 · cmd-guvenli (v1.0.15) · cv update kendi cv.cmd'sini yeniden yazınca fazladan satır çalışmasın; yeni .gitignore satırları var olan projelere de girsin · ölçüler eşit · kabul
- 2026-11-12 · sessiz-init (v1.0.16) · yeni projede init sessiz; kurulum sonrası selam /loop başla'yı gösterir; yalnız-Opus ve kota açık söylenir (soğuk senaryo bulguları) · ölçüler eşit · kabul
- 2026-11-12 · ders-windows-ta-calisirken-kendini-yeniden-108236 (v1.0.17) · evrensel ders: Windows'ta çalışırken kendini yeniden yazan bir .cmd dosyası kayan bayt konumund · ölçüler eşit · kabul
- 2026-11-12 · ders-sayfaya-enjekte-edilen-test-betigi-183241 (v1.0.18) · evrensel ders: "Sayfaya enjekte edilen test betiği hiç sonuç vermiyor ve içindeki zaman bekçisi · ölçüler eşit · kabul
