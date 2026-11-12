# claudevolution

**Claude Code projeleri için kendini geliştiren çalışma sistemi.** Tek komutla bir projeye belge ve kural sistemi, ucuz modele iş dağıtımı, gözetimsiz (limit yöneten) otonom çalışma ve her turdan ders çıkaran bir evrim döngüsü kurar.

*A self-evolving operating system for Claude Code projects: one `init` gives a project its rules and memory docs, cheap-model delegation, unattended limit-aware autonomy, and a learning loop that keeps project-specific lessons local and promotes general ones to every project.*

Durum: **v1.0, standart.** Paket bitmiş hâlinde; yalnız gerçek bir sorun ya da sahibinin isteğiyle, ölçülerek değişir: [docs/STANDARD.md](docs/STANDARD.md). Sahip için sade rehber: [docs/OWNER_GUIDE.md](docs/OWNER_GUIDE.md). Mimari: [ARCHITECTURE.md](ARCHITECTURE.md).

## Neden

Fotosop projesinde bir haftada (~1 milyar token) şunlar elle, dağınık biçimde gelişti: Claude'un planlayıp DeepSeek'in paralel şeritlerde yazdığı paket düzeni (bir turda 30 iş, ~2 $), tur ölçümleri, gözetimsiz döngü, hafıza dosyaları ve pahalıya öğrenilmiş dersler. Hepsi tek projeye gömülü. claudevolution bunları pakete çevirir; her yeni proje sıfırdan değil bu birikimle başlar ve her proje birikime katkı verir.

## Kullanım (hedef)

```
cv init            yeni ya da var olan projeye iskeleti kur
cv adopt           var olan bir düzeni (ör. Fotosop) göç ettir
cv doctor          otonomi önkoşullarını denetle
cv status          tur, kota, şeritler, hafıza özeti
cv distill         yerel dersleri evrensele damıt
cv update          paketin yeni sürümünü projeye uygula
cv delegate which  işi kim yapacak (ucuz API modeli, yoksa Claude subagent ya da ana model)
cv bench           paketi ölç (testler + kaos senaryoları; 0 token; --live ücretli ve tavanlı)
cv evolve          evrim/<ad> dalını ölç, geçerse pakete al ve GitHub'a gönder
```

## Katmanlar

- **Evrensel** (bu depo): yöntem, beceriler, şablonlar, ajan ve ölçüm araçları, `evolution/universal/` dersleri.
- **Yerel** (projede `.evrim/`): proje config'i, kurallar, proje dersleri, ölçümler, otonom hafıza.
