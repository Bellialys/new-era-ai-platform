# ADR-007: Public Key Pinning вместо Certificate Pinning для Mobile SDK

**Status:** Accepted
**Date:** 2026-07
**Deciders:** Platform Team

---

## Context

Mobile SDK (v3.1) требует защиты от MITM-атак и подделки TLS-сертификатов.
Два варианта:
- **Certificate Pinning** — прибиваем конкретный сертификат (DER-encoded)
- **Public Key Pinning** — прибиваем публичный ключ из сертификата (SPKI hash)

---

## Decision

Использовать **Public Key Pinning** (Subject Public Key Info — SPKI hash) — не Certificate Pinning.

```swift
// iOS: Alamofire ServerTrustManager
let evaluators: [String: ServerTrustEvaluating] = [
    "api.domain.com": PublicKeysTrustEvaluator(keys: [
        // SHA-256 hash публичного ключа, не сертификата
        "sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
    ])
]
```

```kotlin
// Android: OkHttp CertificatePinner
val pinner = CertificatePinner.Builder()
    .add("api.domain.com", "sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=")
    // + backup key pin обязательно
    .add("api.domain.com", "sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=")
    .build()
```

---

## Rationale

**Почему не Certificate Pinning:**

**Проблема ротации сертификатов:**
- TLS-сертификаты Let's Encrypt / DigiCert обновляются каждые 90 дней (Let's Encrypt) или 1-2 года
- При каждом обновлении сертификата — Certificate Pin становится невалидным
- Все пользователи на старых версиях SDK теряют доступ к API
- Единственный выход — force-update приложения или server-side override (убивает смысл pinning)

**Жёсткость:**
- Certificate Pinning привязан к одному конкретному сертификату
- Нет пространства для плановой ротации без breaking change

**Почему Public Key Pinning:**

**Ключ живёт дольше сертификата:**
- Публичный ключ (SPKI) остаётся тем же при перевыпуске сертификата
- Можно менять CA, продлевать сертификаты — пин остаётся валидным
- Certificate обновляется → новый сертификат, тот же публичный ключ → SDK не ломается

**Backup Key Pin обязателен:**
```
Primary key:  текущий активный ключ
Backup key:   следующий ключ (pre-generated, ещё не в обороте)
```
- Если primary key скомпрометирован → активируем backup → нет outage
- Стандарт HPKP требовал backup pin (RFC 7469)

**Устойчивость к MITM:**
- MITM-атака требует не только поддельного сертификата, но и приватного ключа
- Приватный ключ под control'ом CA — значительно сложнее скомпрометировать

---

## Consequences

**Позитивные:**
- Ротация TLS-сертификатов не требует обновления SDK
- Поддержка резервного ключа (backup pin) позволяет graceful key rotation
- Стандартный подход, поддерживаемый Alamofire (iOS) и OkHttp (Android)

**Негативные:**
- Сложнее понять: нужно вычислить SPKI hash из ключа, а не просто скопировать сертификат
- При компрометации приватного ключа сервера — нужно менять ключ И обновлять SDK
- Требует поддержания backup key в актуальном состоянии

**Операционные требования:**
- Backup key должен быть pre-generated и храниться в HSM (не использоваться, но готов)
- При смене primary key — backup становится primary, генерируется новый backup
- SDK должен содержать оба пина: primary + backup
- При провале pinning: 401 + специальный error code (не маскировать как network error)
