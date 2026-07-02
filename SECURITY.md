# SECURITY.md

> Этот документ обязателен для SOC 2 Type II и описывает политику безопасности платформы "Новая эпоха".

---

## Контакты безопасности

| Роль | Контакт |
|------|---------|
| Security Lead | TBD: официальный security mailbox перед public disclosure |
| Data Protection Officer (DPO) | TBD: официальный DPO/privacy mailbox перед SOC 2/GDPR-ready релизом |
| Incident Response | TBD: официальный 24/7 incident contact перед enterprise release |

**Responsible Disclosure:** до настройки официального security mailbox этот документ является внутренним draft-policy и не должен публиковаться как внешний disclosure policy.
Не публикуйте и не эксплуатируйте уязвимость до координации с командой.
Мы обязуемся ответить в течение 5 рабочих дней и не преследовать исследователей, действующих добросовестно.

---

## Классификация данных

| Класс | Примеры | Хранение | Обработка |
|-------|---------|----------|-----------|
| **Секретные** | API Keys, Stripe Webhook Secrets, KMS Keys | Только Vercel Env / KMS | Никогда в логи, никогда в код |
| **Конфиденциальные (PII)** | Email, имя, prompt_text | Regional Data Plane (EU/US) | Шифрование AES-256-GCM, Crypto-Shredding при Erasure |
| **Внутренние** | Usage metrics, billing_events | Supabase (региональный) | Append-Only, аудит лог |
| **Публичные** | Документация, статус платформы | Любое хранение | Без ограничений |

**Критическое правило:** Секретные данные (API Keys, Stripe secrets, Supabase Service Role Key) никогда не попадают в:
- Git репозиторий (включая `.env.local`)
- Чат, скриншоты, PR, Issue, README
- Frontend-код или client bundle

---

## Шифрование

### В хранении (At Rest)

- **Supabase:** AES-256 шифрование на уровне PostgreSQL (database-level encryption)
- **PII в `usage_events.prompt_text`:** Дополнительное шифрование AES-256-GCM через Envelope Encryption
  - DEK (Data Encryption Key) хранится в KMS (AWS KMS / GCP KMS / HashiCorp Vault)
  - Только ссылка `key_id` хранится в БД, сам ключ — никогда
  - При GDPR Erasure: DEK удаляется → данные нечитаемы везде (включая WORM-бэкапы)
- **S3 Backups:** AES-256-S3 (SSE-S3) или SSE-KMS, Object Lock COMPLIANCE mode

### В передаче (In Transit)

- Все API endpoints: TLS 1.2+ (TLS 1.3 предпочтительно)
- HSTS: `max-age=63072000; includeSubDomains; preload`
- API Keys в `Authorization: Bearer` header, никогда в URL параметрах
- Mobile SDK: Public Key Pinning (SPKI hash) с backup pin (см. [ADR-007](docs/adr/007-public-key-pinning-vs-certificate-pinning.md))

### API Keys

- Формат: `nea_<random_32_bytes_hex>` (64 символа после префикса)
- Верификация: HMAC-SHA256 (не bcrypt) — высокая энтропия ключа делает brute force нецелесообразным
- Хранение: только HMAC-хеш в БД, оригинал показывается пользователю один раз при создании
- Ротация: немедленная при подозрении на компрометацию

---

## Аутентификация и Авторизация

### Аутентификация

- **Web:** Supabase Auth (email/password + OAuth: Google, GitHub)
- **CLI / Headless:** Device Authorization Grant (RFC 8628) — не Basic Auth
- **Enterprise SAML:** SAML 2.0 с защитой от Replay Attacks (`saml_used_assertions` таблица)
- **2FA:** TOTP (RFC 6238) для всех пользователей; обязательно для операций Maker-Checker

### Авторизация

- Row Level Security (RLS) на всех таблицах Supabase
- `organization_id` как основная граница изоляции
- Pentest-аккаунты: `sandbox_region`, RLS-изоляция, нет доступа к production данным
- JWT: `data_region` claim для routing, `org_id` для RLS, стандартный Supabase signing

### SCIM / Enterprise Provisioning

- SCIM 2.0 для enterprise provisioning
- Soft Delete: при deprovision → статус `suspended`, не hard delete
- SCIM token отдельный от API Key, rotatable независимо

---

## Защита API и Backend

### Rate Limiting

- Upstash Redis (глобальный, edge-compatible)
- Per-user лимиты + per-org лимиты
- `429 Too Many Requests` с `Retry-After` header
- В v3.2+: per-model, per-endpoint, token-based и cost-per-day политики

### Защита от инъекций и AI Output

