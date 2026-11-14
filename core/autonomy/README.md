# core/autonomy

Gözetimsiz döngünün hesap ve durum kısmı. Karar ve sıra `otonom` becerisindedir; buradaki kod kapıyı hesaplar, kilidi tutar, günlüğü yazar, takılmayı bulur.

| Dosya | Tek işi |
|---|---|
| `gates.js` | Kota kapıları: 5 saatlik %85 / %90, haftalık tavan `60 + 30·f`. Saf işlev; test edilir. |
| `lock.js` | Çevrim kilidi (`.evrim/otonom/lock`: oturum + zaman; 90 dk'dan eskiyse bayat). |
| `share.js` | Aynı makinede birden çok proje: makine kilidi + ağırlıklı sıra. |
| `memory.js` | Hafıza dosyalarını dar okur (DERSLER tamamı, GUNLUK kuyruğu, okunmamış NOTLAR, cevaplanmış SORULAR). |
| `cycle.js` | `cv cycle begin / end / sleep / prime`: yukarıdakileri tek komutta birleştirir, sayaçları tutar. |
| `office.js` | Çok katmanlı yazılım ofisi beyni: tempo/yakım izleme, öz-ayarlama kararnameleri (`KARARNAMELER.md`), yöntem denetimi (`OFIS_MUHAKEMESI` / `ACIK_CERCEVE`) ve `BITTI` bitiş kapısı (`checkFinalForm`). |
| `notify.js` | `BITTI` durumunda `OZET.md`'ye çalıştırma yolunu yazar ve platforma uygun (engellemesiz) masaüstü bildirimi + terminal zili gönderir. |
| `recover.js` | `cv recover [--fix]`: bayat kilit, yarım birleştirme, çakışma, ölü şerit kaydı. |
| `TASK_PROMPT.txt` | Zamanlanmış göreve yapıştırılacak düz metin. |

## Sürücü

**Birincil: Claude masaüstü uygulamasının zamanlanmış görevi.** Her tetik temiz bir oturum açar: bağlam şişmez, `/loop`'un 3 günlük ve `CronCreate`'in 7 günlük ömür sınırı yoktur, oturum kapansa da sürer. Görevin istemi düz metindir (yeni oturum kutusu eğik çizgi komutu kabul etmez): `TASK_PROMPT.txt`. Önerilen aralık 30 dakika; çevrim çalışırken gelen tetik kilidi görür ve `MESGUL` ile hemen çıkar (birkaç yüz token).

**Yedek: tek oturumda `/loop`.** Çevrim başında 30 dakikalık sigorta uyanışı (`ScheduleWakeup`), sonunda gerçek süreyle yeniden planlama. Çevrim bir hatayla yarıda kalırsa sigorta döngüyü diriltir.

## Bir çevrim

```
get_usage → cv cycle begin        kilit · bitiş kapısı · sıra · kapı · tempo/ofis muhakemesi · hafıza özeti
            └ KARAR: GO | KUCUK | CIK | MESGUL | DUR | SIRA_DEGIL | BITTI
iş adımı (≤ pencerenin %8'i), her 5-6 araçta ve her commit'te: cv gate
get_usage → cv cycle end          GUNLUK kaydı · pencere gözlemi · öz-ayarlama · bitiş kontrolü · kilidi bırak
```

Her durumun kurtarma yolu:

| Durum | Ne olur |
|---|---|
| Çevrim ortasında oturum öldü | Kilit 90 dk sonra bayatlar; sonraki tetik devralır ve `KURTARMA:` satırıyla haber verir |
| Limit doldu | Kapılar %85/%90'da durdurur; zamanlanmış görev sıfırlanınca kendiliğinden devam eder |
| Kota okunamıyor | Tek küçük adım; üç kez üst üste olursa bekler |
| Yarım birleştirme, çakışma | `cv recover` bulur, `--fix` güvenli olanı geri alır; iş asla silinmez |
| Şerit süreci öldü | Kayıt "öldü" işaretlenir; yarım iş kendi dalında durur, sonraki paket sürdürür |
| Sahibi durdurmak istiyor | `NOTLAR.md`'ye `DUR` → her çevrim hiçbir şey yapmadan çıkar |
| İki proje aynı anda | Makine kilidi biri bitene kadar öbürünü bekletir; sıra ağırlığa göre döner |

Durum dosyaları: `.evrim/state/cycle.json` (sayaçlar), `.evrim/state/quota.json` (son bilinen kota). İkisi de git'e girmez.
