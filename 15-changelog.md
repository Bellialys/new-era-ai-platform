# 15 - Changelog

## Назначение файла

Этот файл фиксирует важные изменения проекта **Новая эпоха**.

## Текущая версия

<!-- SYNC:PROJECT_VERSION_START -->
**Текущая версия:** `v1.7.0-alpha.1`
<!-- SYNC:PROJECT_VERSION_END -->


```text
v1.7.0-alpha.1 - Code Arena Runner
# текущая alpha-ветка: documentation/state/package/migrations/API contracts sync
```

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
