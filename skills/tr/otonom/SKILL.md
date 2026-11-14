---
name: otonom
description: Projeyi sahibi yokken gözetimsiz ilerletir - tek çevrim yapar (kilit, kota kapısı, ofis muhakemesi, hafıza, bir iş adımı, bitiş kapısı, kayıt) ve çıkar. Zamanlanmış görevden ("otonom becerisini yükle ve bir çevrim yap") ya da /loop içinden ("/loop başla": "başla" bir çevrim demektir) çağrılır; sahibi "ne yaptın" ya da "dur" dediğinde de bu beceri cevaplar.
---

# Otonom çevrim

Sahibi burada değil; **sen onun yerindesin.** Soru sorma, onay bekleme, takılıp kalma. Kapanış kutusuna (wrap_up) da soru ya da düğme koyma, yalnız özet: sahibi uyurken düğmeye basmak eski oturuma pahalı ikinci mesaj gönderir. Her kararda: "Sahibi şu an ekrana baksa bunu onaylar mıydı?" Emin değilsen daha küçük, geri alınabilir olanı seç ve soruyu `SORULAR.md`'ye bırak.

`cv` = `.evrim\cv.cmd` (Windows) ya da `.evrim/cv`. Eşikler, belge adları, `finalForm` ve `licensePolicy` `.evrim/config.json` içindedir; bu metindeki sayılar varsayılandır, config farklıysa config geçerli. Hafıza klasörü: `.evrim/otonom/`.

**Bir çağrı = bir çevrim.** Zamanlanmış görev her seferinde temiz oturum açar; çevrim bitince çık. Durum yalnız dosyalarda, `KARARNAMELER.md`'de ve commit'lerde yaşar.

## 1. Aç (tek mesajda)

1. **Platformu tanı, sigortayı kur:**
   - **Claude Code (`/loop`):** önce sigorta `ScheduleWakeup(1800, prompt = döngü metninin aynısı, reason "sigorta")`. Döngünün ilk çevriminde Remote Control'ü aç (`set_remote_control`, `session_id: "self"`, `enabled: true`; ertelenmişse ToolSearch ile yükle); reddedilir ya da "unavailable" derse geç, OZET'e tek satır yaz. Zamanlanmış görevdeysen gerekmez.
   - **Antigravity (`/goal`, `/schedule` veya `"başla"`):** Antigravity'de `/loop` ve `ScheduleWakeup` **yoktur**; bunların yerine yerleşik `schedule` ve `manage_task` araçları vardır. Uzun adımlarda sigorta için gerekirse `schedule(DurationSeconds: 1800, Prompt: "otonom becerisini yükle ve bir çevrim yap")` bırakabilirsin (normal uyku döngüsü §5'te kurulur).
2. **Kota okuma:**
   - **Claude Code:** `mcp__ccd_session_mgmt__get_usage` (yoksa `ToolSearch select:mcp__ccd_session_mgmt__get_usage`).
   - **Antigravity / Codex:** bu aracı **arama** (`ToolSearch` çağırma). Antigravity sistem mesajında `[quota] ... (X% remaining, resets at <ISO>)` bildirimi varsa `--five <100 - X> --five-resets <ISO> --week unknown` ver; yoksa `--five unknown --week unknown` geçir.
3. `cv cycle begin --five <5s %> --week <haftalık %> --five-resets <resetsAt> --week-resets <resetsAt>`

Kota okunamıyorsa `--five unknown --week unknown` ver: `cv cycle begin` yerel 5 saatlik oturum bloklarına (`local-blocks`) düşer; yerel blok da yoksa tek küçük adıma izin verir, üç kez üst üste okunamazsa bekletir.

Komutun çıktısındaki `KARAR` satırına uy:

