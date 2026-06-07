# 09 - API Structure

## Назначение файла

Этот файл описывает API проекта **Новая эпоха**.

Текущий статус:

```text
v0.4.1
# GET /api/models и POST /api/compare уже реализованы
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
# model_id, mode_slug, answer_text, latency_ms
```

## Текущие routes

| Route | Метод | Статус | Назначение |
|---|---|---|---|
| `/api/models` | GET | Реализовано | Получить список разрешённых моделей |
| `/api/compare` | POST | Реализовано | Отправить prompt нескольким моделям |

## GET /api/models

Возвращает список моделей из server-side allowlist.

### Ответ

```json
{
  "status": "success",
  "models": [
    {
      "id": "google/gemini-flash-1.5",
      "name": "Gemini Flash 1.5",
      "role": "Быстрый и точный",
      "provider": "openrouter",
      "badge": "Быстрый",
      "description": "Скоростная модель Google для быстрых и чётких ответов."
    }
  ]
}
```

## POST /api/compare

Отправляет один prompt нескольким моделям через OpenRouter.

### Текущий request body для v0.4.1

```json
{
  "prompt": "Сравни Next.js и Nuxt для MVP AI-платформы",
  "modelIds": [
    "google/gemini-flash-1.5",
    "mistralai/mistral-small-3.1-24b-instruct"
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
| `modelIds` | каждая модель должна быть в server-side allowlist |
| `modeSlug` | optional, по умолчанию `prompt-arena` |
| `modeSlug` | сейчас разрешён только `prompt-arena` |

### Успешный ответ

```json
{
  "status": "success",
  "modeSlug": "prompt-arena",
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
  "errorCode": "INVALID_MODE_SLUG",
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

В `v0.4.1`:

```text
modelIds = OpenRouter model keys из allowlist.
# это временное решение до Supabase
```

В `v0.5+`:

```text
modelIds = UUID из таблицы models.
# frontend не должен отправлять OpenRouter model_key напрямую

Backend получает models.model_key по UUID.
# OpenRouter key остаётся на сервере
```

## Будущий контракт v0.5

После подключения Supabase ответ `/api/compare` должен добавить `taskId`.

```json
{
  "status": "success",
  "taskId": "uuid-task-id",
  "modeSlug": "prompt-arena",
  "responses": []
}
```

## Будущие routes

| Route | Метод | Этап | Назначение |
|---|---|---|---|
| `/api/vote` | POST | v0.6 | Сохранить выбор лучшего ответа |
| `/api/history` | GET | v0.7 | Получить историю сравнений |
| `/api/history/[taskId]` | GET | v0.7 | Открыть одно сравнение |
| `/api/admin/models` | CRUD | v1.6 | Управление моделями |
| `/api/image-arena/generate` | POST | v1.8 | Сгенерировать изображения для будущей Image Arena |

## Правильный body для будущего /api/vote

```json
{
  "taskId": "uuid-task-id",
  "responseId": "uuid-response-id",
  "voteType": "winner"
}
```

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
