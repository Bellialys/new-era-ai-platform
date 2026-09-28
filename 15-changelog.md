# 15 - Changelog

## Назначение файла

Этот файл фиксирует важные изменения проекта **Новая эпоха**.

## Текущая версия

<!-- SYNC:PROJECT_VERSION_START -->
**Текущая версия:** `v2.0.0-alpha.1`
<!-- SYNC:PROJECT_VERSION_END -->


```text
v2.0.0-alpha.1 - AI Team Mode
# текущая alpha-ветка: AI Team Mode за feature flag; state/docs/tests синхронизированы
```

## Stage 3.2 AWS KMS infrastructure IaC - 2026-09-28

### Added

- Added `infra/aws-kms-vercel-oidc.yaml` as the reproducible AWS infrastructure source of truth.
- CloudFormation defines the Vercel team OIDC provider, one symmetric credential-encryption KMS key with annual rotation, and separate preview/production IAM roles.
- Trust is scoped to `bellial-s-projects/new-era-ai-platform` and the matching Vercel environment.
- IAM role permissions are limited to `kms:GenerateDataKey` and `kms:Decrypt` on the credential key.
- KMS permissions require the governed `credential_id/provider/origin` encryption-context key set.
- KMS key uses Retain protection and a 30-day deletion pending window.

### Verified

- Template passed `cfn-lint`.
- Vercel preview readiness probe confirmed `AWS_REGION` is present.
- `AWS_ROLE_ARN`, `AI_CREDENTIAL_KMS_KEY_ID` and `VERCEL_OIDC_TOKEN` are not yet present in the probed preview runtime.
- Static `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` and `AWS_SESSION_TOKEN` are absent.
- Temporary readiness endpoint was removed after the probe and returns 404.
- PR #81 fixed the remaining KMS Decrypt plaintext-DEK lifetime issue: the AWS SDK-owned plaintext buffer is now zeroed immediately after copying and regression-tested.

### Remaining external gate

- The CloudFormation stack still needs to be deployed inside the user's AWS account.
- Vercel project OIDC then needs to be enabled and the generated preview/production role ARN plus KMS key ARN mapped to the relevant environments.
- A live preview KMS round-trip canary must pass before encrypted OpenRouter credential persistence is activated.

## Stage 3.2 AWS KMS adapter - 2026-09-28

### Implemented

- Added pinned `@aws-sdk/client-kms 3.1141.0` and `@vercel/oidc-aws-credentials-provider 3.3.9`.
- Added AWS KMS data-key provider for `GenerateDataKey(AES_256)` and `Decrypt`.
- Adapter uses Vercel OIDC short-lived AWS credentials and explicitly rejects static AWS access-key environment variables for this credential path.
- Encryption context is bound to opaque `credential_id`, `provider` and `origin`.
- Runtime contract is aligned to `AWS_REGION`, `AWS_ROLE_ARN` and documented `AI_CREDENTIAL_KMS_KEY_ID`.
- Review hardening now wipes the original AWS SDK plaintext DEK buffer immediately after copying; the crypto layer separately wipes its working copy.

### Verified

- Security audit, typecheck, lint, full tests, env/model verifier tests, build, docs/state checks and smoke passed.
- Both PR review findings were fixed and resolved before merge.
- Post-merge production deployment is READY and `/api/health` returns 200.

### Remaining external infrastructure gate

- No AWS account resource was created by this code change.
- Before persistent user OpenRouter keys can be enabled, AWS must contain the Vercel OIDC provider, a production-scoped least-privilege IAM role and a symmetric KMS key.
- Vercel must then receive `AWS_REGION`, `AWS_ROLE_ARN` and `AI_CREDENTIAL_KMS_KEY_ID`; static AWS access keys are not part of the design.

## Stage 3.2 production credential migration - 2026-09-28

### Applied

- Production Supabase project `Bellialys's Project` received the additive provider-credential migration.
- Added empty `provider_credentials` and `ai_funding_preferences` tables.
- No existing table, column or user data was removed or modified.
- `provider_credentials` stores only ciphertext/wrapped-DEK/KMS metadata; no plaintext API-key column exists.
- RLS is enabled on both tables.
- Direct `anon` and `authenticated` grants are absent; policies are service-role only.
- Unique live-credential, encryption-envelope and funding-source constraints are present.
- Post-migration security advisors added no new schema security warning.

### Migration history reconciliation

- Supabase MCP recorded the applied migration as version `20260927212853`.
- The repository migration filename was aligned from the earlier unapplied local CLI timestamp to `20260927212853_stage3_provider_credentials.sql` without changing SQL contents, eliminating local/remote version drift.

### Remaining Stage 3.2 gate

- Real AWS KMS data-key adapter and Vercel OIDC/IAM configuration are still required before provider credentials may be persisted or used.
- OAuth user-key persistence remains disabled until that KMS boundary is operational.

## Stage 3.1 Free OAuth architecture - 2026-09-27

### Changed

- Free-first user funding path switched from future Management API provisioning to OpenRouter OAuth PKCE.
- Each authenticated New Era user will connect their own OpenRouter account and receive a user-controlled API key through the official OAuth flow.
- PKCE S256 is mandatory; New Era callback also uses independent random `state` for CSRF/correlation.
- Authorization code is exchanged server-side through OpenRouter `POST /api/v1/auth/keys`.
- User-controlled credential consumes the user's own OpenRouter quota/balance instead of the shared New Era OpenRouter quota.
- Management API, Guardrails and platform-managed per-user keys are deferred to the future platform-funded track and no longer block the Free-user MVP.

