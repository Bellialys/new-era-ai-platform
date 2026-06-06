# AGENTS

## Назначение файла

Этот файл содержит правила для AI-агентов и разработчиков, которые помогают работать над проектом **Новая эпоха**.

## Текущий статус проекта

```text
v0.4.1 - OpenRouter Integration Fix
# текущая исправленная версия
```

## Главные правила

1. Не добавлять секретные ключи в репозиторий.
2. Не коммитить `.env.local`.
3. Все AI-запросы должны идти через backend route handlers.
4. Не вызывать OpenRouter напрямую из frontend.
5. Перед новой функцией выполнять `typecheck`, `lint`, `build`.
6. Не добавлять Code Arena Runner до стабильной Prompt Arena.
7. Не добавлять AI Team Mode до поздних этапов roadmap.
8. Сохранять поэтапную разработку без хаоса.

## Проверка перед commit

```bash
npm run typecheck
# проверяет TypeScript

npm run lint
# проверяет ESLint

npm run build
# проверяет production-сборку
```

## Текущая архитектура

```text
src/app/api/models/route.ts
# список разрешённых моделей

src/app/api/compare/route.ts
# сравнение моделей через OpenRouter

src/lib/server/models.ts
# server-side allowlist

src/lib/server/openrouter.ts
# интеграция OpenRouter

src/lib/server/utils.ts
# ошибки, валидация, логирование

src/components/arena
# UI Prompt Arena
```

## Важное правило по моделям

В `v0.4.1`:

```text
modelIds = OpenRouter model keys из allowlist
# временно до Supabase
```

В `v0.5+`:

```text
modelIds = Supabase models.id UUID
# frontend больше не должен отправлять OpenRouter model_key напрямую
```

## Следующий этап

Делать `v0.5 - Supabase Integration`.

Не делать раньше времени:

- Code Arena;
- Judge Mode;
- Leaderboard;
- AI Team Mode;
- запуск пользовательского кода.
