# core/reference — referans uygulamayla yan yana karşılaştırma

Bir ürünü örnek alınan bir uygulamaya benzetirken "benziyor mu?" sorusunu hissiyattan çıkarıp göze dönüştürmek için: referansın ekran görüntüleri ile bizimkiler **aynı adla** saklanır, tek bir HTML sayfasında yan yana durur. (METHOD §4: his sorunu ölçülebilir parçaya indirgenir.)

Referans görüntülerinin nasıl yakalandığı (hangi uygulama, hangi menü listesi) projeye ve makineye özgüdür; o kısım projede kalır. Paket adlandırmayı, indeksi ve karşılaştırma sayfasını verir. **Telif:** referans uygulamanın dosyaları kopyalanmaz; yalnız sahibinin kendi çektiği ekran görüntüleri kullanılır ve bunlar git'e girmez (projenin `.gitignore`'u).

## Komutlar

```
cv ref name "Görüntü/Ayarlar/Düzeyler..."   → goruntu__ayarlar__duzeyler   (dosya adı kuralı)
cv ref index                                 reference.dir'i tarar → .evrim/state/ref-index.json + özet
cv ref compare                               reference.dir ↔ reference.shotsDir → reference.out (HTML)
```

## Ad kuralı

Menü yolu ya da başlık → küçük harf, Türkçe ve aksanlı harfler ASCII'ye (ç→c, ğ→g, ı→i, ö→o, ş→s, ü→u), `/` ve `>` → `__`, diğer her harf/rakam dışı dizi → `_`, `...`/`…` atılır. Aynı adın birden çok görüntüsü `-2`, `-3` sonekiyle; eşleşme sonekten bağımsızdır (ilki gösterilir, sayısı yazılır).

## Config

```json
"reference": { "dir": "references/shots", "shotsDir": ".evrim/state/shots", "out": ".evrim/state/compare.html" }
```

## İndeks

`ref-index.json`: `{ at, dir, items: [{ name, files: ["a.png", "a-2.png"], kind: "image"|"video" }] }`. Görüntü: png, jpg, jpeg, webp, gif; video: mp4, webm, mov.

## Karşılaştırma sayfası

Üç bölüm: **ikisi de var** (yan yana), **yalnız referansta** (henüz yapılmadı ya da çekilmedi), **yalnız bizde**. Görüntüler kopyalanmaz; sayfa onlara göreli yolla bağlanır (sayfa yerinden taşınırsa bağlar kopar).

## Lisans: ne alınabilir (`cv ref license <klasör>`)

Sahibin kararı #11: referansın lisansına göre üç kip. **adapt** (MIT, Apache-2.0, BSD, ISC, Zlib...; çift lisansta biri yeter): kod ve modül uyarlanır, `THIRD_PARTY_NOTICES.md`'ye kaynak + telif satırı, marka/logo alınmaz. **ideas-only** (GPL/LGPL/AGPL, dosya düzeyinde copyleft MPL-2.0): yalnız fikir ve davranış. **clean-room** (lisans yok, kapalı kaynak, kurulu program): yalnız ekran, erişilebilirlik ağacı ve akış; kod, ikon, görsel kopyalanmaz, özgün SVG ikon çizilir. `--birebir` düzeni korur, varsayılan "benzer" aynı tasarım dilinde özgün düzen ister. Kaynak: `package.json`/`Cargo.toml` `license` alanı ve `LICENSE*`/`COPYING*` metinleri (`core/reference/license.js`); hiçbir şey çalıştırılmaz.
