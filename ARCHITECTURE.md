# Mimari

Sistemin kullanım özeti [README.md](README.md)'de; burada parçaların yeri ve gerekçesi. Mimari kararlar ve seçenekleri: `docs/DECISIONS.md`.

## Amaç

claudevolution, Claude Code ile çalışan bir projeye **tek komutla** şunları kurar ve **kullandıkça kendini geliştirir**:

1. **Belge ve kural sistemi**: ajanın her oturumda nereye bakacağını bildiği, şişmeyen proje hafızası.
2. **İş dağıtımı**: Claude planlar ve denetler; ucuz model (DeepSeek ya da başka) paralel şeritlerde kodu yazar.
3. **Gözetimsiz otonomi**: sahibi yokken günlerce, limitleri yöneterek, takılmadan, zarar vermeden çalışma.
4. **Evrim**: her turdan ders çıkarır; projeye özgüsü projede kalır (yerel), genel olanı pakete taşınır (evrensel) ve bütün projeler faydalanır.

## Katmanlar

```
claudevolution/                 (bu depo: evrensel katman)
  bin/cv(.cmd|.ps1|.js)         CLI yönlendirici; her komut core/cli/<komut>.js (cv help)
  core/
    delegate/                   ucuz model ajanı + ayrık süreçli şerit yöneticisi + yedek (subagent / ana model)
    metrics/                    tur ölçümü (round.js'in genel hâli)
    autonomy/                   zamanlanmış görev sürücüsü, kilit, limit kapıları, sigorta
    probe/                      eklenti arayüzü (uygulamaya kısa betik, ekran görüntüsü)
    reference/                  referans uygulama yakalama + yan yana karşılaştırma
  skills/{tr,en}/               Claude becerileri: durum, calis, otonom, damit, cv-init
  bench/                        ölçüm takımı (testler + kaos senaryoları + canlı mini proje); evrim değiştiremez
  core/evolve/                  cv evolve (ölçülü kabul + push), cv lesson (tek ders hemen pakete), gizlilik taraması
  templates/project/            `cv init`'in kopyaladığı iskelet (aşağıda)
  evolution/
    universal/DERSLER.md        bütün projelerden damıtılmış dersler (≤ 80 satır)
    universal/HATALAR.md        tekrar eden hata kalıpları ve çözümleri
    CHANGELOG.md                pakete giren her evrim değişikliği + ölçü hipotezi + sonuç
  docs/                         METHOD (yöntem), DECISIONS, STANDARD, OWNER_GUIDE; günlük PROGRESS; tarihçe: INVENTORY, REVIEW, BENCHMARK_PLAN, FABLE_PROMPT

<proje>/                        (yerel katman, `cv init` sonrası)
  AGENTS.md                     proje kuralları + claudevolution bölümü (ders kuralı) + "nereye bakmalı" + hafıza tablosu
  CLAUDE.md                     tek satır `@AGENTS.md` (Claude Code CLAUDE.md'yi kendiliğinden okur)
  docs/                         VISION, PROGRESS, ROADMAP, CHECKUP, KNOWLEDGE, ARCHITECTURE, DEVELOPMENT
  docs/tasks/                   ucuz ajan kuralları (genel kısım paketten, proje kısmı burada) + tarifler
  .claude/skills/               paketten bağlanan beceriler (kopya değil; sürümlü)
  .evrim/
    config.json                 derleme/test komutları, yasak yollar, kod klasörleri, model ve bütçe, limit eşikleri, belge adları
    version                     bağlı claudevolution sürümü
    otonom/                     DERSLER, GUNLUK, HATALAR, OZET, SORULAR, NOTLAR, lock
    metrics.jsonl               tur ölçümleri
```

## Otonomi (sürücü)

