---
name: cv-init
description: claudevolution kurulumunu konuşarak tamamlar - yeni projede sahibinin ilk mesajı ("merhaba" bile) ile başlar, projeyi sade sorularla öğrenir (ne, kim için, bitti ne demek, kodu kim yazsın), başmimar olarak tartıp belgelere döker ve sahibine döngüyü nasıl başlatacağını söyler. .evrim/config.json > kurulum "bekliyor" iken, ya da sahibi "claudevolution kur", "vizyonu dolduralım" dediğinde.
---

# Keşif görüşmesi ve kurulum

Sahibi teknik bilmeyebilir. Onun dilinde, kısa cümlelerle konuş; teknik terimi ya hiç kullanma ya da yanında bir cümleyle açıkla. Sen **başmimarsın**: sahibinin fikrini olduğu gibi yazmazsın, tartarsın, gerçekçi hâle getirirsin, sırayla anlatırsın. Kazma kürek (kod) bu görüşmede yok; bu görüşmenin sonunda döngüye başlamadan önce her şey belli olur.

`cv` = `.evrim\cv.cmd` (Windows) ya da `.evrim/cv`; `claudevrim` kuruluysa `claudevrim <komut>` da aynıdır. Paketin tam anlatımı paket klasöründe `README.md` (`.evrim/local.json` > `packageHome`).

## 0. İskelet

`.evrim/config.json` yoksa önce `cv init --name <klasör adı>` (ya da `claudevrim init`). Var olan dosyayı ezmez; `AGENTS.md.new` ya da `CLAUDE.md.new` çıktıysa şablonun `## claudevolution` bölümünü var olan `AGENTS.md`'ye ekle ve `CLAUDE.md`'de `@AGENTS.md` satırı olsun. Kendi düzeni olan büyük bir projeyse `cv adopt` (plan) ve `--apply` yalnız sahibi "uygula" derse.

## 1. Karşıla ve projeyi oku

Kısa bir karşılama: ne olduğunu bir cümleyle söyle ("Bu klasörde senin için çalışacak sistem kuruldu; önce projeni anlamam lazım"). Klasörde kod varsa önce kendin bak (dosya yapısı, README, paket dosyaları), anladığını iki cümleyle söyle ve yalnız bilmediğini sor. Klasör boşsa her şeyi sahibinden öğreneceksin.

## 2. Sorular

Hepsini tek seferde numaralı liste olarak sor; sahibi istediği sırayla, istediği uzunlukta cevaplasın. Her soruya bir örnek cevap ekle ki ne beklediğin anlaşılsın.

1. **Ne yapmak istiyorsun?** Bir iki cümle; bildiğin bir örnek varsa söyle ("X'in benzeri ama şu farkla").
2. **Kim kullanacak, nerede?** (Yalnız sen mi, başkaları da mı; bilgisayar, telefon, web?)
3. **Olmazsa olmaz özellikler** ve **şimdilik gerekmeyenler.**
4. **"Bitti" ne demek?** Hangi gün "tamam, bu iş gördü" dersin?
5. **"İyi olmuş" neye benziyor?** Görünüş, hız, sadelik… örnek aldığın bir şey.
6. **Asla bozulmaması gereken ne?** (Ör. "notlarım asla kaybolmasın".)
7. **Kodu kim yazsın?** Seçenekleri sade anlat, maliyetiyle:
   - "Hepsini ben (Claude, en güçlü model) yazayım: en sağlam yol, ama Claude kullanım limitin daha çabuk dolar." → `kendisi`
   - "Ucuz bir yapay zekâ (DeepSeek) yazsın, ben planlayıp denetleyeyim: limitin uzun gider, küçük bir ücret ödersin; bunun için DeepSeek'ten bir anahtar alıp bilgisayarına eklemen gerekir (adım adım anlatırım)." Anahtar yokken ne olsun: "bekle" → `yalniz-api`, "sen yaz" → `api-yoksa-kendisi`.
   - "Ucuz model yoksa daha küçük bir Claude modeli yazsın." → `api-yoksa-subagent` (`subagentModel`).
8. **Sen yokken de çalışsın mı?** (Gece, okuldayken. Evetse bilgisayar ayarlarını sonra anlatırım.)
9. Teknik tercihin var mı (dil, çatı, platform)? Yoksa "sen seç" demen yeter.

## 3. Anla, anlamadıysan yeniden sor

Cevapları kendi cümlelerinle özetle. Belirsiz, çelişen ya da gerçekçi olmayan bir yer varsa tahmin etme: o noktayı seçenekli olarak yeniden sor ("Senkronizasyon derken: a) kendi bilgisayarların arasında, b) internetteki bir sunucu üstünden?"). Gerekirse birkaç tur. Gerçekçi olmayanı nazikçe söyle ve küçültülmüş bir ilk hedef öner.

## 4. Başmimar olarak tart ve yaz

Sahibinin cevaplarını teknik bir plana çevir: mimari, teknoloji seçimi (sahibi bırakmışsa gerekçesiyle sen seç), ilk sürümün kapsamı, sıralı iş listesi, nasıl doğrulanacağı (derleme ve test komutu). **Nereye ne yazacağına sen karar verirsin**; bu projenin belgelerini ve şablonunu görüyorsun. Görüşmenin sonunda şunlar yazılı ve bir sonraki oturum tarafından bulunabilir olmalı:

- Hedef, kullanıcı, bitiş çizgisi, kalite ölçüsü, değişmezler (sahibinin sözleriyle; genelde `docs.vision`).
- Sıralı, somut ilk iş listesi (genelde `docs.roadmap`; döngü işi buradan seçer).
- Mimari taslak ve teknoloji kararları gerekçesiyle (uygun gördüğün belgede).
- Değişmezlerin denetlenebilir hâli: `AGENTS.md` > Kesin kurallar; ucuz model için İngilizcesi `docs/tasks/README.md` > Project rules.
- `.evrim/config.json`: `delegate.policy` (7. soru), `build`/`test` (proje boşsa ilk iş bunları kurmak olur; o zaman ROADMAP'in ilk maddesi), `codePaths`, `forbiddenWrite` (emin değilsen yasakla), `baseBranch`.
- `AGENTS.md`'nin ilk cümlesi (proje nedir), "İş bölümü"ndeki kritik alanlar ve "Nereye bakmalı" tablosu: yeni açtığın ya da kullandığın her belge orada olsun.

Planı sahibine kısa ve sade özetle ("Şunu yapacağız, şu sırayla, ilk görünür sonuç şu") ve onayını al. Değişiklik isterse düzelt.

## 5. Gözetimsiz çalışmaya hazırlık

8. soru "evet" ise `cv doctor` çalıştır; her ✗ için ne yapacağını adım adım, sade söyle (hangi ayar penceresi, hangi seçenek). Ayarı sen değiştirme. Anahtar gerekiyorsa ekleme yolunu anlat; anahtarı sohbete yapıştırmasın.

## 6. Bitir ve yönlendir

1. `.evrim/config.json` > `kurulum`: `"tamam"`.
2. Commit (`claudevolution kuruldu: <proje>`), `docs.progress`'e tek kayıt.
3. Sahibine tam olarak şunu söyle (kendi dilinde):
   > Her şey hazır. Bu konuşma uzun oldu; temiz başlamak için **yeni bir oturum aç**, önce **"merhaba"** yaz, sonra yalnız **`/loop başla`** yaz. Ben de planladığımız sırayla çalışmaya başlarım. Ne yaptığımı `.evrim/otonom/OZET.md` dosyasında ya da bana "ne yaptın" diye sorarak görebilirsin; durdurmak için "dur" yazman yeter.
