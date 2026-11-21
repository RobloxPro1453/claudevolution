---
name: clean-architecture
description: Masaüstü uygulamanın katmanları - Motor (kurallar) -> Araçlar/Depolama (disk, dış dünya) -> ince Arayüz; veri kaybını önleyen kayıt düzeni ve sürümlü dosya biçimi; masaüstü uygulama projesinde yüklenir.
---

Kaynak: Craft Anything mimarisi (`Engine -> Tools -> ince UI`) ve `pitfalls.md` dosya/kayıt dersleri (MIT OR Apache-2.0).

## Üç katman, tek yön
- **Motor** (`src/engine.rs` ya da `src/engine/`): durum ve kurallar. Pencere kütüphanesi (`eframe`, `egui`, `tauri`) ve disk (`std::fs`) **yok**. Sahibin yapabildiği her şey burada bir işlev: arayüz, `--self-test` ve ileride araçlar aynı kodu çağırır.
- **Araçlar/Depolama** (`src/storage.rs`, `src/tools/`): disk, ağ, dış program. Arayüz yok.
- **Arayüz** (`src/ui.rs`): motorun durumunu çizer, tıklamayı motor çağrısına çevirir. Kural yok, disk yok.
- Katman sınırını `cv check` ölçer (`layers` denetimi): motor dosyasında pencere ya da disk kullanımı = kalır.

## Kayıt ve veri
- Tek yazıcı: geçici dosya → diske boşalt → yeniden adlandır (Windows'ta kısa yeniden deneme). Yarım dosya olmaz.
- Önce disk, sonra bellek: kayıt başarısızsa "kaydedilmemiş" kalır ve sebep sahibin baktığı yerde yazar.
- Okunamayan dosya "boş" sayılmaz: korunur (yanına kopya), varsayılanlarla üstüne yazılmaz. Yalnız "dosya yok" boş başlangıçtır.
- Dosya biçiminde `version`; biçim değişince sürüm +1 ve tek adım yükseltme. Daha yeni sürümün dosyası reddedilir, sessizce bozulmaz.
- Her kalıcı dosyanın tek sahibi var; ikinci yazıcı kaçınılmazsa diskteki hâli birleştirip yaz.
- Kapanışta kaydedilmemiş iş sorulur; çökme ya da elektrik kesintisinde en son kayıt sağlam kalır.

## Test edilebilirlik
- Motor ve depolama `cargo test` ile pencere açmadan test edilir; `--self-test` adımları motorun durumundan ve diskten ölçer, varsaymaz.
- Arayüz ince kaldıkça ekran testine az iş düşer; ekran `cv check` görüntüsüyle ve isteğe bağlı arayüzsüz egui testiyle denetlenir.

## Yasaklar
- Arayüzde iş kuralı, motorda pencere çağrısı, iki yerde aynı kural (biri eskir).
- "Şimdilik" sabit yol ya da kullanıcı adı: yollar `storage::data_dir()` (taşınabilir mod dahil) üzerinden.
