---
name: damit
description: Evrim adımı - projenin yeni derslerini sınıflar, genel olanları claudevolution paketine (evrensel dersler ya da doğrudan beceri/şablon metni) taşır, her değişikliği ölçü hipoteziyle kaydeder ve önceki değişiklikleri ölçüp kötüleşeni geri alır. Otonom çevrim "DAMITMA: evet" dediğinde ya da sahibi "damıt" dediğinde çalışır.
---

# Damıtma

Amaç: bu projede pahalıya öğrenilen şey bir sonraki projede bedava gelsin; ama pakete çöp de girmesin. Bütçe: toplam kotanın en çok %10'u (`evolution.distillQuotaShare`); tek çevrim.

`cv` = `.evrim\cv.cmd` (Windows) ya da `.evrim/cv`. Paketin yeri `cv distill` çıktısının ilk satırındadır (`PAKET: <yol>`); aşağıda `<paket>` diye anılır.

## 1. Topla

`cv distill` çalıştır. Çıktı:
- **Yeni yerel dersler** (son damıtmadan beri `DERSLER.md`'ye eklenenler; etiketleriyle),
- **Evrensel adaylar** (`[evrensel]` etiketli ya da etiketsiz olup proje adı/yolu içermeyenler),
- **Ölçüler** (son turlar ve çevrimler: biten iş başına kota, ucuz model ilk-denemede-bitti oranı, boşa çevrim sayısı, sahibinin itiraz sayısı),
- **Bekleyen evrim değişiklikleri** (`<paket>/evolution/CHANGELOG.md` içinde sonucu "bekliyor" olanlar ve ölçülme zamanı gelenler).

## 2. Seçilim (önce eskileri ölç)

Ölçülme zamanı gelen her "bekliyor" kaydı için, kaydın kendi ölçüsünü önceki değerle karşılaştır:
- İyileşti ya da değişmedi → sonucu `tuttu` yap.
- Kötüleşti → değişikliği **geri al** (kaydın gösterdiği dosyada eski metne dön), sonucu `geri alındı` yap, nedenini tek cümleyle yaz.
- Veri yetersiz (K çevrim dolmadı ya da ölçü hiç oluşmadı) → dokunma.

Tek ölçümle karar verme: fark küçükse (%10'dan az) `tuttu` say; gürültüyü evrim sanma.

## 3. Sınıfla

Her yeni ders için tek soru: **"Bu, başka bir projede de aynen olur muydu?"**

| Sınıf | Belirti | Nereye |
|---|---|---|
| Yerel | Projenin dosya adı, aracı, ürünü geçiyor; başka projede anlamsız | Olduğu yerde kalır (`[yerel]` etiketi) |
| Evrensel ders | Araçla, kotayla, git'le, ucuz modelle, sahibiyle iletişimle ilgili; proje adı çıkarılınca hâlâ doğru | `<paket>/evolution/universal/DERSLER.md` (tek satır, kaynak proje ve tarih parantezde) |
| Evrensel kural | Aynı ders ikinci kez (başka projede ya da 2+ kez burada) çıktı, ya da ders "her zaman şunu yap" biçiminde | Doğrudan ilgili **beceri ya da şablon metnine** (`<paket>/skills/...`, `<paket>/templates/project/...`); DERSLER'den silinir |
| Tekrar eden hata kalıbı | Belirti → neden → çözüm üçlüsü net | `<paket>/evolution/universal/HATALAR.md` |

Emin değilsen yerel bırak; bir sonraki damıtma yeniden bakar.

## 4. Koruma (pazarlıksız)

Evrensel değişiklik:
- **Hiçbir projenin kuralını gevşetemez.** `forbiddenWrite`, veri kaybı kuralları, kota eşikleri ve "Asla" listeleri yalnız sıkılaştırılabilir. Gevşetme önerisi `SORULAR.md`'ye sahibine yazılır, uygulanmaz.
- Proje adı, yolu, kişisel bilgi, anahtar içeremez. Taşımadan önce dersi genelleştir (proje adını "proje", aracı türüyle yaz).
- Küçük olmalı: bir damıtmada en çok 5 taşıma; bir beceri metninde tek seferde en çok bir paragraf.
- Paket git deposuysa değişikliği orada ayrı commit'le (`evrim: <özet>`); push yok.

## 5. Kaydet

Her taşıma için `<paket>/evolution/CHANGELOG.md`'ye tek satır:

`- <tarih> · <değişiklik: hangi dosya, ne eklendi/değişti> · beklenen etki: <ne düzelecek> · ölçü: <hangisi, şimdiki değeri> · K=<çevrim> · sonuç: bekliyor`

Ölçü şu dörtten biri olmalı ve şimdiki değeri `cv distill` çıktısından alınmalı: `is-basina-kota`, `ilk-deneme-orani`, `bosa-cevrim`, `sahip-itirazi`. Ölçüsü olmayan değişiklik yapılmaz.

Sonra:
1. Yerelde taşınan dersleri `DERSLER.md`'den sil (evrensel kural olduysa) ya da `[evrensel→taşındı]` diye işaretle.
2. `DERSLER.md` 40 satırı geçtiyse benzerleri birleştir, eskimişi sil.
3. `cv distill --mark` (damıtma zamanını ve işlenen dersleri kaydeder).
4. Bu projede commit (`evrim: damıtma <tarih>`); OZET'e sade iki satır: "Şunları öğrendim ve kalıcı kurala çevirdim: …".

Paket sürümü değiştiyse (beceri/şablon metni değişti) projeler bunu `cv update` ile görür; bu projede hemen `cv update` çalıştırıp farkı uygula ki kendi derslerinden ilk sen faydalan.
