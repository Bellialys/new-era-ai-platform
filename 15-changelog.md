# 15 - Changelog

## Назначение файла

Этот файл фиксирует важные изменения проекта **Новая эпоха**.

## Текущая версия

```text
v0.5.3 - Voting MVP stabilization
# текущий стабильный MVP-релиз по 14-roadmap.md
```

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
