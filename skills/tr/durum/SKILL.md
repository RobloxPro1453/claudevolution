---
name: durum
description: Yeni oturum başında ya da sahibi "neredeyiz", "durum ne" dediğinde, hiçbir şeyi değiştirmeden projenin durumunu ve sıradaki tur önerisini verir.
---

Ürün dosyalarını değiştirme, commit atma, ucuz model çalıştırma. Yalnız oku ve özetle. Tek yazma: tur açılışı (adım 3, sahibi onaylayınca).

`cv` = `.evrim\cv.cmd` (Windows) ya da `.evrim/cv`. Belge yolları `.evrim/config.json` > `docs` içindedir (aşağıda `docs.progress` gibi anılır).

**Dar oku.** Belgeleri baştan sona okuma; aşağıdakiler yeter. Bağımsız komutları tek mesajda gönder.

1. Tek mesajda, paralel:
   - `cv status` (git durumu, son commit'ler, açık tur ve son 5 tur, şeritler ve bekleyen dallar, son bilinen kota, otonom hafıza özeti, açık yol haritası maddeleri, son PROGRESS kaydı, "Elle bakılacak" listesi; hepsi tek çıktıda)
   - `mcp__ccd_session_mgmt__get_usage` (yüklü değilse `ToolSearch select:mcp__ccd_session_mgmt__get_usage`)
2. Sahibine kendi dilinde, kısa:
   - Son yapılanlar (2-3 madde) ve son turların ölçüsü (biten iş / kota puanı; `cv status` çıktısından, ezberden sayı yazma).
   - Açık kalanlar: gözden geçirilmemiş ucuz model dalı, kirli çalışma alanı, açık tur, sahibinin elle denemesi gerekenler, cevap bekleyen sorular (`SORULAR.md`).
   - Kota: 5 saatlik ve haftalık yüzde.
   - **Sıradaki paket:** `docs.roadmap` sırasına göre 8-10 madde; Claude'da kalacak olan varsa hangisi (AGENTS.md > İş bölümü); kabaca ucuz model maliyeti. Tarama turu ya da tek işlik tur önerme.
   - "Başlayayım mı?" ile bitir.
3. Sahibi onaylarsa turu aç: `cv round start --quota <haftalık %> --type <tür>`, sonra `calis` becerisi.

Bu oturum yeni değilse (önceki bir tur bu oturumda yapıldıysa) turu yeni oturumda başlatmayı öner: bağlam her çağrıda yeniden okunur ve kotanın çoğunu o yer.
