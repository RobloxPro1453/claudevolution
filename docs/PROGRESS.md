# İlerleme

En üstte en yeni; kayıt başına ≤5 satır.

## 2026-11-12 · claudevrim: indir, init, merhaba (Opus 5.5)
İndirilen başlatıcı `claudevrim` (Releases'tan exe; kendini kurar, PATH, paketi GitHub'dan çeker, makine becerisi). `claudevrim init`: git init, ilk commit, `kurulum: bekliyor`; ilk mesajda `cv-init` keşif görüşmesi (sorular, yeniden sorma, başmimar planı, nereye yazacağına kendisi karar verir), sonunda "yeni oturum, merhaba, `/loop başla`". İki evrensel katman: paket + `~/.claudevrim/evrensel/`, projede birleşik `.evrim/evrensel.md`, çevrim başında basılır. Uzun oturum hatırlatması. Yayın: `.github/workflows/release.yml`.
Doğrulama: 74/74 test; derlenmiş exe ile geçici evde gelistirici → init → status uçtan uca.

## 2026-11-12 · Sıfır açıklamayla başlangıç (Opus 5.5)
Giriş noktası tek: README beş bölüm (ne, kurulum, günlük kullanım + çevrim + kapılar, evrim kuralı, komutlar); paket ve proje şablonuna `CLAUDE.md` (`@AGENTS.md`), şablon AGENTS.md'ye `## claudevolution` (ders kuralı döngü dışında da, push ayrımı). `cv doctor` bölüm yoksa uyarır. Push yasakları paket istisnasını söylüyor; ARCHITECTURE/OWNER_GUIDE/KULLANIM eskileri düzeltildi, kuruluş belgeleri "Tarihçe" işaretli. `lesson.test.js` cmd'ye tırnaksız `>` verip kökte `%39` dosyası üretiyordu: düzeltildi.
Doğrulama: bağlamsız ajanlara 7 soru (`tests/docs.test.js` > `COLD_START`). Önce: kurulumun kaynağı yok, döngü dışında `cv lesson` belirsiz, push çelişkisi. Sonra Sonnet ve Haiku 7/7.

## 2026-11-12 · İlk gerçek evrimler + Fotosop göçü (Opus 5.5)
`cv evolve` gerçek adaylarla iki kez çalıştı: v1.0.1 (yedek varsayılanı `self`), v1.0.2 (otonom döngü başında Remote Control); ikisi de ölçülüp push edildi. Fotosop `cv adopt --apply` ile göçtü (develop bfdd906). Bilinen hata: adopt, "kalır" denen var olan belgeler için de şablon `.new` bırakıyor (14 dosya, elle silindi); düzeltme bir sonraki gerçek evrim adayı.

## 2026-11-12 · v1.0 iş 4: cv evolve + STANDARD (Opus 5.5)
`cv evolve` (Goodhart kapısı, adayın kendi ölçümü, gizlilik taraması, sürüm, CHANGELOG, push), `damit` becerisi buna bağlandı, `docs/STANDARD.md`. Test koşucusu bozuk dosyayı artık atlamıyor. 60/60. K28.

## 2026-11-12 · v1.0 iş 3: canlı kat (küçük) (Opus 5.5)
`bench/fixtures/mini` + 4 iş (1 tuzak) + gizli denetçi `bench/checks/mini.js`, `cv bench --live` (API, tavan $0,10, yoğun saatte koşmaz). Bu oturumda canlı koşulmadı; sahte modelle 3 test. 55/55. K27.

## 2026-11-12 · v1.0 iş 2: kaos senaryoları + cv bench (Opus 5.5)
20 senaryo `bench/chaos/` (0 token), `cv bench` (A+B, sonuç dosyası, temel çizgi, karşılaştırma), ilk baseline; otonom becerisine "kapanışta soru/düğme yok" kuralı. 52/52. K26.

## 2026-11-12 · v1.0 iş 1: yedek iş dağıtımı (Opus 5.5)
`cv delegate which|brief`, `delegate.fallback` + `subagentModel`, doctor raporu, calis/otonom (tr+en) yedek yolu, 3 test (49/49). K25.

## 2026-11-12 08:52 · Eksik listesi bitti: HAZIR (Opus)
8 madde kapandı, 7 bitiş şartının hepsi geçti (REVIEW.md), testler 46/46. Kota: 5 saatlik pencere %19, haftalık %43. Sıradaki: sahibinin onayıyla Fotosop'a `cv adopt --apply`, sonra iki yerel eklenti ve ilk damıtma.

## 2026-11-12 08:51 · 8. İngilizce beceriler (Opus)
`skills/en/{durum,calis,otonom,damit,cv-init}`: aynı ad ve komutlar, `cv` kodları çevrilmedi. tr/en eşliğini denetleyen test, 46/46. K24.

