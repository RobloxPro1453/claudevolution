---
name: otonom
description: Projeyi sahibi yokken gözetimsiz ilerletir - tek çevrim yapar (kilit, kota kapısı, hafıza, bir iş adımı, kayıt) ve çıkar. Zamanlanmış görevden ("otonom becerisini yükle ve bir çevrim yap") ya da /loop içinden çağrılır; sahibi "ne yaptın" ya da "dur" dediğinde de bu beceri cevaplar.
---

# Otonom çevrim

Sahibi burada değil; **sen onun yerindesin.** Soru sorma, onay bekleme, takılıp kalma. Kapanış kutusuna (wrap_up) da soru ya da düğme koyma, yalnız özet: sahibi uyurken düğmeye basmak eski oturuma pahalı ikinci mesaj gönderir. Her kararda: "Sahibi şu an ekrana baksa bunu onaylar mıydı?" Emin değilsen daha küçük, geri alınabilir olanı seç ve soruyu `SORULAR.md`'ye bırak.

`cv` = `.evrim\cv.cmd` (Windows) ya da `.evrim/cv`. Eşikler, belge adları ve komutlar `.evrim/config.json` içindedir; bu metindeki sayılar varsayılandır, config farklıysa config geçerli. Hafıza klasörü: `.evrim/otonom/`.

**Bir çağrı = bir çevrim.** Zamanlanmış görev her seferinde temiz oturum açar; çevrim bitince çık. Durum yalnız dosyalarda ve commit'lerde yaşar.

## 1. Aç (tek mesajda)

1. `/loop` içindeysen önce sigorta: `ScheduleWakeup(1800, prompt = döngü metninin aynısı, reason "sigorta")`. Döngünün ilk çevriminde sahibi telefondan izleyebilsin diye Remote Control'ü aç (`set_remote_control`, `session_id: "self"`, `enabled: true`; araç ertelenmişse ToolSearch ile yükle); reddedilir ya da "unavailable" derse geç, OZET'e tek satır yaz. Zamanlanmış görevdeysen gerekmez (bir sonraki tetik sigortadır).
2. `mcp__ccd_session_mgmt__get_usage` (yoksa `ToolSearch select:mcp__ccd_session_mgmt__get_usage`).
3. `cv cycle begin --five <5s %> --week <haftalık %> --five-resets <resetsAt> --week-resets <resetsAt>`

`get_usage` okunamıyorsa `--five unknown --week unknown` ver: komut tek küçük adıma izin verir, üç kez üst üste okunamazsa bekletir.

Komutun çıktısındaki `KARAR` satırına uy:

| KARAR | Ne yaparsın |
|---|---|
| `GO` | Çevrimi yap (§2). |
| `KUCUK` | Yeni adım başlatma; yalnız yarım kalan küçük işi bitir (commit, derleme), sonra §4. |
| `CIK` | Hiç iş yapma. `cv cycle sleep --reason "<çıktıdaki neden>"`, sonra §5. |
| `MESGUL` | Başka bir oturum çalışıyor. Hiçbir dosyaya dokunmadan çık. |
| `DUR` | Sahibi `NOTLAR.md`'ye DUR yazmış. Hiçbir şey yapmadan çık; `/loop` içindeysen `ScheduleWakeup stop: true`. |
| `SIRA_DEGIL` | Kota bu makinedeki başka projenin sırası. Çık. |

Çıktı ayrıca şunları verir, başka dosya okumana gerek kalmaz: DERSLER'in tamamı, GUNLUK'ün son satırları, sahibinin **okunmamış notları**, cevaplanmış sorular, kurtarma bulguları (`KURTARMA`), damıtma zamanı (`DAMITMA: evet`), çevrim kimliği.

## 2. Çevrim (KARAR = GO)

Sıra:
1. **Kurtarma bulgusu varsa önce o** (§6). Kırık derleme ya da yarım birleştirme üstüne iş yapılmaz.
2. **Sahibinin notları.** `ÖNCE:` ile başlayan not sıradaki işin önüne geçer. İtiraz ("beğenmedim", "yapma") gelmişse önce onu düzelt ya da geri al. Her notu işleyince `NOTLAR.md`'de başına `[okundu <tarih>]` yaz. Cevaplanmış soruyu uygula, `SORULAR.md`'de "Kapananlar"a taşı.
3. **`DAMITMA: evet` ise** bu çevrimin işi damıtmadır: `damit` becerisini yükle, yalnız onu yap.
4. **Yoksa bir iş adımı:** `docs.worker` belgesindeki döngünün tek adımı. Kaynak: `docs.roadmap` açık maddeleri ve `docs.checkup`. Kod işi tarif edilebiliyorsa ucuz modele (`calis` becerisinin 3-8. adımları; şeritler ayrık süreçtir, bu çevrim bitse de çalışır; sonucu sonraki çevrim toplar). Anahtar yoksa (`cv delegate which` yedek der) `calis` 5. adımın yedek yolu; durma. Kritik yerleri (AGENTS.md > İş bölümü) kendin yaz.

Çevrim içinde **her 5-6 araç çağrısında bir ve her commit'ten sonra** `get_usage` + `cv gate --five .. --week ..`. `KUCUK`/`CIK` dönerse elindekini commit et (`WIP:` olabilir, derlenir hâlde) ve §4'e geç. Bir çevrim 5 saatlik pencerenin %8'inden fazlasını yememeli; yiyorsa bir sonraki çevrimi küçült.

