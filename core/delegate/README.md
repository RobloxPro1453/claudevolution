# core/delegate — ucuz model ajanı ve şeritler

Büyük model tarif yazar; bu ajan tarifi bir şerit worktree'sinde, kendi dalında uygular; büyük model diff'i gözden geçirir. Yöntem: [docs/METHOD.md](../../docs/METHOD.md) §1-2.

| Dosya | Tek işi |
|---|---|
| `agent.js` | Araç döngüsü (okuma, arama, izinli yazma/düzenleme, derle/test, git), yasak yol denetimi, döngü algılama, bütçe ve adım sınırı, saate göre fiyat, rapor + commit + durum kaydı; `run`, `fix`, `scout`, `auto`, `ask` |
| `lanes.js` | Şeritler: her şerit **ayrık süreç** (oturum kapansa da yaşar), günlük dosyası, pid kaydı, yoğun saatte bekleme; `batch`, `status`, `stop` |
| `plugins/crlf.js` | Paketle gelen eklenti: CRLF dosyada satır sonundan bağımsız düzenleme (K13) |

## Komutlar

```
cv delegate batch [--lanes N] [--from N] T-001 T-002 ...   şeritleri başlat ve dön
cv delegate status | stop <şerit>
cv delegate run T-001 | fix T-001 <notlar> | scout T-001 | auto T-001   [--lane N]   ön planda
cv delegate ask "<soru>"                                   salt okunur, dosya:satırlı kısa cevap
```

`auto` = keşif (salt okuma, not `<iş>.scout.md`) → uygulama → takılırsa bir otomatik düzeltme turu.

## Güvenlik

- Anahtar **yalnız ortam değişkeninden** (`delegate.providers.<ad>.keyEnv`); dosyaya, loga, rapora yazılmaz.
- Yazma: `forbiddenWrite` + her zaman yasak `.git/`, `.evrim/`, `.claude/` (config ile kaldırılamaz). Yol göreli olmalı, proje dışına çıkamaz.
- Her komutun zaman sınırı var (`buildMinutes`, `testMinutes`); asılan süreç öldürülür.
- Aynı araç + aynı argüman + aynı hata: 3. kezde uyarı, 4. kezde `blocked` (`stop: loop`).
- İş başına bütçe (`Budget:` satırı ya da `defaultBudget`), günlük tavan `dailyBudget`.
- Ajan "bitti" dese de çalıştırıcı derleme ve testi kendisi doğrular (ajan son düzenlemeden sonra geçirdiyse sonucu kaydeder).

## Sağlayıcı

OpenAI uyumlu her uç nokta: `delegate.providers.<ad>` = `{ apiBase, model, keyEnv, thinking, price {input, cached, output}, peakUtc, offpeakFactor }`, seçilen `delegate.provider`. Fiyat milyon token başına dolar (yoğun saat); dışında `offpeakFactor` ile çarpılır; hafta sonu yoğun saat yok.

## Eklenti arayüzü

`delegate.plugins` listesi: `"builtin:<ad>"` (bu klasörün `plugins/<ad>.js`'i) ya da projeye göre yol (`.evrim/plugins/arama.js`). Modülün varsayılan dışa aktarımı:

```js
export default {
    name: "arama",
    tools: {                                   // ajana eklenen araçlar (OpenAI function şeması)
        engine_search: {
            description: "Search the readable engine ...",
            parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
            async run(args, ctx) { return "metin sonuç (≤6000 karakter)"; }   // ctx: { cfg, wt, readRoot, plugins, track }
        }
    },
    taskTools: ["engine_search"],              // run/fix/auto'da açık
    askTools: ["engine_search"],               // ask/scout'ta açık
    beforeEdit(text, old_text, new_text) { return { old_text, new_text }; },   // isteğe bağlı
    workPlan: "Bir cümle: bu aracı ne zaman kullan."                            // isteğe bağlı
};
```

Eklenti dosyası yoksa ajan başlamaz (bilerek: sessizce eksik araçla çalışmak daha pahalı). Projeye özgü bir aracın ayarları config'de kendi anahtarında durabilir (ör. `delegate.engineSearch`); eklenti `ctx.cfg`'den okur.

## Kayıtlar

`delegate.stateDir/<iş>.json`: `{ task, cost, runs: [{ startedAt, at, kind: first|fix, before, after, cost, steps, tokens {hit, miss, out}, status: done|blocked, stopReason, testsBy, offpeak }], scout?, summary }`; `asks.jsonl`: soru başına bir satır. `cv round` ve günlük bütçe bunları okur.
