# FABLE_PROMPT: claudevolution'ı tek seferde kur

> Sahibinin yeni (temiz) Fable 5.2 oturumuna yapıştıracağı tek satır:
> **`%USERPROFILE%\claudevolution\docs\FABLE_PROMPT.md` dosyasını baştan sona oku ve uygula. Gözetimsiz çalışıyorsun; soru sorma, kararı gerekçesiyle DECISIONS.md'ye yaz.**

---

Sen Fable 5.2'sin. Bu, projenin en önemli işi: bir haftalık dağınık birikimi **tek, sağlam, kendini geliştiren bir pakete** dönüştüreceksin. Ne yaptığını sahibine sade Türkçe anlatacaksın; kod ve belgeler mimari kalitede olacak. Acele etme ama israf da etme: aşağıdaki limit kuralları pazarlıksız.

## 1. Hedef (tek cümle)

**claudevolution**: Claude Code ile çalışan herhangi bir projeye `cv init` ile belge/kural sistemi, ucuz modele iş dağıtımı, limit yöneten gözetimsiz otonomi ve evrensel + yerel evrim döngüsü kuran, kullanıldıkça kendini geliştiren paket.

## 2. Önce oku (bu sırayla; büyük dosyaları baştan sona değil, gerektiği kadar)

1. Bu depo: `README.md`, `ARCHITECTURE.md` (Opus'un v0 taslağı; değiştirebilirsin), `docs/INVENTORY.md` (**hazine haritası: hangi dosya nerede, evrensel mi yerel mi; §4 pahalıya öğrenilmiş 16 ders; §5 eksikler**), `evolution/universal/DERSLER.md`.
2. Fotosop (salt okunur, `%USERPROFILE%\Desktop\fotosop`): `docs/workflow/ENGINE_IDEA.md` (önceki ayırma tasarımı), `docs/workflow/README.md` (paket düzeni), `docs/workflow/OPTIMIZATION.md`, `docs/workflow/config.json`, `docs/tasks/README.md` + `docs/tasks/TEMPLATE.md` + iki örnek tarif/rapor (ör. `DS-047.md`, `DS-047.report.md`), `scripts/ds/agent.js`, `scripts/ds.ps1`, `scripts/round.js`, `.claude/skills/{durum,calis,fullotonom}/SKILL.md`, `AGENTS.md`, `docs/WORKER.md`.
3. Gerekirse: `%USERPROFILE%\fotosop-calisma\fable\docs\tasks\{AURA,AURA-RUN,FABLE-001}.md` (büyük model brief kalıbı), Claude hafızası `%USERPROFILE%\.claude\projects\C--Users-<ad>-Desktop-fotosop\memory\`, Fotosop'un canlı otonom hafızası `%USERPROFILE%\Desktop\fotosop\build\otonom\` (ilk gerçek gece koşusu: ne iyi gitti, ne takıldı).

**Fotosop'ta hiçbir dosyayı değiştirme.** Yalnız `%USERPROFILE%\claudevolution` içinde yaz.

## 3. Kapsam: ne teslim edeceksin

### 3.1 CLI (`bin/`)
Node (Fotosop'ta zaten var) + ince `cv.ps1`/`cv.cmd` sarmalayıcı; Windows birincil, Linux/macOS'ta da çalışabilir olsun (yollar `path` ile).
- `cv init [--name] [--lang tr|en]`: şablonları kopyalar (var olanı ezmez, `.new` bırakır), `.evrim/config.json`'u algılama + varsayılanlarla doldurur (derleme/test komutu, kod klasörleri, yasak yollar), becerileri `.claude/skills/` altına bağlar (sürüm damgalı kopya ya da bağlantı; kararını gerekçele), `.evrim/version` yazar, sonunda `cv doctor`.
- `cv adopt`: var olan bir düzeni (Fotosop) okur, yeni yapıya **eşleme planı** üretir (`adopt-plan.md`: hangi dosya nereye, ne yerel config'e, ne eklentiye). Uygulama `--apply` ile; bu oturumda Fotosop'a uygulama, yalnız planı üret ve depoya örnek olarak koy (`docs/examples/fotosop-adopt-plan.md`).
- `cv doctor`: otonomi önkoşulları (uyku/hazırda bekletme kapalı mı — `powercfg /q` okunarak, kapak eylemi, güç kaynağı, git temiz mi, derleme/test komutu çalışıyor mu, `.evrim` tam mı). Değiştirmez, yalnız raporlar ve sahibine yapılacakları sade dille yazar.
- `cv status`: tur, kota (son bilinen), şeritler, hafıza özeti.
- `cv distill`: damıtma becerisinin yardımcı çıktısı (yeni yerel dersler listesi, evrensel adaylar).
- `cv update`: paket sürümü yükselince projede farkı göster, onayla uygula.

### 3.2 Çekirdek (`core/`)
- `delegate/`: `agent.js`'in genel hâli. Projeye özgü olanlar (Fotosop'un `engine_search`'ü, CRLF düzeltmesi) **eklenti** olur: config'deki eklenti listesiyle yüklenen modüller. Model sağlayıcı soyut: DeepSeek varsayılan, başka OpenAI-uyumlu uç noktalar config ile. Şerit yöneticisi (`ds.ps1`'in genel hâli): ayrık süreçler, worktree yolları config'den, yoğun saat penceresi config'den, `status`. Anahtar yalnız ortam değişkeninden; **hiçbir dosyaya, loga, örneğe anahtar yazma**.
- `metrics/`: `round.js`'in genel hâli; `metrics.jsonl` biçimi belgelensin (alanlar, birimler).
- `autonomy/`: zamanlanmış görev sürücüsü (Claude masaüstü uygulamasının zamanlanmış görevi; temiz oturum; düz metin istem), kilit (`.evrim/otonom/lock`: oturum + zaman, 90 dk bayatlık), limit kapıları (5s ≥%85 yeni adım yok / ≥%90 çık; haftalık tavan 60+30·f; eşikler config'de), sigorta uyanışı (`/loop` yedeği için), zarar bekçisi kuralları, takılma kurtarma (asılı süreç, kırık derleme, git karışıklığı).
- `probe/` ve `reference/`: arayüz tanımı + Fotosop'tan genelleştirilebilen kısım (ekran yakalama + isimlendirme aracı, referans indeksi, yan yana karşılaştırma sayfası). Projeye özgü kısım eklenti.

### 3.3 Beceriler (`skills/`)
`durum`, `calis` (paket düzeni turu), `otonom` (fullotonom'un genel hâli: tek çevrim; zamanlanmış görevden ya da `/loop`'tan çağrılır), `damit` (evrim), `init` (konuşarak kurulum + VISION doldurma). Belge adları ve eşikler config'den; Fotosop'a özgü hiçbir isim kalmasın. Türkçe ve İngilizce (dil config'den; en azından Türkçe tam).

### 3.4 Şablonlar (`templates/project/`)
`AGENTS.md` (nereye bakmalı tablosu, kesin kurallar bölümü boş başlıklarla, her değişiklikten sonra derle+test, iş bölümü, proje hafızası tablosu, belge diyeti), `docs/{VISION,PROGRESS,ROADMAP,CHECKUP,KNOWLEDGE,ARCHITECTURE,DEVELOPMENT,WORKER}.md`, `docs/tasks/{README,TEMPLATE}.md` (genel ajan kuralları + "Project rules" yer tutucusu), `.evrim/config.json` (şemalı, yorumlu örnek), `.evrim/otonom/{DERSLER,GUNLUK,HATALAR,OZET,SORULAR,NOTLAR}.md`, `CHANGELOG.md`. Şablonlar kısa ve dolu olsun: boş "TODO" sayfası değil, ne yazılacağını örnekle gösteren iskelet.

### 3.5 Evrim (`evolution/` + `skills/damit`)
- Yerel: her çevrim `DERSLER` (≤40), `GUNLUK` (sona ekle, son 10 satır okunur), `HATALAR` (yalnız hata görülünce grep).
- Damıtma: günde bir ya da her N çevrimde, toplam kotanın ≤%10'u. Yerel yeni dersleri sınıflar; genel olanı `evolution/universal/DERSLER.md`'ye **ya da doğrudan ilgili beceri/şablon metnine** taşır; her taşıma `evolution/CHANGELOG.md`'de: değişiklik, beklenen etki, ölçü, sonuç.
- Seçilim: K çevrim sonra ölçü kötüleştiyse geri al. Ölçüler: biten iş başına kota, ucuz model ilk-denemede-bitti oranı, boşa çevrim, sahibinin itirazları (`NOTLAR`).
- Koruma: evrensel değişiklik proje kurallarını gevşetemez; yasak yollar ve veri kaybı kuralları yerel config'de açık kalır.
- Evrensel katman iki projenin aynı makinede limit paylaşımını hesaba katsın (kilit + kota payı; tasarımı yaz, uygulaması basit olabilir).

### 3.6 Belgeler (`docs/`)
`METHOD.md` (yöntem: paket düzeni, ölçüm, deney, otonomi, evrim; Fotosop'un OPTIMIZATION/README/ENGINE_IDEA'sından damıtılmış, tekrar değil), `DECISIONS.md` (her mimari karar: seçenekler, seçilen, neden), `OWNER_GUIDE.md` (sahibi için sade Türkçe: kurulum, başlatma, "ne yaptın", "dur", döngü öldü mü nasıl anlarım, bilgisayar ayarları), `examples/fotosop-adopt-plan.md`.

## 4. Mimari beklentisi

- Tek sorumluluk: her modül tek iş; projeye özgü her şey config ya da eklenti.
- Bağımlılık az: Node standart kütüphanesi + git; dış paket gerekiyorsa gerekçesi DECISIONS'ta.
- Gözetimsiz çalışmaya göre tasarla: her uzun komutun zaman sınırı, her durumun kurtarma yolu, her kararın kaydı.
- Testler: `tests/` altında hızlı, ağsız testler (init bir geçici klasöre; config doğrulama; kilit bayatlığı; kapı hesabı `60+30·f`; adopt planı üretimi; ajanın yasak yol denetimi). `npm test` ya da `node tests/run.js` tek komut.
- Sürüm: `package.json` `0.1.0`; CHANGELOG.

## 5. Bitti ölçüsü (hepsi)

1. Boş bir geçici klasörde `cv init` → tam iskelet + `cv doctor` raporu; ikinci kez çalıştırınca hiçbir şeyi ezmez.
2. `node tests/run.js` yeşil.
3. Fotosop için `adopt` planı üretildi ve gerçekçi (her INVENTORY satırı bir yere eşlendi).
4. Beceri metinlerinde Fotosop'a özgü isim yok (grep ile kanıtla: `Fotosop|Photopea|fotosop` yalnız `docs/examples/` ve INVENTORY'de).
5. `docs/OWNER_GUIDE.md` sahibinin teknik bilmeden okuyabileceği dilde.
6. INVENTORY §4'teki 16 dersin her biri ya bir kurala/koda dönüştü ya da DERSLER'de; hangisinin nereye gittiği tabloda (`docs/INVENTORY.md`'ye sütun ekle).
7. Hiçbir dosyada API anahtarı, e-posta ya da kişisel bilgi yok (grep ile kanıtla). Makineye özgü mutlak yollar (`C:\Users\<ad>\…`) paket koduna ve şablonlara girmez; yalnız bu istem ve INVENTORY'de durur, kodda `%USERPROFILE%`/config kullanılır.

## 6. Limit kuralları (pazarlıksız; bu oturumun en büyük riski)

- Bu oturum temiz başladı; **yarıda durup yeniden başlatılmayacak**. Bu yüzden kendi frenin sende.
- Her commit'ten sonra `mcp__ccd_session_mgmt__get_usage` (yoksa ToolSearch ile yükle). **5 saatlik pencere ≥ %75** ya da **haftalık Fable ≥ %90** ise: elindekini bitir ya da `WIP:` commit et, `docs/PROGRESS.md`'ye (bu depoda) "biten / yarım / sıradaki" yaz, sahibine sade özet ver, dur.
- Sık commit: her alt bölüm (3.1, 3.2 …) en az bir commit; 20 dakikayı geçen iş `WIP:` commit. Dal `main`, push yok.
- Ucuz çalış: büyük dosyaları gerektiği kadar oku (`sed -n`, grep); alt ajan açma; görüntü okuma yok; uzun çıktıları kes.
- Sıra (limit erken biterse en değerli olan bitmiş olsun): **3.4 şablonlar → 3.3 beceriler → 3.2 autonomy → 3.1 init/doctor → testler → 3.5 evrim → 3.2 delegate/metrics → adopt planı → 3.6 belgeler**.

## 7. Kesin yasaklar

- Fotosop'ta, `%USERPROFILE%\.claude` altında ya da sistemde değişiklik yok; program kurma, internetten indirme, push yok.
- Anahtar, e-posta, kişisel bilgi yazma; Fotosop'un `original\` (Adobe kurulumu) klasörüne bakma, hiçbir parçasını taşıma.
- Sahibine soru sorma; belirsizlikte en güvenli ve geri alınabilir seçenek + DECISIONS kaydı.

## 8. Bitirince

`docs/PROGRESS.md`'ye tek kayıt; sahibine sade Türkçe özet: ne kuruldu, nasıl denenir (iki komut), neler kaldı, Opus'un sonraki oturumda ne yapacağı (Fotosop'a `cv adopt --apply` ve ilk damıtma).
