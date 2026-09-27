# OpenRouter Stage 3 Plan Re-Audit — 2026-09-27

## Статус

**Docs-only architecture/security re-audit. Runtime implementation not started.**

Baseline: `main@a5b9fc6b4471635b1ed5a4923a8eef58247d88f6`.

Цель проверки — повторно проверить `49-openrouter-funding-byok-plan.md` против:
- фактического runtime-кода;
- production DB foundation, уже зафиксированной в migrations/roadmap;
- текущих project rules;
- актуальных официальных OpenRouter contracts на 2026-09-27.

Этот аудит **не** меняет production schema, env, OpenRouter keys, budgets или traffic routing.

## 1. Executive result

Архитектурное направление документа 49 подтверждено: разделение `platform` и `user_openrouter`, server-only credentials, provider-side hard limits, envelope encryption/KMS, compensating revoke и разделение telemetry/billing остаются правильной основой.

Повторный аудит выявил несколько обязательных implementation gates. Они не требуют отката архитектуры, но должны быть закрыты **до** BYOK/per-user-key cutover.

## 2. Findings

### GATE-01 — OpenRouter tier/capability matrix нельзя хардкодить

**Severity:** high / rollout blocker.

Публичные OpenRouter materials на дату аудита используют неодинаковую tier terminology и не полностью одинаково описывают availability Management API / spend controls.

Решение:
- не ветвить код по строке названия тарифа;
- Stage 3.1 делает live capability probe именно нашего account/workspace;
- если capability не подтверждена — feature остаётся disabled.

Проверяемые provider contracts:
- Management API keys;
- CRUD `/api/v1/keys`;
- workspaces;
- Guardrails;
- Workspace Budget.

### GATE-02 — текущий OpenRouter client не переносит actual cost

**Severity:** high.

`src/lib/server/openrouter.ts` сейчас:
- использует shared `OPENROUTER_API_KEY`;
- возвращает token counts;
- не переносит `usage.cost`;
- не переносит provider request id;
- не переносит actual returned model;
- text/stream request пока не запрашивает `usage: { include: true }`.

Следствие:
до cost attribution/BYOK нужен общий typed provider result и явный usage accounting.

### GATE-03 — Image Arena обходит будущий unified gateway

**Severity:** high.

`src/app/api/image-compare/route.ts` самостоятельно читает shared key через `getApiKey()` и выполняет provider fetch.

Это безопасно для текущего shared-key alpha, но несовместимо с гарантией:
`Funding Resolver -> Credential Resolver -> Unified Gateway -> OpenRouter`.

Следствие:
Image Arena должна быть перенесена через общую funding/usage boundary до общего rollout per-user funding.

### GATE-04 — `usage_events` существует, но runtime cost telemetry ещё не подключена

**Severity:** high.

Production DB v2 уже содержит `usage_events.cost_usd`, но текущий Prompt Arena persistence пишет `tasks` / `model_responses`, а не provider cost event.

Следствие:
Stage 3.3 должен начать runtime writes в `usage_events` и сохранять:
- billing source;
- credential id;
- provider request id;
- actual returned model;
- provider usage;
- actual/estimated/unknown cost source.

Успешный inference не должен превращаться в 500 из-за telemetry failure; failure должен давать отдельный reconciliation/observability signal.

### GATE-05 — текущий daily usage limit не является monetary budget

**Severity:** high.

`src/lib/server/usage-limits.ts` считает число `tasks` за UTC-день.

Это product/request quota, а не:
- USD budget;
- reservation;
- transactional spend counter;
- provider hard stop.

Следствие:
его нельзя переименовывать в денежный лимит или использовать как единственную защиту platform funds.

### GATE-06 — Redis outage сейчас fail-open к in-memory limiter

**Severity:** high перед paid platform traffic.

`src/lib/server/rate-limit.ts`:
- использует Upstash, когда он доступен;
- при отсутствии конфигурации или transient failure деградирует до per-instance in-memory store.

Для текущего API availability это допустимая degradation policy.
Для будущего cost-bearing platform-funded traffic это не может быть hard financial control.

Рекомендуемый safe default:
- provider per-key limit остаётся последней hard monetary boundary;
- новые platform-funded paid calls fail closed, если обязательный distributed limiter недоступен;
- финальную outage policy утверждает owner до Stage 3.6.

### GATE-07 — lifecycle remote key должен использовать safe provider identifier

**Severity:** medium/high.

OpenRouter key creation возвращает plaintext credential только в момент создания. Дальнейшие lifecycle operations выполняются по provider key hash/identifier.

Следствие:
- plaintext немедленно шифруется;
- provider hash хранится отдельно как non-secret lifecycle identifier;
- create должен явно использовать нужный `workspace_id`;
- local activation failure -> remote DELETE/revoke по provider identifier;
- failed cleanup -> `orphaned` reconciliation state без plaintext secret.

### GATE-08 — BYOK validation должна исключать administrative credentials

**Severity:** medium/high.

Current-key metadata позволяет определить management/provisioning key type.

Следствие:
New Era BYOK connect flow должен fail closed для management/provisioning credentials, даже если такой key технически отвечает на metadata endpoint.

## 3. Fan-out cost model

Prompt Arena, Multi Model Battle и AI Team Mode могут создавать несколько provider calls из одного пользовательского действия.

Поэтому:
- один top-level user request != одна provider charge;
- accounting фиксируется per provider call;
- per-key hard limit остаётся provider-side;
- локальный preflight нужен для UX и раннего отказа, но не является единственным денежным lock;
- concurrency policy должна учитывать параллельный fan-out.