### Security

- No API key is placed in callback URLs, logs, analytics or audit payloads.
- Persistent credential storage remains blocked until Stage 3.2 encryption foundation is implemented.
- No plain PostgreSQL or localStorage fallback is allowed.
- Existing curated model governance, app rate limits and fan-out ceilings remain mandatory for user-funded calls.

### Stage status

- Stage 3.1 Free OAuth readiness: complete.
- Stage 3.2 Data + crypto foundation: next.
- Platform paid allowance remains `$0`.

## Stage 3.1 live account probe - 2026-09-27

### Verified

- Sanitized Vercel Preview probe against `GET https://openrouter.ai/api/v1/key` succeeded with the project's existing OpenRouter inference credential.
- Current OpenRouter account/key state: `is_free_tier=true`, current key is neither management nor provisioning, workspace association exists, provider limit metadata exists.
- Read-only `GET /api/v1/keys` and `GET /api/v1/guardrails` with the current inference key both returned `401`; no mutation was attempted.
- Current OpenRouter pricing matrix lists Management API key and Budgets & Spend Controls as unavailable on Free and available starting from Standard.
- A dedicated GitHub Actions read-only probe received an empty `secrets.OPENROUTER_API_KEY`; scheduled/manual live `models:verify` is therefore not operational until that repository secret is added.

### Decisions

- Initial platform paid allowance remains `$0`; platform paid models stay disabled.
- Future Management lifecycle canary uses a `$0.01/day` hard key limit and performs create/read/update/delete only, with no inference request during Stage 3.1.
- Positive per-user paid budgets are deferred until the Management canary and actual-cost telemetry exist.
- No assumption of unlimited API-key cardinality is made; mass one-key-per-user rollout remains gated on account/provider evidence.

### Remaining blocker

- The current Free account cannot complete the planned Management API readiness path. Account capability must first be upgraded/enabled so a separate server-only Management key can be created.
- After that: confirm workspace in Management context, run Management/Guardrail canary, restore GitHub live-verifier secret, and only then close Stage 3.1.

### Safety

- No OpenRouter secret value was logged or returned.
- No paid inference was sent.
- No Management/Guardrail mutation was performed.
- Temporary diagnostic branch/preview is not part of production `main`.

## Stage 3.1 External Readiness - 2026-09-27

### Verified

- Stage 3.0 повторно проверен после PR #68: pull-request CI, push CI и Vercel check green; squash merge `6ad6ea34b38f35ec38a481b1be83a712c190d391`.
- Production deployment merge commit перешёл в `READY`; public `/api/health` возвращает `200 {"status":"ok"}`.
- OpenRouter key-management contract повторно сверён: Management credential требуется для API-key CRUD; create возвращает plaintext key один раз и safe key hash/metadata; key-level USD limit/reset/workspace metadata подтверждены документацией.
- OpenRouter account feature availability не считается статичной по tier label; live account probe остаётся обязательным gate.

### Decisions

- AWS KMS выбран как target credential-encryption provider; Vercel OIDC — target authentication path без static AWS access keys.
- ADR-004 исправлен: shared KMS KEK + wrapped DEK в immutable backup не выдаётся за настоящий crypto-shredding. Stage 3 гарантирует encryption at rest + live deletion/revocation; отдельная backup crypto-shredding architecture остаётся будущим design.
- Platform-funded paid traffic при outage required distributed limiter должен fail closed; OpenRouter per-key limit остаётся independent hard monetary boundary.
- Paid platform catalog остаётся disabled до live control verification и numeric budget approval.
- BYOK beta остаётся curated; session-only BYOK deferred.
- Current fan-out ceilings зафиксированы как rollout maxima до отдельного cost/security review.

### Still blocked / unverified

- Реальные capability нашего OpenRouter account: Management API CRUD, production workspace id, Guardrail assignment и aggregate Workspace Budget.
- Допустимый масштаб key cardinality/provisioning для one-key-per-user rollout.
- Numeric per-user budget и tiny canary lifecycle-test budget.
- Management key не создавался/не запрашивался в чате и не добавлялся в repo/env этой docs-only работой.
- Production DB schema, runtime provider routing и paid traffic не менялись.

## Stage 3 architecture re-audit - 2026-09-27

### Changed

- Повторно сверены `49-openrouter-funding-byok-plan.md`, текущий runtime и официальные OpenRouter contracts; tier/feature matrix признана изменчивой, поэтому live account capability probe закреплён как SSOT перед provisioning.
- Зафиксированы implementation gates: общий provider gateway должен переносить `usage.cost`/provider request metadata, Image Arena должна пройти через ту же funding boundary, а существующий task-count quota не считается денежным budget.
- Production Redis fail-open -> in-memory поведение признано недопустимым как единственная app-level защита будущего platform-funded paid traffic; финальная outage policy остаётся owner decision.
- Уточнён key lifecycle: explicit `workspace_id`, безопасный provider key hash/identifier для PATCH/DELETE/reconciliation, rejection management/provisioning credentials в BYOK flow.
- Добавлен датированный audit snapshot `docs/audits/openrouter-stage3-plan-audit-2026-09-27.md`.

### Not implemented

- Runtime OpenRouter routing не изменён.
- Production database schema не изменена.
- Vercel/Supabase/OpenRouter secrets не изменены.
- Реальные user keys не создавались.
- BYOK и paid traffic не включались.

### Next gate

- Следующий разрешённый этап — Stage 3.1 External Readiness; реализация schema/crypto/gateway начинается только после live capability evidence и owner decisions по KMS, money budgets, Redis outage policy и key cardinality.

