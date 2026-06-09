# AGENTS

## Назначение файла

Этот файл содержит правила для AI-агентов и разработчиков, которые помогают работать над проектом **Новая эпоха**.

Главный источник порядка версий: `14-roadmap.md`.

Главный активный набор правил для Codex/AI-агентов: `24-codex-active-rule-set.md`.

Если этот файл конфликтует с `14-roadmap.md` по версии или порядку этапов, правильным считается `14-roadmap.md`.

## Текущий статус проекта

```text
v0.5.2 - Supabase, migrations and health stabilization
# текущий стабильный фундамент проекта
```

Следующий главный этап:

```text
v0.6 - Auth, Guest Mode and Profile
# гостевой режим, регистрация, профиль и ограничения доступа к моделям
```

## Главные правила

1. Не добавлять секретные ключи в репозиторий.
2. Не коммитить `.env.local`.
3. Все AI-запросы должны идти через backend route handlers.
4. Не вызывать OpenRouter напрямую из frontend.
5. Перед новой функцией выполнять `typecheck`, `lint`, `build`.
6. Для API/routing/Supabase/OpenRouter изменений выполнять `npm run smoke`, если он применим.
7. Не добавлять Code Arena Runner до стабильной Prompt Arena.
8. Не добавлять AI Team Mode до поздних этапов roadmap.
9. Сохранять поэтапную разработку без хаоса.

## Проверка перед commit

```bash
npm run typecheck
# проверяет TypeScript

npm run lint
# проверяет ESLint

npm run build
# проверяет production-сборку

npm run smoke
# проверяет базовый health/models smoke-check
```

## Текущая архитектура

```text
src/app/api/models/route.ts
# список разрешённых моделей из Supabase catalog с fallback

src/app/api/compare/route.ts
# сравнение моделей через backend/OpenRouter

src/app/api/health/route.ts
# базовая диагностика health/configuration

src/app/api/vote/route.ts
# будущий Voting MVP endpoint поверх server-side votes helper

src/lib/server/models.ts
# server-side fallback allowlist

src/lib/server/model-catalog.ts
# server-side model catalog resolver

src/lib/server/openrouter.ts
# интеграция OpenRouter

src/lib/server/rate-limit.ts
# базовый in-memory rate limit для дорогих API-запросов

src/lib/server/arena-persistence.ts
# best-effort сохранение Prompt Arena в Supabase

src/lib/server/votes.ts
# server-side voting helper для актуальной votes-схемы

src/lib/server/supabase.ts
# server-only Supabase client

src/lib/server/utils.ts
# ошибки, валидация, логирование

src/components/arena
# UI Prompt Arena
```

## Важное правило по моделям

В основном режиме `v0.5.2`:

```text
modelIds = Supabase models.id UUID
# frontend не должен отправлять OpenRouter model_key напрямую
```

В fallback-режиме, если Supabase catalog недоступен:

```text
modelIds могут временно совпадать с server-side allowlist keys
# backend всё равно проверяет выбранные модели на сервере
```

## Не делать раньше времени

- Code Arena;
- Judge Mode;
- Leaderboard;
- AI Team Mode;
- запуск пользовательского кода.
