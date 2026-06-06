# 26 - Code Fix Report

## Назначение файла

Этот файл фиксирует исправления кода, выполненные в `v0.4.1`.

## Исправленные файлы кода

| Файл | Что исправлено |
|---|---|
| `package.json` | Версия поднята до `0.4.1` |
| `package-lock.json` | Версия поднята до `0.4.1` |
| `src/lib/arena/constants.ts` | Добавлены `MODE_SLUG_PROMPT_ARENA`, `ALLOWED_MODE_SLUGS`, `OPENROUTER_MAX_TOKENS` |
| `src/lib/server/utils.ts` | Добавлены безопасные validation helpers и `validateModeSlug` |
| `src/lib/server/models.ts` | `validateModelAllowlist` теперь возвращает `ApiError` |
| `src/lib/server/openrouter.ts` | Добавлена обработка non-JSON ответа OpenRouter и общий max tokens constant |
| `src/app/api/compare/route.ts` | Исправлены validation errors, `modeSlug`, allowlist errors |
| `src/components/arena/prompt-arena.tsx` | Добавлен `AbortController` для устаревших запросов |
| `src/components/arena/arena-form.tsx` | Форма блокируется во время запроса |
| `src/components/arena/response-card.tsx` | `latencyMs = 0` отображается корректно |

## Главная исправленная проблема

До исправления обычные ошибки пользователя могли превращаться в generic ответ:

```json
{
  "status": "error",
  "errorCode": "INTERNAL_ERROR",
  "message": "An unexpected error occurred. Please try again."
}
```

После исправления пользователь получает понятную ошибку:

```json
{
  "status": "error",
  "errorCode": "VALIDATION_ERROR",
  "message": "Prompt must be at least 3 characters"
}
```

## Проверки

```bash
npm run typecheck
# прошло

npm run lint
# прошло

npm run build
# прошло
```

## Следующий шаг

```text
v0.5 - Supabase Integration
# сохранить tasks и model_responses в базу
```
