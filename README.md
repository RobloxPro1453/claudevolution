# claudevolution

**Claude Code, Codex ve Antigravity'yi tek seferlik sohbet aracından çıkarıp; kalıcı hafızalı, kendi kota temposunu yöneten, plan/kota duyarlı meclis kuran ve ölçülü öz-evrim geçiren otonom bir yazılım ofisine dönüştüren katman.**

Sahip yalnızca ne istediğini söyler (`HEDEF`); ajan projeyi analiz eder, yaklaşım seçer, işi böler, alt ajanları veya paralel şeritleri orkestre eder, kota penceresini boşa harcamadan hızını ayarlar, işi bitirince (`KARAR: BITTI`) sonucu doğrular ve durur.

---

## Öne Çıkan Yetenekler

| Yetenek | Ne Sağlar |
|---|---|
| **Akıllı Kurulum ve Sürüm Denetimi** | `claudevrim.exe` çift tıklandığında mevcut kurulumu (`vX → vY`) denetler: yeni sürümse günceller, zaten güncel veya daha yeniyse üzerine yazıp bozmaz, eski geliştirici klonunu bile güvenle günceller. |
| **Çoklu Platform Desteği** | Claude Code (`~/.claude/skills`), Codex CLI (`~/.agents/skills`, `AGENTS.md`) ve Antigravity Desktop/CLI (`.agents/skills`, `.agent/workflows`) tek `cv setup` / `claudevrim init` ile otomatik ayarlanır. |
| **Otonom Yazılım Ofisi (`TEMPO`)** | Her çevrimde kota ve verimliliği ölçer (`HIZLAN` / `DENGELE` / `FRENLE`), tıkanan yöntemi değiştirir ve kalıcı ilkeleri `.evrim/otonom/KARARNAMELER.md` dosyasına işler. |
| **Plan / Kota Duyarlı Meclis** | `cv council` karmaşık kararlarda çoklu bakış açısı çalıştırır, sıradan işlerde boşa üst model token'ı yakmaz; bütçeye göre model/ajan derinliğini uyarlar. |
| **İzole İş Dağıtımı & Doğrulama** | `cv delegate` paralel çalışma şeritleri ve harici API/alt ajan delegasyonu kurar; üretilen çıktılar `cv delegate verify` ile bağımsız doğrulanır. |
| **Ölçülü Öz-Evrim** | Yeni beceri veya çekirdek değişiklikleri `bench/` altındaki deterministik test + kaos senaryolarından (Kat A + Kat B) ve gizlilik taramasından geçmeden `main` dalına alınmaz. |

### ProMax'te yeni (`v1.0.25` → `v1.0.30`)

- **Veri kaybetmeyen güncelleme:** `cv update --apply` önce yedekler, ayarlarını korur, `--rollback` ile tek komutta geri alır.
- **Ucuz model motoru:** önbellek dostu bağlam, bulanık düzenleme, kilitli kabul testi; API yoksa ya da bakiye biterse ana modele kendiliğinden devir.
- **Masaüstü denetimi:** `cv check` derler, pencereyi açar, boş ekranı yakalar, uygulamanın kendi `--self-test` adımlarını koşar; referans koda lisansına göre yaklaşır.
- **Premium müşteri akışı:** kısa istekten söylenmeyen beklentileri çıkaran `cv intent`, çalışan Rust masaüstü iskeleti (`cv stack`), tek `.exe`, eksik araçlar için tek onaylı kurulum.
- **Gece fabrikası:** süreçler arası kilit, bozan dalı bulan birleştirme treni, dürüst `STATUS.md`, iş bitince tek Telegram haberi.
- **Kota bekçisi:** kotayı her adımda izler, planına göre kendini ayarlar, gözetimsiz döngüyü %100'e dayanmadan durdurur.
- **Yaşayan evrim:** kalıcı bilgi deposu, ölçülü öz-ayar (işe yaramayanı geri alır, ders yazar), Codex/Antigravity kullanım ölçümü, tam İngilizce proje belgeleri.

Deneyip görüşünü yazarsan sistem ondan da öğrenir: GitHub'daki **Issues** sekmesine bir satır yeter (ne yaptın, ne bekledin, ne oldu).

---

## 1. Hızlı Başlangıç (Son Kullanıcı — 30 Saniye)

1. **[Releases](../../releases) sayfasından** `claudevrim.exe` (Windows; Linux/macOS için `claudevrim-linux` / `claudevrim-macos`) dosyasını indir ve çalıştır.
   - Başlatıcı paketi `%USERPROFILE%\.claudevrim\bin` (Linux/macOS: `~/.claudevrim/bin`) içine yerleştirir, `PATH`'e ekler ve tüm platformların kullanıcı becerilerini kurar.
   - Zaten kuruluysa mevcut sürümü karşılaştırır: yeni sürüm varsa günceller, **zaten en güncel sürümse bildirir ve korur**.
2. Proje klasöründe terminali aç ve tek komut yaz:
   - **Yeni proje:** `claudevrim init`
   - **Var olan proje (kodu taşı/devral):** `claudevrim adopt`
3. Kullanacağın ajanı aç (**Claude Code**, **Codex** veya **Antigravity Desktop/CLI**), proje klasörünü seç ve sohbete yalnızca **`merhaba`** yaz.
   - `.evrim/DURUM.md` içindeki `"kurulum": "bekliyor"` işaretini gören ajan sohbet içinde kısa kurulum mülakatını başlatır (`cv-init`), hedefi ve yol haritasını kurar.
   - Sürekli otonom çalıştırmak istediğinde **`/loop başla`** (veya zamanlanmış görevde `otonom becerisini yükle ve bir çevrim yap`) demen yeterlidir.
