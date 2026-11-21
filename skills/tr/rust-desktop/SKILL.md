---
name: rust-desktop
description: Rust masaüstü uygulamasını kurulumsuz çift-tık tek .exe olarak kurma, derleme, denetleme ve teslim etme kuralları (egui varsayılan, Tauri yalnız web içeriği gerekirse); yalnız Rust masaüstü projesinde yüklenir.
---

Kaynak: Craft Anything `pitfalls.md` "Building and running" + `packaging/windows/` (MIT OR Apache-2.0). İskelet bunların çoğunu zaten içerir: `cv stack new rust-egui --name "<ad>"`.

## Başlangıç
- Yığın: `cv stack suggest "<istek>"` (sahibin sözü varsayılandan üstün). Varsayılan egui; Tauri yalnız uygulamanın içinde gerçek web içeriği gerekiyorsa (WebView2; yoksa tek onayla kurulur).
- Çok panelli/sekmeli düzen gerekiyorsa `templates/stacks.json` > `craftLibs` haritası (craft-ui docking vb.); sürüm **sabitlenir** (`tag` ya da tam `rev`), `main` izlenmez, önce deneme projesinde `cargo check`.

## Tek .exe ve açılış
- `windows_subsystem = "windows"` (konsol penceresi yok), `+crt-static` (Visual C++ gerekmez), sürüm profili LTO + strip.
- Windows'ta yalnız DX12; GL/Vulkan'ı başlatmak bile eski Intel sürücülerinde açılışta sessiz çöküş yaptı. Önceki açılış pencereye ulaşmadıysa yazılım çizicisi (WARP).
- Alt süreç açılıyorsa konsol penceresi çıkmasın (`CREATE_NO_WINDOW`).
- Taşınabilir mod: exe'nin yanında `portable.txt` varsa veri yanındaki `data/` klasöründe.

## Derleme ve deneme
- API'yi tahmin etme: kullandığın sürümün kaynağını oku (`~/.cargo/registry/src/*/egui-<sürüm>/`); sürüm değişikliklerinde yöntem adları kayar.
- Çalışan exe yeniden derlenemez ("Access is denied"): denerken programı kapat ya da ayrı `CARGO_TARGET_DIR`.
- Başlatılacak program `Cargo.toml` `default-run` ile bildirilir; `target/` içindeki en yeni dosya uygulama değildir.
- Her turda `cargo test` (motor, depolama) + `cv check` (pencere çiziyor mu, `--self-test` adımları). `cv check` geçmeden "bitti" denmez.
- Uzun girdiler komut satırıyla değil dosyayla (Windows 32.767 karakter sınırı); Windows yolları `\` ile.

## Teslim (sahibe)
- `cargo build --release` → `target/release/<ad>.exe` (bu yol `finalForm.deliverable`).
- "Tek exe" sözü denetlenir: `cv check` `single-exe` adımı exe'nin istediği DLL'leri okur; Windows'la gelmeyen bir DLL (ör. MinGW araç zincirinde `libunwind.dll`) varsa kalır. Çözüm statik C çalışma zamanı (`.cargo/config.toml` içinde `-C target-feature=+crt-static`).
- İmzasız exe'de Windows SmartScreen uyarır: teslim notunda sade dille "Ek bilgi → Yine de çalıştır" yazılır; kod imzalama isteğe bağlıdır.
- Teslim notu: ne yapıldı, nasıl açılır, verinin nerede durduğu, taşınabilir mod; teknik terim yok.
