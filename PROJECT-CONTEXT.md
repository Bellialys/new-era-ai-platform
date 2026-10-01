# PROJECT-CONTEXT - New Era AI Platform

## Назначение

Этот файл является короткой канонической точкой входа для ChatGPT, Codex и любого нового инженерного чата по проекту.

Перед продолжением разработки:
1. прочитать этот файл;
2. проверить актуальный `main` и открытые PR/issues;
3. прочитать `.project/state.json` и активные task-файлы;
4. для Stage 3 дополнительно читать `14-roadmap.md`, `15-changelog.md`, `28-api-contracts.md`, `49-openrouter-funding-byok-plan.md` и `docs/infra/aws-kms-vercel-oidc.md`.

Не восстанавливать состояние проекта по старому чату, если оно противоречит GitHub, `.project/state.json` или этому документу.

Последняя ручная синхронизация контекста: 2026-10-01.
Последний подтверждённый production baseline после Vercel Preview hygiene и Stage 3 DB credential hardening: `main = 229eff5b34147be92f265dee871f78c5432ce138` (PR #115).
Baseline SHA является исторической отметкой, а не неизменяемым источником истины: перед новой работой всегда перечитывать текущий `main`.

## Источники истины и приоритет

При конфликте использовать следующий порядок:

1. Фактический код и migrations в текущем `main`.
2. `.project/state.json` + `.project/tasks/*.json` для текущей версии и активной работы.
3. `14-roadmap.md` для порядка этапов.
4. `28-api-contracts.md` для API boundary.
5. `49-openrouter-funding-byok-plan.md` для Stage 3 funding/BYOK архитектуры.
6. `docs/infra/aws-kms-vercel-oidc.md` для Stage 3.2 AWS/Vercel runbook.
7. `15-changelog.md` для уже выполненной работы.
8. Старые PR, archived docs и прошлые чаты являются историей, а не текущим состоянием.

## Технологический стек

- Next.js App Router + React + TypeScript.
- Vercel: hosting, Preview/Production deployments, OIDC workload identity.
- Supabase PostgreSQL + Auth + Storage.
- OpenRouter: AI inference, model catalog, pricing/usage.
- AWS KMS: target для envelope encryption persistent provider credentials.
- GitHub: repository, PR, issues, CI.
- Upstash Redis: distributed rate limiting для cost-bearing production routes.

Секреты запрещено хранить в репозитории. Реальные API keys находятся только в локальном окружении/секретах Vercel/GitHub/AWS.

## Рабочая модель проекта

Основные режимы:

- Prompt Arena.
- Code Arena.
- Multi Model Battle.
- Judge Mode.
- AI Team Mode.
- Leaderboard.
- Image Arena alpha.

Принцип разработки: поэтапный MVP, каждый этап должен оставлять рабочее состояние, новые функции не должны ломать старые, важные этапы фиксируются через Git commit/PR.

## Текущее состояние Stage 3

### Stage 3.0 - Documentation and contract freeze

Статус: COMPLETE.

### Stage 3.1 - Free OAuth readiness

Статус: COMPLETE.

Подтверждён OpenRouter OAuth PKCE S256 flow для подключения user-controlled OpenRouter credential. Platform-paid Management API track отложен на будущий платный этап.

### Stage 3.2 - AWS KMS + Vercel OIDC

Статус: CODE/INFRA FOUNDATION READY, LIVE GATE PENDING.

В `main` уже есть:

- AES-256-GCM envelope encryption;
- AWS KMS data-key provider;
- Vercel OIDC credentials provider;
- AWS-specific OIDC audience `sts.amazonaws.com`;
- explicit AWS region binding;
- CloudFormation `infra/aws-kms-vercel-oidc.yaml`;
- KMS env-readiness checker;
- round-trip/context-mismatch canary;
- extra-context IAM/KMS policy canary;
- fail-closed rejection static AWS credentials.

Главный внешний blocker:

1. развернуть AWS CloudFormation stack;
2. включить Vercel Team Issuer OIDC;
3. если IAM OIDC provider уже существует, проверить/добавить `sts.amazonaws.com` в ClientIDList;
4. добавить `AWS_REGION`, `AWS_ROLE_ARN`, `AI_CREDENTIAL_KMS_KEY_ID` в нужные Vercel environments;
5. подтвердить отсутствие static AWS credentials;
6. выполнить `npm run env:check -- --mode=kms`;
7. запустить оба live Preview KMS canary;
8. закрыть Preview/Production KMS environment-isolation decision;
9. только после этого разрешать persistent provider credentials.

До завершения Stage 3.2 live gate нельзя включать `ENABLE_PROVIDER_CREDENTIAL_PERSISTENCE`.

### Stage 3.3 - Pricing + Actual Usage

Статус: COMPLETE, merged через PR #105.

Реализовано:

- unified server-only OpenRouter gateway;
- provider usage contract;
- actual returned model;
- provider request ID;
- `usage.cost`;
- `provider_is_byok`;
- billing source separation;
- `usage_events` telemetry;
- OpenRouter pricing snapshots;
- pricing API/admin sync;
- Prompt/Stream/Code/Judge/Team/Image runtime paths подключены к общему funding/usage boundary.

Stacked precursor PR #101/#102/#103 закрыты как superseded после PR #105.

### Stage 3.4 - OpenRouter OAuth User Beta

Статус: CODE COMPLETE / MERGED / PRODUCTION BUILD READY, ACTIVATION GATED.

PR #104 merged как `4c80612e`; post-merge docs sync PR #106 merged как `cc61811d`.

Реализовано:

- Connect OpenRouter через OAuth PKCE S256;
- signed user-bound httpOnly OAuth flow cookie;
- state/verifier lifecycle;
- bounded authorization-code exchange;
- same-origin mutation protection;
- mutation rate limits + Retry-After;
- encrypted `user_oauth` credential persistence boundary;
- atomic PostgreSQL RPC: credential activation + `funding_source=user_openrouter`;
- runtime funding resolver;
- Prompt/Stream/Code/Judge/Team/Image Arena используют server-side funding resolver;
- browser получает только safe integration metadata;
- disconnect очищает New Era ciphertext/wrapped DEK и возвращает funding на `platform`;
- внешний user-controlled OpenRouter key при disconnect не отзывается New Era;
- post-exchange KMS/activation failure сохраняет безопасный `orphaned` reconciliation state без plaintext/ciphertext;
- profile UI показывает retryable status-load failure вместо скрытия integration control;
- regression tests + CI + Vercel Preview/Production builds прошли.

Rollout остаётся fail-closed по репозиторному контракту:

- значения по умолчанию для `ENABLE_OPENROUTER_USER_OAUTH` и `ENABLE_PROVIDER_CREDENTIAL_PERSISTENCE` — `false`;
- доступный Vercel connector не предоставляет чтение production env values, поэтому фактические dashboard values нельзя считать проверенными из этого контекста;
- нет подтверждённого evidence, что Stage 3.4 activation была разрешена;
- production Supabase migration `20260929022500_stage34_atomic_openrouter_activation.sql` ещё должна быть применена корректным migration deployment;
- включать persistence/real user credentials запрещено до Stage 3.2 live KMS/OIDC + environment-isolation gate.

## Live Supabase state на 2026-10-01

Production project: active/healthy.

Подтверждены Stage 3 migrations:

- `20260927212853_stage3_provider_credentials`;
- `20260929103057_stage3_usage_telemetry`;
- `20260929103107_stage3_model_pricing`;
- reconciliation migration history `20260929120151` / `20260929120153`;
- `20261001112537_add_usage_events_credential_id_index`;
- `20261001113002_enforce_one_live_user_owned_credential`.

Не применена:

- `20260929022500_stage34_atomic_openrouter_activation.sql`.

Security Advisor:

- leaked password protection disabled -> GitHub issue #108.

Performance Advisor:

- issue #107 resolved: `usage_events.credential_id` now has covering index `idx_usage_events_credential_id`; live advisor no longer reports `unindexed_foreign_keys`.

Credential integrity:

- issue #96 resolved at the database boundary: `uq_provider_credentials_one_live_user_owned` permits at most one `pending|active` user-owned OpenRouter credential across `user_oauth | user_manual` per user/provider;
- existing per-origin UNIQUE guard remains as defense in depth and keeps `platform_managed` lifecycle independent;
- MVP replacement is explicit disconnect/revoke before reconnect; no implicit last-writer credential replacement is enabled.

Не выполнять ad-hoc DDL, который создаёт migration-history drift. Schema changes должны идти через forward-only migration workflow.

## Live Vercel state на 2026-10-01

- Production deployment Stage 3.4 merge commit `4c80612e`: READY.
- Production deployment post-merge docs commit `cc61811d`: READY.
- Production deployment context/state sync commit `cac3b325`: READY.
- Production deployment Image Arena monetary-hardening commit `1389043b`: READY.
- PR #113 (`7f918001`) merged and production READY: Preview builds now skip only an explicit docs/project-state allowlist and fail closed to normal builds for runtime/config/migration/infra changes; issue #100 closed.
- PR #114 (`0ae9b549`) merged and production READY: repository migration history is synchronized with the live `usage_events.credential_id` covering index; issue #107 closed.
- PR #115 (`229eff5b`) merged and production READY: cross-origin user-owned BYOK uniqueness is synchronized with production; issue #96 closed.
- Репозиторный rollout contract остаётся fail-closed; Vercel env values через доступный connector не читаются и требуют отдельной dashboard/CLI verification перед activation.
- Live Stage 3.2 AWS/KMS env gate остаётся внешним blocker.

## Открытые safety/performance follow-up

Критичные или значимые открытые задачи на момент синхронизации:

- #108 - Supabase leaked password protection.

Закрытые follow-up 2026-10-01:

- #96 - DB hardening: один live persistent user-owned BYOK credential на пользователя;
- #100 - Vercel Preview quota hygiene;
- #107 - covering index для `usage_events.credential_id` FK.

Platform-funded Image Arena spend guard: `ENABLE_PLATFORM_PAID_IMAGE_ARENA=false` fail-closed блокирует platform-funded provider generation до явного monetary rollout; `user_openrouter` funding остаётся отдельным funding source.

Старые PR #97/#99 закрыты как superseded после merge PR #111; их pre-gateway branches не должны использоваться как актуальный код.
PR #98 закрыт как superseded после того, как актуальный OIDC runbook был синхронизирован и merged через PR #109.

## Что делать следующим

Канонический порядок продолжения:

1. Выполнить active task `V201-16`: live Stage 3.2 AWS KMS + Vercel OIDC gate.
2. Принять environment-isolation решение Preview vs Production KMS.
3. Корректно применить `20260929022500_stage34_atomic_openrouter_activation.sql` через migration workflow без drift.
4. Повторно проверить Supabase advisors/schema.
5. Выполнить контролируемый Stage 3.4 OAuth canary cohort.
6. Только после подтверждённого canary и явной verification Vercel env values рассматривать включение Stage 3.4 flags.
7. Сохранять `ENABLE_PLATFORM_PAID_IMAGE_ARENA=false`, пока platform-funded paid Image Arena не получит отдельное бюджетное разрешение/provider-side hard cap и operational rollout approval.
8. После этого переходить к следующим Stage 3.5-3.7 задачам.

## Запрещённые shortcuts

Нельзя:

- включать persistent user credentials до Stage 3.2 live gate;
- хранить provider key plaintext в PostgreSQL, logs, browser storage или analytics;
- передавать credential ID/owner из браузера как источник доверия;
- использовать Management key для inference;
- считать app rate limit денежным hard budget;
- считать local estimate фактическим provider cost;
- включать paid platform traffic без explicit monetary guard;
- использовать static AWS access keys для KMS path;
- применять production DDL вне управляемой migration history;
- объявлять Preview/Production криптографически изолированными, пока у них shared KMS key без отдельной environment-bound защиты.

## Проверки перед merge

Минимальный обязательный gate:

- `npm audit`/CI security audit;
- `npm run typecheck`;
- `npm run lint`;
- `npm test`;
- `npm run test:env-check`;
- `npm run test:models-verify`;
- `npm run build`;
- `npm run state:check`;
- `npm run docs:check`;
- smoke, когда CI/deployment контекст это поддерживает.

Для schema/AWS changes добавлять соответствующие live/schema/canary проверки.

## Правила работы для ChatGPT/Codex

Перед изменением:

- проверить текущий `main`, open PRs/issues и active task;
- не повторять уже merged работу;
- не использовать старые precursor PR как актуальный код;
- не включать feature flag автоматически;
- не делать live paid/AWS mutation без требуемого доступа и подтверждённого gate;
- сохранять небольшие логические PR;
- после merge обновлять этот файл, если изменился Stage status, blocker или canonical next step.

Если ChatGPT Project `new-era-ai-platform` содержит более старые файлы/чаты, этот файл должен использоваться как recovery/index document, а противоречащие ему старые заметки считать historical до повторной проверки по GitHub.