## Stage 3 architecture plan - OpenRouter Funding / BYOK - 2026-09-27

### Added

- `49-openrouter-funding-byok-plan.md`: hybrid `platform | user_openrouter` funding architecture (UI: BYOK), lazy one-key-per-authenticated-user platform provisioning, Management API/Guardrail boundaries, OpenRouter price parity and actual `usage.cost` semantics.
- Provider credential security aligned with ADR-004 envelope encryption/KMS; Supabase Vault documented as an alternative requiring a separate ADR rather than a silent architecture switch.
- Planned DB ownership/retention for `provider_credentials`, `ai_funding_preferences`, `usage_events` attribution and `model_price_history` raw pricing.
- v2.1/v2.2 drafts now explicitly defer conflicting cost/budget semantics to document 49.

### Not implemented

- No production schema change.
- No OpenRouter Management key created or stored by this change.
- No real per-user provider key provisioned.
- No BYOK traffic enabled.
- No paid model catalog expansion.
- No production budget values invented.

## P0 Provider Recovery - 2026-09-27

### Changed

- Server fallback catalog выровнен до 8 curated бесплатных text-моделей; Team default — `google/gemma-4-26b-a4b-it:free`.
- Judge использует `google/gemma-4-31b-it:free` как primary и `google/gemma-4-26b-a4b-it:free` как fallback.
- Image catalog полностью заменён registered-only моделями `openai/gpt-image-1-mini`, `google/gemini-3.1-flash-lite-image` и `black-forest-labs/flux.2-klein-4b`.
- Image provider integration переведена на `POST /api/v1/images`: общий body содержит `model`, `prompt`, `n: 1`, `aspect_ratio: "1:1"`; ответ `data[].b64_json` декодируется server-side, сверяется по raster signature/MIME и лимиту 5 MiB, затем напрямую загружается в Supabase Storage. Raw provider URL и base64 клиенту не возвращаются; отдельная ошибка модели сохраняет partial results остальных моделей.

### Added

- Forward-only migration `20260927065448_recover_openrouter_model_catalog.sql` применена в production: старые OpenRouter rows сохранены для истории и деактивированы; curated 8-model set upsert-нут по `model_key`.
- `models:verify` расширен на text fallback catalog, Team default, Judge primary/fallback и Image catalog: проверяются минимальный text count, уникальные непустые IDs, text/image output modalities, различие Judge primary/fallback и Image parameters `aspect_ratio`/`n`. Scheduled GitHub Actions workflow запускает verifier tests и fail-closed live verification ежедневно в `03:17 UTC` и через `workflow_dispatch`; Pull request CI запускает только mock `test:models-verify` без provider secret.
- `POST /api/image-compare` проверяет Storage configuration до платного provider fan-out и возвращает `503 IMAGE_STORAGE_UNAVAILABLE`, если результат заведомо невозможно сохранить; transient upload failures остаются изолированными per-model.

### Release gates

- Migration применена после production deployment PR #61; post-migration проверка подтвердила 8 active/public curated OpenRouter text models и сохранение historical rows.
- Scheduled/manual live-step использует repository secret `OPENROUTER_API_KEY` только внутри live verification step. Текущий connector не позволяет читать repository secrets, поэтому наличие секрета не утверждается; operational monitoring считается подтверждённым только после успешного scheduled/manual live run. Secret не передаётся mock-тесту в Pull request CI.
- Paid Image generation smoke не запускался без явного budget approval. Это отдельный acceptance gate для продвижения Image Arena выше auth-only alpha; provider-recovery Этап 2 при этом закрыт по code/DB/catalog/contracts/storage configuration.
## SECURITY: Stage 1 boundary hardening - 2026-09-27

### Fixed

- PR #64 слит в `main`: well-formed `na_guest` UUID больше не считается доверенной identity сам по себе; production дополнительно проверяет запись в `anonymous_sessions` и fail-closed при невозможности проверки.
- `/admin` выполняет `requireAdmin()` внутри server page до любого service-role чтения; regression test фиксирует порядок authorization-before-query.
- JSON-mutating API routes используют общий `isJsonObject()`: валидные JSON scalar/array/null больше не приводят к field-access 500 и возвращают controlled `400 INVALID_BODY`.
- Общий JSON boundary regression включает `compare`, `stream-compare`, `code-compare`, `code-run`, `image-compare`, `team-run`, `vote`, `profile`, `judge` и admin PATCH routes.

### Verification

- Текущий production `/admin` без авторизации выполняет redirect и не содержит dashboard counts/data в HTML/RSC.
- `anonymous_sessions` защищена RLS; прямые table privileges из проверяемых app-ролей есть только у `service_role`.
- CI после merge: typecheck, lint, tests, env-check, model-verifier tests, build, docs/state sync и smoke — PASS.

## SECURITY: fix(low): close auth, rendering, limiter and admin integrity gaps - 2026-08-24

### Fixed

- Auth callback нормализует `next` и проверяет итоговый origin; protocol-relative и backslash bypass отклоняются.
- Login/signup/reset/email-change используют account-enumeration-safe ответы без provider error disclosure.
- AI Markdown больше не загружает remote images автоматически; разрешены только same-origin image paths.
- In-memory rate-limit fallback ограничен 10 000 LRU buckets с очисткой истёкших записей.
- На момент этого изменения была добавлена pending-миграция `20260824204614_atomic_admin_mutations_and_last_admin_guard.sql`; к 2026-09-27 она уже применена в production вместе с `20260824213000_serialize_admin_role_updates.sql`. Admin mutations и audit insert атомарны, last-admin demotion сериализован, RPC execute разрешён только `service_role`.

