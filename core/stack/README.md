# core/stack — masaüstü yığını ve çalışan iskelet (`cv stack`)

Sahibin kararı #3 ("1-C"): varsayılan **saf Rust + egui/eframe** (gerçek tek `.exe`, hızlı açılış, çok panel de olur); uygulamanın içinde gerçek web içeriği gerekiyorsa **Rust + Tauri** (Windows'un WebView2'si). Sahibin kendi sözü ("tauri ile") her zaman varsayılandan üstündür.

| Dosya | Tek işi |
|---|---|
| `stack.js` | `suggest(istek)` (yığın + sade gerekçe), `scaffold(yığın, klasör)` (iskeleti `{{crate}}`/`{{title}}` doldurarak kopyalar; var olan dosyaya dokunmaz) |
| `templates/stacks.json` | Katalog: yığınlar, ne zaman seçilir, derleme/teslim yolu, denetim adımları; `craftLibs` ihtiyaç → crate haritası (sürüm sabit) |
| `templates/stacks/rust-egui/` | Çalışan iskelet: `engine.rs` (kurallar, pencere/disk yok) → `storage.rs` (bölünmez kayıt, taşınabilir mod, okunamayan dosyayı koruma, sürümlü biçim) → `ui.rs` (ince arayüz) + `selftest.rs` + `main.rs` |

## İskeletin verdiği (Craft Anything saha dersleri, MIT OR Apache-2.0)

- `windows_subsystem = "windows"` (konsol penceresi açılmaz), `.cargo/config.toml` `+crt-static` (Visual C++ gerekmez), sürüm profili LTO + strip.
- Windows'ta yalnız DX12; önceki açılış pencereye ulaşmadıysa (iz dosyası) yazılım çizicisi (WARP) seçilir.
- `--screenshot <png>` (odak çalmadan, arkada; ~120 kare) ve `--self-test <json>` (`create`, `save`, `reopen`, `search`; pencere açmadan, geçici klasörde) — `cv check` bunlarla geçer.
- Kayıt: önce disk sonra bellek; okunamayan kayıt boş belgeyle ezilmez, yanına kopyalanır; biçim sürümü + adım adım yükseltme.
- `cargo test` motor ve depolama testleri; Cargo `default-run` = başlatılacak program.

Doğrulandı (2026-11-21, Windows, Rust 1.99, eframe 0.37.0): `cargo build --release` → 10,7 MB tek `.exe`; `--self-test` 4/4; `--screenshot` boş olmayan 1100×720 PNG; `cv check` tur 1 GEÇTİ, tur 2 "değişmedi".
