# Yöntem

claudevolution'ın arkasındaki çalışma biçimi: neden böyle, hangi ölçüyle. Bir haftalık gerçek kullanımdan damıtıldı (kaynak ve pahalı dersler: [INVENTORY.md](INVENTORY.md)). Komutların ayrıntısı becerilerde (`skills/`) ve kodda; burada yalnız ilkeler ve gerekçeleri.

## 1. İş bölümü: büyük model düşünür, ucuz model yazar

Büyük modelin (Claude) haftalık kotası kıttır, ucuz modelin (DeepSeek ya da OpenAI uyumlu başka biri) parası ucuzdur. Büyük model **planlar, tarif yazar, gözden geçirir, birleştirir**; ucuz model **kodu yazar, derler, test eder**.

**Devir eşiği.** Devretmenin de bedeli var: tarif yazmak, beklemek, diff okumak, düzeltme notu yazmak. Ölçü: `tarif satırı / birleşen kod satırı` (`git.specPerCode`). **0,5'i geçiyorsa iş büyük modelde kalmalıydı.** Kural olarak: büyük modelin 1-2 adımda bitireceği iş onda kalır; kalıbı belli, ≥150 satır ya da çok adımlı iş devredilir.

**Büyük modelde kalanlar** (projenin AGENTS.md'sinde yazılı): veri kaybı riski olan yollar, güvenlik sınırları, belirsiz işler, mimari kararlar.

## 2. Paket düzeni: tur = paket

Tek küçük işli tur kotayı oturum açılışına harcar ama görünür bir şey üretmez. Bu yüzden:

1. **Tur bir pakettir:** 8-30 kısa iş, hedef ≥5 görünür yol haritası maddesi.
2. **Kısa tarif** (15-40 satır): hedef, test, dokunulmayacaklar. Araştırmayı ucuz modelin keşif adımı yapar; büyük model yalnız elindeki kesin bilgiyi yazar. "Nasıl test edilir" testin **neyi nasıl okuyacağını** söyler; "dur ve raporla" koşulu açık yazılır.
3. **Paralel şeritler:** her şerit kendi worktree'si, her iş kendi dalı, şeritler **ayrık süreç** (oturum kapanınca ölmesinler). Her iş: keşif (salt okuma) → uygulama → takılırsa otomatik bir düzeltme turu.
4. **Gözden geçirme ucuzdan pahalıya:** önce çalıştırıcının özeti ve `--stat`, sonra yalnız değişen ürün dosyalarının diff'i, rapor yalnız şüphede. En çok **bir** düzeltme turu; ikinci takılmada büyük model bitirir.
5. **Birleştirme:** dallar sırayla `--no-ff`. Toplamalı çakışmada iki tarafı tut, sonra sözdizimi + JSON + yinelenen anahtar denetimi. Derlenmiş ikili çakışırsa birini al, kaynağına dokun, yeniden derlensin. **Paket birleşince takımı yeşile çekecek bir iş baştan planlanır:** tek tek yeşil dallar birlikte kırılabilir (test yalıtımı).
6. **Yoğun saat:** ucuz modelin pahalı saatlerinde şerit iş başlatmaz, bekler.

## 3. Kotayı ne yer: bağlam

Kotayı yiyen modelin yazdığı metin değil, **her çağrıda yeniden okunan bağlamdır.** Oturum başında okunan her bin token, sonraki her çağrıda bir kez daha okunur. Dört kural:

1. **Ana bağlama az şey girsin.** Belgeler tam okunmaz: ilerlemenin son kaydı, yol haritasının açık maddeleri, kontrol listesinin "elle bakılacak"ı. Keşif yan işte (alt ajan ya da ucuz modelin salt-okur `ask`'ı), ana bağlama ≤30 satır özet girer.
2. **Az çağrı.** Bağımsız komutlar tek mesajda; aynı test iki kez koşmaz (ucuz modelin dalı ana dalın ucundan çıktıysa ve testler geçtiyse birleşme aynı ağacı verir).
3. **Kısa oturum.** Tur yeni oturumda başlar, bitince kapanır. Gözetimsiz döngüde her çevrim temiz oturumdur.
4. **Büyük model yarıda durdurulmaz.** Yeniden başlatılan oturum bağlamı baştan okur; büyük modelle temiz oturum, tek seferlik istem, kendi limit freni.

## 4. Ölçüm: önce ölç, sonra değiştir

Ölçümü model yapmaz; `cv round` oturum kayıtlarından, ucuz modelin kayıtlarından ve git'ten okur (alanlar: [core/metrics/README.md](../core/metrics/README.md)). Modelin elle verdiği yalnız iş türü, bulunan hatalar ve israf sebebi.

| Oran | Ne gösterir |
|---|---|
| 100 satır başına Claude yükü | asıl verimlilik |
| İlk denemede bitme oranı | tarif ve iş seçimi kalitesi |
| Tarif / kod | devir eşiği (0,5) |
| Çağrı başına bağlam | oturum hijyeni |
| Boşa adım oranı | ucuz modelin verimi |
| Tur süresi, bekleme payı | zaman bedeli |

Tur sayacı küreseldir (oturumdan bağımsız); bir tur birden çok oturuma yayılabilir.

**Kalibrasyon:** her ~5 turda bir, benzer boyutta bir iş bilerek büyük model tek başına yapılır (`--mode solo`). "Devir kazandırıyor mu?" ancak böyle tahminden ölçüme döner.

**Teşhis de ölçümle:** "his" sorunları ("ucuz duruyor", "yavaş") ölçülebilir parçaya indirgenir (bir piksel ölçümü yanlış renk sütununu bulur). Sayı kaliteyi ölçmez: sahibinin "iyi olmuş" diyeceği şey ilk günden tanımlanır ve kör testle sınanır. Raporlanan her sayı bir komutla doğrulanır.

## 5. Değişmez kalite kuralları

Hiçbir optimizasyon ve hiçbir evrim adımı bunları gevşetemez; ölçü gevşetmeyi öneriyorsa ölçü yanlıştır.

- Testler geçmeden birleştirme yok; "bitti" iddiasını çalıştırıcı kendisi doğrular.
- Ucuz modelin her diff'ini büyük model okur; yeni testin gerçekten ölçtüğüne bakılır (her zaman doğru dönen kontrol reddedilir).
- Yasak yollar ve veri kaybı kuralları projenin config'inde açık durur; evrensel güncelleme onlara dokunamaz.
- Gerçek arayüzde görülmesi gereken davranış yoklamayla (`probe`) ya da elle doğrulanır.

## 6. Deney: her kural değişikliği bir hipotezdir

Kural değişikliği bir deney kaydıdır: tarih, değişiklik, beklenen etki, hangi ölçüyle, kaç tur sonra bakılacak. Gürültüye karşı: karşılaştırma iş türü içinde; tek tura bakıp kural değişmez; aynı anda en çok iki açık deney; %10'dan küçük fark "tuttu" sayılır.

Modelin sormadan değiştirebildikleri: adım sınırı, araç çıktı sınırları, tarif şablonunun bölümleri, iş türünün kime gittiği, okuma kuralları. Sahibine sorulanlar: iş bölümünün kendisi, model, bütçe, kalite kuralları.

## 7. Otonomi: sahibi yokken

- **Sürücü:** uygulamanın zamanlanmış görevi; her tetik temiz oturum, düz metin istem (yeni oturum kutusu eğik çizgi komutu almaz). `/loop` ve oturum içi zamanlayıcılar yalnız yedek: ömürleri sınırlı ve oturumla ölürler.
- **Kilit:** aynı anda tek çevrim; 90 dakikada bayatlar, sonraki çevrim devralır.
- **Kapılar:** 5 saatlik pencere %85'te yeni adım yok, %90'da çık; haftalık tavan `60 + 30·f` (f = haftanın geçen kesri). Limit %100'e dayanırsa tur ölür ve uyanış planlanamaz: erken durmak döngüyü yaşatır.
- **Zarar bekçisi:** ucuz model 15 dakikada commit yoksa durdurulur; aynı hata 3 kez → geri al, atla; iki çevrim ilerlemesiz → yaklaşım değiştir; bir adım pencerenin %15'inden fazlasını yerse sebebi bulunur.
- **Sahibiyle kanal dosyadır:** `NOTLAR` (sahibi → ajan; `DUR` kodda denetlenir), `SORULAR` (cevap beklenmez; güvenli varsayılanla devam), `OZET` (sade dil). Sahibi her saniye kontrol etmek istemez ama görünmez çalışma da tedirgin eder: net "çalışıyor/uyuyor" işareti ve kolay "dur".
- **Makine:** uyku kapalı, kapak "hiçbir şey yapma", prizde, güncelleme duraklatılmış, izin modu Otomatik; ilk 10 dakika sahibi başında. `cv doctor` denetler, değiştirmez.
- Gözetimsiz istemde kapanışta soru ve düğme yasağı açıkça yazılır.

## 8. Evrim: yerel ders, evrensel ders

- Her çevrim tekrar eden ya da pahalı bir durumdan tek satır ders yazar (`.evrim/otonom/DERSLER.md`, ≤40 satır).
- **Damıtma** (günde bir ya da her N çevrimde, kotanın ≤%10'u): projeden bağımsız dersler pakete taşınır: tercihen doğrudan ilgili beceri/şablon/kod metnine, olmazsa `evolution/universal/DERSLER.md`'ye. Her taşıma `evolution/CHANGELOG.md`'de bir deney kaydıdır.
- **Seçilim:** dört ölçü (biten iş başına kota, ilk deneme oranı, boşa çevrim, sahibinin itirazları). K çevrim sonra ölçü kötüleştiyse değişiklik geri alınır.
- **Paylaşım:** aynı makinede birden çok proje kotayı ağırlıkla paylaşır (makine kilidi + sıra); bir projenin öğrendiği genel ders `cv update` ile hepsine gider.
