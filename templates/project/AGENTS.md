# Yapay zekâ ajanları için rehber

{{project}}: <tek cümle: bu proje nedir, kim için>. Başlamadan önce [docs/VISION.md](docs/VISION.md) dosyasını okuyun. Sahibi Türkçe konuşur; teknik bilmeyebilir, sade anlatın.

## Oturumun ilk işi

- `.evrim/config.json` > `kurulum` `"bekliyor"` ise sahibinin ilk mesajı ne olursa olsun ("merhaba" bile) `cv-init` becerisini uygula: keşif görüşmesi, plan, sonunda "yeni oturum aç, merhaba yaz, `/loop başla` yaz".
- Kurulum tamamsa: selama `durum` becerisiyle kısa durum; sonunda döngü için `/loop başla` yazılacağını söyle. `başla` (çoğunlukla `/loop başla` içinden) = `otonom` becerisiyle bir çevrim.

## claudevolution

Bu proje **claudevolution** düzeniyle çalışır. Sistemin tamamı paketin README'sindedir: paketin yeri `.evrim/local.json` > `packageHome` (`<packageHome>/README.md`). Kısaca:

- `cv` = `.evrim\cv.cmd` (Windows) ya da `.evrim/cv`. Ayarlar `.evrim/config.json`, otonom hafıza `.evrim/otonom/`.
- Beceriler (`.claude/skills/`): `durum` ("neredeyiz"), `calis` ("çalış": bir tur iş), `otonom` (gözetimsiz tek çevrim), `damit` ("damıt"), `cv-init` (kurulum, VISION).
- **Ders kuralı, her oturumda (döngü dışında da):** tekrar eden ya da pahalıya patlayan bir şey öğrendiğin an tek satır yaz. Yalnız bu projeye özgüyse `cv lesson "<ders>"` (`.evrim/otonom/DERSLER.md`). Proje adı çıkınca da doğruysa `cv lesson "<genelleştirilmiş ders>" --evrensel`: ders hemen bütün projelere gider (geliştirici makinesinde pakete: ölçülür, GitHub'a push edilir; diğer makinelerde bu makinenin evrensel katmanına, `~/.claudevrim/evrensel/`); damıtmayı bekleme. Bu projenin gördüğü evrensel dersler (paket + bu makine, birleşik): `.evrim/evrensel.md`. Ciddi hata kalıbı: `--hata`.
- **Push:** bu projenin deposunda yok (sahibi istemedikçe). Paketin push'unu yalnız `cv lesson --evrensel` ve `cv evolve` yapar. Paket yeni sürüm aldıysa: `claudevrim guncelle` (ya da `cv update --apply`).

## Nereye bakmalı

| Soru | Belge |
|---|---|
| Ne isteniyor, hangi kararlar alındı? | `docs/VISION.md` |
| Sistem nasıl işliyor? | `docs/ARCHITECTURE.md` |
| Derleme, test, özellik ekleme? | `docs/DEVELOPMENT.md` |
| Denenerek öğrenilmiş bilgiler, tuzaklar? | `docs/KNOWLEDGE.md` |
| En son ne yapıldı? | `docs/PROGRESS.md` (yalnız en üstteki kayıt) |
| Sırada ne var? | `docs/ROADMAP.md` (yalnız açık maddeler) |
| Bilinen hata, elle denenecekler? | `docs/CHECKUP.md` |
| Kendi başına sürekli çalışma? | `docs/WORKER.md`; gözetimsiz döngü: `otonom` becerisi |
| Kod işini ucuz modele nasıl veririm? | `calis` becerisi; ajan kuralları ve tarifler `docs/tasks/` |
| Gözetimsiz döngünün hafızası, sahibinin notları? | `.evrim/otonom/` (DERSLER, GUNLUK, HATALAR, OZET, SORULAR, NOTLAR) |

Belgeleri baştan sona okumayın: tablodaki "yalnız" notlarına uyun, gerisini `grep` ile arayın.

## Kesin kurallar

<!-- Bu projeye özgü, pazarlıksız kurallar. Her kural tek cümle ve denetlenebilir olsun. Örnekler:
     "Üretilmiş dosya `build/generated/*` elle düzenlenmez."  "Sunucu bağımlılığı eklenmez." -->

1. Veri kaybı en ağır hata türüdür: kaydetme, silme ve taşıma akışları test edilmeden değiştirilmez.
2. `.evrim/config.json` > `forbiddenWrite` içindeki yollara ucuz model yazamaz; bu listeyi yalnız sahibi daraltır.
3. Anahtar, parola, kişisel bilgi hiçbir dosyaya, loga ya da commit'e yazılmaz; anahtarlar yalnız ortam değişkeninden okunur.
4. <projeye özgü kural>
5. <projeye özgü kural>

## Her değişiklikten sonra

```
{{build}}
```

```
{{test}}
```

- Yeni davranış için test ekleyin; her zaman doğru dönen kontrol test değildir.
- Testin geçmesi gerçek kullanımı kanıtlamaz: sahibinin göreceği akışı bir kez gerçekten deneyin.
- Raporladığınız her sayıyı (test sayısı, satır, maliyet) bir komutun çıktısından alın; ezberden sayı yazmayın.

## İş bölümü

Claude düşünür, planlar, denetler ve belgeler; kod emeği ucuz modele gider (`calis` becerisi: turda 8-30 kısa tarif, paralel şeritler, gözden geçir, birleştir). **Claude'da kalır:** veri kaybı riski olan akışlar, ne yapılacağı belli olmayan işler, tarifi kodundan uzun sürecek küçük düzeltmeler, <projeye özgü kritik alanlar>. Ucuz model isen kuralların `docs/tasks/README.md`.

## Projeyi ilerletme

Sahibi her adımı tarif etmek istemiyor; hedef `docs/VISION.md` içindedir, kararı siz verin.

- Belirli bir görev verildiyse önce onu yapın. "Çalış", "devam et" gibi genel sözde `docs/WORKER.md` uygulanır.
- İşler `{{baseBranch}}` dalına commit edilir. Uzak depo eklenmez, push yapılmaz (sahibi açıkça istemedikçe).
- Yanından geçtiğiniz küçük hatayı düzeltin; büyükse `docs/CHECKUP.md`'ye yazıp göreve devam edin.
- Yol haritasının sırası kanıta göre değişebilir; nedenini kayda yazın.

## Proje hafızası

Amaç: gelen her ajan öncekinin kaldığı yerden devam etsin. Her değişiklik her belgeye yazılmaz.

| Olay | Yazılacak yer |
|---|---|
| Küçük düzeltme (yazım, renk, tek satır) | Yalnız commit mesajı |
| Kullanıcının göreceği özellik ya da hata düzeltmesi | `CHANGELOG.md`; yol haritası maddesi bittiyse işaretleyin |
| Oturumda anlamlı iş bitti | `docs/PROGRESS.md` en üste tek kayıt (≤5 satır) |
| Koddan görülemeyen tuzak, denenip bırakılan yol | `docs/KNOWLEDGE.md` |
| Düzeltilmeden bildirilen ya da elle denenecek hata | `docs/CHECKUP.md` |
| Mimari, klasör ya da akış değişti | `docs/ARCHITECTURE.md` ya da `docs/DEVELOPMENT.md` |
| Hedef ya da sahibinin kararı değişti | `docs/VISION.md` (yalnız sahibinin sözüyle) |
| Tekrar eden ya da pahalıya patlayan durum | `cv lesson "<ders>"` (yerel) ya da `cv lesson "<genelleştirilmiş ders>" --evrensel` (pakete); bkz. § claudevolution |

**Belge diyeti:** bir turda yazılan yalnız CHANGELOG satırları, ROADMAP işaretleri ve PROGRESS'e tek kısa kayıttır. KNOWLEDGE ve CHECKUP yalnız gerçekten yeni bulgu varsa, birkaç satır. Yeni plan ya da rapor belgesi açılmaz. Eski ya da yanlış bilgi görürseniz o an düzeltin; doğrulanmamışı doğrulanmış gibi yazmayın.