- **Birincil**: Claude masaüstü uygulamasının **zamanlanmış görevi** (kalıcı, oturumdan bağımsız). Her tetikte temiz bir oturum açılır → bağlam şişmez, 3/7 günlük sınır yoktur. İstem düz metindir (eğik çizgi komutu yok): "otonom becerisini yükle ve bir çevrim yap".
- **Çevrim**: kilit al (`.evrim/otonom/lock`: oturum kimliği + zaman; 90 dk'dan eskiyse bayat) → limit kapısı (§Kapılar) → `DERSLER` tamamı + `GUNLUK` son 10 satır + `NOTLAR` (sahibinin yeni notları) → bir iş adımı (kota payı ≤ %8) → hafızayı yaz → kilidi bırak → çık.
- **Yedek**: tek oturum içinde `/loop` + `ScheduleWakeup` (çevrim başında 30 dk'lık sigorta uyanışı).
- **Kapılar**: 5 saatlik pencere ≥ %85 yeni adım yok, ≥ %90 çık; haftalık tavan `60 + 30·f` (f = haftanın geçen kesri). Eşikler `config.json`'da.
- **Zarar bekçisi**: çevrim sonunda "ne yaptım, neye mal oldu, değdi mi"; ucuz model 15 dk'da commit yoksa durdur; aynı hata 3 kez → geri al ve atla; iki çevrim ilerlemesiz → yaklaşım değiştir; bir adım pencerenin %15'inden fazlasını yerse sebebini bul.
- **Sahibiyle asenkron kanal**: `SORULAR.md` (cevap beklemeyen sorular; sahibi karar verene kadar güvenli varsayılan), `NOTLAR.md` (sahibinin talimatları; her çevrim okunur), `OZET.md` (sade dil).
- **Önkoşul denetimi** (`cv doctor`): uyku, kapak, güç, Windows Update, izin modu, uygulama açık, git temiz, derleme komutu çalışıyor.

## Evrim

- **Yerel ders**: `cv lesson "<ders>"` → `DERSLER.md` (≤ 40 satır), her oturumda, tekrar eden ya da pahalı durumdan tek satır.
- **Evrensel ders, hemen**: `cv lesson "<genelleştirilmiş ders>" --evrensel` → paket deposunda `evrim/ders-…` dalı, `evolution/universal/DERSLER.md`, `cv evolve` (ölçüm, sürüm, push); yerel satır `[evrensel→taşındı vX]`.
- **Damıtma** (`damit` becerisi; günde bir ya da her 10 çevrimde bir; toplam kotanın ≤ %10'u): yeni yerel dersler okunur; projeden bağımsız olanlar evrensel `DERSLER`'e ya da doğrudan şablon/beceri metnine taşınır. Her taşıma `evolution/CHANGELOG.md`'ye: değişiklik, beklenen etki, hangi ölçüyle doğrulanacağı.
- **Doğrulama**: ölçüler `metrics.jsonl`'den: biten iş başına kota, ucuz model başarı oranı (ilk denemede biten), boşa giden çevrim sayısı, sahibinin geri dönüşleri. K çevrim sonra kötüleştiyse değişiklik geri alınır ("evrim seçilimi").
- **Koruma**: evrensel değişiklik proje kurallarını gevşetemez (yasak yollar, veri kaybı kuralları her zaman yerel config'de açık); pakete giren değişiklik sürüm alır; projeler `cv update` ile farkı görüp alır.

## init (cargo new gibi)

`cv init [--name X] [--lang tr]` boş ya da var olan bir projede: şablonları kopyalar (var olan dosyayı ezmez, yanına `.new` koyar), `.evrim/config.json`'u sorularla ya da algılamayla doldurur (derleme/test komutu), becerileri bağlar, `cv doctor` çalıştırır. Claude içinden: "claudevolution init" becerisi aynı işi konuşarak yapar ve VISION'ı sahibiyle doldurur.

## Göç

Kendi düzeni olan bir projede `cv init` yerine `cv adopt`: var olan AGENTS/docs/betikleri yeni yapıya eşleyen plan üretir (örnek: `docs/examples/`), `--apply` ile uygular; hiçbir dosyayı ezmez.