## SECURITY: fix(vote): enforce task ownership before blind reveal - 2026-07-05

### Fixed

- `POST /api/vote` теперь передаёт server-resolved identity в blind reveal lookup; раскрытие `modelKey`/`display_name` возможно только для владельца задачи после его best vote.
- `getBlindReveal()` дополнительно проверяет ownership `tasks` и наличие `vote_type = 'best'` для той же identity перед чтением `model_responses`.
- Добавлена миграция `20260705221427_enforce_vote_task_ownership.sql`: `cast_best_vote` возвращает `TASK_NOT_FOUND`, если `task_id` не принадлежит `p_user_id`/`p_anon_id`, сохраняя `SECURITY INVOKER` и execute только для `service_role`.
- Добавлены regression tests для user/guest identity-scoped reveal и отказа раскрытия при rejected vote.

## SECURITY: fix(admin): harden admin mutations and plan enum - 2026-07-05

### Fixed

- Admin write routes `PATCH /api/admin/users/[id]` и `PATCH /api/admin/models/[id]` получили отдельный mutation rate limit `admin:mutation:<scope>:<actorId>`.
- `PATCH /api/admin/users/[id]` теперь блокирует self-demotion и demotion последнего admin до записи в `profiles`.
- Canonical `profiles.plan` закреплён как `free`/`pro`; добавлена миграция `20260705223415_align_profiles_plan_pro.sql`, profile UI и docs больше не используют `premium` как user plan.
- Direct Supabase Data API access к `models` выровнен с `access_level` через миграцию `20260705223814_enforce_models_access_level_rls.sql`; `schema:check` теперь проверяет profile plan constraint, model grants, access-level RLS policies и `cast_best_vote` body/execute grants.
- Закрыты low-risk hardening gaps: markdown links получили explicit URL policy, Code Arena framework теперь allowlisted по language, `stream-compare` больше не стримит raw exception messages, `SECURITY.md` больше не заявляет неподтверждённые SOC2/enterprise controls.
- `POST /api/image-compare` больше не возвращает raw provider image URLs: разрешён только approved CDN host с public DNS, MIME/size validation и успешный Storage upload; иначе модель получает controlled error.

## Database v2 Foundation - 2026-06-28

### Added (PR25, PR26)

- Добавлена SQL-миграция `20260628031516_database_v2_foundation.sql` с 8 новыми таблицами:
  `usage_events`, `team_runs`, `team_run_steps`, `code_runs`, `leaderboard_snapshots`, `artifacts`, `model_price_history`, `cleanup_log`.
- Все новые таблицы: RLS enabled, `service_role` only (кроме `leaderboard_snapshots` — public SELECT).
- 14 именованных индексов (`CREATE INDEX IF NOT EXISTS`); RLS policies: `DROP POLICY IF EXISTS` перед `CREATE POLICY` (idempotent).
- `scripts/check-schema-sync.mjs` расширен: 8 новых таблиц в `REQUIRED_TABLES` + 43 новые записи в `REQUIRED_COLUMNS`.
- `08-database.md` и `30-data-retention-policy.md` обновлены с retention windows для новых таблиц.

### Fixed (PR26)

- Переименован файл миграции `20260628060000_database_v2_foundation.sql` → `20260628031516_database_v2_foundation.sql` для устранения drift с production Supabase migration history.

## v2.0.0-alpha.1 - AI Team Mode - 2026-06-27

## SECURITY: fix(db): harden profile grants - 2026-07-04

### Added

- Добавлена и применена в live Supabase migration `20260704041841_security_hardening_profiles_grants.sql` для закрытия self-escalation через `profiles.role`/`profiles.plan`: `authenticated` получает `UPDATE` только на `first_name`, `last_name`, `display_name`, `avatar_url`.
- Миграция снимает legacy `TRUNCATE`/`REFERENCES`/`TRIGGER` grants с `anon`/`authenticated` на публичных Arena-таблицах `profiles`, `tasks`, `model_responses`, `models`, `votes`.
- Storage avatar UPDATE policy пересоздаётся с явным `WITH CHECK`, идентичным `USING`, как defense-in-depth против будущего policy drift.
- `08-database.md` и `SECURITY.md` зафиксировали post-migration модель ownership/grants для `profiles`.

## TASK-7: fix(arena): close blind-contract gaps - 2026-07-04

### Fixed

- `GET /api/history/[taskId]` теперь маскирует `selectedModels` как `Модель A/B/...` для blind-задач без best vote текущей identity; regression test закрывает утечку реальных model id/name через detail response.
- `GET /api/history` теперь маскирует `selectedModels` как `Модель A/B/...` для blind-задач без best vote текущей identity, сохраняя корректный `modelCount`.
- `POST /api/compare` возвращает `400 VALIDATION_ERROR` для `blind: true` и направляет blind-запуски на `POST /api/stream-compare`.
- `scripts/check-env.mjs --mode=basic` выводит неблокирующий Upstash/KV status в build-log, чтобы fallback на per-instance in-memory rate limiting был видимым.
- Обновлены route/lib/env-check тесты и API/env-check docs для нового контракта.

## TASK-4: fix(vote): block best vote while task is running - 2026-07-03

### Fixed

- Добавлена миграция `20260703182026_vote_gate_task_running.sql`: `cast_best_vote` теперь возвращает `TASK_STILL_RUNNING`, если `tasks.status = 'running'`.
- `src/lib/server/votes.ts` маппит `TASK_STILL_RUNNING` в `409` и `TASK_NOT_FOUND` в `404`.
- Добавлены тесты на RPC error mapping и ответ `POST /api/vote` с `409 TASK_STILL_RUNNING`.
- `28-api-contracts.md` и `08-database.md` синхронизированы с новым vote gate.

