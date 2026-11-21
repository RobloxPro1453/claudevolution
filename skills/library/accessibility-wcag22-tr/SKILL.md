---
name: accessibility-wcag22-tr
description: Web/app arayüzü tasarlarken erişilebilirlik gereksinimlerini erkenden düşün ve WCAG 2.2 tabanlı ilk geçiş kontrolü yap.
---

# Erişilebilir UI İlk Geçişi

Bu skill tasarım ve kod incelemesinde ilk geçiş kontrolü içindir; tek başına WCAG uygunluk sertifikası veya tam erişilebilirlik denetimi değildir. Normatif ölçütler için [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/) kaynağına başvur. Gereksinimleri ürün türü, yargı alanı ve kullanıcılarla doğrula.

## Tasarım ve uygulama kontrolü

- **Algılanabilir içerik:** Metin/arka plan kontrastını ilgili WCAG başarı ölçütüne göre ölç. Büyük metin, kontrol sınırları ve grafikler için doğru ölçütü seç. Bilgiyi sadece renkle aktarma; durum, grafik ve hata mesajlarına metinsel veya yapısal karşılık ekle.
- **Yazı ve yeniden boyutlandırma:** Metin yakınlaştırıldığında, satır/yazı/harf boşluğu arttığında içerik ve işlev kaybolmamalı. Dar ekranda yatay kaydırma gereksinimini kritik akışlarda azalt.
- **Görsel olmayan alternatif:** Anlamlı görsellerin amacını açıklayan alternatif metin planla; dekoratif görsellerin ekran okuyucuya gereksiz gürültü eklememesini sağla. Grafik ve ikonların anlamını sadece şekle bırakma.
- **Klavye:** Tüm işlevler klavyeyle kullanılabilmeli. Görünür, mantıklı odak sırası ve belirgin odak göstergesi sağla. Odak, sabit başlık/altlık veya modal katmanlarının altında kalmamalı.
- **Hedefler:** Küçük ekranlarda dokunma hedeflerini yeterince büyük ve birbirinden ayrık tut. WCAG 2.2 AA hedef boyutu ölçütünü ve istisnalarını doğrudan W3C'den kontrol et; bütün durumlara tek bir ölçü kuralı uygulama.
- **Hareket ve yanıp sönme:** Hareketi bilgi için zorunlu yapma. Hareket azaltma tercihini destekle, otomatik hareketi kontrol edilebilir kıl ve zararlı yanıp sönmeden kaçın.
- **Formlar:** Alanlara programatik/semantik etiket bağla; zorunlu alanı ve biçimi önceden açıkla. Hataları alanla ilişkilendir, metinle açıkla ve düzeltme yolunu belirt. Yalnızca renk veya placeholder ile etiketleme yapma.
- **Zaman ve kimlik doğrulama:** Süre sınırı, yeniden kimlik doğrulama ve doğrulamayı zorlaştıran bilişsel testlerde kullanıcıya yeterli alternatif/uzatma imkânı sağla. İlgili WCAG ölçütlerini ürün güvenlik ekibiyle birlikte değerlendir.
- **Durum ve duyuru:** Yükleme, hata, başarı ve sonuç güncellemeleri görsel olarak görünür olsun; teknolojide semantik duyurular da sağla. Ekran okuyucu davranışını gerçek yardımcı teknolojiyle test et.
- **Dil ve yön:** Sayfa ve parça bazında doğru dil işaretlemesi kullan. Türkçe harfleri, tarih/sayı/fiyat biçimlerini ve metin büyümesini kontrol et.

## Test rutini

1. Sadece fare değil, klavye ile ana akışı tamamla.
2. Tarayıcı yakınlaştırması ve dar ekranla içeriği kontrol et.
3. Kontrastı araçla ölç; renk algısının farklı olduğu senaryoda durumu yine de anla.
4. Form, modal, menü, toast, hata, boş ve yükleme durumlarını dene.
5. En az bir ekran okuyucu ve mobil yardımcı teknolojiyle kritik akışı test etmeyi öner.
6. Otomatik taramaları kullan; fakat otomatik araçların gerçek kullanım testinin ve uzman incelemesinin yerine geçmediğini belirt.

## Raporlama

Her bulguda ilgili WCAG ölçüt numarasını yalnızca doğrulayabildiğinde yaz. **Kritiklik, kullanıcı etkisi, örnek konum, düzeltme ve doğrulama adımı** ver. Görselden veya kaynak kodundan doğrulanamayan durumu “test edilmedi” olarak işaretle. “WCAG uyumlu” iddiasını yalnızca kapsamlı doğrulama varsa kullan.