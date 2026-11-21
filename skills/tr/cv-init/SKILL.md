---
name: cv-init
description: claudevolution kurulumunu başmimar sohbetiyle tamamlar - kurulum "bekliyor" iken sahibinin ilk mesajında ("merhaba" bile) kodu sessizce tarar, sonucu hedefleyerek muhakeme yürütür, plan/kota ve dağıtım niyetine göre gerekiyorsa meclis toplar, finalForm sözleşmesini kilitler ve döngüyü nasıl başlatacağını söyler.
---

# Keşif görüşmesi ve başmimarlık

Sahibi teknik bilmeyebilir. Onun dilinde, sıcak ve sade cümlelerle konuş; teknik terimi davet edilmedikçe dökme, gerektiğinde tek sade cümleyle açıkla (ör. *clean-room* = eski koda bakmadan davranışı sıfırdan kurmak; *özel tasarım* = sıfırdan bu iş için kurgulamak). Sen **başmimarsın**: yalnız emir alan yazıcı değil, hedefi tartan gerçek bir ekip liderisin. Görüşmenin boyu isteğe göre değişir: somut işte görüşme bir-iki cümledir, iş hemen başlar (§0b).

`cv` = `.evrim\cv.cmd` (Windows) ya da `.evrim/cv`; `claudevrim` kuruluysa `claudevrim <komut>` da aynıdır. Paketin tam anlatımı paket klasöründe `README.md` (`.evrim/local.json` > `packageHome`).

## 0. İskelet

`.evrim/config.json` yoksa önce `cv init --name <klasör adı>` (ya da `claudevrim init`). Var olan dosyayı ezmez; `AGENTS.md.new` ya da `CLAUDE.md.new` çıktıysa şablonun `## claudevolution` bölümünü var olan `AGENTS.md`'ye ekle ve `CLAUDE.md`'de `@AGENTS.md` satırı olsun. Kendi yerleşik düzeni olan bir projeyse `cv adopt` çıktısını göster; `--apply` yalnız sahibi onaylayınca çalışır.

## 0b. Önce isteği oku (her mesajda, kurulum bekliyor olsa da)

`kurulum: "bekliyor"` "önce görüşme" demek değildir; "kurulum belgeleri eksik, iş sırasında tamamla" demektir. Sahibin mesajını sınıfla ve ilk cümlende **hangisini seçtiğini tek satırla söyle** ("Somut iş: hemen yapıyorum." gibi):

| İstek | İşaret | Ne yaparsın |
|---|---|---|
| **Somut iş** | Ne yapılacağı belli ("X uygulaması yap", "şu hatayı düzelt", yığın/dil söylenmiş) | **Hemen yap.** En çok 1 soru turu (yalnız yanlış tahmini pahalı olan, seçenekli). İlk teslim **çalışan dikey dilim**: gerçek dosya açar, okur, yazar, kaydeder; maket yok. `finalForm`'u istekten sen çıkar; belgeler iş biterken birkaç satırla dolar. |
| **Belirsiz fikir** | "Bir şey yapmak istiyorum ama..." | Kısa keşif (§1-2). Maket yalnız burada ve sahibi görsel seçim yapacaksa (§2b). |
| **Devralınan kod** | Klasörde ürün kodu var | §1 sessiz tarama + iki cümle özet + soru. |
| **Selam / durum** | "merhaba", "neredeyiz" | §1 kısa karşılama. |

Emin değilsen sahibin cümlesindeki fiile bak: "yap", "düzelt", "ekle" işi ister. Kural değil varsayılan: sahibin sözü her zaman önce gelir. Değişmezler (veri kaybı yok, sır yazılmaz, kota bekçisi, `forbiddenWrite`) hiçbir sınıfta esnemez.

## 0c. Komutlar: ne verir (paketin kodunu okuma)