## TASK-5: fix(health): expose rate limit backend diagnostics - 2026-07-03

### Added

- Авторизованный `GET /api/health` теперь возвращает `rateLimitBackend: "upstash" | "in-memory"` без изменения публичного ответа `{ "status": "ok" }`.
- Добавлены route-тесты для public health ответа, Upstash/KV alias detection и in-memory fallback.
- `28-api-contracts.md` синхронизирован с авторизованным diagnostic-полем health-check.

## TASK-3: fix(arena): enforce Blind Arena SSE slots server-side - 2026-07-03

### Added

- Добавлена pending migration `20260703221900_tasks_is_blind.sql` для `tasks.is_blind boolean not null default false`; миграцию нужно применить в production Supabase до merge кода TASK-3.
- `POST /api/stream-compare` принимает `blind: true`, серверно shuffle-ит выбранные модели и отдаёт в SSE только `slot-a`/`slot-b` и `Модель A`/`Модель B`, сохраняя реальные model identity только в Supabase persistence.
- `POST /api/vote` для blind-задач возвращает `reveal[]` после успешного best vote текущей identity.
- `GET /api/tasks/[taskId]` и `GET /api/history/[taskId]` маскируют `modelKey/displayName` до best vote текущей identity.
- Обновлены API/database/decision docs и тесты для blind SSE, reveal, task detail и history masking.

## TASK-1: fix(profile): rate limit avatar upload/delete + stale ext cleanup - 2026-07-03

### Added

- `AVATAR_RATE_LIMIT_WINDOW_MS` и `AVATAR_RATE_LIMIT_MAX_REQUESTS` (5 req / 60 s) в `src/lib/arena/constants.ts`.
- Rate limiting на `POST /api/profile/avatar` и `DELETE /api/profile/avatar`: общий ключ `avatar:user:{userId}`, 429 с `Retry-After`.
- Best-effort очистка устаревших форматов аватара (`avatar.jpg|png|webp`) после успешной загрузки нового; ошибка очистки не влияет на ответ.
- Тесты `src/app/api/profile/avatar/route.test.ts`: auth guard, rate limit (POST и DELETE), stale-ext cleanup, resilience к ошибке cleanup.
- Обновлён `28-api-contracts.md`: таблица rate limits и правила `POST`/`DELETE /api/profile/avatar`.
- Добавлены pipeline docs: `47-kickoff-pipeline.md` в корень, раздел "Autonomous pipeline rules" в `CLAUDE.md` и `AGENTS.md`.

## TASK-2: fix(profile): rate limit email change requests - 2026-07-03

### Added

- Добавлен строгий лимит `POST /api/profile/email`: 3 запроса / 3600 сек на verified user UUID, ключ `email-change:user:{userId}`.
- Добавлены константы `EMAIL_CHANGE_RATE_LIMIT_WINDOW_MS` и `EMAIL_CHANGE_RATE_LIMIT_MAX_REQUESTS` в `src/lib/arena/constants.ts`.
- Добавлены route-тесты на `401 AUTH_REQUIRED`, `429 RATE_LIMIT` с `Retry-After` и отсутствие вызова `supabase.auth.updateUser` при превышении лимита.
- `28-api-contracts.md` синхронизирован с лимитом и safe error `RATE_LIMIT` для смены email.

### Added

- Реализован backend `POST /api/team-run` с auth gate (только авторизованные пользователи), rate limiting (3/10 min), DI-паттерном для engine и best-effort сохранением.
- Добавлена `src/lib/arena/team-mode.ts` — последовательный конвейер из 4 ролей: Planner → Researcher → Critic → Finalizer; контекст обрезается до 2000 символов.
- Добавлена страница `/team` — AI Team Mode UI за feature flag `NEXT_PUBLIC_ENABLE_TEAM_MODE`.
- Добавлена `src/app/api/image-compare/route.ts` — Image Arena: DALL-E 3, DALL-E 2, Stable Diffusion XL; загрузка в Supabase Storage bucket `images`.
- Добавлены 13 тестов Upstash rate limit: pipeline-команды, fail-open на 503/ECONNREFUSED, key isolation, token не в body.
- Добавлен audit log `docs/audits/project-audit-2026-06-27.md`.

### Changed

- `package.json` и `.project/state.json` обновлены до `v2.0.0-alpha.1`.
- SYNC-маркеры в `README.md`, `AGENTS.md`, `14-roadmap.md`, `15-changelog.md`, `00-readme.md` синхронизированы с v2.0.
- Выполнена гигиена документации и кода по плану 44: document-map дополнен, 37/38 перенесены в корневой канон, Team Mode persistence truth исправлен в `18-team-mode-spec.md`, `CLAUDE.md` очищен от версионного дрейфа, удалены неиспользуемые exports.

### Security

- `POST /api/team-run` и `POST /api/image-compare` доступны только авторизованным пользователям (`kind !== "user"` → 401).
- Rate limit key привязан к `identity.userId` из Supabase session, не к request body.
- Upstash rate limiter: fail-open при Redis outage; token только в Authorization header, не в body.

## Documentation Governance Hardening - 2026-06-24

### Added

