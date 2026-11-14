# claudevolution · Kullanım Kartı

> Tek sayfalık özet: projeyi kurmak, tek tur çalıştırmak, gözetimsiz çalışmayı açıp kapatmak.
> Bilgisayara bir kez: GitHub'da paketin **Releases** sayfasından `claudevrim.exe`'yi indir, çift tıkla (Node/Deno gerekmez). Geliştirici: depoyu klonla, `claudevrim gelistirici <klon>`.
> Bütün cümleleri Claude uygulamasında, **projenin klasöründe açılmış** bir oturuma yazarsın.

---

## 1. Hızlı bakış

| Ne istiyorsun? | Claude'a ne yazarsın? |
|---|---|
| Yeni projeye kurmak | Proje klasöründe terminal: `claudevrim init`; sonra Claude'da o klasörü aç, `merhaba` |
| Var olan projeyi taşımak | `claudevolution'a taşı: cv adopt önce --dry-run, sonra --apply` |
| Neredeyiz? | `durum` |
| Bir tur iş | `çalış` |
| Gözetimsiz çalışma (evden çıkarken) | yeni oturumda önce `merhaba`, sonra `/loop başla` |
| Ne yaptı? | `ne yaptın` |
| Durdurmak | `dur` |
| Paketi güncellemek | terminalde `claudevrim guncelle` (ya da Claude'a: `cv update --apply`) |
| Dersleri pakete taşımak | `damıt` (tek ders zaten yazıldığı an gider: `cv lesson "…" --evrensel`) |

---

## 2. Yeni proje kurmak (bir kez)

1. Proje için bir klasör aç (ör. masaüstünde `bazalt`). Klasörde sağ tık → **Terminalde aç**.
2. Yaz: `claudevrim init`. Bitince terminali kapat.
3. Claude uygulamasında **Code** bölümünden o klasörü seç, yeni oturum aç (model **Opus**), **`merhaba`** yaz.
4. Claude projeyi sade sorularla öğrenir: ne yapmak istiyorsun, kim kullanacak, "bitti" ne demek, kodu kim yazsın (yalnız Claude / ucuz model / karışık), sen yokken çalışsın mı. Anlamadığını yeniden sorar, sonra planı sana özetler.
5. Onaylayınca sana şunu der: **yeni oturum aç, `merhaba` yaz, sonra `/loop başla` yaz.** O kadar.

> **Projede zaten kendi düzeni varsa** `init` yerine: `claudevolution'a taşı: cv adopt önce --dry-run, sonra --apply`. Hiçbir dosyayı ezmez, silmez.

---

## 3. Tek tur çalışmak (başındayken)

| Adım | Yaz | Ne olur |
|---|---|---|
| 1 | `durum` | Projenin hâlini ve sıradaki işi söyler. Hiçbir şeyi değiştirmez. |
| 2 | `çalış` | Bir paket iş: Claude planlar ve tarif yazar. Kodu DeepSeek yazar (anahtar varsa); yoksa Opus kendisi yazar. Sonra gözden geçirir, test eder, birleştirir, kaydeder. |
| 3 | `ne yaptın` | Sade özet. |

---

## 4. Gözetimsiz çalışma (evden çıkarken)

### Çıkmadan önce (5 dakika)

- [ ] Bilgisayar **prizde**, kapak **açık**
- [ ] Windows Update **duraklatıldı**: Ayarlar > Windows Update > Duraklat
- [ ] Claude uygulamasında **projenin klasöründe yeni oturum**, model **Opus**
- [ ] İzin modu **Otomatik** (yoksa izin penceresi döngüyü kilitler)
- [ ] Önce `merhaba` yaz, cevabı bekle
- [ ] Sonra yaz: `/loop otonom becerisini çalıştır`
- [ ] Remote Control izni sorarsa **izin ver**; sormazsa üstteki Remote Control düğmesine bir kez bas
- [ ] İlk çevrimin başladığını gör, çık

### Sen yokken

- Her çevrimde tek iş adımı yapar, kaydeder, hafızaya yazar.
- **5 saatlik limit %85'e** gelince yeni işe başlamaz; %90'da uyur.
- Limit yenilenince **2 dakika sonra** kendi uyanır. Fazladan beklemez, yenilenmeyi de kaçırmaz.
- **Haftalık limit** için kendine tavan koyar: haftanın başında %60, sonunda %90.
- Hata olursa kendi toparlar. Aynı hata 3 kez çıkarsa değişikliği geri alır ve sıradaki işe geçer.
- Sana soru sormaz. Karar gerekirse güvenli olanı seçer, soruyu `SORULAR.md`'ye yazar.

### Telefondan

- Claude uygulamasında o oturumu aç, sadece izle. Müdahale etmen gerekmez.
- İstersen o oturuma `ne yaptın` ya da `dur` yazabilirsin.

### Eve gelince

- `ne yaptın` yaz. İstersen `.evrim/otonom/OZET.md` dosyasını kendin oku.
- Senin onayını bekleyen dallar varsa özette yazar. Uygulamayı deneyip beğenirsen `birleştir` de.

---

## 5. Uzaktan talimat vermek (döngü çalışırken)

Projedeki `.evrim/otonom/NOTLAR.md` dosyasına bir satır ekle. Her çevrim bu dosyayı okur.

| Satır | Etkisi |
|---|---|
| `- ÖNCE: logoyu düzelt` | Sıradaki iş bu olur |
| `- bunu beğenmedim, geri al` | Önce o düzeltilir ya da geri alınır |
| `DUR` | Döngü durur; satırı silene kadar çalışmaz |

---

## 6. Bilgisayar ayarları (bir kez)

| Ayar | Nereden | Değer |
|---|---|---|
| Uyku | Ayarlar > Sistem > Güç > Ekran ve uyku | Prizdeyken: **Hiçbir zaman** |
| Kapak | Denetim Masası > Güç Seçenekleri > Kapağı kapatınca | Prizde: **Hiçbir şey yapma** |
| Windows Update | Ayarlar > Windows Update | Çalışırken **duraklat** |
| Claude uygulaması | — | **Açık** kalsın, izin modu **Otomatik** |

Kontrol için Claude'a `cv doctor çalıştır` de. Eksik olanı sade dille söyler.

---

## 7. Kim kodu yazıyor?

| Durum | Kim yazar |
|---|---|
| DeepSeek anahtarı tanımlı | DeepSeek (ucuz; paralel şeritler). Opus planlar ve denetler. |
| Anahtar yok | **Opus kendisi** yazar (kalite düşmesin diye daha ucuz bir Claude modeline verilmez). |
| Kayıt, kapanış, veri kaybı riski olan işler | Her zaman Opus |

> Anahtar yalnız Windows ortam değişkeninde durur (`DEEPSEEK_API_KEY`); hiçbir dosyaya yazılmaz.

---

## 8. Kendini geliştirme (evrim)

```
proje çalışır → ders çıkar → .evrim/otonom/DERSLER.md (yerel)
        ↓ hemen ya da arada bir "damıt"
genel ders → hemen: cv lesson "…" --evrensel  (büyük değişiklik: evrim/<ad> dalı → cv evolve)
        ↓ ölçüm: testler + 20 kaos senaryosu (0 token)
iyiyse → pakete girer, sürüm artar, GitHub'a gider
kötüyse → reddedilir, evolution/REJECTED.md'ye yazılır
        ↓
diğer projeler → "claudevolution'ı güncelle" → yeniliği alır
```

- Projeye özgü dersler projede kalır. Genel dersler herkese gider.
- Sistem kendi sınavını değiştiremez: ölçüm takımına dokunan değişiklik reddedilir.
- Göndermeden önce gizlilik taraması yapılır: anahtar, e-posta, kişisel klasör yolu.
- **Kapsam dondu (v1.0):** pakete yeni şey yalnız gerçek bir sorun ya da senin açık isteğinle girer.

---

## 9. Önemli dosyalar (projede)

| Dosya | Ne |
|---|---|
| `.evrim/otonom/OZET.md` | Sana sade özet |
| `.evrim/otonom/NOTLAR.md` | Senin talimatların |
| `.evrim/otonom/SORULAR.md` | Senin cevabını bekleyen sorular (cevapsız da çalışmaya devam eder) |
| `.evrim/otonom/GUNLUK.md` | Çevrim çevrim ne yapıldı |
| `.evrim/otonom/DERSLER.md` | Projenin öğrendikleri |
| `.evrim/config.json` | Proje ayarları: komutlar, yasak klasörler, eşikler |
| `docs/VISION.md` | Projenin hedefi |
| `docs/ROADMAP.md` | Sıradaki işler (döngü buradan seçer) |

---

## 10. Sorun olursa

| Belirti | Çözüm |
|---|---|
| Döngü durmuş, uyandığı yok | Yeni oturum, `merhaba`, sonra `/loop otonom becerisini çalıştır`. Kaldığı yeri hafızadan bulur. |
| "Başka oturum çalışıyor" (MESGUL) diyor | 90 dakikadan eski kilit kendiliğinden açılır. Hemen gerekirse: `cv lock release` |
| Mesaj kutusu `/loop`'u reddediyor | Önce `merhaba`, sonra `/loop …`. Bir mesajda tek eğik çizgili komut olur. |
| Oturum kapanış kutusunda "Evet / Hayır" düğmesi var | Basma. Eski oturuma ikinci mesaj limiti yer. |
| Bilgisayar uyumuş | Bölüm 6'daki ayarlar |
| Limit çok hızlı gidiyor | Fable kullanma; Opus yeterli. |

---

*Paket: github.com/RobloxPro1453/claudevolution · bu kart: `KULLANIM.md`*
