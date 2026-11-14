# Mimari

Sistemin nasıl işlediği: bir sayfayı geçmesin. Ayrıntı kodda; burada yalnız "hangi parça ne iş yapar, kim kiminle konuşur".

## Parçalar

| Parça | Yer | Tek cümleyle işi |
|---|---|---|
| <ör. Arayüz> | `src/ui/` | <ne yapar> |
| <ör. Çekirdek> | `src/core/` | <ne yapar> |

## Akış

<Bir kullanıcı eyleminin baştan sona yolu, 3-6 adım. Ör. "Kaydet → doğrulama → dosyaya yaz → geçmişe ekle".>

## Sınırlar ve kurallar

- <Parçalar arası izinli konuşma yolu; ör. "Arayüz veriye yalnız `api` üzerinden erişir.">
- <Dışarıya bağımlılıklar ve neden.>

## Klasörler

```
src/        <ne>
tests/      <ne>
docs/       proje hafızası (AGENTS.md > Nereye bakmalı)
.evrim/     claudevolution yapılandırması ve otonom hafıza
```
