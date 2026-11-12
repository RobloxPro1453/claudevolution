# Kararlar

Her mimari karar: seçenekler, seçilen, neden. Fable 5.2, 2026-11-12, gözetimsiz kurulum oturumu (sahibine soru sorulmadı; belirsizlikte en güvenli ve geri alınabilir seçenek).

## K1. Çalışma ortamı: Node **ya da** Deno (tek kod)

- **Durum:** İstem "Node (Fotosop'ta zaten var)" diyordu; makinede Node **yok**, Fotosop'un araçları Deno ile çalışıyor (Deno 2.9.8 kurulu). Program kurmak yasak.
- **Seçenekler:** (a) yalnız Deno API'si (Fotosop gibi), (b) yalnız Node, (c) yalnız `node:` standart kütüphanesiyle ESM yazıp ikisinde de çalıştırmak.
- **Seçilen: (c).** `package.json` `"type": "module"`; bütün kod `node:fs`, `node:path`, `node:child_process` kullanır. `bin/cv.cmd`, `cv.ps1`, `cv` önce `node`, yoksa `deno run -A` çağırır. Bu makinede testler Deno ile koşuldu (`deno run -A tests/run.js`); Node kurulunca `node tests/run.js` aynı dosyayı çalıştırır.
- **Neden:** hiçbir şey kurmadan bugün çalışır, yarın Node'lu makinede de çalışır; dış paket yok.
- **Bedel:** Deno'da `-A` (tüm izinler). Fotosop ajanı dar izinle (`--allow-net=<api>`) koşuyordu; ajan için dar izin `bin/` sarmalayıcısına sonradan eklenebilir (yapılacaklar).

## K2. Dış bağımlılık: sıfır

Node standart kütüphanesi + git. Test çatısı da elle (`tests/harness.js`, 40 satır): bir test kütüphanesi kurulum ve ağ ister, gözetimsiz makinede kırılma noktasıdır.

## K3. Beceriler projeye **sürüm damgalı kopya** olarak girer (bağlantı değil)

- **Seçenekler:** (a) sembolik bağlantı / junction, (b) kopya.
- **Seçilen: (b).** Her `SKILL.md` sonuna `<!-- claudevolution <sürüm> -->` damgası konur; `cv update` farkı gösterir.
- **Neden:** Windows'ta sembolik bağlantı yönetici izni ister; junction mutlak yol taşır (başka makinede, taşınan klasörde kırılır) ve git'e girmez. Kopya git'te görünür: projede hangi kuralın geçerli olduğu commit geçmişinden okunur, paket güncellenince proje **habersiz** değişmez (evrim koruması: değişiklik `cv update` ile, farkı görerek alınır).
- **Bedel:** güncelleme elle tetiklenir; `damit` becerisi kendi projesinde `cv update` çağırır.

## K4. Paketin yeri: git'e girmeyen kısayol (`.evrim/cv`, `.evrim/cv.cmd`, `.evrim/local.json`)

Beceriler `cv` komutunu `.evrim/cv` üzerinden çağırır. Kısayol paketin bu makinedeki yolunu bilir, `.gitignore`'dadır ve `cv init` her çalıştığında yeniden üretilir; `CV_HOME` ortam değişkeni onu ezer. Böylece makineye özgü mutlak yol ne paket koduna, ne şablona, ne de projenin git geçmişine girer (bitti ölçüsü 7).

## K5. Hesap koda, karar beceriye

Kapı hesabı, kilit, sayaçlar, günlük kaydı ve hafıza özeti `cv cycle begin / end` içindedir; `otonom` becerisi yalnız kararı ve sırayı anlatır. **Neden:** Fotosop'un `fullotonom` metni 120 satırdı ve her çevrimde yeniden okunuyordu; hesabı model yapınca hem kota yanıyor hem hata çıkıyordu (ders 15: yanlış sayı güveni kırar). Kod test edilir (`60 + 30·f`, bayatlık, eşikler), beceri kısalır, çevrim başı tek komut çıktısı okunur.

## K6. Kapı eşiklerinin üst sınırı kodda

`fiveHourExit` en çok 95, `weeklyBase + weeklySlope` en çok 95 (config doğrulaması reddeder). **Neden:** ders 8: limit %100'e dayanırsa tur ölür ve uyanış planlanamaz. Eşik config'de ayarlanabilir ama ölümcül değere çekilemez.

## K7. Aynı makinede birden çok proje: makine kilidi + ağırlıklı sıra

