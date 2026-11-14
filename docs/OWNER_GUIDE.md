# Sahibin rehberi

Bu sayfa teknik bilgi istemez. claudevolution'ı kurmak, çalıştırmak, ne yaptığını görmek ve durdurmak için gereken her şey burada.

## Bu ne işe yarıyor?

Claude bir projede çalışırken öğrendiklerini unutmasın, ucuz bir modele iş yaptırıp parayı ve limiti korusun, sen yokken (gece, okulda) kendi başına güvenle çalışsın diye kurulan bir düzen. Her projeye aynı düzen tek komutla gelir; bir projede öğrenilen genel bir ders bütün projelere geçer.

Üç şeyi bil, yeter:

1. **Sen not bırakırsın, o okur.** Projede `.evrim/otonom/NOTLAR.md` dosyası. Ne istiyorsan en alta düz cümleyle yaz.
2. **O özet bırakır, sen okursun.** `.evrim/otonom/OZET.md` dosyası. "Ne yaptın?" sorusunun cevabı hep orada, sade dille.
3. **Durdurmak tek kelime.** `NOTLAR.md`'ye tek başına bir satıra `DUR` yaz. Bir sonraki turda hiçbir şey yapmadan durur. Devam etsin istediğinde o satırı sil.

## Kurulum (bir kez)

1. Bilgisayarda **Node** ya da **Deno** kurulu olmalı (biri yeter) ve paket bir kez indirilmiş olmalı (`git clone https://github.com/RobloxPro1453/claudevolution`).
2. Claude'a proje klasöründe şunu yaz: **"claudevolution kurulumunu yap"**. Claude `cv init` komutunu çalıştırır, eksik belgeleri ekler, var olan hiçbir dosyanı ezmez (farklıysa yanına `.new` uzantılı bir kopya bırakır).
3. Sonra Claude seninle projenin hedefini (VISION) konuşarak doldurur.

Var olan, kendi düzeni olan bir projede önce **plan** çıkar: Claude'a "adopt planını göster" de. Plan, hangi dosyanın nereye gideceğini listeler; sen onaylamadan hiçbir şey değişmez.

## Bilgisayar ayarları (gece çalışacaksa)

Claude'a "doctor çalıştır" de; eksik olanı sana tek tek söyler. Elle yapman gerekenler:

- **Uyku: Hiçbir zaman** (prize takılıyken). Ayarlar → Sistem → Güç → Ekran ve uyku. Ekranın kararması sorun değil.
- **Kapak kapanınca: Hiçbir şey yapma.** Denetim Masası → Güç Seçenekleri → Kapağı kapatınca ne olsun. (Önceki gece durmasının sebebi buydu.)
- **Prize takılı** olsun.
- **Windows Update'i duraklat** (gece yeniden başlatmasın).
- Claude uygulaması **açık** kalsın; izin modu **Otomatik** olsun. İlk 10 dakika başında ol: bir izin penceresi çıkarsa döngü onu beklerken kilitlenir.

## Başlatma

Claude masaüstü uygulamasında bir **zamanlanmış görev** kur (Claude'a "otonom döngüyü zamanlanmış görev olarak kur" demen yeterli). Her 30 dakikada temiz bir oturum açar, bir iş adımı yapar, kaydeder, kapanır. Oturum kapansa da, bilgisayar yeniden başlasa da görev durmaz; uygulama açıldığında devam eder.

## "Ne yaptın?" — nereye bakmalı

| Merak ettiğin | Bak |
|---|---|
| Kısaca ne oldu | `.evrim/otonom/OZET.md` |
| Sana sorduğu sorular | `.evrim/otonom/SORULAR.md` — cevabını sorunun altına yaz. Cevap beklemez; o sırada en güvenli seçenekle devam eder. |
| Tur tur ne yaptığı | `.evrim/otonom/GUNLUK.md` (en altta en yeni) |
| Öğrendiği dersler | `.evrim/otonom/DERSLER.md` |
| Proje ne durumda | Claude'a "durum" yaz |

## Döngü çalışıyor mu, öldü mü?

Claude'a **"durum"** yaz. Cevapta "Otonom" bölümüne bak:

- **Kilit tutuluyor, birkaç dakika önce:** şu an çalışıyor.
- **Kilit yok, son çevrim yarım saat içinde:** uyuyor, sıradaki turu bekliyor. Normal.
- **Son çevrim saatler önce:** büyük ihtimalle limit doldu; limit sıfırlanınca kendisi devam eder. Bir şey yapman gerekmez.
- **Kilit 90 dakikadan eski:** bir tur yarıda kalmış. Sonraki tur bunu fark edip kendisi toparlar ("KURTARMA" diye yazar).

Kendi kendine durduğu durumlar (hepsi bilerek):

- Limit %85'e gelince yeni iş başlatmaz, %90'da çıkar. Limit tamamen biterse bir daha uyanamazdı; bu yüzden erken durur.
- Haftalık limitin, haftanın geçen kısmına göre bir tavanı var (haftanın başında daha az harcar).
- Aynı hatayı 3 kez yaparsa o işi geri alır, atlar ve sana yazar.
- İki tur üst üste bir şey üretemezse yaklaşımını değiştirir; üç turda uyur.

## Durdurmak

- **Nazikçe:** `NOTLAR.md`'ye `DUR`. O an çalışan adım biter; bir sonraki tur hiç başlamaz.
- **Hemen:** Claude uygulamasında zamanlanmış görevi kapat.
- **Bir işi öne almak:** `NOTLAR.md`'ye `ÖNCE: <yapılacak iş>`.

İtirazların ("bunu beğenmedim", "bunu yapma") sayılır: sistem hangi değişikliğin işe yaramadığını bunlardan da öğrenir.

## Para ve limit

- Kodun çoğunu ucuz model yazar; günlük bir harcama sınırı vardır (`.evrim/config.json` içinde `dailyBudget`, dolar). Sınır dolunca yeni iş başlatmaz.
- Ucuz modelin anahtarı **yalnız bilgisayarın ortam değişkeninde** durur; hiçbir dosyaya yazılmaz. Anahtarı kimseyle, hiçbir sohbette paylaşma.
- Pahalı saatlerde (hafta içi bazı sabah saatleri) ucuz model iş başlatmaz, bekler.

## Güvenlik sözleri

- Var olan dosyalarını ezmez; silmez. Emin olmadığı her şeyde en geri alınabilir yolu seçer ve kararını yazar.
- Projenin kodunu internete göndermez (push yok). Tek istisna paketin kendisi: her projede işe yarayacak bir ders öğrenince onu ölçüp paketin GitHub deposuna gönderir; kişisel bilgi, yol, anahtar taramadan geçemez.
- Ucuz model bazı dosyalara hiç yazamaz (kurallar, vizyon, gizli klasörler); bu liste yalnız senin sözünle değişir.

## Sık sorulanlar

**Bilgisayar gece açık kaldı, zarar verir mi?** Hayır; ekran kararır, fanlar normal çalışır. Tedirgin olursan `DUR` yaz.

**Ertesi sabah ilk ne yapayım?** `OZET.md`'yi oku, `SORULAR.md`'de soru varsa cevapla. Bu kadar.

**Bir şeyi beğenmedim, geri alınır mı?** Her adım ayrı kaydedilir (commit). Claude'a "dün geceki şu değişikliği geri al" demen yeter.
