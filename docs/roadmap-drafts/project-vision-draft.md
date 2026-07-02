# Project Vision Draft

> Живой документ. Обновляется при каждом крупном архитектурном решении.
> Исторический MVP-замысел сохранён в [`01-idea.md`](../../01-idea.md).
> Порядок версий — в [`14-roadmap.md`](../../14-roadmap.md).

---

## Миссия

**Новая эпоха** — платформа для сравнения, оценки и интеграции AI-моделей.

Мы начали как инструмент, который позволял сравнить два ответа рядом.
Сейчас мы строим Enterprise PaaS: открытый API, marketplace AI-провайдеров,
командная работа моделей, глобальная инфраструктура с юридической изоляцией данных.

Главный принцип не изменился: пользователь должен видеть несколько вариантов
и выбирать лучший — будь то один запрос, команда моделей или целый провайдер.

---

## Аудитория

### Individual Developers
Разработчики, исследователи, авторы текстов, студенты.
Используют Prompt Arena, Code Arena, Judge Mode.
Монетизация: Free tier → Pro (pay-as-you-go).

### Teams
Команды разработки, дизайна, контента.
Используют Shared Prompts, Team Mode, организационный биллинг.
Монетизация: Team plan с под-бюджетами на участника.

### Enterprise
Корпоративные клиенты с требованиями к безопасности и compliance.
SSO/SCIM, Data Residency (EU/US), Custom Domains, SLA-гарантии, Audit Logs.
Монетизация: Annual Enterprise contracts + Marketplace commissions.

---

## Пирамида продукта

```
┌─────────────────────────────────────────────────────────┐
│           Global Platform (v3.0+)                       │
│     Data Residency · Custom Domains · AI Marketplace    │
├─────────────────────────────────────────────────────────┤
│           Compliance & Observability (v2.8)             │
│     SOC 2 · GDPR · Crypto-Shredding · OTEL Pipeline     │
├─────────────────────────────────────────────────────────┤
│           Enterprise & Identity (v2.6–v2.7)             │
│     Organizations · SSO/SCIM · Audit Log · SLA          │
├─────────────────────────────────────────────────────────┤
│           Developer API & Ecosystem (v2.5)              │
│     REST API · SDK · Webhooks · Test Mode               │
├─────────────────────────────────────────────────────────┤
│           Monetization (v2.3–v2.4)                      │
│     Stripe · Entitlements · Dunning · Auto-Recharge     │
├─────────────────────────────────────────────────────────┤
│           Analytics & Admin (v2.1–v2.2)                 │
│     usage_events · Cost Dashboard · Admin Panel         │
├─────────────────────────────────────────────────────────┤
│           Core Product (v0.1–v2.0)                      │
│  Prompt Arena · Code Arena · Team Mode · Leaderboard    │
└─────────────────────────────────────────────────────────┘
```

---

## Бизнес-модель

### Free
- Ограниченное количество запросов в день
- Доступ к базовым моделям
- Prompt Arena, история

### Pro (Pay-as-you-go)
- Без лимита запросов (биллинг по usage)
- Все модели, Code Arena, Judge Mode
- Developer API, webhooks

### Team
- Организационный баланс с под-бюджетами
- Shared Prompts, Team Mode
- Audit log организации, под-бюджеты на участника

### Enterprise (Annual contract)
- SSO/SCIM, Custom Domains, Data Residency
- SLA-гарантии (99.9% uptime)
- Dedicated support (SLA 4 часа)
- Terraform Provider, BYOK Marketplace

### Marketplace Commission
- 15–25% от расходов через BYOK (Bring Your Own Key) к сторонним провайдерам
- Плата за трассировку (trace_token)

---

## Ключевые возможности

### Core Arena
- **Prompt Arena** — сравнение ответов нескольких AI-моделей
- **Code Arena** — сравнение кодовых решений (Lite + Runner)
- **Image Arena** — сравнение визуальных результатов
- **Multi Model Battle** — формальные бои с Leaderboard
- **Judge Mode** — модель-судья с многокритериальной оценкой
- **AI Team Mode** — несколько моделей с ролями (Planner → Critic → Finalizer)

### Analytics & Billing
- `usage_events` → `daily_usage_rollups` — детальный учёт расходов
- Spending Dashboard с прогнозом и объяснимостью (ML, Conformal Prediction)
- Append-only `billing_events` ledger — двойная бухгалтерия
- Stripe: Pay-as-you-go, подписки, dunning, auto-recharge
- Reconciliation: только алертинг, никогда не автокорректирует

