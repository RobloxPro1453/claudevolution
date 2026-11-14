# claudevolution

**Claude Code, Codex ve Antigravity projeleri için kendini geliştiren otonom yazılım ofisi.** Bir projeye tek komutla belge ve kural sistemi, plan/kota duyarlı meclis, ucuz modele/ikincil CLI'lara iş dağıtımı, gözetimsiz (kota ve tempo yöneten) otonom çalışma ve her turdan ders çıkaran bir evrim döngüsü kurar.

*A self-evolving autonomous software office for Claude Code, Codex, and Antigravity projects: one `cv init` gives a project its rules and memory docs, plan-aware council, multi-CLI/cheap-model delegation, unattended quota- and tempo-aware autonomy (`KARAR: BITTI` completion gate + self-tuning decrees), and a learning loop that keeps project-specific lessons local and sends general ones to the package.*

> **Bu dosyayı okuyan model:** sistemin tamamı aşağıdaki beş bölümde. Ayrıntı becerilerde (`skills/tr/*/SKILL.md`, İngilizcesi `skills/en/`) ve `core/*/README.md` içinde. Bu paketin kendisinde çalışıyorsan kuralların [AGENTS.md](AGENTS.md).

## 1. Ne bu

İki katman:

| Katman | Nerede | Ne tutar |
|---|---|---|
| **Paket (evrensel)** | bu depo (`git clone https://github.com/RobloxPro1453/claudevolution`) | `cv` komutu, beceriler, proje şablonu, ölçüm takımı, bütün projelerin evrensel dersleri (`evolution/universal/`) |
| **Proje (yerel)** | projede `.evrim/`, `.claude/skills/`, `.codex/skills/`, `.agent/`, `AGENTS.md`, `docs/` | proje ayarları (`.evrim/config.json`), otonom hafıza ve kararnameler (`.evrim/otonom/`), projeye özgü dersler |

Projedeki `.evrim/cv.cmd` (Windows) ya da `.evrim/cv` paketi bulan kısayoldur; paketin yeri `.evrim/local.json` > `packageHome` (ya da `CV_HOME` ortam değişkeni). Aşağıda `cv` = o kısayol.

## 2. Bir projeye kurmak

**Sahibinin yolu (hiçbir şey indirmeden, derlemeden):**

