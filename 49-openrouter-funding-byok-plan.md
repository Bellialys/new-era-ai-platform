# 49 - OpenRouter Funding, Per-User Keys and BYOK Plan

## Статус

**Architecture plan / implementation not started**

Дата ревью внешних контрактов: **2026-09-27**.

Этот документ фиксирует архитектуру следующего этапа после закрытых Stage 1 и Stage 2.
Он не создаёт ключи, не меняет production database schema и не включает платные модели.
Реализация начинается только отдельными PR после повторной проверки внешних API.

## 1. Цель

Построить управляемую OpenRouter-инфраструктуру, в которой пользователь может работать в двух режимах:

1. **Platform funding** — AI-запрос оплачивается балансом New Era.
2. **User BYOK** — пользователь подключает собственный OpenRouter API key, и AI-запрос идёт за счёт его OpenRouter аккаунта.

Для platform funding целевая схема — **один активный OpenRouter inference key на одного зарегистрированного пользователя**, созданный backend через OpenRouter Management API.

Главные свойства:

- published model pricing совпадает с OpenRouter;
- фактическая стоимость запроса берётся из provider `usage.cost`, когда поле доступно;
- New Era не добавляет скрытую наценку;
- platform-owned ключ пользователя имеет отдельный hard spending limit;
- общий Workspace/Guardrail ограничивает риск всей платформы;
- BYOK расход не списывается с platform inference key;
- browser никогда не получает обратно сохранённый secret;
- guest users не получают отдельные OpenRouter keys;
- rate limiting, spending budget и provider limits считаются разными механизмами.

## 2. Что подтверждено у OpenRouter на 2026-09-27

Перед реализацией эти факты обязательно перепроверяются.

### Management API

OpenRouter Management API позволяет создавать и обновлять API keys.

Для key-level spend control доступны:

- `limit`;
- `limit_reset = daily | weekly | monthly`;
- `disabled`;
- `include_byok_in_limit`.

Management API key используется для административных операций и не должен использоваться как inference key.

### Current-key metadata

`GET /api/v1/key` возвращает safe account/key metadata, включая:

- `usage`;
- `usage_daily`;
- `usage_weekly`;
- `usage_monthly`;
- `limit`;
- `limit_remaining`;
- `limit_reset`;
- `is_free_tier`;
- `is_management_key`;
- `expires_at`;
- BYOK usage fields.

Поле `rate_limit` документировано OpenRouter как deprecated и не становится нашим SSOT.

### Pricing

`GET /api/v1/models` содержит provider catalog pricing для text-моделей.

Image API endpoint discovery возвращает отдельную pricing structure, потому что image models могут тарифицироваться per token, per image, per megapixel или по model-specific units.

Нельзя сводить все image prices к одному выдуманному `price_per_image`.

### Actual request cost

Для завершённого inference фактическая стоимость должна браться из `usage.cost`, когда OpenRouter её возвращает.

Если `usage.cost` отсутствует:

- нельзя записывать рассчитанную цену как «фактическую»;
- разрешено сохранить estimate отдельно;
- `cost_source` должен явно показывать `provider_usage | estimated | unknown`.

### Plans and controls

На текущей pricing page Management API и Budgets & Spend Controls доступны начиная со Standard.

Автоматическое создание per-user platform keys является blocked prerequisite, пока владелец OpenRouter account не подтвердит подходящий plan и Management API key.

### Guardrails / Workspaces

Guardrail может задавать spending limit, reset interval, model/provider allowlists, ZDR/privacy restrictions и дополнительные security controls.

New Era users **не становятся OpenRouter organization members**. Organization membership — административная модель OpenRouter, а не наша пользовательская таблица.

## 3. Основное архитектурное решение

```text
                         +----------------------+
                         | New Era user account |
                         +----------+-----------+
                                    |
                                    v
                         +----------------------+
                         | Funding Resolver     |
                         | platform | user_openrouter |
                         +----------+-----------+
                                    |
                  +-----------------+-----------------+
                  |                                   |
                  v                                   v
       +-------------------------+       +-------------------------+
       | Platform credential     |       | User BYOK credential    |
       | one active key / user   |       | user's OpenRouter key   |
       +------------+------------+       +------------+------------+
                    |                                 |
                    +---------------+-----------------+
                                    |
                                    v
                         +----------------------+
                         | OpenRouter Gateway   |
                         | validation           |
                         | usage/cost capture   |
                         | safe errors          |
                         +----------+-----------+
                                    |
                                    v
                              OpenRouter API
```

