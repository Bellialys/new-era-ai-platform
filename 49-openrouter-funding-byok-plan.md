# 49 - OpenRouter Funding, Per-User Keys and BYOK Plan

## Статус

**Architecture plan merged / Stage 3.0 re-audit complete / runtime implementation not started**

Дата ревью внешних контрактов: **2026-09-27**.
Дата повторного code/architecture audit: **2026-09-27** (`main` baseline `a5b9fc6b4471635b1ed5a4923a8eef58247d88f6`).

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
- per-user key limit жёстко ограничивает расход конкретного platform credential; Guardrail добавляет model/provider/privacy/budget policy; aggregate Workspace Budget используется только если фактически доступен нашему account/tier;
- BYOK расход не списывается с platform inference key;
- browser никогда не получает обратно сохранённый secret;
- guest users не получают отдельные OpenRouter keys;
- rate limiting, spending budget и provider limits считаются разными механизмами.

## 2. Что подтверждено у OpenRouter на 2026-09-27

Перед реализацией эти факты обязательно перепроверяются.

### Management API

OpenRouter Management API позволяет создавать, читать, обновлять и удалять API keys.

Для key-level spend control доступны:

- `limit`;
- `limit_reset = daily | weekly | monthly`;
- `disabled`;
- `include_byok_in_limit`.

Для platform-managed key создание должно явно передавать целевой `workspace_id`, а не полагаться на неявный workspace context. Create response возвращает plaintext key только в момент создания; дальнейший lifecycle должен опираться на безопасный provider key hash/identifier, который используется для GET/PATCH/DELETE.

Документированная семантика reset: daily — в 00:00 UTC, weekly — недельный интервал Monday-Sunday, monthly — календарный месяц.

Management API key используется только для administrative CRUD и не должен использоваться как inference key. `disabled=true` рассматривается как обратимая пауза, а финальный revoke/delete — как отдельная операция удаления remote key.

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
- `is_provisioning_key`;
- `expires_at`;
- BYOK usage fields.

New Era BYOK validation должна отклонять management/provisioning credentials как пользовательские inference credentials.

Поле `rate_limit` документировано OpenRouter как deprecated и не становится нашим SSOT.

### Pricing

`GET /api/v1/models` содержит provider catalog pricing для text-моделей.

Image API endpoint discovery возвращает отдельную pricing structure, потому что image models могут тарифицироваться per token, per image, per megapixel или по model-specific units.

Нельзя сводить все image prices к одному выдуманному `price_per_image`.

### Actual request cost

Для завершённого inference фактическая стоимость должна браться из `usage.cost`, когда OpenRouter её возвращает.

Provider request должен явно запрашивать usage accounting там, где OpenRouter это требует/поддерживает (для text/stream paths — `usage: { include: true }`). Gateway обязан сохранить distinction между provider-reported actual cost и локальным estimate.

Если `usage.cost` отсутствует:

- нельзя записывать рассчитанную цену как «фактическую»;
- разрешено сохранить estimate отдельно;
- `cost_source` должен явно показывать `provider_usage | estimated | unknown`.

### Plans and controls

На 2026-09-27 публичные материалы OpenRouter расходятся по названиям tiers и feature matrix. Текущая pricing page показывает `Free | Standard | Business | Enterprise` и отдельную матрицу Management API / Budgets & Spend Controls; более ранний материал о spend controls использует другую tier terminology и описывает availability иначе.

Вывод повторного аудита: **название тарифа нельзя использовать как capability detector**. Единственный безопасный rollout gate — live capability probe именно нашего OpenRouter account/workspace.

Stage 3.1 обязан проверить:

- наличие Management API key capability;
- доступность CRUD `/api/v1/keys`;
- список/идентификатор production workspace;
- Guardrail CRUD/assignment semantics;
- Workspace Budget availability и реальные account constraints;
- допустимую key cardinality и provisioning expectations.

Если capability не подтверждена live — соответствующий rollout stage остаётся disabled. Автоматическое создание per-user platform keys заблокировано до этой проверки.

### Guardrails / Workspaces

Guardrail может задавать spending limit, reset interval, model/provider allowlists, ZDR/privacy restrictions и дополнительные security controls.

