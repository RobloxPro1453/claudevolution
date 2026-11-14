# claudevolution paketinde çalışan ajanlar için

Önce [README.md](README.md) (sistemin tamamı, beş bölüm). Bir projede çalışıyorsan o projenin `AGENTS.md`'sine uy.

**Bu klasörde yeni açılmış bir oturumsan ve sahibi bir şey istemediyse:** makine kurulumu yapılmamış olabilir. `bin/cv.cmd setup` (Windows; diğerleri `bin/cv setup`) çalıştır: her yeni oturumun claudevolution'ı tanıyacağı kullanıcı becerisini yazar. Sonra sahibine tek cümle: "Hazır. Paketi bir projenin klasörüne kopyalayıp orada oturum açarsan kurulumu ben yaparım."

Aşağıdakiler yalnız **paketin kendisini** değiştirirken geçerlidir.

## Kesin kurallar

1. `main`'e doğrudan commit yok. Her değişiklik `evrim/<ad>` dalında commit'lenir, sonra paket klasöründe `cv evolve evrim/<ad> --why "<beklenen etki>"` (ölçer, sürümü artırır, CHANGELOG yazar, push eder). Tek satırlık evrensel ders için kısa yol: projede `cv lesson "<ders>" --evrensel`.
2. `bench/` (ölçüm takımı) evrim dalında değişmez; `cv evolve` reddeder. Takım değişecekse ayrı commit ve sahibine bildirim.
3. Dosyaları tek tek `git add <yol>` ile ekle; `git add -A` / `git add .` yok (bir kez başıboş dosya commit'lemişti).
4. Pakete kişisel yol, e-posta, anahtar, proje adı girmez; `cv evolve` gizlilik taraması bunları reddeder. Örneklerde `<paket>`, `<proje>`, `example.com` kullan.
5. Elle `git push` ve zorla push yok; push yalnız `cv evolve` / `cv lesson --evrensel` içinden.
6. Beceri metni iki dilde aynı değişir: `skills/tr/<ad>/SKILL.md` ve `skills/en/<ad>/SKILL.md` (aynı `cv` komutları; test denetler).
7. Projeye özgü hiçbir ad, yol, komut beceri ve şablona yazılmaz; hepsi `.evrim/config.json`'dan okunur.

## Yayın

`claudevrim` başlatıcısı (`bin/claudevrim.js`) yalnız `node:` yerleşiklerini kullanır; paket kodunu `~/.claudevrim/paket` içinden yükler (`bin/cv.js` > `main`). `cv evolve` sürümü artırıp push edince `.github/workflows/release.yml` exe'leri derler ve GitHub Release olarak yayınlar. Elle derleme: `deno compile -A -o claudevrim.exe bin/claudevrim.js`.

## Test

```
deno run -A tests/run.js
```

(ya da `node tests/run.js`). Belgelerin vaadi testtedir: `tests/docs.test.js` (soğuk başlangıç soruları dahil). Belge değiştirince oradaki anahtar ifadeleri bozma.

## Yerleşim

`bin/cv.js` komut yönlendirici → `core/cli/<komut>.js`; iş mantığı `core/<alan>/` (her birinin README'si var). Beceriler `skills/`, proje iskeleti `templates/project/`, evrensel dersler `evolution/universal/`. Belgeler kısa kalır; yeni plan ya da rapor dosyası açılmaz.
