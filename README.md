# claudevolution

**Claude Code projeleri için kendini geliştiren çalışma sistemi.** Bir projeye tek komutla belge ve kural sistemi, ucuz modele iş dağıtımı, gözetimsiz (kota yöneten) otonom çalışma ve her turdan ders çıkaran bir evrim döngüsü kurar.

*A self-evolving operating system for Claude Code projects: one `cv init` gives a project its rules and memory docs, cheap-model delegation, unattended quota-aware autonomy, and a learning loop that keeps project-specific lessons local and sends general ones to the package, so every project gets them.*

> **Bu dosyayı okuyan model:** sistemin tamamı aşağıdaki beş bölümde. Ayrıntı becerilerde (`skills/tr/*/SKILL.md`, İngilizcesi `skills/en/`) ve `core/*/README.md` içinde. Bu paketin kendisinde çalışıyorsan kuralların [AGENTS.md](AGENTS.md).

## 1. Ne bu

İki katman:

| Katman | Nerede | Ne tutar |
|---|---|---|
| **Paket (evrensel)** | bu depo (`git clone https://github.com/RobloxPro1453/claudevolution`) | `cv` komutu, beceriler, proje şablonu, ölçüm takımı, bütün projelerin evrensel dersleri (`evolution/universal/`) |
| **Proje (yerel)** | projede `.evrim/`, `.claude/skills/`, `AGENTS.md`, `docs/` | proje ayarları (`.evrim/config.json`), otonom hafıza (`.evrim/otonom/`), projeye özgü dersler |

Projedeki `.evrim/cv.cmd` (Windows) ya da `.evrim/cv` paketi bulan kısayoldur; paketin yeri `.evrim/local.json` > `packageHome` (ya da `CV_HOME` ortam değişkeni). Aşağıda `cv` = o kısayol.

## 2. Bir projeye kurmak

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
| zamanlanmış görev "otonom becerisini yükle ve bir çevrim yap" ya da `/loop otonom becerisini çalıştır` | `otonom` becerisi: **tek çevrim** (aşağıda) |
| "damıt" | `damit` becerisi: yerel dersleri sınıfla, genel olanı pakete taşı, eski evrim değişikliklerini ölç |
| `.evrim/otonom/NOTLAR.md`'ye `DUR` / `ÖNCE: <iş>` | döngü durur / o iş öne geçer |

**Otonom çevrim** (`otonom` becerisi): `get_usage` → `cv cycle begin --five <5s %> --week <haftalık %> …` (kilit alır, kota kapısını hesaplar, DERSLER + GUNLUK sonu + sahibinin okunmamış notlarını basar) → çıktıdaki `KARAR`a uy: `GO` bir iş adımı, `KUCUK` yalnız yarım işi bitir, `CIK` → `cv cycle sleep`, `MESGUL` başka oturum çalışıyor, `DUR` sahibi durdurdu, `SIRA_DEGIL` makinede başka projenin sırası → adım içinde ara sıra `cv gate` → ders (§4) → `OZET.md` → `cv cycle end …` (GUNLUK'e yazar, kilidi bırakır, `UYKU` süresini verir) → commit → çık ya da uyu.

**Kodu kim yazar** (`delegate.policy`, kurulumda `cv-init` sorar): `kendisi` hiç dağıtma, ana model yazar (kritik projeler) · `yalniz-api` yalnız API modeli (`delegate.provider`, varsayılan DeepSeek; anahtar yalnız ortam değişkeninde), anahtar yoksa kod işi bekler · `api-yoksa-kendisi` API, yoksa ana model (varsayılan) · `api-yoksa-subagent` API, yoksa daha ucuz Claude alt ajanı (`delegate.subagentModel`). Claude alt ajanı (ör. Haiku) yalnız son seçenekte kullanılır.

**Kota kapıları** (`.evrim/config.json` > `autonomy.gates`, varsayılan): 5 saatlik pencere **%85**'te yeni adım yok (`KUCUK`), **%90**'da çık ve pencere yenilenince +2 dk uyan (`CIK`); haftalık tavan **60 + 30·f** (f = haftanın geçen kesri). Kota okunamazsa tek küçük adım, üç kez üst üste okunamazsa bekle. Kilit 90 dakikada bayatlar; `cv recover [--fix]` takılmayı toparlar.

## 4. Evrim kuralı (her oturumda, döngü içinde ya da dışında)

Tekrar eden ya da pahalıya patlayan bir şey öğrendin mi, **o an** tek satır:

| Ders | Komut | Ne olur |
|---|---|---|
| Yalnız bu projede geçerli | `cv lesson "<ders>"` | `.evrim/otonom/DERSLER.md`'ye `[yerel]` satırı. Her otonom çevrim başında okunur. |
| Proje adı çıkınca da doğru | `cv lesson "<genelleştirilmiş ders>" --evrensel` | Hemen pakete: `evrim/ders-…` dalı → `evolution/universal/DERSLER.md` satırı → ölçüm → kabul → sürüm +1 → GitHub'a push. Yerel satır `[evrensel→taşındı vX]`. Ret ya da hata olursa yerelde `[evrensel]` kalır, damıtma yeniden bakar. |
| Ciddi hata kalıbı | aynı komuta `--hata` | `HATALAR.md` (yerel ya da evrensel) |

Ders genelleştirilmiş olmalı: proje adı, yol, kişisel bilgi, anahtar geçerse paket reddeder.

**Beceri, şablon ya da kod değişikliği** (ders satırından büyük): paket deposunda `evrim/<ad>` dalında commit → paket klasöründe `cv evolve evrim/<ad> --why "<beklenen etki>"`. Komut ölçer (A: testler, B: 20 kaos senaryosu; ikisi de 0 token; `--live` ile ücretli C katı), `bench/`'e dokunan adayı reddeder (sistem kendi sınavını değiştiremez), gizlilik taraması yapar; geçerse `main`'e `--no-ff` alır, sürümü artırır, `evolution/CHANGELOG.md`'ye yazar ve push eder; geçmezse `evolution/REJECTED.md`. Diğer projeler yeniliği `cv update --apply` ile alır.

**Push:** projenin kendi deposunda push ve uzak depo yok (sahibi istemedikçe). Pakete push yalnız `cv lesson --evrensel` ve `cv evolve` üzerinden olur; elle `git push` yok, zorla push hiç yok.

## 5. Komutlar

```
cv init | adopt | update      kurulum, göç, paket sürümünü projeye uygulama
cv doctor | status            önkoşul denetimi; tur, kota, şerit, hafıza özeti
cv cycle begin|end|sleep      otonom çevrim;  cv gate  kota kapısı;  cv lock  kilit;  cv recover  takılma
cv delegate which|brief|batch|status|stop|fix   iş dağıtımı ve ucuz model şeritleri
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