- AI-generated output = Untrusted Input
- Обязательная sanitization перед рендером (DOMPurify или аналог)
- Запрет исполнения AI-output как кода
- Markdown рендер: безопасный режим без raw HTML

### SSRF Protection

- Webhook URL валидация: блокировка RFC 1918 (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
- Блокировка loopback (127.x.x.x, ::1) и link-local (169.254.x.x, fe80::)
- Только разрешённые протоколы: HTTPS

### OpenRouter

- Никаких прямых вызовов OpenRouter из frontend
- Только через backend route handlers (`/api/...`)
- API Key OpenRouter хранится только в Vercel Env (server-side)

### Code Arena Runner

- Пользовательский код — только через внешний изолированный runner
- Требует аутентификации
- Недоступно в v0.x (только в v1.7+ после sandbox/security review)

---

## Соответствие нормативным требованиям (Compliance)

### GDPR

- **Data Residency:** EU-данные только в EU Regional Data Plane (Frankfurt)
  — Global Control Plane не содержит PII (см. [ADR-005](docs/adr/005-global-control-plane-regional-data.md))
- **Right to Erasure:** Crypto-Shredding — удаление DEK делает данные нечитаемыми везде
  (см. [ADR-004](docs/adr/004-crypto-shredding-gdpr.md))
- **Data Portability:** Compliance Pack Export (JSON/CSV)
- **Processing Restriction:** HTTP 451 при active restriction запросе
- **Retention:** PII не хранится дольше необходимого; billing records — по юридическим требованиям (7 лет)
- **DPA:** Data Processing Agreement доступно для Enterprise

### SOC 2 Type II (Roadmap)

| Control | Статус |
|---------|--------|
| Append-Only audit log | ✅ Внедрено (PostgreSQL triggers) |
| Crypto-Shredding GDPR | ✅ Внедрено (v2.8) |
| RBAC + RLS | ✅ Внедрено |
| Vanta/Drata integration | 📋 Roadmap (v2.8+) |
| Quarterly Restore Drills | 📋 Roadmap |
| Penetration Testing | 📋 Annual (v3.0+) |
| Compliance Evidence Snapshots | 📋 Roadmap (v2.8+) |

---

## Аудит и Логирование

### Аудит лог

- **Append-Only:** PostgreSQL triggers запрещают UPDATE/DELETE на `organization_audit_log`
- **Что логируется:** все чувствительные действия (login, API key creation, settings change, GDPR request, billing)
- **Retention:** минимум 1 год для SOC 2, 3 года для Enterprise

### Request Logs

- Хранятся вне PostgreSQL: OpenTelemetry → Grafana Loki / ClickHouse
- Никаких `prompt_text` в request logs (PII)
- Correlation ID (trace ID) во всех запросах

### Incident Response

1. Обнаружение (мониторинг / внешний отчёт)
2. Оценка серьёзности (P1-P4)
3. Containment (изоляция, revoke ключей если нужно)
4. Investigation (audit log, request logs)
5. Recovery
6. Post-mortem (обязателен для P1/P2)
7. Уведомление пользователей (если затронуты их данные — в течение 72h по GDPR)

---

## Инфраструктура и Секреты

### Vercel Environment Variables

Обязательные секреты хранятся только в Vercel Dashboard (не в коде):

- `OPENROUTER_API_KEY` — только server-side
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `SUPABASE_SERVICE_ROLE_KEY` — только server-side, никогда в `NEXT_PUBLIC_`
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- `API_KEY_SECRET` — для HMAC-SHA256 верификации API Keys

### KMS

- AWS KMS / GCP KMS / HashiCorp Vault для DEK хранения
- Региональные master keys (EU-KMS отдельно от US-KMS)
- Ротация master keys каждые 90 дней
- DEK никогда не покидает KMS в виде plaintext

---

## Связанные документы

- [ADR-001: HMAC-SHA256 для API Keys](docs/adr/001-hmac-sha256-vs-bcrypt-for-api-keys.md)
- [ADR-004: Crypto-Shredding для GDPR](docs/adr/004-crypto-shredding-gdpr.md)
- [ADR-005: Global Control Plane / Regional Data Plane](docs/adr/005-global-control-plane-regional-data.md)
- [ADR-007: Public Key Pinning для Mobile SDK](docs/adr/007-public-key-pinning-vs-certificate-pinning.md)
- [25-production-excellence.md](25-production-excellence.md) — раздел 9.1 AI Output Sanitization, 6.1 Code Runner
- [Project Vision Draft](docs/roadmap-drafts/project-vision-draft.md) — Архитектурные принципы