Все Prompt/Code/Judge/Team/Image маршруты позже должны использовать единый gateway вместо прямого чтения `OPENROUTER_API_KEY`.

## 4. Funding modes

### 4.1 `platform`

- только authenticated user;
- key создаётся лениво при первом platform-funded AI request или явном opt-in;
- максимум один active platform-managed key на пользователя в MVP;
- key secret не показывается пользователю;
- limit задаётся New Era policy;
- общий workspace/default guardrail ограничивает blast radius;
- usage: `billing_source = platform`.

Отдельный key **не означает**, что provider/account-wide limits автоматически умножаются на число пользователей.

### 4.2 `user_byok`

- только authenticated user;
- ключ проверяется server-side через OpenRouter до сохранения;
- пользователь видит только safe fingerprint/label/status;
- plaintext не возвращается после сохранения;
- запрос использует именно BYOK credential;
- usage: `billing_source = user_openrouter`;
- BYOK не расходует platform inference key;
- New Era всё равно применяет anti-abuse/concurrency limits;
- OpenRouter account balance/limits пользователя остаются provider-side authority.

### Terminology: New Era BYOK vs OpenRouter BYOK

UI-термин **BYOK** в New Era означает: пользователь принёс свой OpenRouter API key. Внутренний funding enum называется `user_openrouter`.

OpenRouter поле `usage.is_byok` означает другое: OpenRouter сам использовал upstream provider key, подключённый внутри OpenRouter аккаунта. Поэтому его сохраняем отдельно как `provider_is_byok` и никогда не используем вместо `billing_source`.

Возможны оба варианта:

- `billing_source=user_openrouter`, `provider_is_byok=false` — пользователь платит OpenRouter credits своего аккаунта;
- `billing_source=user_openrouter`, `provider_is_byok=true` — его OpenRouter account использовал upstream BYOK provider key.

### 4.3 Guests

Guest session не получает отдельный OpenRouter key из-за abuse/key-explosion риска.
До отдельного решения гости используют только текущую ограниченную platform policy.

## 5. Price parity policy

### Published price

Источник истины:

- text: OpenRouter model catalog;
- image/media: соответствующий OpenRouter discovery/endpoint pricing.

New Era хранит snapshot для истории, но stale snapshot не объявляется текущей ценой.

### Actual cost

Каноническое значение завершённого вызова — OpenRouter `usage.cost`.

### Estimate

До запроса UI может показывать только estimate с явной пометкой approximate.

### Account-level fees are separate

OpenRouter model inference rate и account-level fees — разные понятия. Credit-purchase/platform fees или BYOK plan fees не должны скрыто прибавляться к model price. Если New Era когда-либо показывает такие fees, они отображаются отдельной строкой с собственным источником.

### Future New Era billing

Если позже New Era продаёт собственные credits/subscription, разделять:

```text
provider_cost_usd
new_era_fee_usd
charged_total_usd
```

Provider cost нельзя перезаписывать коммерческой ценой New Era.
ADR-002 остаётся правилом для будущего реального billing ledger.

## 6. Limit model

| Слой | Что защищает | Источник истины |
|---|---|---|
| Provider/account limit | upstream availability | OpenRouter/provider |
| Platform key budget | деньги New Era на user | OpenRouter key `limit` |
| Workspace guardrail | общий blast radius | OpenRouter Guardrail |
| App rate limit | spam/concurrency/Vercel load | New Era + Upstash |

Один лимит не заменяет другой.

Hard monetary stop для platform mode должен находиться у OpenRouter: per-user key limit + workspace/default guardrail.

Локальная БД используется для UX, analytics и reconciliation, но не является единственной защитой денег.

Upstash остаётся отдельным anti-abuse механизмом. Production in-memory fallback не считается достаточной защитой cost-bearing routes.

## 7. Credential security

### Project-wide values

```text
OPENROUTER_MANAGEMENT_KEY
# provisioning/update/revoke only

OPENROUTER_API_KEY
# legacy/shared inference key до migration completion

OPENROUTER_WORKSPACE_ID
# server config identifier

OPENROUTER_DEFAULT_GUARDRAIL_ID
# server config identifier
```

