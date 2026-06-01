# 09 - Структура API

## Назначение файла

Этот файл описывает API-структуру проекта **Новая эпоха**.

API нужен, чтобы frontend безопасно работал с серверной частью проекта:

- получал список доступных AI-моделей;
- отправлял задачу пользователя нескольким моделям;
- получал ответы моделей;
- сохранял задачи, ответы и голоса в Supabase;
- показывал историю сравнений;
- подключал будущие режимы без поломки MVP.

Главная цель API - быть безопасной прослойкой между интерфейсом, OpenRouter и Supabase.

Главный источник порядка версий - `14-roadmap.md`.

Если этот файл конфликтует с `14-roadmap.md`, правильным считается `14-roadmap.md`.

---

# Главный принцип API

Frontend не должен обращаться к OpenRouter напрямую.

Правильная схема:

```text
Frontend
# браузер пользователя

Next.js Route Handler
# серверный API-маршрут проекта

OpenRouter API
# внешний сервис AI-моделей

Supabase PostgreSQL
# база данных проекта
```

Неправильная схема:

```text
Frontend -> OpenRouter API
# так делать нельзя, потому что секретный API-ключ может попасть в браузер
```

---

# Единый стиль имён

## API JSON

Frontend и API JSON используют `camelCase`.

```text
modelIds
# список выбранных моделей в API body

taskId
# id задачи в API body

responseId
# id ответа в API body

modeSlug
# slug режима в API body
```

## Database

Supabase PostgreSQL использует `snake_case`.

```text
model_id
# id модели в базе

task_id
# id задачи в базе

response_id
# id ответа в базе

mode_slug
# slug режима в базе

vote_type
# тип голоса в базе
```

## Mode slug

Для режима Prompt Arena используется единое значение:

```text
prompt-arena
# единый mode slug для API и базы
```

Не использовать:

```text
prompt_arena
# старый вариант с подчёркиванием
```

---

# Общий формат ответа API

Успешный ответ:

```json
{
  "success": true,
  "data": {}
}
```

Ответ с ошибкой:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Проверьте данные запроса."
  }
}
```

Правило:

```text
Пользователь видит понятное сообщение.
# без stack trace и внутренних секретов
```

---

# Общий порядок появления API

| Версия | API | Назначение |
|---|---|---|
| `v0.3` | Нет реального API | UI работает на mock-данных |
| `v0.4` | `GET /api/models`, `POST /api/compare` | Реальные ответы через OpenRouter |
| `v0.5` | Усиленный `/api/compare` | Сохранение `tasks` и `model_responses` |
| `v0.6` | `POST /api/vote` | Сохранение выбора лучшего ответа |
| `v0.7` | `GET /api/history`, `GET /api/history/[taskId]` | История сравнений |
| `v0.8` | Все MVP API на Vercel | Production deploy |
| `v0.9` | Validation, limits, timeout, fallback | Стабилизация |
| `v1.0` | Stable Prompt Arena API | Стабильный MVP |

---

# API MVP

| Маршрут | Метод | Версия | Назначение |
|---|---:|---|---|
| `/api/models` | GET | `v0.4` | Получить список доступных моделей |
| `/api/compare` | POST | `v0.4-v0.5` | Отправить задачу нескольким моделям |
| `/api/vote` | POST | `v0.6` | Сохранить выбор лучшего ответа |
| `/api/history` | GET | `v0.7` | Получить историю сравнений |
| `/api/history/[taskId]` | GET | `v0.7` | Получить одно сохранённое сравнение |

---

# 1. GET /api/models

## Назначение

Маршрут возвращает список моделей, которые разрешены в проекте.

Frontend может иметь временный mock-список на `v0.3`, но с `v0.4` реальный список должен проходить через backend.

## Версии

```text
v0.4
# можно вернуть модели из server-side allowlist

v0.5
# лучше возвращать активные модели из таблицы models в Supabase

