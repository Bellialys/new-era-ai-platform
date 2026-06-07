# 15 - Changelog

## Назначение файла

Этот файл фиксирует важные изменения проекта **Новая эпоха**.

## Текущая версия

```text
v0.4.1 - OpenRouter Integration Fix
# текущая исправленная версия проекта
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
