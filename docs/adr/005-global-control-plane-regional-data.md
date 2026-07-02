# ADR-005: Global Control Plane / Regional Data Plane для Data Residency

**Status:** Accepted
**Date:** 2026-07
**Deciders:** Platform Team

---

## Context

При проектировании Data Residency (v3.0) первый инстинкт был:
"Auth глобальный, данные региональные".

Проблема: если Supabase Auth (глобальный) расположен в US, то `auth.users`
содержит email EU-пользователей на US-серверах. Это нарушает GDPR (Schrems II).

---

## Decision

Разделить инфраструктуру на два уровня:

**Global Control Plane (US, без PII):**
```sql
CREATE TABLE global_accounts (
  global_user_id  UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  data_region     TEXT NOT NULL CHECK (data_region IN ('eu', 'us')),
  account_status  TEXT NOT NULL DEFAULT 'active'
  -- НИКАКИХ email, имён или PII
);
```

**Regional Data Planes (EU: Frankfurt, US: Virginia):**
- `user_settings` (email, профиль)
- `usage_events`, `billing_events`
- `saved_prompts`, `organization_audit_log`
- Все данные с PII

**JWT routing:**
```
Login → Control Plane выдаёт JWT с claim data_region='eu'
Next.js Middleware читает data_region из JWT (без DB запроса)
→ роутит запрос на eu.api.domain.com
```

---

## Rationale

**Почему нельзя "Auth глобальный, данные региональные":**
- `auth.users` хранит email — это PII
- Таблица `auth.users` глобального Supabase = email EU-пользователей в US
- Это прямое нарушение GDPR Article 44 (transfers to third countries)
- После Schrems II EU-DPA могут наложить штраф: до 4% от глобального оборота

**Почему Global Control Plane без PII:**
- Control Plane содержит только `global_user_id`, `org_id`, `data_region` — не PII
- JWT с `data_region` позволяет Middleware роутить без дополнительных DB запросов
- Email и профиль хранятся только в региональном Data Plane пользователя

**Компромисс:**
Auth flow стал сложнее (два шага). Но это единственный способ соблюсти GDPR
при глобальной инфраструктуре.

---

## Consequences

**Позитивные:**
- GDPR-совместимое хранение данных EU-пользователей только в EU
- JWT routing без дополнительных DB запросов в Middleware
- Региональные KMS мастер-ключи (EU отдельно, US отдельно)

**Негативные:**
- Auth flow сложнее: два шага вместо одного
- Операционная сложность: два Supabase проекта вместо одного
- Cross-region requests — строгая проверка: EU-org никогда не попадает на US Data Plane

**Связанные решения:**
- Middleware проверка кросс-региональных запросов → алерт + блокировка
- Write-to-Read Routing (Session Stickiness) после записи (ADR не создан, но решение в v3.1)
- Regional Migration API использует Strangler Fig паттерн (ADR-006 не создан)