v1.6
# админ сможет включать, отключать и ограничивать модели через Admin Panel
```

## Пример успешного ответа

```json
{
  "success": true,
  "data": {
    "models": [
      {
        "id": "uuid-model-1",
        "provider": "openrouter",
        "modelKey": "openai/gpt-example",
        "displayName": "GPT Example",
        "description": "Balanced model for general tasks",
        "category": "balanced",
        "priceLabel": "balanced",
        "roleTags": ["prompt"],
        "supportsCode": true,
        "supportsJudge": false,
        "sortOrder": 10
      }
    ]
  }
}
```

## Правила

Endpoint должен:

- возвращать только активные модели;
- не раскрывать внутренние секреты;
- не возвращать service-role данные;
- сортировать модели по `sortOrder`;
- возвращать только модели, разрешённые для текущего этапа проекта;
- скрывать дорогие модели до появления лимитов и админ-контроля.

---

# 2. POST /api/compare

## Назначение

Главный endpoint Prompt Arena. Он получает задачу пользователя, выбранные модели и возвращает ответы нескольких AI-моделей.

## Версии

```text
v0.4
# получает реальные ответы от OpenRouter, но может ещё не сохранять их в базу

v0.5
# создаёт task и model_responses в Supabase

v0.9
# получает усиленную обработку ошибок, timeout, лимиты и защиту от слишком дорогих запросов

v1.0
# считается стабильным API для Prompt Arena
```

## Пример запроса

```json
{
  "prompt": "Сравни React и Vue для небольшого MVP",
  "modelIds": ["uuid-model-1", "uuid-model-2"],
  "modeSlug": "prompt-arena"
}
```

## Валидация запроса

Backend должен проверить:

| Поле | Правило |
|---|---|
| `prompt` | Обязательная строка |
| `prompt` | Не пустой после `trim()` |
| `prompt` | Минимум 3 символа |
| `prompt` | Максимум 8000 символов |
| `modelIds` | Массив |
| `modelIds` | Минимум 2 модели для сравнения |
| `modelIds` | Максимум 3 модели для MVP |
| `modelIds` | Каждая модель должна существовать в allowlist или таблице `models` |
| `modelIds` | Каждая модель должна быть активна |
| `modeSlug` | Для MVP только `prompt-arena` |

## Почему backend проверяет модели повторно

Frontend можно изменить вручную через DevTools или прямой HTTP-запрос.

```text
Frontend показывает доступные модели.
# это удобно для пользователя

Backend повторно проверяет модели.
# это настоящая защита проекта
```

## Что делает /api/compare

Порядок работы в `v0.4`:

1. Получить JSON-запрос.
2. Проверить `prompt`.
3. Проверить `modelIds`.
4. Проверить `modeSlug`.
5. Проверить лимиты.
6. Отправить prompt в OpenRouter для каждой модели.
7. Вернуть frontend список ответов.

Порядок работы с `v0.5`:

1. Создать запись в `tasks`.
2. Сохранить успешные ответы в `model_responses`.
3. Сохранить ошибки моделей в `model_responses`.
4. Вернуть frontend `taskId` и список ответов.

## Частичная успешность

Если одна модель дала ошибку, весь запрос не должен падать.

```text
Модель 1 ответила успешно.
# показываем карточку ответа

Модель 2 ответила успешно.
# показываем карточку ответа

Модель 3 дала timeout.
# показываем карточку ошибки именно для этой модели

Весь compare-запрос остаётся успешным частично.
# пользователь всё равно видит полезный результат
```

## Пример успешного ответа

```json
{
  "success": true,
  "data": {
    "task": {
      "id": "uuid-task",
      "modeSlug": "prompt-arena",
      "promptText": "Сравни React и Vue для небольшого MVP"
    },
    "responses": [
      {
        "id": "uuid-response-1",
        "modelId": "uuid-model-1",
        "modelName": "Model A",
        "status": "success",
        "answerText": "React лучше подходит...",
        "latencyMs": 4200
      },
      {
        "id": "uuid-response-2",
        "modelId": "uuid-model-2",
        "modelName": "Model B",
        "status": "error",
        "answerText": null,
        "errorCode": "MODEL_TIMEOUT",
        "errorMessage": "Модель не успела ответить."
      }
    ]
  }
}
```

## Что нельзя делать в /api/compare

Нельзя:

- принимать любой `modelKey` напрямую от пользователя;
- отдавать OpenRouter API key на frontend;
- отправлять запрос сразу в 10-20 моделей в MVP;
- молча скрывать ошибки моделей;
- сохранять секретные данные в `tasks` или `model_responses`;
- показывать пользователю полный технический stack trace;
- запускать код пользователя.

---

# 3. POST /api/vote

## Назначение

Маршрут сохраняет выбор пользователя: какой ответ он считает лучшим.

Важно:

```text
v0.3
# есть только локальный UI-выбор победителя без сохранения