- **Tasarım:** `~/.claudevolution/lock` (aynı anda tek projede çevrim) ve `~/.claudevolution/projects.json` (proje başına ağırlık ve bu kota haftasında kullandığı çalışan çevrim sayısı). Bir proje, `kullanılan/ağırlık` değeri en az hizmet alan etkin projenin bir çevrimden fazla önüne geçmişse `SIRA_DEGIL` alır. 48 saattir görünmeyen proje etkin sayılmaz. Kapılar ortak toplam kotaya uygulanmaya devam eder.
- **Neden basit:** kota hesabın tamamına ait tek sayı; proje başına kota ölçülemez. Çevrim sayısı, ölçülebilen tek adil birim.
- **Not:** klasör ilk çevrimde oluşur, `cv init` oluşturmaz. `CV_STATE_HOME` ile yeri değişir (testler bunu kullanır).

## K8. Yasak yolların çekirdeği config'den bağımsız

`.git`, `.evrim/`, `.claude/` ucuz modele her zaman yasaktır (`ALWAYS_FORBIDDEN`), proje listesi boş olsa bile. Proje listesi `forbiddenWrite` varsayılanla **birleştirilmez**, olduğu gibi kullanılır (sahibi bir yolu bilerek açtıysa paket varsayılanı onu sessizce geri kapatmasın; ama çekirdek üçlü açılamaz). Evrensel güncelleme ve damıtma bu alana dokunmaz.

## K9. Otonom hafıza git'e girer; kilit ve durum girmez

Fotosop'ta hafıza `build/` altındaydı (git dışı). Burada `DERSLER`, `GUNLUK`, `HATALAR`, `OZET`, `SORULAR`, `NOTLAR` izlenir. **Neden:** damıtma "son damıtmadan beri eklenen dersler"i ve sahibinin itirazlarını geçmişten okur; sahibi başka cihazdan bakabilir; kayıp riski kalmaz. `lock`, `state/`, kısayollar `.gitignore`'da.

## K10. Sahibinin asenkron kanalı: `NOTLAR.md` (sahibi → ajan), `SORULAR.md` (ajan → sahibi)

Zamanlanmış görev her seferinde temiz oturum açtığı için sohbet kalıcı kanal olamaz. `DUR` tek satırı her çevrimi kapıda durdurur (kod denetler, modelin yorumuna kalmaz). İtiraz içeren notlar sayılır: evrim ölçüsü `sahip-itirazi`.

## K11. Kurulum becerisinin adı `cv-init`

İstem `init` diyordu; Claude Code'un yerleşik `/init` komutu (CLAUDE.md üretir) aynı adı kullanıyor. Çakışmamak için `cv-init`.

## K12. Şeritler JavaScript'te ve ayrık süreç (PowerShell değil)

`ds.ps1`'in genel hâli `core/delegate/lanes.js`: `spawn(..., { detached: true })` + günlük dosyası + pid kaydı. **Neden:** ders 1 (oturumun arka plan görevi oturumla ölür); tek dil; Linux/macOS'ta da çalışır. `Start-Job` kullanılmaz (çağıran süreçle ölür).

## K13. CRLF düzeltmesi paketle gelen eklenti (`builtin:crlf`)

İstem "projeye özgü, eklenti olsun" diyordu. Düzeltme Fotosop'a değil Windows + `core.autocrlf`'e özgü; her Windows projesinde aynı döngüye (60 kez tekrarlanan düzenleme) yol açar. Eklenti arayüzünden yüklenir (çekirdek ajan onu bilmez) ama şablon config'de varsayılan açıktır; LF dosyada etkisizdir. `engine_search` gibi gerçekten projeye özgü araçlar projenin kendi eklenti dosyasında kalır.

## K14. `cv doctor` komutları çalıştırmaz (varsayılan)

Derleme/test programının PATH'te olduğuna bakar; gerçekten koşturmak `--run` ile (süre sınırlı). **Neden:** `cv init` sonunda otomatik çalışıyor; habersiz 15 dakikalık test koşusu ve yan etkileri istenmez.

## K15. Dil

Şablonlar ve beceriler Türkçe tam. Ucuz modelin kuralları (`docs/tasks/README.md`, tarif şablonu) İngilizce: model İngilizce kuralda daha tutarlı ve Fotosop'ta denenmiş hâli bu. `--lang en` seçilince İngilizcesi olan beceri kullanılır, olmayan Türkçe kalır (`skillSources`).

## K16. Temizlenen yan etki