Management key запрещено использовать для inference.

### User/provider secrets

Не хранить user OpenRouter keys в `profiles`, localStorage/sessionStorage, browser analytics, logs, error payloads, audit payloads или plain PostgreSQL columns.

### Encryption decision

ADR-004 уже принял envelope encryption / DEK-per-user-or-connection как target architecture.

Persistent provider secrets следуют ADR-004:

- ciphertext в Supabase;\n- plaintext DEK никогда не хранится в БД;\n- KMS/эквивалент управляет KEK и шифрованием DEK (например GenerateDataKey/envelope pattern);
- database dump сам по себе не раскрывает secret;
- crypto-shredding уничтожает возможность расшифровки;
- Vercel к KMS по возможности аутентифицируется short-lived OIDC credentials.

Supabase Vault установлен в production и технически подходит для encrypted secrets, но не выбирается как основной путь без отдельного ADR, потому что это изменило бы ADR-004.

### Plaintext lifetime

Plaintext key существует только в TLS request и server memory на время validation/encryption/inference и не попадает в persistence до шифрования.

## 8. Planned database changes

Это план, не применённая схема.

### `provider_credentials`

```text
id uuid PK
user_id uuid NOT NULL
provider text = 'openrouter'
origin text = 'platform_managed' | 'user_provided'
status text = 'pending' | 'active' | 'revoking' | 'revoked' | 'error'
provider_key_hash text nullable
safe_fingerprint text nullable
secret_ciphertext text/bytea
encrypted_dek text/bytea
kms_key_id text
limit_usd numeric nullable
limit_reset text nullable
expires_at timestamptz nullable
last_verified_at timestamptz nullable
last_used_at timestamptz nullable
created_at timestamptz
rotated_at timestamptz nullable
revoked_at timestamptz nullable
```

Rules:

- RLS enabled;
- no direct `anon`/`authenticated` table grants;
- backend/service layer only;
- one active platform credential per user in MVP;
- one active persistent BYOK credential per user in MVP;
- raw secret never appears in user-facing API.

### `ai_funding_preferences`

```text
user_id uuid PK
funding_source text = 'platform' | 'user_openrouter'
preferred_credential_id uuid nullable
updated_at timestamptz
```

### Extend `usage_events`

Current table already has user/model/tokens/latency/cost.

Planned additions:

```text
billing_source
credential_id
provider_request_id
provider_usage jsonb
provider_is_byok boolean
cost_source
currency
request_kind
```

### Extend `model_price_history`

Reuse existing table instead of creating a parallel pricing table.

Planned additions:

```text
provider
raw_pricing jsonb
source_checked_at
currency
```

Raw pricing is required for image/media non-token billing units.

## 9. Credential lifecycle

### Platform-managed key

```text
none -> pending -> Management API create -> encrypt -> active
     -> rotate -> revoking -> remote disable/revoke
     -> crypto-shred local secret -> revoked metadata
```

Provisioning must be idempotent. Concurrent first requests cannot create multiple active keys. Safe local fingerprint может использовать HMAC-SHA256 по ADR-001, но HMAC не заменяет reversible encrypted secret.

### BYOK key

```text
submit -> validate -> encrypt -> active -> verify on demand
       -> disconnect -> crypto-shred -> safe audit metadata only
```

New Era не может revoke внешний пользовательский OpenRouter key; disconnect удаляет только нашу копию.

## 10. Backend services planned

```text
openrouter-gateway.ts
openrouter-credentials.ts
openrouter-management.ts
openrouter-pricing.ts
openrouter-usage.ts
funding-resolver.ts
credential-crypto.ts
```

Все Arena modes должны зависеть от gateway, а не самостоятельно читать provider key.

## 11. Planned API surface

### `GET /api/integrations/openrouter`

Safe status only: connected, funding source, safe fingerprint/label, last verified, safe limit/usage metadata.

### `PUT /api/integrations/openrouter`

Auth + rate limit + validate key with OpenRouter + reject management key as inference BYOK + encrypt + atomic activate + safe response.

### `DELETE /api/integrations/openrouter`

Disconnect and crypto-shred our stored BYOK copy.

