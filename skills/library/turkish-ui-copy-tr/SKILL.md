---
name: turkish-ui-copy-tr
description: Türkçe uygulama arayüzü metni yazarken doğal dil, okunabilirlik, tutarlı terminoloji ve yerelleştirmeyi koru.
---

# Türkçe UI Metni ve Yerelleştirme

- Buton metnini kısa ve eylem odaklı yaz: kullanıcının ne olacağını anlamasını sağla. “Gönder”, “Kaydet”, “Devam et” gibi fiil kullan; belirsiz “Tamam”ı yalnızca gerçekten onaylama gereken yerde kullan.
- Hata mesajında ne olduğunu, nedenini biliniyorsa nedenini ve sonraki adımı anlat. Kullanıcıyı suçlama.
- Menü, sayfa başlığı, bildirim ve boş durumlarda aynı kavram için aynı terimi kullan. Teknik terminoloji gerekiyorsa sade Türkçe açıklamayla destekle.
- Türkçe karakterleri doğru kullan: `İ/ı`, `Ş/ş`, `Ğ/ğ`, `Ç/ç`, `Ö/ö`, `Ü/ü`. Büyük/küçük harf dönüşümü ve arama davranışını Türkçe locale ile test et.
- Tarih, sayı, para birimi ve saat biçimini ürünün hedef pazarı ve kullanıcının bölgesel ayarıyla uyumlu göster. Formatı kod içine sabitlemeden yerelleştirme imkânı bırak.
- Metni sabit genişlikli kutuya sığdırmak için anlamı bozma veya yazıyı aşırı küçültme. Daha uzun çeviri, zoom ve kullanıcı metin boyutu tercihlerini test et.
- Ürün dili belirlenmemişse samimi/resmî tonu bağlama göre seç ve tutarlı tut. Cinsiyet, yaş veya beceri hakkında gereksiz varsayım yapma.
- Gizlilik, fiyat, izin veya güvenlik kararlarında açıklığı estetikten üstün tut.
- Türkçe metni gerçekçi uzunlukta örnekle; yalnızca kısa İngilizce placeholder ile tasarım kararını doğrulama.

Teslim öncesi başlıkları, butonları, boş/hata durumlarını ve bildirimleri baştan sona oku. Makine çevirisi gibi duran, bir ekranda farklı terim kullanan veya eylemin sonucunu saklayan metinleri düzelt.