v0.6
# появляется POST /api/vote и сохранение в Supabase
```

## Версия

```text
v0.6 - Voting MVP
# пользовательский выбор сохраняется в таблицу votes
```

## Пример запроса

```json
{
  "taskId": "uuid-task",
  "responseId": "uuid-response"
}
```

`voteType` не нужно передавать с frontend для обычного MVP-голоса.

Backend должен записать:

```text
vote_type = user
# обычный пользовательский голос
```

## Валидация запроса

Backend должен проверить:

| Поле | Правило |
|---|---|
| `taskId` | Обязательный uuid |
| `responseId` | Обязательный uuid |
| `responseId` | Должен принадлежать указанному `taskId` |
| `responseId` | Должен иметь статус `success` |

## Пример успешного ответа

```json
{
  "success": true,
  "data": {
    "vote": {
      "id": "uuid-vote",
      "taskId": "uuid-task",
      "responseId": "uuid-response",
      "voteType": "user"
    }
  }
}
```

## Правило для повторного голосования

Для MVP можно выбрать простое правило:

```text
Одна задача - один пользовательский голос в рамках текущей сессии.
# проще для первого MVP

Если пользователь выбирает другой ответ.
# обновляем существующий голос
```

После появления аккаунтов можно сделать точнее:

```text
Один пользователь - один голос за одну задачу.
# это уже версия v1.5+
```

---

# 4. GET /api/history

## Назначение

Маршрут возвращает список прошлых сравнений.

## Версия

```text
v0.7 - History MVP
# пользователь может открыть историю сохранённых сравнений
```

## Пример ответа

```json
{
  "success": true,
  "data": {
    "tasks": [
      {
        "id": "uuid-task",
        "modeSlug": "prompt-arena",
        "title": "React vs Vue",
        "promptPreview": "Сравни React и Vue...",
        "status": "completed",
        "createdAt": "2026-06-01T12:00:00.000Z"
      }
    ]
  }
}
```

---

# 5. GET /api/history/[taskId]

## Назначение

Маршрут возвращает одно сохранённое сравнение вместе с ответами моделей и выбранным голосом.

## Версия

```text
v0.7 - History MVP
# подробный просмотр сохранённого сравнения
```

## Пример ответа

```json
{
  "success": true,
  "data": {
    "task": {
      "id": "uuid-task",
      "modeSlug": "prompt-arena",
      "promptText": "Сравни React и Vue",
      "status": "completed",
      "createdAt": "2026-06-01T12:00:00.000Z"
    },
    "responses": [
      {
        "id": "uuid-response-1",
        "modelId": "uuid-model-1",
        "modelName": "Model A",
        "status": "success",
        "answerText": "...",
        "latencyMs": 4200
      }
    ],
    "vote": {
      "responseId": "uuid-response-1",
      "voteType": "user"
    }
  }
}
```

---

# Общие правила безопасности API

API routes должны:

- читать секреты только из server-side env;
- не возвращать `OPENROUTER_API_KEY`;
- не возвращать `SUPABASE_SERVICE_ROLE_KEY`;
- проверять входные данные;
- проверять allowlist моделей;
- ограничивать длину prompt;
- ограничивать количество моделей;
- обрабатывать timeout моделей;
- не показывать stack trace пользователю;
- не запускать пользовательский код.

---

# Минимальные server-side файлы для v0.4

```text
src/app/api/models/route.ts
# GET /api/models

src/app/api/compare/route.ts
# POST /api/compare

src/lib/server/openrouter.ts
# server-side OpenRouter client

src/lib/server/model-allowlist.ts
# список разрешённых моделей для v0.4

src/lib/server/limits.ts
# лимиты prompt, моделей и timeout

src/lib/server/api-response.ts
# единый формат success/error ответа
```

---

# Следующий шаг

Перед реализацией `v0.4` нужно убедиться, что документация и код используют:

```text
modelIds
# API JSON

taskId
# API JSON

responseId
# API JSON

modeSlug = prompt-arena
# API JSON и database value

vote_type = user
# database value для обычного голоса

MAX_MODELS_PER_COMPARE = 3
# общий лимит MVP

MAX_PROMPT_LENGTH = 8000
# общий лимит MVP
```
