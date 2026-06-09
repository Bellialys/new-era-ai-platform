# 09 - API Structure

## Назначение файла

Этот файл описывает API проекта **Новая эпоха**.

Текущий статус:

```text
v0.5.2
# GET /api/models, POST /api/compare, GET /api/health и /api/vote foundation реализованы
# 14-roadmap.md остаётся главным источником статуса этапов
```

## Общие правила API

```text
Frontend вызывает только свои backend routes.
# браузер не должен обращаться к OpenRouter напрямую

Backend вызывает OpenRouter.
# API-ключ хранится только на сервере

API JSON использует camelCase.
# modelIds, modeSlug, answerText, latencyMs

Database использует snake_case.
# model_id, mode_slug, task_text, response_text, latency_ms, model_response_id
```

## Текущие routes

| Route | Метод | Статус | Назначение |
|---|---|---|---|
| `/api/models` | GET | Реализовано | Получить список разрешённых моделей |
| `/api/compare` | POST | Реализовано | Отправить prompt нескольким моделям |
| `/api/health` | GET | Реализовано | Проверить базовое состояние приложения |
| `/api/vote` | POST | Foundation | Сохранить best vote через backend route |

## GET /api/models

Возвращает список моделей из Supabase `public.models`.

Если Supabase не настроен или каталог временно недоступен, route возвращает hardcoded server-side fallback из `src/lib/server/models.ts`, чтобы Prompt Arena не падала полностью.

### Ответ

```json
{
  "status": "success",
  "models": [
    {
      "id": "uuid-from-models-table",
      "name": "GPT-OSS 120B",
      "role": "General-модель",
      "provider": "openrouter",
      "badge": "Free",
      "description": "Бесплатная открытая модель OpenAI на 120B — сильный универсальный baseline."
    }
  ]
}
```

В Supabase mode поле `id` равно `models.id` UUID.
В fallback mode поле `id` временно равно hardcoded OpenRouter model key, но только после server-side allowlist.

## POST /api/compare

Отправляет один prompt нескольким моделям через OpenRouter.

### Текущий request body

```json
{
  "prompt": "Сравни Next.js и Nuxt для MVP AI-платформы",
  "modelIds": [
    "uuid-model-1",
    "uuid-model-2"
  ],
  "modeSlug": "prompt-arena"
}
```

### Валидация

| Поле | Правило |
|---|---|
| `prompt` | string, минимум 3 символа, максимум 8000 символов |
| `modelIds` | array, минимум 2 модели, максимум 3 модели |
| `modelIds` | без пустых строк и дублей |
| `modelIds` | каждая модель должна быть в Supabase catalog или fallback allowlist |
| `modeSlug` | optional, по умолчанию `prompt-arena` |
| `modeSlug` | сейчас разрешён только `prompt-arena` |

### Успешный ответ

```json
{
  "status": "success",
  "taskId": "uuid-task-id-or-null",
  "responses": [
    {
      "id": "generated-response-id",
      "modelId": "google/gemini-flash-1.5",
      "modelName": "Gemini Flash 1.5",
      "status": "success",
      "answerText": "Ответ модели",
      "latencyMs": 1234
    },
    {
      "id": "generated-response-id",
      "modelId": "mistralai/mistral-small-3.1-24b-instruct",
      "modelName": "Mistral Small 3.1",
      "status": "error",
      "answerText": null,
      "errorCode": "TIMEOUT",
      "errorMessage": "OpenRouter request timed out after 30000ms"
    }
  ]
}
```

### Ошибка валидации

```json
{
  "status": "error",
  "errorCode": "VALIDATION_ERROR",
  "message": "Prompt must be at least 3 characters"
}
```

### Ошибка режима

```json
{
  "status": "error",
  "errorCode": "INVALID_MODE",
  "message": "Unsupported modeSlug. Allowed values: prompt-arena"
}
```

### Ошибка модели

```json
{
  "status": "error",
  "errorCode": "MODEL_NOT_ALLOWED",
  "message": "One or more selected models are not allowed"
}
```

## Важное правило по modelIds

В основном `v0.5` режиме:

```text
modelIds = UUID из таблицы models.
# frontend не должен отправлять OpenRouter model_key напрямую
```

В fallback режиме:

```text
modelIds = OpenRouter model keys из hardcoded allowlist.
# допустимо только если Supabase catalog недоступен
```

В обоих случаях backend резолвит выбранные модели через server-side catalog и только потом вызывает OpenRouter.

## Supabase persistence

`/api/compare` best-effort сохраняет:

- одну запись в `tasks` с `task_text`, `mode_slug`, `selected_models`, `status`;
- записи в `model_responses` с `task_id`, `model_id`, `model_key`, `response_text`, latency и token usage.

Если Supabase не настроен или insert упал, route продолжает возвращать ответы моделей пользователю, а `taskId` остаётся `null`.

## Будущие routes

| Route | Метод | Этап | Назначение |
|---|---|---|---|
| `/api/history` | GET | v0.8 | Получить историю сравнений |
| `/api/history/[taskId]` | GET | v0.8 | Открыть одно сравнение |
| `/api/admin/models` | CRUD | v1.5 | Управление моделями |
| `/api/image-arena/generate` | POST | v1.7 | Сгенерировать изображения для будущей Image Arena |

## POST /api/vote

Контракт должен совпадать с `28-api-contracts.md`.

Актуальная схема базы:

```text
votes.model_response_id -> model_responses.id
votes.vote_type = best | like | dislike
```

Правильный body:

```json
{
  "taskId": "uuid-task-id",
  "responseId": "uuid-response-id",
  "voteType": "best",
  "anonymousSessionId": "anonymous-session-id"
}
```

Правила:

- `responseId` в API соответствует `votes.model_response_id` в базе;
- `voteType = "best"` используется для выбора лучшего ответа;
- старое `voteType = "winner"` не должно использоваться в документации и новом frontend-коде;
- выбирать можно только successful `model_responses`.

Не использовать:

```json
{
  "promptId": "old-name"
}
```

Правильное поле - `taskId`.

---

## Будущий route /api/image-arena/generate

Этот route появится позже и не входит в текущий MVP.

Назначение:

```text
POST /api/image-arena/generate
# принять одну визуальную идею, вызвать 2-3 image-модели через backend и вернуть metadata результатов
```

Будущий request body:

```json
{
  "idea": "Футуристический город на рассвете в стиле кинематографичной иллюстрации",
  "modelIds": ["uuid-image-model-1", "uuid-image-model-2"],
  "modeSlug": "image-arena"
}
```

Будущий ответ должен возвращать не raw binary, а metadata:

```json
{
  "status": "success",
  "taskId": "uuid-task-id",
  "images": [
    {
      "id": "uuid-image-generation-id",
      "modelId": "uuid-image-model-1",
      "status": "success",
      "storagePath": "image-arena/task-id/model-id.png"
    }
  ]
}
```

Правила:

- frontend не вызывает OpenRouter напрямую;
- frontend не получает secret keys;
- backend разрешает только модели с `image` output capability;
- изображения сохраняются в Supabase Storage;
- PostgreSQL хранит только metadata и `storagePath`;
- route включается только после лимитов стоимости и safety-контролей.