| KARAR | Ne yaparsın |
|---|---|
| `GO` | Çevrimi yap (§2). |
| `KUCUK` / `KISITLI` | Büyük/paralel adım başlatma; yalnız yarım kalan küçük işi ya da tek dar adımı bitir (commit, derleme), sonra §4. |
| `CIK` | Hiç iş yapma. `cv cycle sleep --reason "<çıktıdaki neden>"`, sonra §5. |
| `MESGUL` | Başka bir oturum çalışıyor. Hiçbir dosyaya dokunmadan çık. |
| `DUR` | Sahibi `NOTLAR.md`'ye DUR yazmış. Hiçbir şey yapmadan çık; Claude Code `/loop` içindeysen `ScheduleWakeup stop: true`, Antigravity'de aktif zamanlayıcı varsa `manage_task` (`list` → `kill`) ile kapat. |
| `SIRA_DEGIL` | Kota bu makinedeki başka projenin sırası. Çık. |
| `BITTI` | `finalForm` ve yol haritası tamam. Teslimat dosyasını/komutunu doğrula, `OZET.md`'ye sahibinin çift tıklayıp açabileceği **kesin çıktı/uygulama yolunu** (`DELIVERABLE`) yaz; Claude Code `/loop` içindeysen `ScheduleWakeup stop: true`, Antigravity'de `manage_task` ile zamanlayıcıları kapat ve yeni `schedule` kurmadan temiz çık. |

Çıktı ayrıca şunları verir: `TEMPO` (`HIZLAN` / `YAVAS` / `NORMAL`), `KARARNAME`, `OFIS_MUHAKEMESI`, `ACIK_CERCEVE`, DERSLER, GUNLUK sonu, sahibinin **okunmamış notları**, cevaplanmış sorular, `KURTARMA`, `DAMITMA`, çevrim kimliği. Kalıcı proje ilkeleri için `.evrim/otonom/KARARNAMELER.md` dosyasına bakılır.

## 2. Çevrim, Yazılım Ofisi ve Açık Çerçeveli Öz-Gelişim (KARAR = GO)

Sıra:
1. **Kurtarma bulgusu varsa önce o** (§6). Kırık derleme ya da yarım birleştirme üstüne iş yapılmaz.
2. **Sahibinin notları.** `ÖNCE:` ile başlayan not sıradaki işin önüne geçer. İtiraz ("beğenmedim", "yapma") gelmişse önce onu düzelt ya da geri al. Her notu işleyince `NOTLAR.md`'de başına `[okundu <tarih>]` yaz. Cevaplanmış soruyu uygula, `SORULAR.md`'de "Kapananlar"a taşı.
3. **`DAMITMA: evet` ise** bu çevrimin işi damıtmadır: `damit` becerisini yükle, yalnız onu yap.
4. **Tempo, Ofis Muhakemesi ve İnisiyatif:**
   - **`TEMPO` (`HIZLAN` / `YAVAS` / `NORMAL`):** Yalnız ham `%` değerine değil, **harcanan kotaya karşılık elde edilen işe** bak. Pencere büyük boş kotayla ve hafif işle kapanıyorsa (`HIZLAN`) paket ağırlığını ve paralel şerit sayısını (`delegate.lanes`) artır. `YAVAS` ise küçük, yüksek kaldıraçlı işlere odaklan.
   - **Yöntem değişimi (`OFIS_MUHAKEMESI`):** Bir yaklaşım turlar boyunca patinaj yapıyorsa aynı X yolunu zorlama — Y yaklaşımına geç (gerekiyorsa `cv council --topic "<konu>"` ile kısa muhakeme kur) ve nedenini `.evrim/otonom/KARARNAMELER.md` dosyasına veya `cv lesson` ile yaz.
   - **Açık çerçeveli öz-gelişim (`ACIK_CERCEVE`):** Eski alışkanlığa körü körüne uyma. Daha iyi bir mimari, özel doğrulama/test betiği ya da çalışma kuralı gerekiyorsa inisiyatif al, projeye özgü kalıcı kararnameyi `.evrim/otonom/KARARNAMELER.md`'ye yaz; başka projelerde de geçerliyse `cv lesson "<genelleştirilmiş ders>" --evrensel` ile pakete gönder.
5. **Bir iş adımı:** `docs.worker` belgesindeki döngünün adımı (`docs.roadmap` açık maddeleri ve `docs.checkup`; dış referans incelemesinde `licensePolicy` sınırına uy). Kod işi tarif edilebiliyorsa ucuz modele (`calis` becerisinin 3-8. adımları; şeritler ayrık süreçtir, bu çevrim bitse de çalışır; sonucu sonraki çevrim toplar). Anahtar yoksa (`cv delegate which` yedek der) `calis` 5. adımın yedek yolu; durma. Kritik yerleri (AGENTS.md > İş bölümü) kendin yaz.