4. Paketi sonradan güncellemek için her yerden **`claudevrim guncelle`** (veya yeni indirdiğin `claudevrim.exe`'yi yeniden çalıştır).

---

## 2. Geliştirici / Elle Kurulum (`git clone`)

Önkoşul: **Node ≥ 18 ya da Deno** ve `git`.

```bash
git clone <paket-depo-url> ~/.claudevrim/paket
cd ~/.claudevrim/paket
bin/cv.cmd setup          # Windows (Linux/macOS: bin/cv setup) — makineye bir kez
```

Bir projeye uygulamak için proje klasöründe:

```bash
<paket>/bin/cv.cmd init   # yeni proje (`cv init`; Linux/macOS: bin/cv init)
<paket>/bin/cv.cmd adopt  # var olan proje (`cv adopt`); --yes ile varsayılan ayarlarla hızlı geçiş
```

- Varsayılan yerleşimde çekirdek kopyası `<proje>/claudevolution/` altında tutulabilir (`.gitignore` ayarlı) ya da makinedeki merkezi `~/.claudevrim/paket` kullanılır; mevcut projeye paket güncellemesi **`cv update --apply`** ile uygulanır (önce yedek alır, dersler/günlük/ayarlarınız silinmez; geri almak: `cv update --rollback`).
- Kurulum sonrası ajana `"kurulum"` / `merhaba` dendiğinde `cv-init` becerisi proje profilini tamamlar.

---

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

**Kota bekçisi** (`cv guard`, her projede Claude Code kancası olarak kurulur): kapılar modelin hatırlamasına bağlıydı; bir döngü uzun bir adımda unutup kotayı %100'e kadar yaktı. Bekçi her iş aracından önce ve sonra kendisi bakar: pencere bu hızla sıfırlanmadan dolacaksa `KOTA_TEMPO`, %85'te `KOTA_FRENI (KUCUK)`, %90'da gözetimsiz çalışmada yeni işi **engeller** (commit, `cv` ve uyku açık kalır); sahibi başındayken yalnız uyarır. Yüzdeyi her gerçek okumayla (`get_usage`, `[quota]`, `cv gate --five ..`) bu hesabın planına göre ayarlanan yerel sayaçtan alır; `cv guard --show` ne gördüğünü söyler, `cv doctor` kancanın kurulu olduğunu denetler.

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
claudevrim [kur] | init | guncelle | gelistirici <klon> | surum | <cv komutu>   indirilen başlatıcı (exe)
cv setup                      makineye bir kez: Claude, Codex ve Antigravity için kullanıcı becerisi
cv init | adopt | update      kurulum, göç, paket sürümünü projeye uygulama (--rollback geri alır)
cv doctor | status            önkoşul denetimi (--install-deps: eksik araç, tek onay); tur, kota, şerit, blok ve hafıza özeti
cv intent "<istek>" | stack   alt-metin motoru (niyet kartı, söylenmeyen beklentiler); masaüstü yığını + çalışan Rust iskeleti
cv check                      masaüstü uygulama denetimi: derle, pencere çiziyor mu, --self-test adımları (0 token)
cv council --topic "<konu>"   plan/kota duyarlı uyarlanabilir mimari meclis
cv cycle begin|end|sleep|prime  otonom çevrim (TEMPO, BITTI, compaction prime); cv gate [--auto]
cv delegate which|brief|batch|status|stop|fix|verify|train|note  iş dağıtımı, şeritler, doğrulama, birleştirme treni, çalışan işe not
cv watch | telegram           canlı STATUS.md (neden bekliyor); bitince tek haber + yetkili uzaktan kumanda
cv round start|end|show       tur ölçümü (.evrim/metrics.jsonl)
cv lesson "<ders>" [--evrensel] [--hata]        ders yaz (evrensel: hemen pakete)
cv distill [--mark]           damıtma girdisi;  cv evolve evrim/<ad>  pakete ölçülü değişiklik
cv bench [--live] | compare   paketi ölç (A testler + B kaos; C ücretli); iki sürümü 0 tokenla kıyasla
cv probe | ref                çalışan uygulamayı yokla; referansla karşılaştır, referans lisansı (uyarla / clean-room)
```

`cv help` tam listeyi verir. Paket testleri: `node tests/run.js` ya da `deno run -A tests/run.js`.

## Belgeler

- Sahibi için sade: [KULLANIM.md](KULLANIM.md) (tek sayfa), [docs/OWNER_GUIDE.md](docs/OWNER_GUIDE.md).
- Neden böyle: [docs/METHOD.md](docs/METHOD.md), kararlar [docs/DECISIONS.md](docs/DECISIONS.md), değişiklik kuralı [docs/STANDARD.md](docs/STANDARD.md), mimari [ARCHITECTURE.md](ARCHITECTURE.md).
- Evrim kaydı: [evolution/CHANGELOG.md](evolution/CHANGELOG.md) (her sürüm), [evolution/README.md](evolution/README.md).
- Paketin geliştirme günlüğü: [docs/PROGRESS.md](docs/PROGRESS.md). Tarihçe (güncel kural değil): `docs/INVENTORY.md`, `docs/REVIEW.md`, `docs/BENCHMARK_PLAN.md`, `docs/FABLE_PROMPT.md`, `docs/examples/`.