Критическая семантика: Guardrail budget, назначенный нескольким keys/members, **не является общим shared pool**. OpenRouter проверяет budget независимо для каждого assigned key/member. Workspace default guardrail задаёт baseline policy, но его budget нельзя считать aggregate cap всей платформы.

Настоящий aggregate Workspace Budget ограничивает суммарный spend workspace и в текущей документации указан как Enterprise feature.

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

### 3.1 Current runtime baseline — подтверждено повторным аудитом

На `main` baseline `a5b9fc6b4471635b1ed5a4923a8eef58247d88f6`:

- `src/lib/server/openrouter.ts` использует один shared `OPENROUTER_API_KEY` для text/stream inference;
- `ModelUsage` содержит только token counts и не переносит `usage.cost`, provider request id или actual returned model в общий результат;
- text/stream requests пока не запрашивают `usage: { include: true }`;
- Prompt/Code/Judge/Team зависят от shared OpenRouter helper;
- Image Arena вызывает OpenRouter Image API напрямую из route handler и тем самым обходит будущий unified credential/funding gateway;
- таблица `usage_events` уже существует в production DB v2, но текущий Arena persistence не пишет в неё фактическую provider cost telemetry;
- `usage-limits.ts` считает количество `tasks` за UTC-день. Это product/request quota, а не monetary budget и не race-safe reservation;
- `rate-limit.ts` при отсутствии Redis или transient Upstash failure деградирует до per-instance in-memory limiter. Для будущего platform-funded paid traffic этот fallback нельзя считать hard cost-control boundary.

Следствие: до BYOK/per-user-key cutover сначала нужен единый server-side provider gateway с explicit credential context, usage/cost capture и безопасным error contract. Image Arena должна пройти через тот же funding resolver/gateway до включения денежных лимитов как общей гарантии.

## 4. Funding modes

### 4.1 `platform`

- только authenticated user;
- key создаётся лениво при первом platform-funded AI request или явном opt-in;
- максимум один active platform-managed key на пользователя в MVP;
- key secret не показывается пользователю;
- limit задаётся New Era policy;
- per-key limit ограничивает расход конкретного user key; default/key Guardrail ограничивает модели/providers/privacy и может добавить отдельный per-key budget;
- usage: `billing_source = platform`.

Отдельный key **не означает**, что provider/account-wide limits автоматически умножаются на число пользователей.

### 4.2 `user_openrouter` (UI: BYOK)

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

### Pricing freshness

Pricing snapshot всегда содержит `source_checked_at`. Конкретный production TTL/cadence не фиксируется до implementation review, чтобы не выдумывать SLA провайдера.

Правило отображения:

- fresh snapshot можно показывать как текущую published price;
- stale/unknown snapshot явно маркируется;
- для paid action backend может выполнить on-demand refresh до показа/подтверждения цены;
- sync failure не меняет последний snapshot задним числом.

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
| Platform key budget | деньги New Era на конкретный user key | OpenRouter key `limit` |
| Guardrail policy/budget | policy + дополнительный budget на key/member | OpenRouter Guardrail |
| Workspace aggregate budget | общий hard cap workspace, если feature доступна | OpenRouter Workspace Budget |
| App rate limit | spam/concurrency/Vercel load | New Era + Upstash |

Один лимит не заменяет другой.

Hard monetary stop для каждого platform user должен находиться у OpenRouter per-key `limit`. Guardrail добавляет ещё один provider-side policy/budget слой, но не считается общим pooled budget.

Если наш tier поддерживает aggregate Workspace Budget, он становится дополнительным hard cap всей platform-funded среды. Если нет, документация/UI не должны изображать Guardrail как глобальный cap; общий риск тогда ограничивается per-key caps, количеством provisioned keys, account credit/top-up policy и отдельным New Era operational circuit breaker.

Локальная БД используется для UX, analytics и reconciliation, но не является единственной защитой денег.

Существующий daily task-count limit остаётся отдельной product quota. Его запрещено переименовывать или использовать как денежный budget/pre-authorization.

Для fan-out режимов (Prompt Arena, Multi Model Battle, AI Team Mode и похожих) один user action может создать несколько независимых provider calls. Денежная политика должна считать каждый provider call отдельно; один «запрос пользователя» не равен одной provider charge.

