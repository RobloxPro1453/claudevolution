---
name: ui-design-review-tr
description: Var olan arayüz veya UI kodunu tasarım kalitesi, kullanılabilirlik, responsive davranış ve erişilebilirlik için bulgu odaklı incele.
---

# UI Tasarım İncelemesi

Yeni tasarım üretme isteği değilse önce mevcut arayüzü koru ve incele. Mümkünse hem uygulamayı görüntüle hem kodu kontrol et; yalnızca birini yaptıysan bunu belirt. Vercel'in MIT lisanslı `references/vercel-web-interface-guidelines-command.md` dosyası ekli pakette bulunuyorsa güncel/uygulanabilir maddeler için onu da kullan. Bu checklist bir ürün tasarım sisteminin veya kapsamlı erişilebilirlik testinin yerine geçmez.

## Öncelik sırası

1. Kullanıcının ana görevi bloklanıyor mu?
2. Bilgi hiyerarşisi veya eylem sırası anlaşılmıyor mu?
3. Klavye, kontrast, odak, alan etiketleri veya dar ekran gibi erişilebilirlik/usability sorunu var mı?
4. Boş, yükleniyor, hata ve başarı durumları eksik mi?
5. Tutarsız token, aralık, tipografi veya bileşen kullanımı var mı?
6. Yalnızca kozmetik ama görünürlüğü yüksek bir sorun kaldı mı?

## İnceleme kuralları

- Her bulguya etki düzeyi, örnek ekran/dosya satırı, neden kullanıcıyı etkilediği ve net düzeltme ekle.
- Ürün gereksinimi olmayan tercihi hata diye sunma. Kanıt yoksa varsayım olduğunu söyle.
- Renk, font, bileşen veya framework'i kullanıcı talebi olmadan toptan değiştirme.
- Önce ciddi işlev, erişilebilirlik ve responsive sorunlarını düzelt; sonra görsel polish yap.
- İyileştirme istenmişse yalnızca eleştiri verme: en değerli düzeltmeleri uygula ve kapsamı açıkla.
- Arayüzü çalıştırmadan koddan görünüşe dair kesin iddia etme. Otomatik tarama veya screenshot yalnızca gerçekten alındıysa raporlanır.
- WCAG uygunluğu hakkında geniş iddia kurma; gözlenen/ölçülen bulgu, ilgili başarı ölçütü ve test sınırlarını belirt.

## Yanıt formatı

Önce en yüksek öncelikli 3–7 bulguyu sırala. Her bulgu: **önem — konum — sorun — kullanıcı etkisi — düzeltme**. Sonra test edilmiş kapsamı ve test edilmemiş alanları bir cümleyle bildir. Kritik bir sorun yoksa yeni sorun uydurma.