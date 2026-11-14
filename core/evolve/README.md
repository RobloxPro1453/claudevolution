# core/evolve: evrensel evrim

`cv evolve evrim/<ad> --why "<beklenen etki>" [--live] [--no-push]`, claudevolution deposunda, `main` üzerinde ve temiz ağaçta.

1. Aday `evrim/<ad>` dalında; `main`'den ileride olmalı.
2. **Goodhart kapısı:** aday `bench/` altına dokunuyorsa reddedilir. Ölçüm takımı ayrı commit'le değişir ve sahibine OZET'te bildirilir.
3. Aday kendi kodu ve kendi senaryolarıyla geçici bir çalışma ağacında ölçülür (`cv bench --json`; `--live` ile Kat C).
4. `bench/baseline.json` ile karşılaştırma (`core/bench/README.md`). Sert kapılar: A yeşil ve test sayısı azalmadı; B tam ve senaryo sayısı azalmadı; C varsa tuzak 0, çözülen iş azalmadı, "ölçülemedi" değil.
5. **Gizlilik taraması** (`privacy.js`), adayın izlenen bütün dosyalarında: anahtar biçimi (`sk-` + 20 harf/rakam), e-posta (yalnız `example.*` ve `noreply@` serbest), kişisel ev klasörü yolları.
6. Kabul: `--no-ff` birleştirme, yama sürümü +1 (`package.json`), `evolution/CHANGELOG.md` satırı (gerekçe + ölçü farkı), yeni temel çizgi, tek commit; sonra `git push origin main` (zorla push yok; push başarısızsa kabul yerelde kalır, komut söyler).
7. Ret: `evolution/REJECTED.md`'ye tek satır (ne, neden) ve commit; `main` yarım değişmiş kalmaz.

Yerel evrim (projeye özgü dersler) projenin `.evrim/` klasöründe kalır ve buradan geçmez.
