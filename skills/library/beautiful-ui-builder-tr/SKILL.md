---
name: beautiful-ui-builder-tr
description: Yeni uygulama ekranı veya web UI üretirken önce ürün-bağlamlı görsel yön, hiyerarşi ve tasarım sistemi tanımla; sonra kodla ve tasarımı eleştirel biçimde kontrol et.
---

# Ürün Odaklı UI Üretimi

Bu skill, arayüz kodlamadan önce tasarım kararlarını görünür kılar. Kullanıcı yalnızca kod istemiş olsa bile kısa bir iç brief hazırla; gereksiz uzun planı kullanıcıya dökme. Mevcut kod, marka, framework ve bileşenleri koru.

## 1. Ürün brief'i

Kod yazmadan önce şu bilgileri mevcut bağlamdan çıkar: hedef kullanıcı, en önemli görev, ana ekran/akış, marka/ürün karakteri, cihazlar, framework ve hazır varlıklar. Kritik bilgi eksikse bir makul varsayım yap ve bunu açıkça belirt; küçük belirsizliklerde işi durdurup soru sorma.

## 2. Görsel konsept seç

- Ürünün amacına uyan bir görsel yön seç; bunu 2–3 sıfat ve somut uygulama kararlarıyla açıkla.
- Başlangıç olarak genel bir template, dashboard kartları, neon gradient, cam efekti, rastgele büyük başlık veya emoji ikonu seçme. Bunları ancak brief haklı çıkarıyorsa kullan.
- Renk, yazı tipi, yoğunluk, grid, yüzey ve ikon dili ürünün mesajıyla uyumlu olsun.
- Referans yoksa ürüne özgü bir düzen ve renk sistemi kur. Sırf “modern” görünsün diye bütün projelere aynı görsel imzayı uygulama.

## 3. Önce sistem, sonra ekran

Az sayıda tasarım token'ı belirle: renk rolleri, tipografi ölçeği, boşluk basamakları, köşe/çizgi, yüzey ve katman. Ana bileşenleri (buton, alan, navigasyon, kart gerekiyorsa) aynı kurallara bağla. İsimlendirme ve bileşen yapısını mevcut teknoloji yığınına uyarla; gereksiz bağımlılık ekleme.

## 4. Hiyerarşiyi çöz

Ekranın tek bir ana amacını belirle. Kullanıcı neye önce bakmalı, neyi sonra yapmalı? Başlık, ana içerik ve birincil eylem bu sırayı desteklesin. İkincil eylemleri ayrıştır; kritik bilgiyi yalnızca hover, tooltip veya renk içine saklama. İlgili öğeleri grupla ve göz için nefes alanı bırak.

## 5. Gerçek durumları tasarla

Yalnızca mutlu yolun statik görüntüsünü üretme. Akışa göre boş, yükleniyor, devam ediyor, başarı, hata, devre dışı, seçim, doğrulama ve küçük ekran durumlarını belirle. Formlarda hata ve yardım metnini; listelerde boş veri ve yoğun veri durumlarını; istek yapan aksiyonlarda geri bildirim ve tekrar deneme yolunu ekle.

## 6. Uygula

Önce var olan projeyi ve tasarım sistemi kurallarını incele. Tamamen yeni görsel yön istenmedikçe çalışan akışları, içerik hiyerarşisini ve kullanıcı beklentilerini koru. Temiz semantik yapı, erişilebilir etiket, klavye odağı, doğru responsive davranış ve işlevsel durumlar üret. Sahte metin, anlamsız lorem ipsum ve tekrar eden dekoratif kartlarla ekranı doldurma.

## 7. Kontrol et ve geliştir

Mümkünse uygulamayı çalıştırıp gerçek viewport'ta gör. En az bir geniş, bir dar görünüm kontrol et. Tasarımın ilk odak noktasını, boşluk ritmini, hizayı, kontrastı, metin kırılımını, taşmaları ve etkileşim feedback'ini gözden geçir. Birinci öncelikli 1–3 problemi düzelt; sonrasında gereksiz yeniden tasarım yapma.

Kendi sonucuna şu soruları sor:

- Arayüz kime ve ne işe yarıyor, ilk bakışta anlaşılıyor mu?
- Görsel yön ürüne özgü mü, yoksa jenerik üreteç şablonu mu?
- Her öğenin amacı var mı? Birincil işlev en belirgin mi?
- Mobilde düzen yeniden düşünülmüş mü?
- İşlev, erişilebilirlik ve tüm temel durumlar mevcut mu?

## Çıktı

İstenen kodu teslim et. Kısa notta önemli varsayımı ve tamamlanan görünüm/durum kontrollerini belirt. Görmediğin veya çalıştırmadığın şeyi test edilmiş gibi sunma.