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

## Maket onayı (kod yazmadan önce)
1. `cv stack new <yığın> --name "<ad>"` iskeleti; ekranlar içi boş ama düzen gerçek (1-2 dk).
2. `cv check --self` → ekran görüntüsü (`.evrim/state/checks/round-0/screenshot.png`); önce kendin bak.
3. Görüntüyü `docs/INTENT.md` "Anladığım şu" özetiyle **birlikte** sahibe göster; tek seferde düzeltsin.