- Добавлен `25-production-excellence.md` как активный production-grade стандарт для observability, CI/CD, resilience, privacy, capacity planning, security, release evidence и agent reporting.
- `CLAUDE.md`, `AGENTS.md` и `24-codex-active-rule-set.md` закрепляют режим глубокого анализа, priority `23-codex-quality-rules.md`, Stop Signal для >5 файлов и расширенный Research -> Review -> CI -> Report workflow.
- `23-codex-quality-rules.md` расширен ADR, JSDoc, no-unjustified-any, STRIDE, OpenAPI, DTO whitelist, EXPLAIN/PITR, performance budgets, WCAG 2.1 AA, structured logging, typed env и 90% target coverage правилами.

### Changed

- `26-definition-of-done.md`, `36-document-sync-policy.md`, `41-enterprise-readiness-roadmap.md` и `19-development-checklist.md` синхронизированы с production-grade agent workflow и текущим этапом `v1.7`.

## v1.7.0-alpha.1 Documentation and Migration Sync - 2026-06-24

### Changed

- `.project/state.json`, package metadata, README, roadmap and agent docs синхронизированы вокруг `v1.7 - Code Arena Runner`.
- Локальные миграции приведены к remote history: `20260624034630_add_judge_verdict_to_tasks.sql` и `20260624055408_add_audit_log.sql`.
- `08-database.md` описывает `tasks.judge_verdict`, `public.audit_log`, новые миграции и release-gate note для `v1.7.0-alpha.1`.
- `28-api-contracts.md` описывает `POST /api/judge`, `POST /api/code-run`, `GET /api/admin/audit` и `GET /api/admin/usage`.

### Security

- `public.audit_log` зафиксирован как RLS-enabled table без прямого доступа `anon`/`authenticated`; `service_role` имеет только SELECT/INSERT через явные policies.
- Главная страница больше не утверждает, что Code Arena всегда запускает код в sandbox: сравнение кода и внешний runner описаны отдельно.

## v0.7.1 Streaming Implementation - 2026-06-18

### Added

- Добавлен streaming-режим для `POST /api/compare` через `stream: true`: Prompt Arena может получать SSE-события `model_start`, `model_token`, `model_done`, `model_error` и `complete`.
- Prompt Arena UI теперь может показывать ответы моделей по мере генерации, не ожидая полного JSON-ответа.
- API contract `28-api-contracts.md` описывает streaming-события и правило, что `complete.responses` является финальным источником `response.id` для `/api/vote`.

## Documentation Planning - 2026-06-18

### Added

- Добавлен плановый UX-подэтап `v0.7.1 - Arena UX and Fair Voting`.
- В roadmap включены ближайшие улучшения: live streaming, Blind Arena, Code Diff, быстрый share/copy и guest anti-abuse.
- В `v0.8` добавлены публичные ссылки на батлы, Open Graph preview, многокритериальная оценка и фильтры истории.
- В `v0.9` добавлены Prompt Library, шаблоны с переменными, cost/token preview, персональная аналитика и подготовка Consensus Mode.

### Deferred

- Code Arena Runner остаётся не раньше `v1.7`.
- Judge Mode остаётся не раньше `v1.3`.
- Глобальный Leaderboard/Elo остаётся не раньше `v1.4`.
- Semantic caching через `pgvector`, Batch Testing, multimodal uploads, Private Arenas и RAG оставлены для поздних этапов после privacy, cost и safety controls.

## v0.7.0-alpha.1 - Code Arena Lite stabilization

Дата: 2026-06-17

### Added

- Добавлен task-state для `V070-01 - v0.7 Code Arena Lite stabilization`.
- Добавлен `41-enterprise-readiness-roadmap.md` как отдельный план выхода на international corporate-grade уровень.
- Зафиксирован Code Arena Lite как текущий alpha-этап без запуска пользовательского кода.

### Changed

- `.project/state.json`, `package.json`, `package-lock.json` и sync-маркеры переведены на `0.7.0-alpha.1`.
- v0.6 task-файлы переведены из `planned` в `verify`, потому что реализация присутствует в рабочем дереве, но ещё ждёт полного release gate.
- `14-roadmap.md` очищен от конфликта `v0.7 Code Arena Lite` vs `v0.7 History MVP`; History перенесён в `v0.8`.
- Guest identity contract уточнён: доверенный guest id живёт в httpOnly cookie `na_guest`, localStorage используется только для display card.
- API-документы дополнены `/api/code-models` и `/api/code-compare`.
- Auth session refresh переведён на Next.js 16 `src/proxy.ts`; duplicate `src/middleware.ts` удалён, `turbopack.root` зафиксирован.
- `next` обновлён до `16.2.9`; `postcss` закрыт через npm `overrides` на `^8.5.15`.

### Fixed

- `src/components/code-arena/code-arena.tsx` больше не импортирует несуществующий `@/components/auth/access-gate`.
- Code Arena Winner vote отправляет `responseId`, а не `winnerResponseId`.
- `.project/task.schema.json` разрешает `archivedAt` для archived task-файлов.
- `docs:sync` теперь синхронизирует `00-readme.md` через отдельную readme-index цель.
- ESLint больше не падает на `unrs-resolver` native binding: `import/no-duplicates` заменён на built-in `no-duplicate-imports`, а `.claude/**` и `.codex/**` исключены из lint-scope.

### Verification

- `npm run typecheck` прошёл.
- `npm run lint` прошёл.
- `npm test` прошёл.
- `npm run build` прошёл.
- `npm run smoke` прошёл против `http://localhost:3000` (health `ok`, models `18`).
- `npm run docs:check` прошёл.
- `npm run state:check` прошёл.
- `npm audit --audit-level=moderate` прошёл с `0 vulnerabilities`.
- Live DB sync ещё должен пройти перед stable/release.

