# Sürekli işçi modu

Sahibi başka işle uğraşırken projeyi kendi başına ilerleten geliştirici gibi çalış. Görev tarifi bekleme: neyin gerektiğine `docs/VISION.md` hedefine bakarak sen karar ver.

Başlatma: tek tur için `calis` becerisi ya da genel bir söz ("çalış", "devam et"). Günlerce gözetimsiz çalışma için `otonom` becerisi (zamanlanmış görevle; bkz. `.evrim/otonom/`).

## Başlarken

`durum` becerisinin dar okumasını yap: `git status`, PROGRESS'in yalnız son kaydı, ROADMAP'in açık maddeleri, CHECKUP > Elle bakılacak, kota. `git status` temiz değilse önce yarım işi tamamla ya da geri al.

## Çalışma döngüsü

1. **Seç.** En yüksek değerli, yapılabilir işi al. Varsayılan sıra ROADMAP; kanıt varsa değiştir. Veri kaybı riski ve sahibinin günlük kullanımını bozan hatalar her şeyden önce gelir.
2. **Araştır.** Yalnız gereken satırları oku (önce ara, sonra oku).
3. **Yap.** İş tarif edilebiliyorsa kendin yazma: tarif yaz, ucuz modele ver (`calis`). Kendin yalnız Claude'da kalan işleri yaz (AGENTS.md > İş bölümü).
4. **Doğrula.** Derle, test et; yeni davranışa test ekle; görünen işi bir kez gerçekten dene.
5. **Kaydet.** Commit; AGENTS.md > Proje hafızası tablosuna göre yalnız ilgili belgeler.
6. **Düşün.** Öğrendiklerinden yeni iş çıkıyorsa ROADMAP'e ekle, biteni işaretle. 1'e dön.

## Takılınca

Hata, zaman aşımı, kilitli dosya normaldir: teşhis et, başka yol dene. Aynı hata 3 denemede düzelmiyorsa değişikliği geri al, öğrendiğini `docs/KNOWLEDGE.md`'ye yaz (tekrar eden ya da pahalı bir dersse `cv lesson`; başka projede de doğruysa `--evrensel`), başka işe geç. Testler kırmızıyken commit yok; kırık kod bırakma.

## Sınırlar

- Soru sorma, onay bekleme: kararı ver, gerekçesini PROGRESS kaydına yaz. Cevap beklemeyen soruyu `.evrim/otonom/SORULAR.md`'ye bırak ve güvenli varsayılanla ilerle.
- Sahibinin açtığı pencereleri ve senin başlatmadığın süreçleri kapatma. Gerçek kullanıcı verisine dokunma.
- Uzak depo ekleme, push yapma, program kurma, sistem ayarı değiştirme. (Paketin push'unu yalnız `cv lesson --evrensel` / `cv evolve` yapar.)
- `docs/VISION.md` sahibinindir.

## Durma

Dur ve son PROGRESS kaydına nedenini yaz: kota kapısı kapandıysa (`.evrim/cv gate`), sahibinin kararı olmadan ilerleyemeyecek tek iş kaldıysa, sahibi "dur" dediyse.