## 3. Zarar bekçisi

Boşa giden parayı ve kotayı sahibi değil **sen** fark edeceksin:

- **Ucuz model:** başlattığın iş 15 dk içinde commit üretmiyorsa, aynı adımı tekrarlıyorsa ya da bütçesinin %60'ını yiyip testi geçiremiyorsa → `cv delegate stop <şerit>` (yarım iş dalda kalır), işi küçült ya da kendin yap. İki iş üst üste başarısızsa bu çevrimde bir daha başlatma.
- **Kendi hatan:** aynı hata 3 denemede düzelmiyorsa değişikliği geri al (`git checkout -- <dosya>` / `git revert`), `docs.checkup`'a yaz, sıradakine geç. Kırık hâlde commit yok.
- **İlerlemesiz çevrim:** `cv cycle begin` üst üste commit'siz çevrim sayısını söyler. 2 ise yaklaşımı değiştir (işi küçült ya da sıradakine geç); 3 ise OZET'e "takıldım: …" yaz ve bu çevrimi uyku olarak kapat.
- **Zaman kutusu:** bir yol haritası maddesine en çok 4 çevrim. Dolunca ulaşılan hâli commit et, eksiği OZET'e ve `docs.checkup`'a yaz, sıradakine geç. Ölçü tutmuyorsa "ölçülemedi" yaz; cilaya takılma.
- **Pahalı adım:** bir adım pencerenin %15'inden fazlasını yediyse dur, sebebini bul (büyük dosyayı baştan sona okuma, görüntü okuma, uzun çıktı) ve DERSLER'e yaz.
- **Uzun komut:** her birine süre sınırı; testi arka planda çalıştır, bitişi bekle, yoklama yapma. Test koşarken derleme başlatma.

## 4. Kapat

1. Çalışma ağacı temiz ya da `WIP:` commit'li; derleme geçiyor (geçmiyorsa son commit'i geri al).
2. **Ders:** bu çevrimde tekrar eden ya da pahalı bir şey olduysa `DERSLER.md`'ye tek satır (`[evrensel]` ya da `[yerel]` etiketiyle). Ciddi hata olduysa `HATALAR.md`'ye kayıt (önce `grep` ile benzerini ara).
3. **OZET.md**'yi güncelle: sade Türkçe, teknik terimsiz; "Şu an", "Bitenler" (nereye bakılacağıyla), "Karar verdiklerim", "Takıldıklarım", "Harcama", "Senin bakman gerekenler".
4. `get_usage`, sonra: `cv cycle end --id <kimlik> --did "<ne yaptım>" --cost "<kota %, $>" --worth evet|hayir --five .. --week .. --next "<sıradaki>"`. Komut GUNLUK'e yazar, sayaçları günceller, kilidi bırakır ve `UYKU` saniyesini söyler. Raporladığın her sayı bir komut çıktısından gelsin.
5. Hafıza dosyalarını commit et (`otonom: çevrim <tarih>`).

## 5. Çık ya da uyu

- **Zamanlanmış görev:** bir cümlelik son söz yaz ve bitir. Yeniden planlama yok.
- **`/loop`:** `ScheduleWakeup(<UYKU>, prompt = aynı metin, reason "<tek cümle>")`. İş sürüyorsa 60-120 sn; arka planda test/şerit bekleniyorsa 1200 sn; kapı kapalıysa komutun verdiği süre (en çok 3600'lük parçalar). Uyku çevrimlerinde iş yapma.

## 6. Kurtarma (takılma noktaları)

`cv recover` bulguları listeler; `cv recover --fix` güvenli olanları yapar (bayat kilidi siler, yarım birleştirmeyi `git merge --abort` ile bırakır, ölü şerit kayıtlarını temizler).

- **Asılı süreç:** yalnız kendi başlattığın (şerit kayıtlarındaki) süreçleri durdur. Sahibinin açtığı pencereye dokunma.
- **Kırık derleme:** son commit'i geri al; proje her çevrim sonunda açılabilir olmalı.
- **Git karışıklığı:** çakışma işaretli dosya ya da yarım birleştirme temizlenemiyorsa o işi bırak, OZET'e yaz, başka maddeye geç.
- **İzin reddi:** aynı çağrıyı tekrarlama; başka yoldan yap ya da maddeyi atla, GUNLUK'e yaz.

## 7. Asla

- Sistem ayarı değiştirme, program kurma/kaldırma, internetten dosya indirme, proje ve kendi çalışma kopyaların dışında dosya silme.
- Push, uzak depo, sahibinin onayını bekleyen dalı birleştirme.
- `.evrim/config.json` > `forbiddenWrite` listesini ya da kota eşiklerini gevşetme.
- Anahtarı bir yere yazma. Başka projenin dosyalarına dokunma.

## 8. Sahibi oturuma yazarsa

- **"ne yaptın":** `OZET.md`'nin özetini ver (sade), sorusunu cevapla. `/loop` içindeysen sonra **mutlaka** `ScheduleWakeup` ile döngüyü yeniden kur.
- **"dur":** commit, OZET, `cv lock release`; `/loop` içindeysen `ScheduleWakeup stop: true`. Zamanlanmış görev için sahibine söyle: "`NOTLAR.md`'ye tek satır DUR yaz ya da zamanlanmış görevi kapat."
- **Çalışıyor mu?** `cv lock status` ve `cv status` net cevap verir: çalışıyor / uyuyor (ne zamana kadar) / durdu.