## v0.5.4 - Vote Security & Auth Foundation

Дата: 2026-06-15

### Security

- `/api/vote` больше не принимает `userId` из тела запроса. Идентичность голосующего
  определяется на сервере: проверенный пользователь Supabase (cookie-сессия) или
  анонимный гость через httpOnly-cookie `na_guest`. Это закрывает накрутку голосов от
  имени произвольного пользователя.
- Добавлен rate-limit на `/api/vote` (переиспользует `checkRateLimit`).
- `/api/compare` определяет владельца запуска на сервере и сохраняет `tasks.user_id`
  либо `tasks.anonymous_session_id` (раньше владелец не сохранялся).

### Added

- Перешли на `@supabase/ssr`: браузерный клиент на cookie-сессиях, серверный
  `src/lib/server/auth.ts` и session-refresh через Next.js proxy (`src/proxy.ts`, updateSession() при каждом запросе); реализация в `src/lib/supabase-proxy.ts`.
- Атомарный Postgres RPC `cast_best_vote` (миграция
  `20260615191924_atomic_best_vote_rpc.sql`) заменил неатомарный delete-then-insert.
  Release-gate migration `20260617212741_reconcile_release_gate_security_and_models.sql`
  перевела RPC на `SECURITY INVOKER` с execute только для `service_role`.
- Граничные экраны App Router: `error.tsx`, `loading.tsx`, `not-found.tsx`,
  `global-error.tsx`.
- Добавлен `.nvmrc` (Node 24) в соответствие с CI.
- Тесты `src/lib/server/votes.test.ts`.

### Changed

- Клиент Prompt Arena больше не отправляет `anonymousSessionId` в `/api/vote`.
- Маршрут `/arena-voting` и его alias-компонент фактически удалены из кода — это
  приводит код в соответствие с записью об удалении от 2026-06-11.

### Deferred

- Полный Access Gate UI, guest-карточки `Анонимус #1234`, уровни доступа моделей,
  страница `/profile`, загрузка аватаров и OAuth остаются этапами v0.6.1–v0.6.8.

## v0.5.3 - Voting MVP Stabilization

Дата: 2026-06-10

### Added

- Добавлен минимальный GitHub Actions CI.
- Добавлена migration metadata для будущего model catalog governance через `raw_metadata`.

### Changed

- Основная Prompt Arena теперь сохраняет Winner vote через `POST /api/vote`.
- `/arena-voting` оставлен как совместимый маршрут без отдельной копии voting-логики.
- README, roadmap, AGENTS и package metadata синхронизированы на `v0.5.3`.
- `README-status-v0-5-3.md` перенесён в `archive/`.
- Смысл `15-changelog-addendum.md` и `32-model-catalog-governance-addendum.md` перенесён в основные документы.

### Documentation Cleanup - 2026-06-11

- Зафиксировано, что `/arena-voting` удалён как дубль `/arena`; историю старой совместимой записи выше не переписываем.

### Health Check Cleanup - 2026-06-11

- Добавлены `health`, `health:local` и `health:production` scripts для общей проверки проекта.
- Добавлена live-проверка OpenRouter model ids через `npm run models:verify`.
- Browser Supabase client теперь поддерживает fallback `NEXT_PUBLIC_SUPABASE_ANON_KEY` после `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- `npm run test:env-check` подключён к GitHub Actions CI.
- Из fallback allowlist удалены два устаревших free model id, которых больше нет в live OpenRouter catalog.
- Добавлена migration, деактивирующая эти устаревшие free model ids в Supabase catalog без удаления исторических строк.

### Fixed

- Убрано состояние, где Winner-кнопка была видимой, но сохраняла выбор только локально.
- Model catalog больше не утверждает live-verification OpenRouter IDs без фактической проверки API.

### Verified

```bash
npm run typecheck
npm run lint
npm run test
npm run build
npm run smoke
```

## v0.5.2 - Supabase, migrations and health stabilization

Дата: 2026-06-09

### Added

- Добавлен `/api/health`.
- Добавлен `scripts/smoke-check.mjs` и команда `npm run smoke`.
- Добавлены миграции выравнивания `tasks`, `votes`, integrity fixes и cleanup `prompt_text`.

### Changed

- История Supabase migrations синхронизирована с репозиторием.
- `votes` приведены к актуальной схеме `model_response_id` и `vote_type = 'best' | 'like' | 'dislike'`.
- Документация должна считать `14-roadmap.md` главным источником текущей версии и порядка этапов.

### Verified

```bash
npm run typecheck
npm run lint
npm run build
npm run smoke
```

## v0.5.1 - Migration Sync

Дата: 2026-06-08

### Changed

- Восстановлены timestamp migrations для Supabase.
- Репозиторий и remote migration history приведены к одному состоянию.
- `prompt_text` заменён на каноническое поле `task_text`.
- `08-database.md` синхронизирован с фактическим состоянием базы.

## v0.5.0 - Supabase Integration

Дата: 2026-06-07

### Documentation

- `27-environments.md` закреплён как основной документ по Local / Preview / Staging / Production окружениям.
- Устаревший отчёт `27-final-documentation-review.md` относился к `v0.4.1` и больше не является отдельным документом документационного индекса.
- Итоги старого `v0.4.1` documentation review сохранены в changelog: документация была синхронизирована после OpenRouter Integration Fix, следующий этап был обозначен как Supabase Integration, а проверки `typecheck`, `lint`, `build` проходили.

### Added

- Добавлены Supabase migrations для `models`, `tasks`, `model_responses`, `profiles` и grants.
- Добавлен Supabase model catalog как основной источник `/api/models`.
- Добавлен hardcoded fallback catalog, если Supabase недоступен.
- Добавлено best-effort сохранение Prompt Arena runs в `tasks` и `model_responses`.
- Добавлена документация будущего режима Image Arena / Visual Arena без реализации в коде.

### Changed

- Версия в `package.json` и `package-lock.json` поднята до `0.5.0`.
- Документация синхронизирована с фактической схемой `prompt_text`, `response_text`, `role_tags`, `price_label`.
- На момент `v0.5.0` roadmap отмечал `v0.5` как текущий этап, а Voting MVP как следующий крупный шаг.

### Fixed

- `/api/models` снова безопасно возвращает fallback catalog при ошибке или пустом Supabase catalog.
- Тесты model catalog обновлены под Supabase-first/fallback поведение.

### Verified

```bash
npm run typecheck
# TypeScript проверка прошла