## 2026-11-12 08:49 · 7. probe/reference (Opus)
`cv probe` (eklenti, zaman sınırı, çıktı kesme, ekran adı) + `cv ref name|index|compare` (ad kuralı, indeks, yan yana HTML). 3 yeni test, 45/45. K23.

## 2026-11-12 08:47 · 6. core README'leri (Opus)
`core/{delegate,probe,reference}/README.md` yazıldı (metrics 1. maddede); eklenti arayüzleri, kayıt biçimleri, ad kuralı. Yer tutucu kalmasın testi, 42/42. K22.

## 2026-11-12 08:45 · 5. METHOD (Opus)
`docs/METHOD.md`: iş bölümü, paket düzeni, bağlam, ölçüm, değişmez kurallar, deney, otonomi, evrim; proje adı yok. Eşikleri config'e bağlayan test, 41/41. K21.

## 2026-11-12 08:44 · 4. ders sütunu (Opus)
INVENTORY §4 tablo oldu: 16 dersin her biri için "nereye gitti" (15 kod/beceri/şablon, 1 yalnız DERSLER). Hücrelerdeki yolları denetleyen test, 40/40. K20.

## 2026-11-12 08:43 · 3. OWNER_GUIDE (Opus)
`docs/OWNER_GUIDE.md`: kurulum, bilgisayar ayarları, başlatma, "ne yaptın", döngü öldü mü, durdurma; komutsuz sade Türkçe. Sayıları config'e bağlayan test, 39/39. K19.

## 2026-11-12 08:41 · 2. cv adopt (Opus)
`cv adopt [--dry-run|--apply] [--out]` + `docs/examples/fotosop-adopt-plan.md` (70 satır; Fotosop'a yalnız --dry-run, git temiz kaldı). 3 yeni test, 38/38. Karar K18.

## 2026-11-12 08:38 · 1. cv round (Opus)
`core/metrics/round.js` + `cv round start|end|add|show|table`: Fotosop tur ölçümünün genel hâli, alanlar `core/metrics/README.md`'de. 3 yeni test, 35/35. Karar K17.

## 2026-11-12 05:50 · Opus inceleme
Fable işi incelendi: 7 şarttan 4 geçti (init, testler, ad temizliği, kişisel bilgi), 3 eksik (adopt, OWNER_GUIDE, ders sütunu). Karar DEVAM; liste `docs/REVIEW.md`. Opus saat başı birer adım sürdürür.

## 2026-11-12 05:15 · v0.1.0 kurulum, limit freninde durdu (Fable 5.2)
5 saatlik pencere %76'ya geldi (istem sınırı %75); oturum kuralı gereği durdu. Doğrulama: `deno run -A tests/run.js` → 32/32 (bu makinede Node yok, Deno var; bkz. DECISIONS K1). Kararlar: `docs/DECISIONS.md` K1-K16.
- **Biten:** şablonlar (3.4), Türkçe beceriler `durum/calis/otonom/damit/cv-init` (3.3), otonomi çekirdeği: kapılar, kilit, proje payı, hafıza özeti, çevrim, kurtarma (3.2), CLI `init/doctor/status/gate/lock/cycle/recover` (3.1), evrim `distill/update` (3.5), ucuz model ajanı + ayrık şeritler + `builtin:crlf` eklentisi (3.2 delegate), testler.
- **Yarım / yok:** `cv round` (core/metrics; `calis` ve `durum` becerileri bu komutu çağırıyor, `cv status` yokluğunu hoş görüyor), `cv adopt` ve `docs/examples/fotosop-adopt-plan.md`, `cv ref` + core/probe + core/reference, İngilizce beceriler, `docs/METHOD.md`, `docs/OWNER_GUIDE.md`, INVENTORY §4'e "nereye gitti" sütunu, bitti ölçüsü 4 ve 7'nin grep kanıtı, `core/{delegate,metrics,probe,reference}/README.md` hâlâ yer tutucu. Şeritlerin gerçek ayrık süreç başlatması (`cv delegate batch`) ağ ve anahtar istediği için denenmedi; yalnız ajan döngüsü sahte modelle sınandı.
- **Sıradaki (bu sırayla):** core/metrics/round.js (Fotosop `scripts/round.js` genel hâli + alan belgesi) → `cv adopt` + Fotosop planı → OWNER_GUIDE → METHOD → INVENTORY sütunu + grep kanıtları → probe/reference → İngilizce beceriler. Sonra Opus: Fotosop'a `cv adopt --apply` ve ilk damıtma.

## 2026-11-12 03:40 · v0 temel (Opus 5.5)
Envanter (`docs/INVENTORY.md`), mimari taslak, README, evrim tohumu (16 evrensel ders), boş çekirdek klasörleri ve Fable istemi (`docs/FABLE_PROMPT.md`) yazıldı. Kod yok. Sıradaki: sahibi temiz bir Fable 5.2 oturumunda FABLE_PROMPT.md'yi çalıştırır.