İlk elle denemede `cv cycle begin` gerçek ev klasöründe `~/.claudevolution` oluşturdu (istem: "sistemde değişiklik yok"). İçeriği yalnız bu denemenin kaydıydı; silindi. Testler `CV_STATE_HOME` ile geçici klasöre yazar; `tests/harness.js` bunu içe aktarmadan önce ayarlar.

## K17. `cv round`: Fotosop betiğinin aynısı, kaynakları config'den

`core/metrics/round.js` Fotosop `scripts/round.js`'in alan alan aynısı (start/end/add/show/table, aynı yük formülü), şu farklarla: yollar ve ağırlıklar `.evrim/config.json`'dan (`metrics.*`, `delegate.stateDir`, `tasks.pattern`, `codePaths`); ucuz model alanı `deepseek` yerine `delegate` (sağlayıcıdan bağımsız; eski satırlar `deepseek` alanıyla da okunur); Claude kayıt klasörü verilmezse proje yolundan türetilir (Claude Code'un adlandırması: harf/rakam dışı her karakter "-"); ucuz modelin kodu `delegate.commitTrailer` ile ayrılır; tablo `metrics.table` (varsayılan `.evrim/METRICS.md`). `round.ps1` taşınmadı: `cv.cmd/cv.ps1` sarmalayıcısı aynı işi görür. **Neden:** Fotosop'ta bir hafta kullanılmış ölçüyle geçmiş satırlar karşılaştırılabilir kalsın.

## K18. `cv adopt`: yalnız bilinen yerlere bakar, hiçbir şeyi taşımaz

Seçenekler: (a) projeyi baştan sona tarayıp her dosyayı sınıflamak, (b) bilinen yerleri (kök dosyalar, `docs/`, eski iş akışı config'i, `docs/tasks`, `scripts/`, `.claude/skills`, otonom hafıza klasörü) kurallarla eşlemek, gerisini klasör adıyla "dokunulmaz" yazmak. **Seçilen (b).** Neden: üçüncü taraf/kurulum klasörleri (ör. `original/`) asla okunmaz; plan kısa ve okunur kalır; kurallar genel (Fotosop adı kodda yok). Eylemler: config / kopya / birleştir / yeni / emekli / eklenti / kalır / dokunulmaz. `--apply` yalnız yeni dosya yazar (önce kopyalar, sonra `cv init`; böylece eski DERSLER boş şablonun önüne geçer), hiçbir dosyayı taşımaz ya da silmez; "emekli" dosyaları sahibi bir tur sorunsuz geçtikten sonra siler. Makineye özgü `claudeProjectDir` alınmaz (türetilir). Henüz yazılmamış eklenti (`engine-search`) `delegate.plugins`'e eklenmez: eksik eklenti dosyası her ucuz model çalıştırmasını durdururdu; ayarları `delegate.engineSearch`'te bekler. Ucuz model commit'leri ölçümde imzadaki e-postayla tanınır (eski commit'ler adın yanında model taşıyordu). Fotosop'ta yalnız `--dry-run --out docs/examples/fotosop-adopt-plan.md` çalıştı; Fotosop `git status` önce ve sonra temiz. INVENTORY'deki her satır planda bir eyleme düştü; bu checkout'ta olmayan `compare.py`/`shots.js`/fable worktree briefleri aynı kurallarla eşlenir (`compare.*` → `cv ref compare`, `docs/tasks` içindeki briefler → kalır).

## K19. OWNER_GUIDE komut değil cümle öğretir

Sahibi teknik bilmiyor; rehber her işi "Claude'a şunu yaz" ya da "şu dosyaya şunu yaz" diye anlatır, terminal komutu içermez. Kapı yüzdeleri, kilit süresi ve gösterilen dosyalar `tests/docs.test.js` ile config ve şablonlara bağlı: biri değişirse test kırılır, rehber yalan söylemez (ders 15: her sayıyı doğrula).

## K20. INVENTORY §4 tabloya döndü; her hücre testle doğrulanır

16 ders numaralı listeden "# · Ders · Nereye gitti" tablosuna çevrildi. 15'i koda, config'e, beceriye ya da şablona dönüştü; 16. ("his sorununu ölçülebilir parçaya indir") yalnız DERSLER'de: koda dönüşecek genel bir araç yok. Hepsi ayrıca `evolution/universal/DERSLER.md`'de. `tests/docs.test.js` 16 satırın varlığını ve hücrelerin gösterdiği dosyaların depoda olduğunu denetler: bir dosya taşınırsa tablo yalan kalmaz.
