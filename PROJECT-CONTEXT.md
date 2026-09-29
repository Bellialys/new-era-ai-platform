# PROJECT-CONTEXT - New Era AI Platform

## Назначение

Этот файл является короткой канонической точкой входа для ChatGPT, Codex и любого нового инженерного чата по проекту.

Перед продолжением разработки:
1. прочитать этот файл;
2. проверить актуальный `main` и открытые PR/issues;
3. прочитать `.project/state.json` и активные task-файлы;
4. для Stage 3 дополнительно читать `14-roadmap.md`, `15-changelog.md`, `28-api-contracts.md`, `49-openrouter-funding-byok-plan.md` и `docs/infra/aws-kms-vercel-oidc.md`.

Не восстанавливать состояние проекта по старому чату, если оно противоречит GitHub, `.project/state.json` или этому документу.

Последняя ручная синхронизация контекста: 2026-09-29.
Последний контекстный sync merged через PR #109: `main = cac3b3253a0d8cde0cca460a8d7253d43b467a6a`.
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

## Live Supabase state на 2026-09-29

Production project: active/healthy.

Подтверждены Stage 3 migrations:

- `20260927212853_stage3_provider_credentials`;
- `20260929103057_stage3_usage_telemetry`;
- `20260929103107_stage3_model_pricing`;
- reconciliation migration history `20260929120151` / `20260929120153`.

Не применена:

- `20260929022500_stage34_atomic_openrouter_activation.sql`.

Security Advisor:

- leaked password protection disabled -> GitHub issue #108.

Performance Advisor:

- FK `usage_events.credential_id` без covering index -> issue #107.

Не выполнять ad-hoc DDL, который создаёт migration-history drift. Schema changes должны идти через forward-only migration workflow.

## Live Vercel state на 2026-09-29

- Production deployment Stage 3.4 merge commit `4c80612e`: READY.
- Production deployment post-merge docs commit `cc61811d`: READY.
- Production deployment context/state sync commit `cac3b325`: READY.
- Репозиторный rollout contract остаётся fail-closed; Vercel env values через доступный connector не читаются и требуют отдельной dashboard/CLI verification перед activation.
- Live Stage 3.2 AWS/KMS env gate остаётся внешним blocker.

Vercel Preview quota hygiene остаётся отдельной задачей: issue #100.

## Открытые safety/performance follow-up

Критичные или значимые открытые задачи на момент синхронизации:

- #95 - P0 monetary fail-closed guard для paid Image Arena shared-key generation.
- #96 - DB hardening: один live persistent user-owned BYOK credential на пользователя.
- #100 - Vercel Preview quota hygiene.
- #107 - index для `usage_events.credential_id` FK.
- #108 - Supabase leaked password protection.

PR #97/#99 относятся к Image Arena monetary kill-switch path и требуют отдельного rebase/review; не считать их merged.
PR #98 закрыт как superseded после того, как актуальный OIDC runbook был синхронизирован и merged через PR #109.

## Что делать следующим

Канонический порядок продолжения:

1. Выполнить active task `V201-16`: live Stage 3.2 AWS KMS + Vercel OIDC gate.
2. Принять environment-isolation решение Preview vs Production KMS.
3. Корректно применить `20260929022500_stage34_atomic_openrouter_activation.sql` через migration workflow без drift.
4. Повторно проверить Supabase advisors/schema.
5. Выполнить контролируемый Stage 3.4 OAuth canary cohort.
6. Только после подтверждённого canary и явной verification Vercel env values рассматривать включение Stage 3.4 flags.
7. Отдельно закрыть P0 Image Arena monetary guard (#95) до разрешения paid shared-key generation.
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