## 4. STRIDE mini threat model

### Spoofing
Risk: пользователь пытается выбрать чужой credential или подменить `user_id`.

Control:
- identity только из verified Supabase session;
- credential ownership server-resolved;
- browser `user_id` / provider key hash / platform limit не доверяются.

### Tampering
Risk: пользователь подменяет funding source, workspace, key limit или remote identifier.

Control:
- platform limits/workspace/remote lifecycle identifiers формирует backend;
- DTO whitelist;
- server-side validation.

### Repudiation
Risk: нельзя доказать, кто подключил/отключил/переключил funding.

Control:
- audit action/result/requestId/safe credential id;
- никакого plaintext/ciphertext в audit payload.

### Information disclosure
Risk: API key попадает в JSON/log/error/analytics/database dump.

Control:
- browser never gets persisted secret back;
- envelope encryption/KMS;
- secret redaction;
- safe fingerprint/hash only.

### Denial of service
Risk: provisioning spam, fan-out amplification, Redis/provider outage.

Control:
- auth-only provisioning;
- separate mutation rate limits;
- unique pending/active constraints;
- cooldown;
- distributed limiter;
- provider-side hard key limit.

### Elevation of privilege
Risk: Management key используется как inference key или user credential получает administrative semantics.

Control:
- separate management/inference credential paths;
- reject management/provisioning BYOK;
- management operations server-only.

## 5. Architecture decisions retained

1. One active platform-managed OpenRouter key per authenticated user in MVP.
2. No per-guest OpenRouter key.
3. BYOK means user's OpenRouter API key, distinct from OpenRouter upstream `usage.is_byok`.
4. OpenRouter per-key limit is provider-side hard spend boundary for that key.
5. Guardrail policy/budget is not treated as a shared global pool.
6. Aggregate Workspace Budget is used only if the actual account exposes it.
7. `usage_events` is telemetry, not the future monetary ledger.
8. Real New Era charging must follow ADR-002 double-entry ledger semantics.
9. Persistent provider secrets follow ADR-004 envelope encryption/KMS.
10. Shared `OPENROUTER_API_KEY` remains migration fallback until gateway cutover is proven.

## 6. Implementation sequence after this audit

### Stage 3.0 — complete
- architecture plan merged;
- repeat code/contract audit completed;
- corrections documented;
- no runtime changes.

### Stage 3.1 — next allowed stage
External readiness only:
- verify actual account/workspace capabilities;
- verify Management API/Guardrail/Workspace Budget;
- confirm production workspace id;
- confirm Upstash;
- choose KMS;
- define owner-approved per-user money policy;
- define Redis outage policy;
- define maximum provider fan-out/concurrency;
- confirm acceptable key cardinality.

No mass user-key provisioning is allowed in Stage 3.1.

### Stage 3.2+
Remain not started until Stage 3.1 evidence and owner decisions are complete.

## 7. Files/code evidence reviewed

- `49-openrouter-funding-byok-plan.md`
- `src/lib/server/openrouter.ts`
- `src/lib/server/usage-limits.ts`
- `src/lib/server/rate-limit.ts`
- `src/lib/server/arena-persistence.ts`
- `src/app/api/compare/route.ts`
- `src/app/api/judge/route.ts`
- `src/app/api/team-run/route.ts`
- `src/app/api/image-compare/route.ts`
- `supabase/migrations/20260628031516_database_v2_foundation.sql`
- `14-roadmap.md`
- `AGENTS.md`
- `23-codex-quality-rules.md`
- `24-codex-active-rule-set.md`
- `25-production-excellence.md`
- `36-document-sync-policy.md`
- `.project/state.json`
- `.project/tasks/*.json`

## 8. External contracts reviewed

OpenRouter official sources:
- https://openrouter.ai/docs/api/api-reference/api-keys/create-keys
- https://openrouter.ai/docs/api/api-reference/api-keys/get-current-key
- https://openrouter.ai/docs/api/api-reference/api-keys/update-keys
- https://openrouter.ai/docs/api/api-reference/api-keys/delete-keys
- https://openrouter.ai/docs/api/api-reference/management-keys
- https://openrouter.ai/docs/guides/features/guardrails
- https://openrouter.ai/docs/api/api-reference/workspaces
- https://openrouter.ai/pricing/
- https://openrouter.ai/docs/guides/guides/usage-accounting

## 9. Owner decisions still required before runtime implementation

1. Initial platform per-user money budget values.
2. KMS provider.
3. Whether session-only BYOK is needed in addition to persistent BYOK.
4. Whether platform mode remains free-model-only initially.
5. Whether BYOK beta remains curated-catalog-only.
6. Redis outage behavior for platform-funded and BYOK traffic.
7. Maximum concurrent fan-out per user/mode.
8. Acceptable OpenRouter key cardinality/provisioning scale.

These values are deliberately not invented in code or documentation.

## 10. Verification status

Completed:
- architecture/code semantic review;
- external OpenRouter contract re-check;
- scope review against project state and roadmap;
- STRIDE review;
- secret-handling review;
- rollback/failure-path review.

Not claimed as runtime pass:
- no production DB migration was run;
- no Vercel env was changed;
- no OpenRouter key was created/rotated/deleted;
- no paid provider request was sent;
- no KMS integration was configured.

CI/docs/state checks for this documentation branch are verified separately by repository CI after PR creation.
