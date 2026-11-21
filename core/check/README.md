# core/check — masaüstü uygulama denetimi (`cv check`)

Yazılan masaüstü programının **gerçekten açıldığını, bir şey çizdiğini ve asıl işini yaptığını** model jetonu harcamadan, sayıyla gösterir. Ölçüt ve uyarlama kaynağı: Craft Anything `crates/ai/src/rebuild/` (MIT OR Apache-2.0; `THIRD_PARTY_NOTICES.md`).

| Dosya | Tek işi |
|---|---|
| `check.js` | Tur koşucusu: derle → programı bul → `--screenshot` ya da konsol koşuları → `--self-test` → `check.json`; değişmeyen geçmiş turu yeniden kullanır |
| `pe.js` | `.exe`nin içe aktarma tablosu (PE32/PE32+): hangi DLL'leri istiyor, hangileri Windows'ta yok (tek dosya kontrolü) |
| `program.js` | Hangi program başlatılır: `check.program` → `finalForm.deliverable` → Cargo (`default-run`, pencere kütüphanesi kullanan paket, kök paket); en yeni dosya değil |
| `selftest.js` | `--self-test` ve `--screenshot` sözleşme metinleri; rapor okuma ve hüküm (istenen adımlar + uygulamanın kendi adımları) |
| `image.js` | Küçültme, boş ekran (tek renk), SSIM benzerliği, referansa en yakın görüntü, kare farkı (`diffShare`) |
| `png.js` | Bağımlılıksız PNG okuma/yazma (`node:zlib`) |

## Sözleşme (uygulamanın vermesi gereken)

- `--screenshot <dosya.png>`: normal açıl, ~120 kare çiz, pencere görüntüsünü PNG kaydet, çık. Odak çalma (egui: `with_active(false)`, Windows'ta `WindowLevel::AlwaysOnBottom`). İki ek koşu ortam değişkeni verir: `CV_SHOT_FRAMES` (kare sayısı, varsayılan 120) ve `CV_SHOT_SIZE` (`800x560` gibi iç boyut) — tek resim her karede büyüyen yerleşimi göstermez.
- `--self-test <dosya.json>`: kendini betikli girdiyle sür, her adımı kendi durumundan ölç, `{"version":1,"steps":[{"step","passed","detail"}]}` kaydet, çık. İstenen adımlar `check.selfTest.steps` (ör. not uygulaması: `create`, `save`, `reopen`, `search`).
- Metinler: `cv check contract` (tarife ve M4 şablonlarına girer).

## Kapı (ERRATA E4/E7)

- **Kapı sayıdır:** derleme geçti, program başladı, görüntü boş değil, yerleşim 120. ve 360. karede aynı (`diffShare` <= 0.03), dar pencerede (800x560) de çiziyor, self-test adımlarının hepsi geçti; konsol programında `--help`/`--version` çıkış 0 ve çıktı var (her vaka iki kez koşulur, farklı çıktı işaretlenir).
- **Tek dosya:** program `.exe` ise içe aktarma tablosu okunur; Windows'un taşımadığı bir DLL istiyorsa (ör. `libunwind.dll`) tur kalır ve not çözümü söyler: statik C çalışma zamanıyla derle (Rust: `-C target-feature=+crt-static`). DLL'ler `.exe`nin yanındaysa program açılır ama tek dosya değildir; not bunu söyler.
- Referans görüntüye benzerlik (`references/shots/*.png`, 0–100) yalnız `check.referenceGate` verilmişse kapıdır ("şunu yeniden kur"); yeni fikirde yalnız not. Görüntüler modelin bakması için `artifacts` olarak listelenir; DeepSeek de görebilir, ama karar `check.json`'dadır.
- En çok 20 iddia (`claims`); kesilen liste kesildiğini söyler.

## Turlar

`.evrim/state/checks/round-<n>/check.json` = `{ version, round, at, fingerprint, program {file, why}, passed, results: [{ id, passed, note, claims: [{title, passed, detail}], artifacts, confidence: "observed", similarity? }] }`. `cv check --self` = tur 0 (çalışırken kendi bakışı, sayılmaz). Her şey geçmiş bir tur, baktığı şeyler (HEAD, çalışma ağacı içeriği, program dosyası, `check` ayarları) değişmedikçe geçerli kalır (`kept`); `--force` yeniden koşar. Başarısız tur hiç saklanmaz.

## Güvenlik

Program `cwd` = proje kökü, süre sınırlı (`runSeconds`, konsolda 8 sn), Windows'ta süreç ağacıyla öldürülür; askıda kalan geliştirme sunucusu da sınırda kesilir. Hiçbir şey yüklenmez, ağa çıkılmaz.
