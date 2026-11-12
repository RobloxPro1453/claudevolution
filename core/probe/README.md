# core/probe — çalışan uygulamayı yoklama

Tarif yazmadan ya da gözden geçirmeden önce gerçek uygulamadan **kısa, sınırlı** bir gerçek almak için: bir arayüzün gerçek yapısı, bir değerin şu anki hâli, bir ekran görüntüsü. Uzun elle komutların ve şişen çıktıların yerine tek komut (METHOD §3: ana bağlama az şey girsin).

Uygulamayı nasıl açıp içine nasıl betik sokacağını yalnız proje bilir; bu yüzden asıl iş **eklentidedir**. Paket şunu sağlar: eklentiyi yükleme, zaman sınırı, çıktıyı JSON'a çevirip kesme, ekran görüntüsü adlandırma.

## Komut

```
cv probe --preset <ad>                 eklentinin hazır yoklaması
cv probe --script "<js gövdesi>"       ya da --script yol/dosya.js
cv probe --list                        eklentinin hazır yoklamaları
         [--max N] [--timeout SN]      çıktı sınırı (karakter), zaman sınırı (saniye)
```

Çıktı tek JSON; `--max`'ı aşarsa kesilir ve kesildiği yazılır. Zaman aşımında `HATA: zaman aşımı`.

## Config

```json
"probe": { "plugin": ".evrim/plugins/probe.js", "maxChars": 4000, "timeoutSeconds": 120 }
```

## Eklenti arayüzü

```js
export default {
    name: "uygulamam",
    presets: { layers: "açık belgenin katman adları" },          // --list bunu gösterir
    async run({ preset, script, args }, ctx) {
        // ctx: { cfg, root, timeoutMs, shot(ad) -> ekran görüntüsünün yazılacağı mutlak yol }
        // uygulamayı test profiliyle aç, betiği çalıştır, dönen değeri ver (JSON'a çevrilebilir olmalı)
        return { title: "..." };
    }
};
```

Kurallar: test kopyası sahibinin açık penceresinden **ayırt edilebilir** olmalı (ayrı profil, ayrı pencere adı; tek kopya denetimi yanılmasın). Yoklama projenin testleriyle aynı anda çalışmamalıysa eklenti bunu kendisi denetler. Ekran görüntüleri `ctx.shot(ad)` ile `reference.shotsDir`'e yazılır; ad `cv ref name` ile aynı kuralla düzgünleştirilir, böylece `cv ref compare` referansla eşler.
