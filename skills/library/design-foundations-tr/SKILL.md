---
name: design-foundations-tr
description: Uygulama arayüzü üretirken görsel hiyerarşi, tipografi, boşluk, renk, grid ve tutarlı tasarım dili kur. Yeni UI tasarlama veya mevcut görünümü iyileştirme isteklerinde kullan.
---

# Temel Görsel Tasarım

Bu skill'i arayüz kodlamadan önce veya görsel kaliteyi iyileştirirken uygula. Hedef “daha süslü” görünmek değil; ürünün amacını açık, güvenilir, tutarlı ve kolay taranabilir biçimde anlatmaktır.

## Önce yönü tanımla

Kod yazmadan önce şu kısa tasarım kararlarını ver:

1. Ürünün işi ve kullanıcının en önemli görevi nedir?
2. Hangi tek görsel karakter ürüne uygun? Örnek: sakin/uzman, sıcak/oyuncu, editoryal/entelektüel, teknik/yoğun. İki-üç sıfat seç.
3. Bu karakteri taşıyan renk, tipografi, yüzey, yoğunluk ve şekil kararları nelerdir?
4. Kullanıcı ilk bakışta neyi fark etmeli ve sonraki adım ne olmalı?

Mevcut ürünün markası, bileşen kütüphanesi veya kullanıcı talebi varsa onları koru. Bir görsel referanstan yalnızca istenen boyutu (ör. düzen, renk, tipografi) al; sayfayı körü körüne kopyalama.

## Hiyerarşi ve yerleşim

- Her ekranda bir birincil görev ve görsel odak seç. Ekrandaki tüm öğeleri aynı ağırlıkta gösterme.
- Başlık, yardımcı açıklama, ana içerik ve eylem arasında belirgin önem farkı kur. Boyut tek hiyerarşi aracı değildir; ağırlık, renk, konum, boşluk ve gruplanma da kullanılır.
- İlgili öğeleri yakın, ilgisiz öğeleri daha ayrı yerleştir. Hizalama ve tekrar, kullanıcıya hangi içeriğin birlikte çalıştığını anlatmalıdır.
- Büyük ekranlarda okunabilir bir içerik genişliği ve açık kolon/grid mantığı kur. Mobilde sırayı ve önceliği yeniden düzenle; masaüstü düzenini yalnızca daraltma.
- Boş alanı “eksik içerik” sayma. Grupları ayırmak, odağı güçlendirmek ve okunabilirliği artırmak için kullan.
- Her bölüm için bir baskın işlev tanımla. Kartları ancak içerik veya etkileşim gerçekten ayrı bir yüzey gerektiriyorsa kullan.

## Tipografi

- En fazla iki aileyle başla: birincil arayüz/yazı tipi ve gerekiyorsa belirgin başlık ailesi. Üründe zaten font varsa onu tercih et.
- Ölçek oluştur: küçük meta, gövde, bölüm başlığı, sayfa başlığı gibi anlamlı seviyeler. Rastgele boyutlar kullanma.
- Gövde metnini rahat okunur tut; satır uzunluğu ve satır aralığını metin yoğunluğuna göre ayarla.
- Türkçe `İ/ı`, `Ş/ş`, `Ğ/ğ`, `Ç/ç`, `Ö/ö`, `Ü/ü` gliflerini kontrol et. Gerçekçi Türkçe metinle satır kırılımını dene.
- Çok ince font ağırlıklarından ve küçük düşük-kontrast metinden kaçın. Sadece caps-lock ile hiyerarşi kurma.

## Renk ve yüzey

- Önce nötr yüzeyleri ve metin renklerini, sonra marka/eylem rengini tanımla. Durum renklerini (başarı, uyarı, hata, bilgi) marka rengiyle karıştırma.
- Rengi yalnızca önem veya durum taşıdığı yerde kullan. Aynı rengin aynı anlama gelmesini koru.
- Metin ve kontrollerde kontrastı doğrula. Anlamı yalnızca renge bağlama; ikon, etiket veya metinle de belirt.
- Gölge, blur, gradient, glow ve cam efekti için somut gerekçe yoksa ekleme. Her alana gradient, her bilgiye kart, her köşeye aşırı yuvarlaklık verme.
- Gerçek marka varlıkları mevcutsa uydurma logo veya rastgele illüstrasyon üretme.

## Tutarlılık

- Renk, boşluk, köşe yarıçapı, gölge, çizgi ve tipografi için az sayıda token tanımla; bileşenlerde aynı kararları kullan.
- Benzer işler benzer görünmeli. Farklı davranışlar ise görsel olarak ayırt edilebilir olmalı.
- Bileşen çeşidini gereksiz artırma. Tekrarlanan kalıp varsa ortaklaştır, ancak içeriği farklı iki şeyi sırf benziyor diye aynı bileşene zorlama.
- Görsel stil kararlarını ürünün tüm ekranlarında devam ettir; yalnızca hero alanını tasarlayıp geri kalanını varsayılan bırakma.

## Teslim öncesi kontrol

- İlk birkaç saniyede kullanıcı sayfanın ne yaptığını ve ilk adımını anlıyor mu?
- En önemli şey gerçekten en belirgin şey mi?
- Başlık, metin, kontroller ve boşluklar birlikte bir ritim oluşturuyor mu?
- Mobil/dar görünümde taşma, kırpılma veya kaybolan birincil eylem var mı?
- Kontrol edilmemiş rastgele renk, font, ikon veya efekt kaldı mı?
- Sayfa şablon hissi veriyorsa, ürüne özgü hangi bilgi veya görsel kararı bunu değiştirebilir?

Bir ekranı iyileştirirken önce en etkili 1–3 sorunu düzelt. İşlevsel olarak doğru olanı, kullanıcı talebi olmadan yeniden tasarlama.