### `PATCH /api/profile/ai-funding`

Switch `platform | user_openrouter`; BYOK requires active validated credential.

Platform provisioning remains an internal service operation, not a public «create OpenRouter key» endpoint.

## 12. Model access policy

Platform mode starts with the current curated catalog.

BYOK may unlock a broader catalog later, but first beta keeps the same governance layer. BYOK solves funding, not capability/safety/UI compatibility.

## 13. Usage and accounting semantics

Every inference should capture when available:

- user_id;
- mode;
- requested model;
- actual returned model;
- prompt/completion/total tokens;
- latency;
- actual `usage.cost`;
- `provider_is_byok` (OpenRouter upstream-BYOK flag, not our funding source);\n- billing source;
- provider request id;
- safe error code.

`usage_events` is telemetry, not a money ledger.

Inference success не превращается в 500 только из-за telemetry insert failure, но telemetry loss должен создавать structured error/metric/reconciliation signal.

Если New Era начнёт списывать собственный пользовательский баланс, ADR-002 append-only double-entry ledger обязателен.

## 14. Safe error contract

```text
OPENROUTER_CONNECTION_REQUIRED
OPENROUTER_KEY_INVALID
OPENROUTER_KEY_EXPIRED
OPENROUTER_KEY_REVOKED
OPENROUTER_MANAGEMENT_UNAVAILABLE
PLATFORM_KEY_PROVISIONING_FAILED
PLATFORM_BUDGET_EXCEEDED
BYOK_PROVIDER_LIMIT
INSUFFICIENT_CREDITS
PROVIDER_RATE_LIMIT
CREDENTIAL_DECRYPTION_FAILED
```

Ошибки не содержат secret, Authorization header или unsafe provider payload.

## 15. Anti-abuse rules

- no platform key provisioning for guests;
- provisioning rate-limited per authenticated user;
- unique active-key constraints;
- Management API не принимает arbitrary browser payload;
- user cannot set arbitrary platform `limit`;
- key labels exclude email/PII;
- repeated provisioning failures trigger cooldown;
- disconnect/rotate audited without secret material.

## 16. Rollout plan

### Stage 3.0 — Documentation and contract freeze

Этот документ. Runtime не меняется.

### Stage 3.1 — External readiness

- confirm OpenRouter plan supports Management API/Budgets;
- create separate Management API key;
- confirm production Workspace;
- define default Guardrail;
- confirm production Upstash;
- choose KMS provider compatible with ADR-004;
- configure Vercel OIDC to KMS/cloud role where possible;
- define initial platform per-user money policy.

### Stage 3.2 — Data + crypto foundation

- migration for credentials/funding metadata;
- KMS/envelope crypto adapter;
- service-role-only storage;
- crypto tests;
- no inference routing change.

### Stage 3.3 — Pricing + actual usage

- add `usage.cost` handling;
- record actual cost + OpenRouter `usage.is_byok` as `provider_is_byok`;
- price sync into `model_price_history`;
- safe price/status API;
- no paid-model expansion.

### Stage 3.4 — BYOK beta

- auth-only connect/validate/store/disconnect;
- funding resolver;
- same governed catalog initially;
- strict secret-redaction tests;
- feature flag / controlled rollout.

### Stage 3.5 — Platform per-user keys

- lazy Management API provisioning;
- one active key per registered user;
- key limit/reset;
- rotation/revocation lifecycle;
- guardrail association;
- begin with a controlled canary cohort;
- verify OpenRouter key-cardinality/provisioning expectations before mass rollout;
- monitor Management API error/latency and orphan-key reconciliation;
- shared `OPENROUTER_API_KEY` becomes controlled migration fallback only.

### Stage 3.6 — Distributed limits and cost protection

- production Upstash required for cost-bearing routes;
- explicit Redis outage policy;
- provider budget preflight UX;
- global guardrail verification.

### Stage 3.7 — Expanded paid catalog

Only after previous stages are stable:

- broader BYOK catalog;
- optional platform-funded paid models by plan;
- price/spend UI;
- admin cost/credential status without secret access.

## 17. Test matrix

Security:
- user A cannot select/decrypt user B credential;
- no secret in JSON/logs/audit;
- malformed ciphertext fails closed;
- KMS unavailable fails closed;
- Management key cannot be inference credential;
- guest cannot provision platform key.