npm run lint
# ESLint проверка прошла

npm run test
# Vitest проверка прошла

npm run build
# production-сборка прошла
```

## v0.4.1 - Full Project Audit Fix

Дата: 2026-06-07

### Added

- Добавлен базовый in-memory rate limit для `/api/compare`.
- Добавлено сохранение OpenRouter token usage в `model_responses`.
- Добавлен `MODE_SLUG_PROMPT_ARENA` как общий slug Prompt Arena.
- Добавлен `OPENROUTER_MAX_TOKENS` в `.env.example`.
- Добавлен audit/action status в `archive/28-action-plan-v0.4.1.md`.

### Changed

- `ArenaModel` сведён к одному типу в `src/types/arena.ts`.
- `/api/compare` теперь использует нормализованные значения валидаторов.
- `/api/compare` уважает `ApiError.statusCode` в общем error path.
- OpenRouter client безопасно обрабатывает non-JSON responses.
- Документация синхронизирована с текущим состоянием v0.4.1 и v0.5 groundwork.

### Fixed

- Удалены корневые дубликаты `index.ts`, `models.ts`, `openrouter.ts`, `utils.ts`, которые ломали `typecheck`.
- Исправлено отображение `latencyMs = 0`.
- Старые client-side запросы теперь отменяются через `AbortController`.

### Verified

```bash
npm run typecheck
# TypeScript проверка прошла

npm run lint
# ESLint проверка прошла

npm run build
# production-сборка прошла
```

## v0.4.1 - OpenRouter Integration Fix

Дата: 2026-06-06

### Added

- Добавлена валидация `modeSlug` на backend.
- Добавлен `MODE_SLUG_PROMPT_ARENA` в общие constants.
- Добавлен `ALLOWED_MODE_SLUGS` в общие constants.
- Добавлен `OPENROUTER_MAX_TOKENS` в общие constants.
- Добавлена безопасная обработка non-JSON ответа OpenRouter.
- Добавлена отмена устаревших client-side запросов через `AbortController`.
- Добавлено логирование OpenRouter call без API-ключа и без prompt body.

### Changed

- Версия в `package.json` поднята до `0.4.1`.
- Версия в `package-lock.json` поднята до `0.4.1`.
- `validatePrompt` теперь принимает `unknown` и возвращает очищенное значение.
- `validateModelIds` теперь принимает `unknown` и возвращает нормализованные model IDs.
- `validateModelAllowlist` теперь возвращает контролируемую `ApiError`.
- `/api/compare` теперь возвращает понятные validation errors вместо generic `INTERNAL_ERROR`.
- `/api/compare` теперь возвращает `modeSlug` в успешном ответе.
- UI блокирует форму во время активного запроса.
- `latencyMs = 0` теперь отображается корректно.
- Документация синхронизирована с реальным состоянием проекта.

### Fixed

- Исправлена проблема, когда короткий prompt мог возвращать `INTERNAL_ERROR`.
- Исправлена проблема, когда invalid JSON возвращался как неизвестная ошибка.
- Исправлена проблема, когда неподдержанный `modeSlug` не проверялся.
- Исправлена проблема, когда OpenRouter non-JSON response мог ломать обработку.
- Исправлена документация, где проект ошибочно описывался как `v0.3` mock UI.
- Исправлена документация, где `package-lock.json` ошибочно считался отсутствующим.
- Исправлено расхождение по `modelIds` между текущим OpenRouter allowlist и будущей Supabase схемой.

### Verified

```bash
npm run typecheck
# TypeScript проверка прошла

npm run lint
# ESLint проверка прошла

npm run build
# production-сборка прошла
```

## v0.4 - OpenRouter Integration

### Added

- `GET /api/models`.
- `POST /api/compare`.
- `src/lib/server/openrouter.ts`.
- `src/lib/server/models.ts`.
- `src/lib/server/utils.ts`.
- Server-side OpenRouter integration.
- Server-side model allowlist.
- Реальные AI-ответы вместо mock-ответов.

## v0.3 - Static UI MVP

### Added

- Страница `/arena`.
- Prompt input.
- Выбор моделей.
- Карточки ответов.
- Loading, empty, error, success состояния.
- UI-выбор победителя.
- Ограничение prompt до 8000 символов.
- Client-side validation.

## v0.2 - Next.js Base

### Added

- Next.js project structure.
- TypeScript config.
- ESLint config.
- Tailwind CSS config.
- Главная страница `/`.

## v0.1 - Project Documentation

### Added

- Файлы документации `00-18`.
- Roadmap.
- MVP scope.
- Architecture notes.
- API notes.
- Database notes.
- Security notes.
