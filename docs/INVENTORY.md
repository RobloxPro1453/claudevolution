# Envanter: Fotosop'taki dağınık hazine

Kaynak proje: `C:\Users\yasink\Desktop\fotosop` (dal `develop`). Çıkarım: Opus 5.5, 2026-11-12. Her parça: ne işe yarıyor, **E** = evrensel (her projede işe yarar), **Y** = yerel (Fotosop'a özgü), **K** = karışık (iskeleti evrensel, içeriği yerel; ayrılması gerek).

Fotosop'un kendi önceki ayırma notu `docs/workflow/ENGINE_IDEA.md` (bu deponun tohumu; okunmalı).

## 1. Kurallar ve belge sistemi

| Yol | Ne | Sınıf | Not |
|---|---|---|---|
| `AGENTS.md` (87 satır) | Ajan rehberi: "nereye bakmalı" tablosu, kesin kurallar, her değişiklikten sonra derle+test, Claude+DeepSeek iş bölümü, "projeyi ilerletme", **proje hafızası tablosu** (olay → yazılacak yer), **belge diyeti** | K | "Nereye bakmalı" + hafıza tablosu + belge diyeti evrensel şablon; kurallar 1-8 yerel |
| `GEMINI.md` (55) | Başka bir modele devir notu (kendi worktree'si, dal adı kalıbı) | K | "Yabancı model devri" şablonu |
| `docs/VISION.md` | Hedef, sahibinin kararları, bitiş çizgisi | K | Şablon: Hedef / Kararlar / Bitiş çizgisi / Değişmezler |
| `docs/PROGRESS.md` (294) | Oturum kayıtları, en üstte en yeni, ≤5 satır | K | Biçimi evrensel |
| `docs/ROADMAP.md`, `docs/CHECKUP.md`, `docs/KNOWLEDGE.md`, `docs/DEVELOPMENT.md`, `docs/ARCHITECTURE.md` | Yol haritası, bilinen hatalar, tuzaklar, derleme/test, mimari | K | Hepsi şablon olur; içerik yerel |
| `docs/WORKER.md` (62) | "Sürekli işçi modu": başlarken, döngü, tek tur, yeni iş bulma, takılınca, sınırlar, durma | E | Neredeyse tamamen evrensel |
| `docs/FEATURES.md`, `docs/ENGINE.md`, `docs/REVERSE_ENGINEERING.md`, `docs/re/`, `docs/LEGAL.md`, `docs/REFERENCES.md`, `docs/STATS_USAGE.md` | Ürün ve motor bilgisi | Y | Yalnız "RE kuyruğu" ve "özellik kaynak tablosu" kalıpları ilham |
| `CHANGELOG.md` | Kullanıcıya görünen değişiklik | E (biçim) | |

## 2. İş dağıtımı (Claude planlar, ucuz model yazar)

| Yol | Ne | Sınıf | Not |
|---|---|---|---|
| `docs/workflow/README.md` (163) | **Paket düzeni**: turda 8-30 kısa tarif, `ds.ps1 batch -Lanes N` ile paralel şeritler, her iş keşif → uygulama → otomatik düzeltme; gözden geçir, birleştir, belgele; maliyet; sorunlar | E | En değerli yöntem belgesi |
| `docs/workflow/OPTIMIZATION.md` (152) | Token teşhisi, değişmez kalite kuralları, Aşama 0-5 planı | E | Yöntem |
| `docs/workflow/ENGINE_IDEA.md` (56) | Ayırma tasarımı ve genel/yerel tablosu | E | Bu deponun tohumu |
| `docs/workflow/config.json` (44) | Dallar, worktree, derleme/test komutları, yasak yollar, kod klasörleri | K | Biçim evrensel (`.evrim/config.json`), içerik yerel |
| `docs/workflow/EXPERIMENTS.md`, `METRICS.md`, `metrics.jsonl` | Deney kaydı ve tur ölçümleri | K | Yöntem E, veri Y |
| `docs/tasks/README.md` | Ucuz ajanın kuralları (kapsam, test, ne zaman durur, rapor) | K | ~%60 evrensel; "Project rules" bölümü yerel |
| `docs/tasks/TEMPLATE.md`, `DS-0xx.md`, `DS-0xx.report.md` (47 iş) | Tarif şablonu ve gerçek örnekler | E (şablon) | Örnekler eğitim verisi: hangi tarif iyi sonuç verdi |
| `scripts/ds/agent.js` (593) | DeepSeek ajanı: araç döngüsü, yasak yol denetimi, döngü algılama, bütçe/adım sınırı, saate göre fiyat, test tekrarı, özet JSON, devam etme (resume) | K | Genel; `engine_search` ve CRLF düzeltmesi yerel eklenti olmalı |
| `scripts/ds.ps1` (109) | `batch -Lanes N [-From N]`, `status`, worktree'ler `%USERPROFILE%\fotosop-calisma\ds-N`, dallar `ds/DS-xxx`, loglar `build\ds\lane-N.log` | E | Yollar config'e |
| `scripts/round.js` + `round.ps1` | Tur ölçümü: Claude oturum kaydından çağrı/yük/bağlam, DeepSeek maliyet ve adım, `METRICS.md` üretimi | E | |
| `scripts/probe.ps1` (159) | Gerçek uygulamaya kısa betik, sınırlı JSON çıktı, ekran görüntüsü | K | Fikir evrensel ("probe" eklentisi) |
| `scripts/capture/` (`capture.ps1`, `Yakalama.cmd`, `ref_index.py`, `compare.py`, `shots.js`) | Referans uygulamadan ekran yakalama + isimlendirme, referans indeksi, yan yana karşılaştırma sayfası | K | "Referans eşleme" araç seti olarak evrensel |
| `scripts/re.ps1`, `re_extract.py`, `docs/re/` | Ucuz modelle tersine mühendislik haritası | Y | Kalıp ilham |

## 3. Claude becerileri ve otonomi

| Yol | Ne | Sınıf |
|---|---|---|
| `.claude/skills/durum/SKILL.md` | Oturum başı durum, hiçbir şeyi değiştirmeden | E (belge adları config'den) |
| `.claude/skills/calis/SKILL.md` | Bir tur: paket planla, çalıştır, birleştir, belgele | E |
| `.claude/skills/test/SKILL.md` | Test çalıştırma | K |
| `.claude/skills/fullotonom/SKILL.md` (~150) | **Gözetimsiz döngü**: limit kapıları (5s %85/%90, haftalık 60+30·f), sigorta uyanışı, zarar bekçisi, zaman kutuları, takılma noktaları, hafıza sistemi (DERSLER/GUNLUK/HATALAR/OZET) | E (Faz A/B içeriği yerel) |
| `.claude/loop.md` | Eski döngü istemi | E |
| `docs/tasks/AURA.md`, `AURA-RUN.md`, `FABLE-001.md` (fable worktree: `%USERPROFILE%\fotosop-calisma\fable\docs\tasks\`) | Büyük model briefleri: gözetimsiz çalışma, sık commit, limit bekçisi, rapor dosyasından devam | E (brief kalıbı) |
| Claude hafızası `%USERPROFILE%\.claude\projects\C--Users-yasink-Desktop-fotosop\memory\` (`MEMORY.md` + 6 not) | Oturumlar arası kalıcı geri bildirim | K |
| `build\otonom\` (fotosop) | Döngünün canlı hafızası (ilk gerçek koşu 2026-11-11 gecesi) | Y (veri) |

## 4. Bu hafta pahalıya öğrenilmiş dersler (evrensel; `evolution/universal/DERSLER.md` tohumu)

"Nereye gitti": dersin pakette kurala, koda ya da şablona dönüştüğü yer. "+ DERSLER": ayrıca `evolution/universal/DERSLER.md`'de tek satır olarak duruyor (her projeye `cv init` ile gelen yerel DERSLER'e değil, damıtma kaynağına).

| # | Ders | Nereye gitti |
|---|---|---|
| 1 | Ucuz model şeritleri oturumun arka plan görevi olarak başlatılırsa oturum kapanınca ölür → ayrık süreç (`Start-Process`) ile başlat; yeniden başlatmadan önce her şeritte WIP commit + `git checkout --detach`. | **Kod:** `core/delegate/lanes.js` (`spawn` detached, K12); `core/autonomy/recover.js` (ölü şerit kaydı). + DERSLER |
| 2 | Devam etme (resume) denetimi: dal yoksa `git log` hata verir ve hata metni "ilerideki commit" sanılır → çıkış kodunu kontrol et. | **Kod:** `core/lib/util.js` `run()` (başarıyı çıkış kodu belirler), `core/delegate/agent.js` (devam denetimi). + DERSLER |
| 3 | Yoğun saat fiyatı: DeepSeek hafta içi 01-04, 06-10 UTC pahalı → bekle. | **Config + kod:** `delegate.providers.*.peakUtc`/`offpeakFactor`; `core/delegate/lanes.js` yoğun saatte bekler, `agent.js` fiyatı saate göre. + DERSLER |
| 4 | 29 dal tek tek yeşilken birleşince 23 test kırıldı: sebep test yalıtımı (açık bırakılan belgeler, basılı kalan sentetik tuş, profilde kalan kayıt) → paket birleşmesinden sonra "takımı yeşile çek" işi ayrı tarif olarak planlanmalı. | **Beceri:** `skills/tr/calis` 4. adım ("takımı yeşile çek" işi baştan planlanır). + DERSLER |
| 5 | Toplamalı çakışmalar (komut tabloları, listeler) "iki tarafı koru" betiğiyle çözülür, ama virgül/parantez sonrası sözdizimi + JSON + yinelenen anahtar kontrolü şart. | **Beceri:** `skills/tr/calis` 8. adım (iki tarafı tut, sonra sözdizimi/JSON/yinelenen anahtar). + DERSLER |
| 6 | Derlenmiş ikili (wasm) çakışmada "bizimkini al" + kaynağa dokun → yeniden derlensin. | **Beceri:** `skills/tr/calis` 8. adım (ikili çakışma: birini al, kaynağa dokun). + DERSLER |
| 7 | Büyük model (Fable) 6 dakikada 5 saatlik pencerenin %57'sini yedi: durdurup yeniden başlatınca tüm bağlamı yeniden okudu. Büyük modelle **temiz oturum, tek nokta atışı istem**; yarıda yeniden başlatma. | **Beceri + belge:** `skills/tr/otonom` (bir çağrı = bir temiz çevrim); limit freni istemlerde (`docs/FABLE_PROMPT.md` §6). + DERSLER |
| 8 | Limit %100'e dayanınca tur ölür ve uyanış planlanamaz → döngü sahibi dönene kadar ölü. Kapılar %85/%90, çevrim başında sigorta uyanışı. | **Kod + config:** `core/autonomy/gates.js` (%85/%90, 60+30·f), `core/lib/config.js` (çıkış kapısı >%95 reddedilir), `safetyWakeSeconds`, `skills/tr/otonom` sigorta uyanışı. + DERSLER |
| 9 | `/loop` istemi tek eğik çizgi komutu kabul eder; yeni oturum kutusu eğik çizgi komutu hiç kabul etmez; `/loop` 3 gün, `CronCreate` 7 gün sonra biter ve yalnız oturum açıkken yaşar → kalıcı otonomi için uygulamanın **zamanlanmış görevi** (her seferinde temiz oturum) + kilit dosyası. | **Kod + belge:** `core/autonomy/TASK_PROMPT.txt` (düz metin), `core/autonomy/lock.js`, `core/autonomy/README.md` (zamanlanmış görev birincil). + DERSLER |
| 10 | Bilgisayar: uyku kapalı, kapak "hiçbir şey yapma", prize takılı, Windows Update duraklatılmış; ekran kararması sorun değil. Kapağın kapanması önceki durmanın sebebiydi. | **Kod:** `core/cli/doctor.js` (`powercfg` ile uyku/hazırda bekletme/kapak); `docs/OWNER_GUIDE.md` "Bilgisayar ayarları". + DERSLER |
| 11 | Gözetimsiz işte izin penceresi döngüyü kilitler → ilk 10 dakika sahibi başında, izin modu "Otomatik". | **Kod + belge:** `core/cli/doctor.js` (izin modu Otomatik, ilk 10 dk uyarısı); `docs/OWNER_GUIDE.md`. + DERSLER |
| 12 | Tek kopyalı uygulama kontrolü gizli test kopyasını "zaten açık" sanıp kendini kapattı → test pencereleri ayırt edilebilir olmalı. | **Şablon:** `templates/project/docs/DEVELOPMENT.md` (test süreçleri ayırt edilebilir). + DERSLER |
| 13 | Sahibinin psikolojisi: "kreş öğretmeni gibi her saniye kontrol" istemiyor; ama sürekli çalışan makine de tedirgin ediyor → sade OZET, net "uyuyor/çalışıyor" işareti, kolay "dur". | **Şablon + belge:** `.evrim/otonom/OZET.md`, `NOTLAR.md` (`DUR` kodda denetlenir, K10), `cv status` kilit satırı, `docs/OWNER_GUIDE.md`. + DERSLER |
| 14 | Kullanıcıya görünen iş ile ölçülen iş farklı: menü sayısı 449→612 olsa da sahibi "ucuz kopya" dedi → his/kalite ölçüsü ilk günden tanımlanmalı (kör test). | **Şablon + beceri:** `templates/project/docs/VISION.md` "His ve kalite ölçüsü", `skills/tr/cv-init` 4. soru. + DERSLER |
| 15 | Sayılarda dikkatsizlik güveni kırar (14'ü 16 dedi) → raporladığın her sayıyı komutla doğrula. | **Beceri + test:** `skills/tr/calis` 11. adım (her sayı komut çıktısından); `tests/docs.test.js` (rehberdeki sayılar config'e bağlı, K19). + DERSLER |
| 16 | Teşhis ölçümle: arayüz "his" sorunu piksel ölçümüyle yanlış tema sütununa (en koyu yerine varsayılan) indirgendi. | **Yalnız DERSLER** (koda dönüşecek genel bir araç yok). |

## 5. Eksik olan (bugün hiçbir yerde yok)

- `init` (iskelet üretici), sürümleme, `update` (şablon farkı).
- Evrensel ↔ yerel ders taşıma (damıtma) ve bunun ölçüyle doğrulanması.
- Zamanlanmış görev tabanlı otonomi ve kilit.
- Sahibinin asenkron kanalı (soru bırakma / cevap okuma) temiz oturumlar arasında.
- Çoklu proje: aynı makinede iki projenin limit paylaşımı.