Concurrency:
- simultaneous first requests create at most one active key;
- rotation/inference deterministic;
- disconnect during inference does not leak credential.

Provider:
- valid/invalid/revoked/expired BYOK;
- 402 credits;
- 429 provider limit;
- Management API error;
- timeout.

Cost:
- exact `usage.cost` stored unchanged;
- missing cost never becomes fake actual;
- platform/BYOK attribution correct;
- image raw pricing units retained.

Rollback:
- forward-only migration;
- shared-key path remains until cutover;
- BYOK/provisioning feature flags independent;
- revoked credentials are never resurrected.

## 18. Observability

Safe structured fields:

```text
requestId
userId
credentialId
credentialOrigin
modelKey
providerStatus
billingSource
usageCost
latencyMs
safeErrorCode
```

Never log API key, Authorization header or full prompt by default.

## 19. Retention and deletion

BYOK:
- plaintext persistence = zero;
- encrypted secret until disconnect/account deletion;
- disconnect => crypto-shred according to ADR-004;
- safe metadata follows retention policy.

Platform-managed:
- active while platform access is enabled;
- account deletion/suspension => remote disable/revoke first, then local crypto-shred;
- later reconciliation detects orphaned remote keys.

Usage follows `30-data-retention-policy.md`.
Financial ledger rules apply only when real New Era billing exists.

## 20. Failure and rollback strategy

BYOK incident:
- disable BYOK feature flag;
- platform path independent;
- do not auto-delete credentials unless compromise suspected.

Management API incident:
- stop new provisioning/rotation;
- existing active keys may continue;
- never use Management key for inference.

KMS incident:
- credential-backed inference fails closed;
- no plaintext fallback.

Price sync incident:
- keep last snapshot with stale marker;
- do not claim stale price is current;
- actual `usage.cost` remains preferred.

## 21. Owner decisions required before implementation traffic

1. Confirm OpenRouter account plan/readiness.
2. Choose initial platform per-user money budget values.
3. Choose KMS provider.
4. Decide whether a session-only BYOK option is needed in addition to persistent BYOK.
5. Decide whether platform mode remains free-model-only initially.
6. Keep BYOK catalog curated in first beta (recommended: yes).
7. Approve Redis outage policy for cost-bearing requests.
8. Confirm acceptable OpenRouter key cardinality/provisioning scale for our rollout; no assumption of unlimited per-user keys.

Эти значения не выдумываются в коде.

## 22. Alternatives reviewed

**One shared key only** — rejected as target; retained as migration fallback.

**OpenRouter organization member per New Era user** — rejected for public SaaS identity mapping.

**Separate key per guest** — rejected due abuse/key explosion.

**Keys in profiles** — rejected.

**One Vercel master encryption secret** — not selected because ADR-004 already requires envelope encryption/KMS.

**Supabase Vault as primary** — technically viable and installed, but would require a new ADR replacing/amending ADR-004.

## 23. Implementation start gate

Implementation begins only when:

- this plan is merged to `main`;
- docs/state checks are green;
- current OpenRouter Management/Guardrail API is reconfirmed;
- no secrets are added to repository;
- KMS choice is documented;
- first PR does not enable paid traffic.

Recommended first implementation PR:

```text
feat(provider): add OpenRouter credential and funding foundation
```

It creates schema/types/service interfaces/tests only. It must not provision real user keys or enable BYOK traffic yet.

## 24. External references reviewed

OpenRouter:
- https://openrouter.ai/docs/api/api-reference/api-keys/get-current-key
- https://openrouter.ai/docs/api/api-reference/models/get-models
- https://openrouter.ai/blog/tutorials/team-spend-controls-setup/
- https://openrouter.ai/blog/announcements/guardrails/
- https://openrouter.ai/pricing/
- https://openrouter.ai/blog/announcements/image-api/

Supabase:
- https://supabase.com/docs/guides/database/vault
- https://supabase.com/docs/guides/security/product-security

Vercel:
- https://vercel.com/changelog/openid-connect-federation-now-generally-available

Internal:
- `docs/adr/002-double-entry-ledger-billing.md`
- `docs/adr/003-reconciliation-alert-only.md`
- `docs/adr/004-crypto-shredding-gdpr.md`