1. **Bilgisayara bir kez:** GitHub'da bu deponun **Releases** sayfasından en son `claudevrim.exe`'yi indir (macOS/Linux: `claudevrim-macos` / `claudevrim-linux`) ve çift tıkla. Kendini `%USERPROFILE%.claudevrimin`'e kopyalar, orayı kullanıcının PATH'ine ekler, paketi GitHub'dan `~/.claudevrim/paket`'e indirir, bu makinenin evrensel ders klasörünü (`~/.claudevrim/evrensel/`) açar ve makine becerisini `Claude`, `Codex` ve `Antigravity` için yazar (`cv setup`). Node, Deno, npm gerekmez; exe kendi çalışma ortamını taşır. Git gerekir (Claude Code zaten ister).
2. **Her yeni proje:** proje klasöründe terminal aç, `claudevrim init` yaz, terminali kapat. Komut önce paketi GitHub'dan günceller, sonra klasörü kurar (git deposu değilse açar, kurduğu dosyaları ilk commit'e koyar; projenin kendi dosyalarına dokunmaz; becerileri `.claude/skills/`, `.codex/skills/`, `.agent/skills/` ve `.agent/workflows/loop.md` olarak yerleştirir).
3. **Claude, Codex veya Antigravity uygulamasında** o klasörü aç, **"merhaba"** yaz. Config'te `"kurulum": "bekliyor"` olduğu için oturum ilk mesaj ne olursa olsun `cv-init` keşif görüşmesini başlatır: var olan kod varsa sessizce tarayıp iki cümleyle özetler, sonucu hedefleyerek başmimar gibi tartar (plan/kotaya göre gerekirse `cv council` toplar, `licensePolicy` ve `delegate.policy` belirler, `finalForm` bitiş sözleşmesini kilitler) ve sonunda "yeni oturum aç, merhaba yaz, `/loop başla` yaz" (veya platform eşdeğeri) der.
4. Yeni oturumda **`/loop başla`** (Antigravity'de `.agent/workflows/loop.md` eşdeğeri): `otonom` becerisi çevrim çevrim çalışır, iş bitince `KARAR: BITTI` ile durur. Paket güncellemesi: `claudevrim guncelle` (projede ayrıca `cv update --apply` yapar).

Paket klasörü bir projenin içine kopyalanmışsa da (`<proje>/claudevolution/`) makine becerisi onu tanır ve kurulumu oturum kendisi yapar; paket klasörü `.gitignore`'a girer.

**Geliştirici (paketin bakımcısı):** paketi git ile klonla, `claudevrim gelistirici <klon>` (ya da exe olmadan doğrudan klondaki `bin/cv`). Evrensel dersler o zaman pakete gider (ölçülür, push edilir). Release'i `.github/workflows/release.yml` her kabul edilen sürümde kendisi derler ve yayınlar.

Elle (exe olmadan):

1. Paketi bir kez klonla (yer serbest; ör. kullanıcı klasörü). **Node ≥ 18 ya da Deno 2** yeter, `npm install` yok.
2. Projenin klasöründe: `<paket>/bin/cv.cmd init --name <ad>` (Windows; macOS/Linux `<paket>/bin/cv init`). Var olan dosyayı ezmez, farklıysa yanına `.new` bırakır; ikinci kez çalıştırmak bir şey değiştirmez. Kurar: `AGENTS.md` + `CLAUDE.md`, `docs/` (VISION, ROADMAP, PROGRESS…), `.evrim/` (config, hafıza, kısayollar), `.claude/skills/` (durum, calis, otonom, damit, cv-init). Git deposu olmalı.
3. Claude oturumunda **`cv-init` becerisi** ("claudevolution kurulumunu tamamlayalım"): config'i doğrular, VISION'ı sahibinin sözleriyle doldurur, ilk yol haritasını yazar, `cv doctor` ile gözetimsiz çalışma önkoşullarını söyler.
4. Projede zaten kendi düzeni varsa `init` yerine `cv adopt` (plan) → sahibi onaylarsa `cv adopt --apply`.
5. Paket yeni sürüm aldığında projede `cv update` (farkı gösterir) → `cv update --apply` (yalnız beceri kopyaları, `.evrim/README.md`, kısayollar; config'e ve proje belgelerine dokunmaz).

## 3. Günlük kullanım

| Sahibi ne der | Ne çalışır |
|---|---|
| "durum", "neredeyiz" | `durum` becerisi: değiştirmeden durum + sıradaki paket önerisi (`cv status`) |
| "çalış", "devam et" | `calis` becerisi: bir tur = bir paket iş (8-30 tarif). Kodu kim yazar: `.evrim/config.json` > `delegate.policy` (aşağıda); `cv delegate which` söyler |
| zamanlanmış görev "otonom becerisini yükle ve bir çevrim yap" ya da `/loop başla` (eşdeğeri `/loop otonom becerisini çalıştır`) | `otonom` becerisi: **tek çevrim** (aşağıda) |
| "damıt" | `damit` becerisi: yerel dersleri sınıfla, genel olanı pakete taşı, eski evrim değişikliklerini ölç |
| `.evrim/otonom/NOTLAR.md`'ye `DUR` / `ÖNCE: <iş>` | döngü durur / o iş öne geçer |

**Otonom çevrim** (`otonom` becerisi): `get_usage` → `cv cycle begin --five <5s %> --week <haftalık %> …` (kilit alır, kota kapısını ve `TEMPO`/`OFIS_MUHAKEMESI` durumunu hesaplar, `get_usage` yoksa `local-blocks` oturum bloklarına düşer, DERSLER + GUNLUK sonu + sahibinin okunmamış notlarını basar) → çıktıdaki `KARAR`a uy: `GO` bir iş adımı, `KUCUK` / `KISITLI` yalnız yarım işi ya da dar adımı bitir, `CIK` → `cv cycle sleep`, `MESGUL` başka oturum çalışıyor, `DUR` sahibi durdurdu, `SIRA_DEGIL` makinede başka projenin sırası, `KARAR: BITTI` → `finalForm` ve yol haritası tamam: çıktıyı doğrula, `OZET.md`'ye sahibinin açacağı kesin yolu yaz ve döngüyü durdur → adım içinde ara sıra `cv gate` (`--auto` ile yerel blok yedeği) ve sıkışma sonrası `cv cycle prime` → iş/kota verimliliği için açık çerçeveli öz-gelişim (`.evrim/otonom/KARARNAMELER.md` veya ders §4) → `OZET.md` → `cv cycle end …` (GUNLUK'e yazar, pencere sonu öz-ayarını yapar, kilidi bırakır, `UYKU` ve `SONRAKI_KAPI` verir) → commit → çık ya da uyu.

**Kodu kim yazar** (`delegate.policy`, kurulumda `cv-init` sorar): `kendisi` hiç dağıtma, ana model yazar (kritik projeler) · `yalniz-api` yalnız API modeli (`delegate.provider`, varsayılan DeepSeek; anahtar yalnız ortam değişkeninde), anahtar yoksa kod işi bekler · `api-yoksa-kendisi` API, yoksa ana model (varsayılan) · `api-yoksa-subagent` API, yoksa daha ucuz Claude alt ajanı (`delegate.subagentModel`) veya uygun yerel CLI (`codex`, `agy`, `gemini`). Çıktılar `cv delegate verify` ile bağımsız doğrulanır.

**Meclis ve açık çerçeve (`cv council` & `.evrim/otonom/KARARNAMELER.md`):** Başmimar veya otonom döngü her zaman ağır alt ajan çağırmaz; plan/kota ve iş zorluğuna göre solo muhakeme veya `cv council --topic "<konu>"` (hafif/derin çoklu bakış) seçer. Örnekler duvar değildir: ajan işe yaramayan yaklaşımdan döner, kendi verimliliğini ölçer ve kalıcı ilkeleri `.evrim/otonom/KARARNAMELER.md`'ye yazar.

**Kota kapıları** (`.evrim/config.json` > `autonomy.gates`, varsayılan): 5 saatlik pencere **%85**'te yeni adım yok (`KUCUK`), **%90**'da çık ve pencere yenilenince +2 dk uyan (`CIK`); haftalık tavan **60 + 30·f** (f = haftanın geçen kesri). Kota okunamazsa tek küçük adım (`local-blocks` yoksa), üç kez üst üste okunamazsa bekle. Kilit 90 dakikada bayatlar; `cv recover [--fix]` takılmayı toparlar.

## 4. Evrim kuralı (her oturumda, döngü içinde ya da dışında)

Tekrar eden ya da pahalıya patlayan bir şey öğrendin mi, **o an** tek satır:

| Ders | Komut | Ne olur |
|---|---|---|
| Yalnız bu projede geçerli | `cv lesson "<ders>"` | `.evrim/otonom/DERSLER.md`'ye `[yerel]` satırı. Her otonom çevrim başında okunur. |
| Proje adı çıkınca da doğru | `cv lesson "<genelleştirilmiş ders>" --evrensel` | **Geliştirici makinesinde** hemen pakete: `evrim/ders-…` dalı → `evolution/universal/DERSLER.md` satırı → ölçüm → kabul → sürüm +1 → GitHub'a push. Yerel satır `[evrensel→taşındı vX]`. Ret ya da hata olursa yerelde `[evrensel]` kalır, damıtma yeniden bakar. |
| Ciddi hata kalıbı | aynı komuta `--hata` | `HATALAR.md` (yerel ya da evrensel) |

Ders genelleştirilmiş olmalı: proje adı, yol, kişisel bilgi, anahtar geçerse paket reddeder.

**İki evrensel katman.** Pakete push yetkisi olmayan bir sahip (claudevrim kurulu, geliştirici değil) için `--evrensel` dersi bu makinenin katmanına yazar: `~/.claudevrim/evrensel/DERSLER.md` (yerel satır `[evrensel→taşındı makine]`). Her projenin gördüğü evrensel dersler iki katmanın birleşimidir: paketin `evolution/universal/` (GitHub'dan, bakımcının) + bu makinenin katmanı; aynı ders bir kez yazılır, hiçbiri silinmez. Birleşik hâl projede `.evrim/evrensel.md` (üretilmiş; `claudevrim init`, `cv update`, `cv lesson` yeniler) ve her otonom çevrimin başında `cv cycle begin` çıktısında. Paketteki yeni evrensel dersler `claudevrim guncelle` ile gelir, makinenin kendi dersleri hiçbir güncellemede kaybolmaz.

**Beceri, şablon ya da kod değişikliği** (ders satırından büyük): paket deposunda `evrim/<ad>` dalında commit → paket klasöründe `cv evolve evrim/<ad> --why "<beklenen etki>"`. Komut ölçer (A: testler, B: 20 kaos senaryosu; ikisi de 0 token; `--live` ile ücretli C katı), `bench/`'e dokunan adayı reddeder (sistem kendi sınavını değiştiremez), gizlilik taraması yapar; geçerse `main`'e `--no-ff` alır, sürümü artırır, `evolution/CHANGELOG.md`'ye yazar ve push eder; geçmezse `evolution/REJECTED.md`. Diğer projeler yeniliği `cv update --apply` ile alır.

**Push:** projenin kendi deposunda push ve uzak depo yok (sahibi istemedikçe). Pakete push yalnız `cv lesson --evrensel` ve `cv evolve` üzerinden olur; elle `git push` yok, zorla push hiç yok.

## 5. Komutlar

```
claudevrim [kur] | init | guncelle | gelistirici <klon> | <cv komutu>   indirilen başlatıcı (exe)
cv setup                      makineye bir kez: Claude, Codex ve Antigravity için kullanıcı becerisi
cv init | adopt | update      kurulum, göç, paket sürümünü projeye uygulama
cv doctor | status            önkoşul denetimi; tur, kota, şerit, blok ve hafıza özeti
cv council --topic "<konu>"   plan/kota duyarlı uyarlanabilir mimari meclis
cv cycle begin|end|sleep|prime  otonom çevrim (TEMPO, BITTI, compaction prime); cv gate [--auto]
cv delegate which|brief|batch|status|stop|fix|verify  iş dağıtımı, paralel şeritler ve doğrulama
cv round start|end|show       tur ölçümü (.evrim/metrics.jsonl)
cv lesson "<ders>" [--evrensel] [--hata]        ders yaz (evrensel: hemen pakete)
cv distill [--mark]           damıtma girdisi;  cv evolve evrim/<ad>  pakete ölçülü değişiklik
cv bench [--live]             paketi ölç (A testler + B kaos; C ücretli)
cv probe | ref                çalışan uygulamayı yokla; referansla karşılaştır
```

`cv help` tam listeyi verir. Paket testleri: `node tests/run.js` ya da `deno run -A tests/run.js`.

## Belgeler

- Sahibi için sade: [KULLANIM.md](KULLANIM.md) (tek sayfa), [docs/OWNER_GUIDE.md](docs/OWNER_GUIDE.md).
- Neden böyle: [docs/METHOD.md](docs/METHOD.md), kararlar [docs/DECISIONS.md](docs/DECISIONS.md), değişiklik kuralı [docs/STANDARD.md](docs/STANDARD.md), mimari [ARCHITECTURE.md](ARCHITECTURE.md).
- Evrim kaydı: [evolution/CHANGELOG.md](evolution/CHANGELOG.md) (her sürüm), [evolution/README.md](evolution/README.md).
- Paketin geliştirme günlüğü: [docs/PROGRESS.md](docs/PROGRESS.md). Tarihçe (güncel kural değil): `docs/INVENTORY.md`, `docs/REVIEW.md`, `docs/BENCHMARK_PLAN.md`, `docs/FABLE_PROMPT.md`, `docs/examples/`.
