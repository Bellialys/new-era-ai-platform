# 28 - API Contracts

## Статус

```text
Draft / MVP contract
# документ заменяет прежний placeholder и фиксирует текущий backend-only API контракт
```

## Назначение

Этот документ описывает публичные backend endpoints проекта **Новая эпоха**.

Главное правило:

```text
Frontend вызывает только backend route handlers.
# OpenRouter, Supabase service role и другие секретные интеграции не вызываются напрямую из frontend
```

## Общие правила API

- Ответы API должны быть JSON.
- Ошибки должны возвращаться через безопасный формат `createErrorResponse`.
- Секреты, API keys, service role keys и Authorization headers нельзя логировать.
- `model_key` провайдера не должен быть доверенным значением из frontend.
- Backend повторно валидирует `prompt`, `modelIds`, `modeSlug` и выбранные модели.

## Rate Limiting

Публичные endpoints с дорогими или массовыми запросами защищены rate limiting. При превышении лимита возвращается `429` с заголовком `Retry-After` (секунды до сброса).

| Endpoint | Лимит | Окно | Ключ |
|---|---|---|---|
| `GET /api/models` | 60 req | 60 сек | IP-адрес |
| `POST /api/compare` | 10 req | 60 сек | user UUID или guest cookie `na_guest` |
| `POST /api/vote` | 30 req | 60 сек | user UUID или guest cookie `na_guest` |
| `GET /api/code-models` | 60 req | 60 сек | IP-адрес |
| `POST /api/code-compare` | 10 req | 60 сек | user UUID или guest cookie `na_guest` |

Ответ при превышении:

```json
{
  "status": "error",
  "errorCode": "RATE_LIMIT",
  "message": "Too many requests. Please try again later."
}
```

Заголовки ответа:

```text
HTTP/1.1 429 Too Many Requests
Retry-After: 42
```

В production rate limit глобальный (Upstash Redis). Локально — in-memory per-process.

Release-gate note: `POST /api/guest` создаёт anonymous session и должен пройти отдельный abuse/rate-limit review перед public release.

## `GET /api/models`

Возвращает модели, доступные для Prompt Arena.

Основной режим:

```text
Supabase models catalog -> public model id -> frontend
```

Fallback режим:

```text
server-side allowlist -> frontend
```

Минимальный ответ:

```json
{
  "status": "success",
  "models": [
    {
      "id": "model-selection-id",
      "name": "Model display name",
      "provider": "openrouter",
      "role": "general"
    }
  ]
}
```

## `POST /api/compare`

Запускает Prompt Arena comparison через backend.

Минимальный запрос:

```json
{
  "prompt": "Сравни Next.js и Nuxt для MVP",
  "modelIds": ["model-selection-id-1", "model-selection-id-2"],
  "modeSlug": "prompt-arena"
}
```

Правила:

- `prompt` должен пройти ограничения длины MVP;
- `modelIds` должен содержать 2-3 модели;
- `modeSlug` сейчас должен быть `prompt-arena`;
- backend резолвит model selection id в server-only `model_key`;
- сохранение `tasks` и `model_responses` выполняется best-effort.

Минимальный ответ:

```json
{
  "status": "success",
  "taskId": "saved-task-uuid-or-null",
  "responses": [
    {
      "id": "response-uuid-or-generated-id",
      "modelId": "model-selection-id-1",
      "modelName": "Model display name",
      "status": "success",
      "answerText": "Ответ модели",
      "latencyMs": 1234
    }
  ]
}
```

## `POST /api/vote`

Сохраняет выбор лучшего ответа, когда voting включён и persistence доступен.

Минимальный запрос:

```json
{
  "taskId": "task-uuid",
  "responseId": "model-response-uuid",
  "voteType": "best"
}
```

> **Идентичность определяется из cookie, не из тела.**
> Авторизованные пользователи — через Supabase-сессию (`sb-*` cookie).
> Гости — через httpOnly cookie `na_guest` (выдаётся сервером автоматически).
> Поле `anonymousSessionId` в теле запроса **игнорируется** — не передавать.

Правила:

- `taskId` и `responseId` должны быть UUID;
- `responseId` должен принадлежать указанному `taskId`;
- выбирать можно только response со статусом `success`;
- актуальная схема БД использует `votes.model_response_id` и `vote_type = 'best'`;
- старое значение `winner` не должно использоваться в новом frontend-коде или документации.

Минимальный ответ:

```json
{
  "status": "success",
  "voteId": "vote-uuid",
  "taskId": "task-uuid",
  "responseId": "model-response-uuid",
  "voteType": "best"
}
```

## `GET /api/code-models`

Возвращает модели для Code Arena Lite.

Минимальный ответ:

```json
{
  "status": "success",
  "models": [
    {
      "id": "model-selection-id",
      "name": "Model display name",
      "provider": "openrouter",
      "role": "coding"
    }
  ]
}
```

## `POST /api/code-compare`

Запускает сравнение кодовых решений через backend. Code Arena Lite не выполняет пользовательский код.

Минимальный запрос:

```json
{
  "prompt": "Напиши безопасный Next.js route handler",
  "modelIds": ["model-selection-id-1", "model-selection-id-2"],
  "language": "TypeScript",
  "framework": "Next.js"
}
```

Минимальный ответ:

```json
{
  "status": "success",
  "taskId": "saved-task-uuid-or-null",
  "language": "TypeScript",
  "framework": "Next.js",
  "responses": [
    {
      "id": "response-uuid-or-generated-id",
      "modelId": "model-selection-id-1",
      "modelName": "Model display name",
      "status": "success",
      "answerText": "Ответ модели",
      "latencyMs": 1234
    }
  ]
}
```

Rules:

- requires Supabase auth cookie or httpOnly guest cookie `na_guest`;
- validates prompt, model IDs, language and framework server-side;
- persists as `tasks.mode_slug = "code-arena"` when Supabase persistence is available;
- never runs code, starts tests, spawns processes, or uses a sandbox in Lite mode.

## Related Docs

- `09-api-structure.md` - подробная структура API.
- `12-security-and-env.md` - правила безопасности API и env.
