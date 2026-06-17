# 09 - API Structure

## Назначение файла

Этот файл описывает API проекта **Новая эпоха**.

Текущий статус:

```text
v0.7.0-alpha.1
# GET /api/models, POST /api/compare, GET /api/health, POST /api/vote,
# POST /api/guest, GET /api/code-models и POST /api/code-compare реализованы/в alpha
# rate limiting на публичных endpoint (Upstash Redis + in-memory fallback)
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

## Rate Limiting

Публичные endpoints с дорогими или массовыми запросами защищены rate limiting. При превышении — `429 Too Many Requests` с заголовком `Retry-After`.

| Endpoint | Лимит | Окно | Ключ |
|---|---|---|---|
| `GET /api/models` | 60 req | 60 сек | IP-адрес |
| `POST /api/compare` | 10 req | 60 сек | user UUID или guest cookie `na_guest` |
| `POST /api/vote` | 30 req | 60 сек | user UUID или guest cookie `na_guest` |
| `GET /api/code-models` | 60 req | 60 сек | IP-адрес |
| `POST /api/code-compare` | 10 req | 60 сек | user UUID или guest cookie `na_guest` |

Авторизованные пользователи и гости получают **персональную** квоту, не разделяемую с другими людьми за тем же IP (корпоративный NAT, VPN).

Ответ при превышении:

```json
{
  "status": "error",
  "errorCode": "RATE_LIMIT",
  "message": "Too many requests. Please try again later."
}
```

Заголовок `Retry-After` содержит количество секунд до сброса счётчика.
В production rate limit глобальный через Upstash Redis. Локально — in-memory per-process.

Release-gate note: `POST /api/guest` создаёт anonymous session и сейчас не входит в таблицу rate-limited endpoints; перед public release нужен отдельный abuse-review этого route.

## Текущие routes

| Route | Метод | Статус | Назначение |
|---|---|---|---|
| `/api/models` | GET | Реализовано | Получить список разрешённых моделей |
| `/api/compare` | POST | Реализовано | Отправить prompt нескольким моделям |
| `/api/health` | GET | Реализовано | Проверить базовое состояние приложения |
| `/api/vote` | POST | Реализовано | Сохранить best vote через backend route |
| `/api/guest` | POST | Реализовано | Создать/обновить anonymous guest session и поставить `na_guest` cookie |
| `/api/code-models` | GET | Alpha | Получить code-capable модели для Code Arena Lite |
| `/api/code-compare` | POST | Alpha | Сравнить кодовые решения без запуска пользовательского кода |

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
  "voteType": "best"
}
```

> **Идентичность берётся из cookie, не из тела запроса.**
> Авторизованные пользователи идентифицируются через Supabase-сессию (`sb-*` cookie).
> Гости — через httpOnly cookie `na_guest` (выдаётся автоматически сервером при первом запросе).
> Поле `anonymousSessionId` в теле **игнорируется** сервером — передавать его не нужно.

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

## GET /api/code-models

Возвращает список моделей, разрешённых для Code Arena Lite.

Правила:

- route использует backend model catalog;
- guest видит только модели с anonymous-доступом;
- frontend не получает provider `model_key`;
- endpoint не включает Code Runner и не выполняет код.

## POST /api/code-compare

Запускает Code Arena Lite через backend/OpenRouter.

Request body:

```json
{
  "prompt": "Напиши Next.js route handler для безопасного вызова OpenRouter",
  "modelIds": ["model-selection-id-1", "model-selection-id-2"],
  "language": "TypeScript",
  "framework": "Next.js"
}
```

Правила:

- нужна user session или guest cookie `na_guest`;
- `modelIds` валидируются на backend;
- `language` должен быть из allowlist Code Arena;
- `framework` optional;
- backend сохраняет `tasks.mode_slug = "code-arena"`;
- код не запускается, тесты не выполняются, sandbox не используется.

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