### Developer Platform
- REST API `/api/v1/` — HMAC-SHA256, cursor pagination, Idempotency-Key
- TypeScript SDK `@new-era/sdk`, Python SDK `new-era-py`, iOS/Android SDK
- GraphQL API (Enterprise) с DataLoader, Persisted Queries
- Webhooks v2 с CloudEvents 1.0, SSRF защитой, Exactly-once delivery
- Test Mode (`ne_sk_test_...`) — детерминированные моки без биллинга
- Terraform Provider с поддержкой `terraform import`

### Enterprise & Identity
- Organizations с Advisory Lock биллингом, под-бюджетами, audit log
- SAML 2.0 / OIDC SSO с Account Linking и replay-защитой
- SCIM 2.0 с Soft Delete (финансовая целостность) и GBAC
- Append-Only audit log через PostgreSQL trigger
- Maker-Checker для трансферов > $100
- Device Authorization Grant (RFC 8628) для CLI/headless

### Compliance & Security
- Crypto-Shredding (Envelope Encryption) для GDPR Erasure
- KMS-зашифрованные DEK для каждого пользователя и провайдера
- GDPR: Erasure, Export, Restriction of Processing
- SOC 2 Type II через Vanta/Drata + `compliance_evidence_snapshots`
- Restore Drills ежеквартально с RTO/RPO логированием
- PII Redaction в Sentry/OTEL; request_logs вне PostgreSQL (Loki + Tempo)

### Global Platform
- **Global Control Plane / Regional Data Plane**: Auth без PII глобально,
  данные физически в регионе пользователя (EU: Frankfurt, US: Virginia)
- **Cloudflare for SaaS** — Custom Domains с автоматическим SSL
- **AI Marketplace** — BYOK с Crypto-Shredding DEK, Approval Workflow,
  Elastic IPs, outbound proxy
- **Write-to-Read Routing** — Session Stickiness после записи
- **Cross-Region DR** — async репликация, Read-Only при падении региона

---

## Архитектурные принципы

1. **Не вызывать OpenRouter напрямую из frontend** — только через backend route handlers
2. **Не коммитить секреты** — `.env.local` только локально, Vercel Env для production
3. **Append-Only Ledger** — `billing_events` никогда не удаляется и не редактируется
4. **Reconciliation = alert only** — никогда не автокорректирует баланс
5. **HMAC-SHA256 для API keys** — не bcrypt (слишком медленно для per-request верификации)
6. **Request logs вне PostgreSQL** — OTEL → Loki/Tempo, в PG только агрегаты
7. **Crypto-Shredding для GDPR** — удаляем DEK, не перезаписываем данные
8. **Regional isolation** — EU-данные физически не пересекают в US Data Plane
9. **Soft Delete для SCIM** — никогда hard delete financial records
10. **AI output = Untrusted Input** — sanitization, запрет исполнения

---

## Целевые SLA по тарифам

| Тариф      | Uptime SLA | Support Response | Credits при нарушении |
|------------|-----------|-----------------|----------------------|
| Free/Pro   | Best effort | Community       | Нет                  |
| Team       | 99.5%     | 72 часа         | 10% при <99.0%       |
| Enterprise | 99.9%     | 4 часа          | 25% при <99.0%       |

SLA покрывает только внутренние ошибки платформы (5xx).
Таймауты от OpenAI/Anthropic/OpenRouter не засчитываются в downtime.

---

## Non-Goals

Мы сознательно не строим:

- **Собственные LLM** — мы агрегатор и сравнительный слой, не провайдер
- **General-purpose AI platform** (как Hugging Face) — фокус на сравнении и командной работе
- **Voice/Video модальности** — в ближайшие 12 месяцев (текст + изображения)
- **Self-hosted Multi-region** — только Single-region self-hosted в Beta
- **Semantic caching с pgvector** — отложено до решения privacy/retention вопросов

---

## Связанные документы

- [`01-idea.md`](./01-idea.md) — исторический MVP-замысел (v0.1)
- [`14-roadmap.md`](./14-roadmap.md) — канонический порядок версий
- [`07-architecture.md`](./07-architecture.md) — техническая архитектура
- [`docs/adr/`](../adr/) — Architecture Decision Records
- [`SECURITY.md`](../../SECURITY.md) — безопасность и responsible disclosure
- [`12-security-and-env.md`](./12-security-and-env.md) — правила работы с секретами
- [`25-production-excellence.md`](./25-production-excellence.md) — production стандарты