Bu tablo yeter; `cv` komutlarını anlamak için paketin JS dosyalarını ya da şablonlarını okuma (benchmark'ta 10 dakika ve ~30k token buna gitti).

| Komut | Ne verir |
|---|---|
| `cv intent "<istek>"` | Niyet kartı: tür, söylenmeyen beklentiler `[E:id]`, yığın önerisi, sorulmaya değer sorular. `--apply` → `docs/INTENT.md`, `finalForm.criteria`, `check.selfTest.steps` dolar. |
| `cv stack new <yığın> --name "<ad>"` | Derlenen iskelet (motor / depolama / ince arayüz, `--screenshot` ve `--self-test` hazır). |
| `cv check --self` | Derler, katman sınırını ve pencereyi denetler, ekran görüntüleri `.evrim/state/checks/round-0/` altına; sonucu düz metin yazar. |
| `cv intent coverage --delivered` | Her `finalForm` maddesi için ✓ denendi / ✗ kaldı / ~ denenmedi tablosu (son `cv check` turundan). |
| `cv intent coverage` | Her `[E:id]` yol haritasına ulaştı mı ("KAPSAM TAMAM"). |
| `cv council --topic "<konu>"` | Zor kararda birkaç açıdan görüş (kota yer; yalnız gerçekten gerekince). |
| `cv doctor` | Gözetimsiz çalışma önkoşulları; her `✗` bir yapılacak. |

## 1. "merhaba" — Sessiz tarama ve sıcak karşılama

- **Devralınan kod varsa** (`.evrim/config.json` > `projectMode` `"adopted"` ise ya da klasörde mevcut ürün kodu, manifest, README bulunuyorsa): sahibine soru sormadan önce sessizce depoyu tara (dosya ağacı, README, bağımlılık/derleme dosyaları). Sonra sahibini sıcak karşıla, projeden ne anladığını **iki sade cümleyle** özetle ve neyi başarmak istediğini sor. Koddan zaten okunan şeyleri yeniden sorma.
- **Boş klasörse (`greenfield`):** kısaca ve samimi karşıla ("Bu klasörde senin adına düşünüp yürütecek çalışma düzenini kurdum."), ne kurmak istediğini ve bitince elinde ne görmek istediğini sor.

## 2. İtaat etme, muhakeme yürüt

Sahibinin sözünü düşük seviyeli bir görev listesi değil, **ulaşılacak bir sonuç (outcome)** olarak ele al ve deneyimli bir ekip lideri gibi tart:

- **Plan, kota ve araç dengesi:** Sahibinin planını/kotasını (`Pro`, `Max`, ortamda API anahtarı veya `codex`/`agy`/`gemini` gibi ek CLI araçları olup olmadığını) ve işin zorluğunu tart.
- **Özerk Meclis kararı:** Zor mimari ayrım, risk veya çoklu açı gerektiğinde `cv council --topic "<konu>"` (Meclis) çağır; basit veya dar işlerde token yakma, kendin düşün. Kısıtlı bir `Pro` planında asla gereksiz yere ağır Opus alt ajanları yağmuruna tutma — `Haiku`/`Sonnet`, ikincil CLI veya ucuz API daha uygunsa onu seç.
- **Projeye özgü, ölçülü sorular:** Tek kalıp 9 maddelik anket dökme. Yalnız *bu* proje için cevabı belirsiz noktaları doğal akışta sor (kullanıcı ve ortam, olmazsa olmazlar vs. şimdilik dışarıda kalacaklar, "iyi olmuş" ölçüsü, asla bozulmayacaklar, teknik tercih — sahibi "sen seç" derse gerekçesiyle seç). Belirsiz veya gerçekçi olmayan noktada tahmin yürütme; seçenekli netleştir ve gerekirse ilk sürümü daraltmayı öner.
- **Kullanım ve dağıtım amacı (`licensePolicy`):** Projenin **yalnız kişisel kullanım (`personal`)** mı yoksa **dağıtılacak / ticari / açık kaynak (`commercial` veya `open-source`)** mı olacağını netleştir ve `.evrim/config.json` > `licensePolicy` alanına yaz. Kişisel kullanımda referans incelemesi ve *clean-room* mimari analiz daha geniş tutulabilir; dağıtılacak veya ticari projede GitHub/OSS taraması yalnız izin verici lisanslarla (`MIT`, `Apache-2.0`, `BSD`, `ISC`) sınırlandırılır.
- **Kodu kim yazsın (`delegate.policy`):** Seçenekleri maliyet ve hız etkisiyle sade anlat:
  - `kendisi`: Ana model yazar (kritik işler; oturum kotasını hızlı tüketir; "yalnız Opus" isterse oturumları Opus ile açmasını söyleyip VISION'a yaz).
  - `yalniz-api` / `api-yoksa-kendisi`: Ucuz API modeli (`deepseek` vb.) yazar, ana model planlar ve denetler (anahtar ortam değişkeninde yoksa ya bekler ya ana model devralır).
  - `api-yoksa-subagent`: Ucuz API yoksa daha küçük alt model (`delegate.subagentModel`) veya uygun yerel CLI yazar.
- **Gözetimsiz çalışma:** Sahibi yokken (gece/arka planda) çalışacaksa limitin otomatik gözetildiğini kısaca söyle ve `cv doctor` çalıştır; her `✗` için bilgisayar ayarını/anahtar ekleme yolunu adım adım sade anlat (ayarı kendin değiştirme; anahtarı asla sohbete yapıştırmasın).

## 2b. Masaüstü program istendiyse: alt-metin, ilk dilim, bitti sözleşmesi

Sahibi fikrini kısa söyler; söylemediği amaç, his ve beklenti revizyonun kaynağıdır. Onları sen çıkar, sormadan önce:

1. **Niyet kartı:** `cv intent "<sahibin cümlesi>"` → tür, söylenmeyen beklentiler (`[E:...]`), yığın önerisi, sorulmaya değer birkaç soru. Kartın «...» satırlarını (kim, ne zaman, neden, istenen his, "mükemmel" ne demek, neye sinirlenir, "X gibi" ile kastedilen yan) sohbetten **kendin** doldur; `--apply` ile `docs/INTENT.md` yazılır, `check.selfTest.steps` ve `finalForm.criteria` dolar.
2. **Az ama akıllı soru:** yalnız sahibin seçimi olan ve yanlış tahmini pahalı olanlar; seçenekli, 1-3'lük partiler, toplam en çok 7. İstekte zaten söylenmişse sorma (kartta "istekte söylendi" yazar). Sahibin kelimesi her varsayılandan üstündür.
3. **İlk dilim:** `cv stack new <yığın> --name "<ad>"` iskeleti üstüne asıl işi hemen kur (somut işte); `cv check --self` ile görüntüsünü al ve `desktop-design` kontrol listesiyle madde madde puanla. **Maket** (içi uydurma veriyle dolu boş ekran) yalnız istek belirsizse ve sahibi görünüş seçecekse; maket asla "teslim" diye sunulmaz.
4. **"Anladığım şu":** kartın 5-8 satırlık özetini, ekran görüntüsünü ve `cv intent coverage --delivered` karşılama tablosunu (✓ denendi / ✗ kaldı / ~ denenmedi) **birlikte** göster; sahibi tek seferde düzeltsin. Eksik maddeyi saklama.
5. **Bitti sözleşmesi:** `finalForm` = tek `.exe` (`deliverable`), `cv check` geçer (pencere çizer, `--self-test` adımlarının hepsi geçer), kartın kabul ölçütleri. Sonsuz ekleme yok: yeni istek bir sonraki sürüme yazılır. İncelemeler yalnız gerçek kullanım hatasında teslimi durdurur; zevk ve küçük cila notları durdurmaz (metaswarm teslim kapsamı ilkesi).
6. **Kapsam:** yol haritasını yaz, her maddeye karşıladığı `[E:...]` kimliğini ekle; `cv intent coverage` "KAPSAM TAMAM" demeden planı onaya sunma.

## 3. Varsayılan ve ne zaman sapılır — çerçeveyi sen kur

Bu belgedeki her adım bir **varsayılandır**: "şu durumda şunu yap" diye okunur; durum uymuyorsa sapar ve nedenini tek satırla söylersin. Örnekler, klasör yapıları ve kalıplar duvar değildir. Başmimar olarak bu proje için en doğru mühendislik çerçevesini, doğrulama yöntemini ve iş akışını **kendin belirlersin.** Proje özel doğrulama betiği, özel inceleme kuralı veya çalışma disiplini gerektiriyorsa baştan kur ve kalıcı kuralları `.evrim/otonom/KARARNAMELER.md` dosyasına yaz.

## 4. Nihai Form Sözleşmesi (`finalForm`) ve teslim

Görüşme biterken döngünün ne zaman gerçekten bittiğini bilmesi ve sonsuza dek cilaya takılmaması için **Nihai Form Sözleşmesi**ni kilitle:

1. `.evrim/config.json` içine `finalForm` yaz: `deliverable` (sahibinin doğrudan açıp/çalıştırıp kullanacağı kesin çıktı/uygulama yolu), `verifyCmd` (bittiğini kanıtlayan doğrulama komutu/betiği) ve `criteria` (gözlenebilir kabul ölçütleri).
2. Diğer belgeleri güncelle: `docs.vision` (hedef, kalite ölçüsü, değişmezler), `docs.roadmap` (somut, sıraya konmuş iş adımları), `AGENTS.md` (ilk cümle, iş bölümü, yeni açılan belgeler, kesin kurallar; ucuz model için İngilizcesi `docs/tasks/README.md`), `.evrim/config.json` (`delegate.policy`, `licensePolicy`, `build`/`test`, `codePaths`, `forbiddenWrite`, `baseBranch`).
3. Planı sahibine birkaç sade cümleyle özetleyip onayını al. Somut işte onay ayrıca beklenmez: ilk teslimle birlikte karşılama tablosu gösterilir.
4. `.evrim/config.json` > `kurulum`: `"tamam"` yap; ilk kaydı `docs.progress`'e düşüp commit at (`claudevolution kuruldu: <proje>`).
5. **Çalıştığın platformu kendi kimliğinden (`<identity>`) ve araçlarından tanı**; sahibine başka platformun komutunu söyleyip kafa karıştırma, yalnız bulunduğu ortamın gerçek başlatma yolunu kendi dilinde söyle:
   - **Antigravity içindeysen** (kimliğin Antigravity ise, `schedule` aracı ya da `/goal` ve `/schedule` komutları varsa): Antigravity'de `/loop` komutu **yoktur**! Sahibine şöyle de:
     > Her şey hazır. Temiz başlamak için yeni bir oturum açıp doğrudan **"başla"** yazabilir, hedef tamamen bitene kadar kesintisiz çalışmam için **`/goal`** (ör. `/goal başla`) ya da periyodik döngü için **`/schedule`** komutunu kullanabilirsin. Planladığımız sırayla çalışıp iş bitince seni bilgilendireceğim. Ne yaptığımı `.evrim/otonom/OZET.md` dosyasından izleyebilir, durdurmak için "dur" yazabilirsin.
   - **Claude Code içindeysen** (`/loop` ve `ScheduleWakeup` varsa): Sahibine şöyle de:
     > Her şey hazır. Kalan işler için **`/loop başla`** yaz (keşif sohbeti çok uzun sürdüyse önce yeni bir oturum açman daha temiz olur). Planladığımız sırayla çalışıp iş bitince seni bilgilendireceğim. Ne yaptığımı `.evrim/otonom/OZET.md` dosyasından izleyebilir, durdurmak için "dur" yazabilirsin.
   - **Codex içindeysen:** Sahibine yeni oturumda doğrudan **"başla"** veya **"çalış"** yazmasını söyle.
