# İlerleme

En üstte en yeni; kayıt başına ≤5 satır.

## 2026-11-12 05:50 · Opus inceleme
Fable işi incelendi: 7 şarttan 4 geçti (init, testler, ad temizliği, kişisel bilgi), 3 eksik (adopt, OWNER_GUIDE, ders sütunu). Karar DEVAM; liste `docs/REVIEW.md`. Opus saat başı birer adım sürdürür.

## 2026-11-12 05:15 · v0.1.0 kurulum, limit freninde durdu (Fable 5.2)
5 saatlik pencere %76'ya geldi (istem sınırı %75); oturum kuralı gereği durdu. Doğrulama: `deno run -A tests/run.js` → 32/32 (bu makinede Node yok, Deno var; bkz. DECISIONS K1). Kararlar: `docs/DECISIONS.md` K1-K16.
- **Biten:** şablonlar (3.4), Türkçe beceriler `durum/calis/otonom/damit/cv-init` (3.3), otonomi çekirdeği: kapılar, kilit, proje payı, hafıza özeti, çevrim, kurtarma (3.2), CLI `init/doctor/status/gate/lock/cycle/recover` (3.1), evrim `distill/update` (3.5), ucuz model ajanı + ayrık şeritler + `builtin:crlf` eklentisi (3.2 delegate), testler.
- **Yarım / yok:** `cv round` (core/metrics; `calis` ve `durum` becerileri bu komutu çağırıyor, `cv status` yokluğunu hoş görüyor), `cv adopt` ve `docs/examples/fotosop-adopt-plan.md`, `cv ref` + core/probe + core/reference, İngilizce beceriler, `docs/METHOD.md`, `docs/OWNER_GUIDE.md`, INVENTORY §4'e "nereye gitti" sütunu, bitti ölçüsü 4 ve 7'nin grep kanıtı, `core/{delegate,metrics,probe,reference}/README.md` hâlâ yer tutucu. Şeritlerin gerçek ayrık süreç başlatması (`cv delegate batch`) ağ ve anahtar istediği için denenmedi; yalnız ajan döngüsü sahte modelle sınandı.
- **Sıradaki (bu sırayla):** core/metrics/round.js (Fotosop `scripts/round.js` genel hâli + alan belgesi) → `cv adopt` + Fotosop planı → OWNER_GUIDE → METHOD → INVENTORY sütunu + grep kanıtları → probe/reference → İngilizce beceriler. Sonra Opus: Fotosop'a `cv adopt --apply` ve ilk damıtma.

## 2026-11-12 03:40 · v0 temel (Opus 5.5)
Envanter (`docs/INVENTORY.md`), mimari taslak, README, evrim tohumu (16 evrensel ders), boş çekirdek klasörleri ve Fable istemi (`docs/FABLE_PROMPT.md`) yazıldı. Kod yok. Sıradaki: sahibi temiz bir Fable 5.2 oturumunda FABLE_PROMPT.md'yi çalıştırır.
