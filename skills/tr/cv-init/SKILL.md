---
name: cv-init
description: claudevolution'ı bir projeye konuşarak kurar ya da kurulumu tamamlar - iskeleti kurar, yapılandırmayı sahibiyle doğrular, VISION'ı sahibinin sözleriyle doldurur, gözetimsiz çalışma önkoşullarını sade dille anlatır. Sahibi "claudevolution kur", "projeyi kur", "vizyonu dolduralım" dediğinde.
---

# Konuşarak kurulum

Sahibi teknik bilmeyebilir. Kısa cümleler, her seferinde tek soru, seçenekli sor. Cevabı kendi cümleleriyle yaz; uydurma.

`cv` = `.evrim\cv.cmd` (Windows) ya da `.evrim/cv`. İskelet henüz yoksa paketteki `bin/cv` ile çalıştır (sahibi yolu söyler ya da `CV_HOME` ortam değişkeninde durur).

## 1. İskelet

`.evrim/config.json` yoksa: `cv init --name <ad>` (var olan dosyayı ezmez; çakışanın yanına `.new` bırakır). Çıktıdaki `.new` dosyalarını sahibine söyle: "Sende zaten şu dosyalar vardı, dokunmadım; yenileri yanlarında duruyor."

Var olan, kendi düzeni olan bir projeyse `cv adopt` çalıştır ve üretilen eşleme planını sahibine özetle; `--apply` yalnız sahibi "uygula" derse.

## 2. Yapılandırmayı doğrula

`.evrim/config.json` içinde algılananları göster ve yalnız emin olmadıklarını sor:
- Derleme ve test komutu doğru mu? (Bir kez çalıştır; çalışmıyorsa birlikte düzeltin.)
- Kod hangi klasörlerde? (`codePaths`)
- **Ucuz modelin asla dokunmaması gereken yerler** neresi? (`forbiddenWrite`: kayıt/silme akışı, üretilmiş dosyalar, sahibinin elle yazdığı belgeler.) Emin değilsen yasakla; sonra açmak kolay, veri kaybını geri almak zor.
- Ana dal adı (`baseBranch`).

## 3. VISION

`docs.vision` şablonunu sahibiyle doldur. Sırayla, tek tek sor:
1. "Bu proje bitince ne yapabiliyor olacaksın?" → Hedef.
2. "Kim kullanacak?" → Hedef.
3. "'Bitti' demen için neler olmuş olmalı?" → Bitiş çizgisi (ölçülebilir hâle getir, sahibine onaylat).
4. "'İyi olmuş' dediğin şey neye benziyor? Örnek aldığın bir şey var mı?" → His ve kalite ölçüsü (nasıl sınanacağıyla; iş sayısı kaliteyi ölçmez).
5. "Ne olursa olsun bozulmaması gereken ne var?" → Değişmezler; aynılarını AGENTS.md > Kesin kurallar'a denetlenebilir cümlelerle yaz.

AGENTS.md'nin ilk cümlesini (proje nedir) ve "İş bölümü"ndeki kritik alanları doldur. `docs/tasks/README.md` > Project rules'a aynı kuralların ucuz model için İngilizcesini yaz.

## 4. İlk yol haritası

Hedeften 5-10 somut madde çıkar, `docs.roadmap`'e yaz, sahibine sırayı onaylat.

## 5. Gözetimsiz çalışmaya hazırlık

`cv doctor` çalıştır. Her ✗ satırı için sahibine **ne yapacağını adım adım, sade dille** söyle (hangi ayar penceresi, hangi seçenek). Ayarı sen değiştirme. Ucuz model anahtarı yoksa nasıl ekleneceğini anlat (ortam değişkeni; anahtarı sana yazmasın, sohbete yapıştırmasın).

Zamanlanmış görevi sahibi kurar; ona verilecek düz metin: **"otonom becerisini yükle ve bir çevrim yap"** (eğik çizgi komutu değil). Ayrıntı: paketteki `docs/OWNER_GUIDE.md`.

## 6. Bitir

Commit (`claudevolution kuruldu`), `docs.progress`'e tek kayıt, sahibine üç satır: ne kuruldu, şimdi ne yazarsa ne olur ("durum", "çalış"), gözetimsiz çalışma için kalan adımlar.
