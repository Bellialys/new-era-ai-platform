# ADR-004: Crypto-Shredding для GDPR Erasure (не перезапись данных)

**Status:** Accepted
**Date:** 2026-07
**Deciders:** Platform Team

---

## Context

GDPR требует "право на удаление" (Right to Erasure, Article 17). При этом:
- Финансовые записи в `billing_events` нельзя удалять (юридические требования)
- S3 WORM-бэкапы immutable — физическая перезапись невозможна
- `prompt_text` в `usage_events` содержит PII пользователя

Первый подход: перезаписать `prompt_text = '[DELETED]'`. Но это не работает с WORM-бэкапами.

---

## Decision

Использовать **Crypto-Shredding** через Envelope Encryption (DEK per user).

```
Для каждого пользователя:
  DEK (Data Encryption Key) хранится в KMS
  prompt_text = AES-256-GCM(raw_prompt, DEK)

При GDPR Erasure:
  DELETE DEK из KMS → данные нечитаемы
  Физические записи остаются, но расшифровать невозможно
```

```sql
CREATE TABLE user_encryption_keys (
  user_id     UUID PRIMARY KEY,
  key_id      TEXT NOT NULL,    -- только ссылка на KMS, не сам ключ
  created_at  TIMESTAMPTZ DEFAULT now(),
  shredded_at TIMESTAMPTZ       -- NULL = ключ активен
);
```

---

## Rationale

**Почему не простая перезапись:**
- WORM-бэкапы в S3 (Object Lock COMPLIANCE mode) физически immutable
- Перезапись в live БД не затрагивает бэкапы — данные остаются в архиве
- GDPR аудиторы могут потребовать доказательство удаления из бэкапов

**Почему Crypto-Shredding:**
- Удаление DEK из KMS = данные нечитаемы везде: в live БД, в бэкапах, в репликах
- Физические байты остаются (WORM), но без ключа они бессмысленны
- GDPR: "right to erasure" = данные недоступны, не обязательно физически удалены
- Признано EU GDPR WP29 guidelines как допустимый метод

**KMS выбор:**
AWS KMS, GCP KMS или Azure Key Vault. Self-hosted: HashiCorp Vault.
Ключ никогда не покидает KMS — только зашифрованные данные.

---

## Consequences

**Позитивные:**
- GDPR Erasure совместим с WORM/immutable storage
- Один удалённый DEK = все данные пользователя нечитаемы мгновенно
- Аудиторский след: `shredded_at` timestamp

**Негативные:**
- KMS — дополнительная зависимость и стоимость
- При потере DEK до Erasure — данные нечитаемы раньше времени (KMS backup критичен)
- Производительность: каждая запись `prompt_text` требует KMS-вызова (смягчается кэшированием DEK в памяти с TTL)

**Связанные решения:**
- Marketplace BYOK ключи провайдеров используют тот же паттерн (отдельный DEK на подключение)
- Pentest-аккаунты: при `auto_delete_at` — Crypto-Shredding sandbox DEK