Upstash остаётся отдельным anti-abuse механизмом. Production in-memory fallback не считается достаточной защитой cost-bearing routes. До включения platform-funded paid traffic должна быть утверждена explicit Redis outage policy; рекомендуемый безопасный default для platform-funded spend — fail closed на новые cost-bearing calls при потере distributed limiter, при сохранении provider-side per-key hard limit как последнего денежного предохранителя.

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

- ciphertext в Supabase;
- plaintext DEK никогда не хранится в БД;
- KMS/эквивалент управляет KEK и шифрованием DEK (например GenerateDataKey/envelope pattern);
- database dump сам по себе не раскрывает secret;
- crypto-shredding уничтожает возможность расшифровки;
- Vercel к KMS по возможности аутентифицируется short-lived OIDC credentials.

Supabase Vault установлен в production и технически подходит для encrypted secrets, но не выбирается как основной путь без отдельного ADR, потому что это изменило бы ADR-004.

### Sensitive credential mutations

Connect/replace/disconnect/funding-switch operations are security-sensitive:

- verified Supabase user is mandatory;
- request must pass existing same-origin/CSRF protections appropriate to cookie auth;
- browser-supplied `user_id`, credential owner, provider key limit or remote key id is never trusted;
- rate limit credential mutations separately from inference;
- consider a recent-auth/re-auth requirement before public rollout if Supabase session capabilities support it;
- audit only action/result/safe credential id, never plaintext/ciphertext.

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
status text = 'pending' | 'active' | 'revoking' | 'revoked' | 'orphaned' | 'error'
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
reconcile_after timestamptz nullable
last_error_code text nullable
```

Rules:

- RLS enabled;
- no direct `anon`/`authenticated` table grants;
- backend/service layer only;
- one active platform credential per user in MVP;
- one active persistent BYOK credential per user in MVP;
- planned partial UNIQUE constraints prevent more than one `pending|active` credential per `(user_id, provider, origin)`;
- credential rows use an opaque internal id as the remote key label/reference; email/display name are not used;
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

Provisioning не должен держать длинную PostgreSQL transaction/row lock во время внешнего HTTP-вызова. Целевой алгоритм:

1. atomic local claim создаёт одну `pending` credential row через UNIQUE/UPSERT/RPC;
2. конкурентные запросы видят существующий `pending|active` row и не создают новый remote key;
3. backend создаёт OpenRouter key, явно указывая target `workspace_id` и используя opaque local credential id как безопасную correlation label;
4. returned plaintext secret немедленно шифруется; provider key hash/identifier сохраняется отдельно как non-secret remote lifecycle identifier;
5. тот же pending row атомарно переводится в `active`;
6. если remote create успешен, а local activation не удалась, backend немедленно пытается DELETE/revoke remote key по provider hash/identifier;
7. если revoke тоже не удался, safe remote identifier/status фиксируется как `orphaned` для reconciliation; plaintext secret в reconciliation metadata не хранится.

Нельзя считать external Management API call и PostgreSQL update одной ACID-транзакцией. Компенсирующая revoke/reconciliation логика обязательна.

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
- `provider_is_byok` (OpenRouter upstream-BYOK flag, not our funding source);
- billing source;
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

- probe actual OpenRouter account capabilities instead of inferring them from tier names: Management API key, CRUD `/api/v1/keys`, workspaces, Guardrails and Workspace Budget availability;
- verify production `workspace_id` explicitly before any automated key create;
- verify key lifecycle semantics with a disposable low-limit canary only after owner budget approval; no mass provisioning in readiness stage;
- create/rotate a separate Management API key only after capability confirmation and store it only in approved secret storage;
- define default/key Guardrail policy;
- if aggregate Workspace Budget is available, define it; otherwise document the account-wide risk fallback without pretending Guardrail is a shared pool;
- confirm production Upstash and select Redis outage behavior for cost-bearing routes;
- choose KMS provider compatible with ADR-004;
- configure Vercel OIDC to KMS/cloud role where possible;
- define initial platform per-user money policy and maximum concurrent provider fan-out.

### Stage 3.2 — Data + crypto foundation

- migration for credentials/funding metadata;
- KMS/envelope crypto adapter;
- service-role-only storage;
- crypto tests;
- no inference routing change.

### Stage 3.3 — Pricing + actual usage

- refactor provider calls behind the unified gateway before funding cutover;
- gateway accepts server-resolved credential context/opaque credential id; raw credential ownership is never client-controlled;
- request provider usage accounting explicitly where required (`usage: { include: true }`);
- add `usage.cost`, provider request id and actual returned model handling;
- record actual cost + OpenRouter `usage.is_byok` as `provider_is_byok`;
- route Image Arena through the same funding/usage capture boundary;
- begin runtime writes to `usage_events` with telemetry failure isolated from successful inference;
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
- explicit Redis outage policy; platform-funded paid traffic must not silently fall back to per-instance memory as its only app-level protection;
- provider budget preflight UX;
- concurrency/fan-out controls must be evaluated per provider call, not only per top-level user action;
- verify per-key limit + Guardrail semantics; verify aggregate Workspace Budget only when the account exposes that feature.

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
- simultaneous first requests create at most one `pending|active` key;
- remote-create/local-persist failure either revokes remote key or records safe `orphaned` reconciliation state;
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

### Account deletion and remote resources

Account deletion cannot rely on a database cascade alone because OpenRouter keys are external resources.

Target workflow:

1. mark credential mutation/deletion in progress;
2. disable/revoke platform-managed remote key;
3. crypto-shred local secret;
4. remove user-linked credential/funding rows;
5. delete/anonymize account data according to retention policy.

If remote revoke is unavailable, account erasure must not require keeping user PII indefinitely. Preserve only the minimum opaque remote identifier in a service-only orphan reconciliation record, detach it from user identity, crypto-shred the secret, then retry remote cleanup asynchronously in a later operational stage.

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

1. Confirm actual OpenRouter account capabilities (Management API, per-key limits, Guardrails, optional aggregate Workspace Budget) rather than inferring them from a plan label.
2. Choose initial platform per-user money budget values.
3. Choose KMS provider.
4. Decide whether a session-only BYOK option is needed in addition to persistent BYOK.
5. Decide whether platform mode remains free-model-only initially.
6. Keep BYOK catalog curated in first beta (recommended: yes).
7. Approve Redis outage policy for cost-bearing requests.
8. Confirm acceptable OpenRouter key cardinality/provisioning scale for our rollout; no assumption of unlimited per-user keys.

Эти значения не выдумываются в коде.

## 22. Scope boundary with future Marketplace BYOK

This Stage 3 BYOK means **user-provided OpenRouter API key used server-side by New Era**.

It does not replace future roadmap concepts:

- v3.0 Marketplace BYOK: direct third-party provider connections/marketplace credentials;
- v3.1 Client-Side BYOK: browser/provider callback model with different threat and billing semantics.

Those future systems must reuse credential/KMS principles where applicable but require separate ADRs and must not overload `billing_source=user_openrouter`.

## 23. Alternatives reviewed

**One shared key only** — rejected as target; retained as migration fallback.

**OpenRouter organization member per New Era user** — rejected for public SaaS identity mapping.

**Separate key per guest** — rejected due abuse/key explosion.

**Keys in profiles** — rejected.

**One Vercel master encryption secret** — not selected because ADR-004 already requires envelope encryption/KMS.

**Supabase Vault as primary** — technically viable and installed, but would require a new ADR replacing/amending ADR-004.

## 24. Implementation start gate

Implementation begins only when:

- this plan is merged to `main`;
- Stage 3.0 repeat audit findings are resolved in documentation;
- docs/state checks are green;
- current OpenRouter Management/Guardrail/Workspace capabilities are reconfirmed against the actual account;
- no secrets are added to repository;
- KMS choice is documented;
- Redis outage policy and initial money budget policy are owner-approved;
- first PR does not enable paid traffic.

**Current gate:** Stage 3.0 documentation/re-audit is complete; Stage 3.1 External Readiness is the next allowed step. Runtime implementation, DB migration, real key provisioning and BYOK traffic remain disabled until the Stage 3.1 evidence/owner decisions are complete.

Recommended first implementation PR:

```text
feat(provider): add OpenRouter credential and funding foundation
```

It creates schema/types/service interfaces/tests only. It must not provision real user keys or enable BYOK traffic yet.

## 25. External references reviewed

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
