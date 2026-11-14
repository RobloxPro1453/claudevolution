# core/orchestrate — Plan ve Kota Uyumlu Uyarlanabilir Meclis

Çoklu ajan müzakeresini (`Meclis`) her işe körü körüne 4 ağır model salmadan önce **maliyet/fayda**, **plan ve kota boşluğu**, **yerel CLI + API havuzu** ve **lisans politikası** ekseninde planlayan orkestrasyon katmanı.

| Dosya | Tek işi |
|---|---|
| `council.js` | Havuz algılama (`detectPool`), uyarlanabilir meclis planı (`planCouncil`), isteğe bağlı paralel çalıştırma ve kör sentez (`runCouncil`) |

## 1. Maliyet / Fayda ve Uyarlanabilir Kipler

`planCouncil`, konunun karmaşıklığına (`low | medium | high | auto`) ve kota/plan durumuna (`Pro` / `Max` / harici API anahtarları) bakarak üç kipten birini seçer:

1. **`solo`**: Düşük karmaşıklık (`complexity: "low"`) veya tek dosyalık basit işler. Meclis toplanmaz; gereksiz token yakımı önlenir.
2. **`light` (2 koltuk)**: Orta karmaşıklıkta veya kota sıkışıkken (`5 saatlik >= %75` ya da haftalık kalan `< %35`, özellikle kısıtlı `Pro` planlarda). Yalnızca ekonomik katmanlar (`haiku`, `sonnet`, yerel `codex`/`agy`/`gemini` veya ucuz DeepSeek/Gemini API) kullanılır — **asla 4 ağır `opus` koltuğu açılmaz**.
3. **`deep` (3–4 koltuk)**: Yüksek karmaşıklık ve sağlıklı kota / `Max` / API bütçesi. Farklı bakış açılarını (`Mimari & Sistem`, `Ürün & Kullanıcı Deneyimi`, `Şeytanın Avukatı & Risk/Lisans`, `Verimlilik & Maliyet`) mevcut CLI ve API çeşitliliğine dağıtır.

## 2. Çoklu CLI ve Çoklu Model Havuzu (`detectPool`)

- **Yerel CLI algılama**: Windows'ta `where`, POSIX'te `which` üzerinden `claude`, `codex`, `agy`, `gemini` komutlarını hızlı ve önbellekli biçimde yoklar (testler için `opts.checkCmd` ile enjekte edilebilir).
- **API sağlayıcıları**: `delegate.providers` ayarlarını ve `DEEPSEEK_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` ortam değişkenlerini denetler (anahtarların kendisi hiçbir yere yazılmaz).
- **Kota ve plan okuması**: `.evrim/state/quota.json` dosyasını ve `cfg.delegate.plan` bilgisini okuyarak kalan 5 saatlik / haftalık boşluğu hesaplar.

## 3. Lisans ve Araştırma Politikası

- **`commercial` / `open-source`**: Dış referans ve kod incelemesini yalnızca izin verici lisanslarla (`MIT`, `Apache-2.0`, `BSD-2-Clause`, `BSD-3-Clause`, `ISC`) sınırlar; copyleft/lisanssız koda karşı koltukları uyarır.
- **`personal`**: Geniş çaplı *clean-room* mimari ve tasarım incelemesine izin verir.
- **`auto`**: Sahip seçim yapana kadar güvenli varsayılan olarak izin verici lisans sınırını uygular.

## 4. Kör Müzakere ve Sentez (`consilium` + `mco`)

Her koltuk kendi XML-yalıtılmış bağlamı (`<role>`, `<topic>`, `<license_policy>`, `<instructions>`) ile birbirinin taslağını görmeden bağımsız görüş üretir; ardından sentez protokolü uzlaşıları, gerçek çatışmaları ve lisans uyumunu tek net kararda birleştirir. Çıktı varsayılan olarak `.evrim/otonom/MECLIS.md` dosyasına yazılır (`--execute` ile uyumlu API koltukları paralel çalıştırılabilir).

## Komut

```
cv council --topic "<konu>" [--complexity auto|low|medium|high] [--depth auto|solo|light|deep] [--license personal|commercial|open-source] [--execute] [--json]
```
