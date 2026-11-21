---
name: desktop-design
description: Masaüstü uygulamanın görünüşü ve hissi - tek ölçek (yazı, boşluk, köşe, renk), iki tema, kontrast, bileşen kuralları; yalnız masaüstü uygulama projesinde (Cargo.toml'da eframe/egui/tauri ya da sahibi masaüstü program istediğinde) yüklenir.
---

Kaynak: Craft Anything `docs/design-system.md` + `pitfalls.md` "Design" (MIT OR Apache-2.0), damıtılmış.

**Önce his:** `docs/INTENT.md` > istenen his (sakin/odaklı, hızlı/pratik, profesyonel, eğlenceli) her tasarım kararını yönetir. Yoksa `cv intent "<istek>" --apply`.

## Tek ölçek (sayı ekranda yazılmaz)
- Yazı: başlık 26/18/16, gövde 15, küçük 14, etiket 13, açıklama 12; 12'nin altı yalnız yoğun listelerde. Paragraf satır yüksekliği 1.45×.
- Boşluk: 2, 4, 8, 12, 16, 24, 32 (4/8 ızgarası). Köşe: 4 (liste satırı), 6 (kontrol), 8 (kart, pencere).
- Kontrol yüksekliği: 24 (araç çubuğu), 32 (varsayılan), 40 (ana alan), 48 (ekranın tek asıl işi).
- Renkler tema jetonlarından (`canvas` < `card` < `field`); yeni sayı = ölçeğe ekleme, ekrana değil. Ekran kodunda sabit `#hex`/piksel sayısı kalmasın.

## İki tema, ölçülen kontrast
- Koyu ve açık tema birlikte; ikisinde de bak (`cv check` görüntüsü + açık tema).
- Yazı/arka plan ≥ 4.5:1, kontrol kenarı ve kaydırma çubuğu ≥ 3:1 (WCAG). Göz kararı değil hesap: tema değişince test yeniden ölçer.
- Odak halkası klavye kullanıcısı için her kontrolde görünür.

## Bileşen kuralları
- Ekranın tek asıl işi = birincil düğme; diğerleri ikincil/sessiz. Geri alınamaz iş = tehlike rengi + onay.
- Boş ekran yazısız kalmaz: "Soldan bir öğe seçin ya da yenisini ekleyin" gibi tek cümle.
- Mesajlar: onay kendiliğinden kaybolur, hata kapatılana kadar kalır; sahibin baktığı yerde görünür.
- Açılır liste en geniş satırı kadar geniş, ~9 satırdan sonra kayar.

## Donmayan arayüz
- Çizerken diskten okuma, klasör tarama yok (her karede tekrarlanır). Ağır iş arka planda, sonuç kanalla.
- egui'nin kendi `Spinner`/`ProgressBar::animate`'i her kare yeniden çizer: tempolu kendi animasyonun ya da durağan "çalışıyor" yazısı.
- Ölçüsü çizimden sonra bilinen öğe bir kare geç kalır: ölçüyü önceki kareden al.

## "X gibi olsun" dendiğinde: önce referansı çıkar
Kod yazmadan önce referansın (Obsidian, VS Code, Notion, Figma...) yerleşimini 8-10 maddeyle yaz ve ekranı ona göre kur. Örnek (Obsidian tipi not uygulaması):
- Solda ince **ikon şeridi** (dosyalar, arama, etiketler), yanında sabit genişlikli ağaç; ağaç satırı ok + ad, kutu/çerçeve yok.
- Üstte **düz sekmeler** (seçili sekme zemine kaynaşır), sekme kapatma × yalnız üstüne gelince.
- Okuma sütunu ortalı ve dar (~700 px); başlıklar ölçekli, gövde 15-16 px, satır yüksekliği 1.5.
- Düğmeler **ikon ve çerçevesiz** (üstüne gelince hafif zemin); yazılı düğme yalnız birincil iş için.
- Sağ panel (içindekiler, geri bağlantılar) katlanabilir; durum çubuğu ince ve sessiz.
- Renk: tek vurgu rengi (seçim, bağlantı); geri kalan gri tonları.

## egui'de bu ilkeler nasıl uygulanır
- Kenar panel: `SidePanel::left(..).resizable(true).default_width(250.0).width_range(180.0..=420.0)`; içindeki satırlar `ui.set_max_width(..)` ya da sabit genişlikle çizilir. Yoksa içerik paneli her karede büyütür ("sonsuza genişleyen kasa").
- Çerçevesiz düğme: `Button::new(..).frame(false)` ya da kendi `ghost` düğmen; ikonlar vektörle çizilir (`Painter` çizgi/daire) ya da gömülü ikon yazı tipiyle; emoji ve ASCII ok ("v", "<", ">") kullanma.
- Yazı tipi: Windows'ta sistem yazı tipini yükle (Segoe UI gövde, Consolas kod); Türkçe harfleri dene.
- Uzun metin `LayoutJob` ile sarılır; `ui.horizontal` içindeki etiket sarılmaz, taşar.
- Yerleşik tasarım becerileri (paket içinde, ihtiyaçta oku): `design-foundations-tr`, `beautiful-ui-builder-tr`, `ui-design-review-tr`, `frontend-design-anthropic`.

## Ölçütlü öz-denetim (göz kararı yok)
`cv check --self` görüntüsünü (ve dar pencere görüntüsünü) yukarıdaki referans maddelerine karşı **madde madde evet/hayır** puanla; sonuca yalnız sayıyı yaz ("10 maddeden 8'i"). "Neredeyse kusursuz", "harika görünüyor" gibi serbest yargı yazılmaz. Mümkünse puanlamayı ayrı bir inceleyici (alt ajan / ucuz model) yapar: kendi işini kendin notlama.

Sahibi bir görsel hata bildirince önce **hatayı yeniden üret** (pencereyi büyüt/küçült, birkaç saniye bekle, tıkla); "bende görünmüyor" deyip sahibi yanlışlama.

## Maket (yalnız belirsiz istekte)
Somut iş istendiyse maket yapılmaz; ilk teslim çalışan dilimdir (`cv-init` §0b). İstek belirsizse ve sahibi görünüş seçecekse: iskelet + uydurma örnek veri, görüntü ve "Anladığım şu" birlikte gösterilir; maket asla teslim diye sunulmaz.