Çevrim içinde **her 5-6 araç çağrısında bir ve her commit'ten sonra**: Claude Code'da `get_usage` + `cv gate --five .. --week ..`; Antigravity veya Codex'te `get_usage` aramadan `[quota]` varsa onu, yoksa doğrudan `cv gate --auto` (yerel 5 saatlik oturum bloklarına düşer) çalıştır. `KUCUK`/`CIK` dönerse elindekini commit et (`WIP:` olabilir, derlenir hâlde) ve §4'e geç. Bir çevrim 5 saatlik pencerenin %8'inden fazlasını yememeli; yiyorsa bir sonraki çevrimi küçült.

Bağlam sıkışması (compaction) sonrası güncel aşamayı, engelleyicileri ve göreve dönük dersleri geri yüklemek için `cv cycle prime` (gerekirse `--task <id>`) çalıştır.

## 3. Zarar bekçisi

Boşa giden parayı ve kotayı sahibi değil **sen** fark edeceksin:

- **Ucuz model:** başlattığın iş 15 dk içinde commit üretmiyorsa, aynı adımı tekrarlıyorsa ya da bütçesinin %60'ını yiyip testi geçiremiyorsa → `cv delegate stop <şerit>` (yarım iş dalda kalır), işi küçült ya da kendin yap. İki iş üst üste başarısızsa bu çevrimde bir daha başlatma.
- **Kendi hatan:** aynı hata 3 denemede düzelmiyorsa değişikliği geri al (`git checkout -- <dosya>` / `git revert`), `docs.checkup`'a yaz, sıradakine geç. Kırık hâlde commit yok.
- **İlerlemesiz çevrim:** `cv cycle begin` üst üste commit'siz çevrim sayısını söyler. 2 ise yaklaşımı değiştir (işi küçült, yöntemi değiştir ya da sıradakine geç); 3 ise OZET'e "takıldım: …" yaz ve bu çevrimi uyku olarak kapat.
- **Zaman kutusu:** bir yol haritası maddesine en çok 4 çevrim. Dolunca ulaşılan hâli commit et, eksiği OZET'e ve `docs.checkup`'a yaz, sıradakine geç. Ölçü tutmuyorsa "ölçülemedi" yaz; cilaya takılma.
- **Pahalı adım:** bir adım pencerenin %15'inden fazlasını yediyse dur, sebebini bul (büyük dosyayı baştan sona okuma, görüntü okuma, uzun çıktı) ve DERSLER'e yaz.
- **Uzun komut:** her birine süre sınırı; testi arka planda çalıştır, bitişi bekle, yoklama yapma. Test koşarken derleme başlatma.

## 4. Kapat

1. Çalışma ağacı temiz ya da `WIP:` commit'li; derleme geçiyor (geçmiyorsa son commit'i geri al).
2. **Ders ve kararname:** bu çevrimde tekrar eden ya da pahalı bir şey olduysa tek satır: projeye özgüyse `cv lesson "<ders>"`. Başka projede de aynen geçerliyse (proje adı çıkınca hâlâ doğru) **hemen** `cv lesson "<genelleştirilmiş ders>" --evrensel`: ders o an pakete girer, ölçülür, commit edilir ve GitHub'a gider; damıtmayı bekleme. Ciddi hata olduysa aynı komut `--hata` ile (önce `grep` ile `HATALAR.md`'de benzerini ara). Komut "pakete gitmedi" derse ders yerelde `[evrensel]` kalır, damıtma yeniden bakar. Kalıcı bir yöntem/mimari ilkesi çıkardıysan `.evrim/otonom/KARARNAMELER.md`'ye ekle.
3. **OZET.md**'yi güncelle: sade Türkçe, teknik terimsiz; "Şu an", "Bitenler" (nereye bakılacağıyla), "Karar verdiklerim", "Takıldıklarım", "Harcama", "Senin bakman gerekenler".
4. Kota bilgisini al (Claude Code'da `get_usage`; Antigravity'de son `[quota]` bildirimi varsa `100 - remaining`, yoksa `unknown`), sonra: `cv cycle end --id <kimlik> --did "<ne yaptım>" --cost "<kota %, $>" --worth evet|hayir --five .. --week .. --next "<sıradaki>"`. Komut GUNLUK'e yazar, sayaçları günceller, kilidi bırakır, `UYKU` ve `SONRAKI_KAPI` verir. Raporladığın her sayı bir komut çıktısından gelsin.
5. Hafıza dosyalarını commit et (`otonom: çevrim <tarih>`).
6. **`SONRAKI_KAPI` `BITTI` dönerse:** teslimat yolunu ve doğrulamasını kontrol et, `OZET.md`'ye sahibinin hemen açabileceği kesin çıktı/uygulama yolunu yaz; Claude Code `/loop` içindeysen `ScheduleWakeup stop: true`, Antigravity'de `manage_task` ile zamanlayıcıları kapat ve yeni `schedule` kurmadan bitir.

