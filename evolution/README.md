# evolution

Paketin kendini geliştiren kısmı. Uygulayan: `damit` becerisi (`skills/tr/damit/SKILL.md`); yardımcı çıktı: `cv distill`.

```
proje/.evrim/otonom/DERSLER.md        yerel dersler (≤40 satır, her çevrim okunur)
        │  damıtma: günde bir ya da her 10 çalışan çevrimde; toplam kotanın ≤%10'u
        ▼
evolution/universal/DERSLER.md        evrensel dersler (≤80 satır)            ┐
evolution/universal/HATALAR.md        tekrar eden hata kalıpları              ├ bütün projeler alır
skills/ ve templates/ metinleri       ikinci kez çıkan ders kurala dönüşür    ┘ (cv update ile)
evolution/CHANGELOG.md                her değişiklik: beklenen etki · ölçü · K · sonuç
```

## Seçilim

Her evrim değişikliği bir **ölçü hipotezi**yle girer ve K çevrim sonra ölçülür; kötüleştiyse geri alınır.

| Ölçü | Tanım | Kaynak | İyi yön |
|---|---|---|---|
| `is-basina-kota` | biten ucuz model işi başına haftalık kota puanı (son 5 tur) | `.evrim/metrics.jsonl` | düşük |
| `ilk-deneme-orani` | ucuz modelin ilk denemede bitirdiği iş oranı | `.evrim/metrics.jsonl` | yüksek |
| `bosa-cevrim` | commit üretmeyen çevrim oranı | `.evrim/state/cycle.json` | düşük |
| `sahip-itirazi` | sahibinin `NOTLAR.md`'deki itiraz sayısı | `.evrim/otonom/NOTLAR.md` | düşük |

Fark %10'dan küçükse gürültü sayılır (`tuttu`). Ölçüsü olmayan değişiklik yapılmaz.

## Koruma

- Evrensel değişiklik **hiçbir projenin kuralını gevşetemez**: `forbiddenWrite`, veri kaybı kuralları, kota eşikleri, "Asla" listeleri yalnız sıkılaşır. `cv update` config'e ve proje belgelerine dokunmaz; çekirdek yasak yollar (`.git`, `.evrim/`, `.claude/`) kodda sabittir.
- Pakete proje adı, yolu, kişisel bilgi, anahtar girmez; ders taşınmadan önce genelleştirilir.
- Bir damıtmada en çok 5 taşıma. Değişiklik projelere habersiz gitmez: her proje `cv update` ile farkı görüp alır.

## Aynı makinede birden çok proje

Kota tek hesaba aittir. `core/autonomy/share.js`: makine kilidi (aynı anda tek projede çevrim) + ağırlıklı sıra (`autonomy.share.weight`). Tasarım ve gerekçe: `docs/DECISIONS.md` K7.
