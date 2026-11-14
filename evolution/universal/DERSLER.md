# Evrensel dersler

Her satır: durum → artık ne yapıyoruz (kaynak). En çok 80 satır; dolunca birleştir. Damıtma (`damit`) buraya yazar; her ekleme `evolution/CHANGELOG.md`'ye.

- Ucuz model şeritleri oturumun arka plan görevi olunca oturumla ölür → ayrık süreç başlat; yeniden başlatmadan önce WIP commit + detach (2026-11-11).
- Bir komutun hata metni veri sanılabilir (dal yokken `git log`) → çıkış kodunu kontrol et.
- Ucuz modelin yoğun saat fiyatı var → saat penceresini config'e koy, batch beklesin.
- Tek tek yeşil dallar birleşince test yalıtımı kırılır → paket birleşmesinden sonra "takımı yeşile çek" işini baştan planla.
- Toplamalı çakışma "iki tarafı koru" ile çözülür; ardından sözdizimi + JSON + yinelenen anahtar denetimi şart.
- İkili çıktı çakışırsa "bizimki" + kaynağa dokun, yeniden derlensin.
- Büyük model yarıda durdurulup yeniden başlatılınca bağlamı baştan okur, limiti yer → temiz oturum, tek nokta atışı istem, durdurma yok.
- Limit %100'e dayanırsa tur ölür, uyanış planlanamaz → %85 yeni adım yok, %90 çık; çevrim başında sigorta uyanışı.
- `/loop` 3 gün, `CronCreate` 7 gün ve oturumla sınırlı; yeni oturum kutusu eğik çizgi komutu kabul etmez → kalıcı otonomi = zamanlanmış görev + temiz oturum + kilit.
- Gözetimsiz makine: uyku kapalı, kapak "hiçbir şey yapma", prize takılı, güncelleme duraklatılmış; izin modu Otomatik; ilk 10 dk sahibi başında.
- Gizli test kopyası tek kopya denetimini yanıltabilir → test süreçleri ayırt edilebilir olmalı.
- Sahibi sürekli kontrol etmek istemez ama görünmez çalışma da tedirgin eder → sade OZET, net uyuyor/çalışıyor işareti, kolay "dur".
- İş sayısı kaliteyi ölçmez (612 menü, "ucuz kopya") → his/kalite ölçüsünü (kör test) ilk günden tanımla.
- Raporlanan her sayı komutla doğrulanır; yanlış sayı güveni kırar.
- "His" sorunları ölçülebilir parçalara indirgenir (piksel ölçümü yanlış tema sütununu buldu).
- Gözetimsiz istemde "bitince soru sorma, kapanış kutusunda düğme koyma" açıkça yazılır; uygulama kutusu sahibi uyurken soru gösterir, düğmeye basmak eski oturuma pahalı ikinci mesaj gönderir (claudevolution).
- Otomatik izin kipi geri alınamaz git işlerini (birleşmemiş dalı silme, reset --hard) reddeder; tekrar denemek çevrimi yakar → bu tür işi denemeden SORULAR'a yaz, komutu sahibine bırak (2026-11-12).
- Evrensel ders yazıldığı an pakete gider: `cv lesson "<ders>" --evrensel` (dal, ölçüm, commit, GitHub'a push tek komutta). Damıtmayı beklemek dersleri projede [evrensel] etiketiyle unutturuyordu (2026-11-12).
- Windows'ta .cmd sarmalayıcısı başka bir .cmd'yi `call` ile çağırınca argümanlardaki % ikinci kez açılır ("%34" → 3. argüman + "4") → sarmalayıcı node'u doğrudan çağırır. PowerShell'de dolar işaretli metni ("$0.05") tek tırnakla ver (2026-11-12).
- Test takımı arka planda koşarken aynı uygulamayı derleme: çıktı dosyası kilitli kalır, derleme derleyici başarısız diye düşer → önce testin bitmesini bekle, sonra derle. (2026-11-12)
- Yardımcı betiğe (yoklama, test aracı) çok satırlı ya da tırnaklı kodu komut satırında verme: kabuk tırnakları bozar, araç zaman aşımına kadar bekler → kodu geçici bir dosyaya yaz, yolunu ver. (2026-11-12)
- Arayüz işinde her adımda gerçek uygulamadan ekran görüntüsü al ve referans görselle yan yana koy, gerekirse piksel ölç; görüntüsüz yapılan arayüz işi körlemesine kalır ve farkları kaçırır. (2026-11-12)
- Ara sıra düşen bir test ilk kez görülünce yeniden koşmadan önce hata yakalayıcısına dosya:satır ve çağrı zinciri ekle; yoksa düşüş tekrar ettiğinde de kaynağı bilinmez. (2026-11-12)
- Windows'ta çalışırken kendini yeniden yazan bir .cmd dosyası kayan bayt konumundan okunmaya devam eder ve rastgele satırlar çalışır; komut satırını '& exit /b' ile bitir ve dosyayı yalnız içerik değiştiyse yaz. (2026-11-12)
- "Sayfaya enjekte edilen test betiği hiç sonuç vermiyor ve içindeki zaman bekçisi de tetiklenmiyorsa asılmayı değil önce sözdizimini ara: ayrıştırılamayan betik hiç başlamaz. Koşmadan önce betiği bir JS çalışma ortamında async fonksiyon gövdesi olarak ayrıştır. (2026-11-12)" (2026-11-12)
- "Ucuz model ajanına derleme/test betiklerini (scripts/, build betiği, test koşucusu, .evrim/) forbiddenWrite ile yasakla ve gözden geçirmede betik değişikliğine ayrıca bak: bir ajan derleme betiğine 'bütün uygulama süreçlerini öldür' satırı koydu, paralel şeritlerin ve trenin testleri kesildi." (2026-11-14)