## 5. Çık ya da uyu

- **Zamanlanmış görev:** bir cümlelik son söz yaz ve bitir. Yeniden planlama yok.
- **Oturum uzadı mı?** Aynı sürekli oturumda 8. çevrimi geçtiysen ya da bağlam çok büyüdüyse (her çağrı pahalılaşır) döngüyü bozma, ama OZET'in "Senin bakman gerekenler" kısmına ve son sözüne sahibinin dilinde yaz — Claude Code'da `"yeni oturum aç, 'merhaba' yaz, sonra /loop başla yaz"`, Antigravity'de `"yeni oturum aç, doğrudan 'başla' veya /goal yaz"`. Her çevrimde tekrarlama; en çok 4 çevrimde bir.
- **Sonraki çevrimi kurma (platforma göre):** `BITTI` veya `DUR` yoksa:
  - **Claude Code (`/loop`):** `ScheduleWakeup(<UYKU>, prompt = aynı metin, reason "<tek cümle>")`.
  - **Antigravity:** yerleşik `schedule` aracını çağır: `schedule(DurationSeconds: <UYKU>, Prompt: "otonom becerisini yükle ve bir çevrim yap")` ve başka araç çağırmadan turu bitir (beklerken token yakmaz). Sahibi `/goal` başlattıysa ve `KARAR = GO` + `UYKU <= 120` ise beklemeden sonraki çevrime de geçebilirsin; yine de uyku gerektiğinde (`CIK` / kota bekleme / `UYKU > 120`) `schedule` kullan.
  - Süreler: iş sürüyorsa 60-120 sn; arka planda test/şerit bekleniyorsa 1200 sn; kapı kapalıysa komutun verdiği süre (en çok 3600'lük parçalar). Uyku çevrimlerinde iş yapma.

## 6. Kurtarma (takılma noktaları)

`cv recover` bulguları listeler; `cv recover --fix` güvenli olanları yapar (bayat kilidi siler, yarım birleştirmeyi `git merge --abort` ile bırakır, ölü şerit kayıtlarını temizler).

- **Asılı süreç:** yalnız kendi başlattığın (şerit kayıtlarındaki) süreçleri durdur. Sahibinin açtığı pencereye dokunma.
- **Kırık derleme:** son commit'i geri al; proje her çevrim sonunda açılabilir olmalı.
- **Git karışıklığı:** çakışma işaretli dosya ya da yarım birleştirme temizlenemiyorsa o işi bırak, OZET'e yaz, başka maddeye geç.
- **İzin reddi:** aynı çağrıyı tekrarlama; başka yoldan yap ya da maddeyi atla, GUNLUK'e yaz.

## 7. Asla

- Sistem ayarı değiştirme, program kurma/kaldırma, internetten dosya indirme, proje ve kendi çalışma kopyaların dışında dosya silme.
- Projede push, uzak depo, sahibinin onayını bekleyen dalı birleştirme. (Tek istisna paket: `cv lesson --evrensel` kendi ölçülü push'unu yapar; elle push yok.)
- `.evrim/config.json` > `forbiddenWrite` listesini ya da kota eşiklerini gevşetme.
- Anahtarı bir yere yazma. Başka projenin dosyalarına dokunma.

## 8. Sahibi oturuma yazarsa

- **"ne yaptın":** `OZET.md`'nin özetini ver (sade), sorusunu cevapla. Sürekli döngü içindeysen ve iş bitmediyse sonra **mutlaka** sonraki uyanışı kur (Claude Code'da `ScheduleWakeup`, Antigravity'de `schedule`).
- **"dur":** commit, OZET, `cv lock release`; Claude Code `/loop` içindeysen `ScheduleWakeup stop: true`, Antigravity'de aktif zamanlayıcı varsa `manage_task` (`list` → `kill`) ile durdur. Zamanlanmış görev için sahibine söyle: "`NOTLAR.md`'ye tek satır DUR yaz ya da zamanlanmış görevi kapat."
- **Çalışıyor mu?** `cv lock status` ve `cv status` net cevap verir: çalışıyor / uyuyor (ne zamana kadar) / durdu.
