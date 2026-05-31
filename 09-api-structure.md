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

---

## Главный источник порядка версий

Канонический порядок разработки находится в файле:

```text
14-roadmap.md
# главный источник порядка версий проекта
```

Этот файл не должен менять roadmap. Он только описывает, какие API-маршруты нужны на каждом этапе.

Если есть конфликт между этим файлом и `14-roadmap.md`, главным считается `14-roadmap.md`.

---

## Главный принцип API

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

## Почему API routes обязательны

API routes нужны для:

- защиты `OPENROUTER_API_KEY`;
- защиты `SUPABASE_SERVICE_ROLE_KEY`;
- проверки входных данных;
- проверки разрешённых моделей;
- контроля количества моделей в одном запросе;
- ограничения длины prompt;
- контроля расходов;
- сохранения данных в Supabase;
- обработки частичных ошибок;
- подготовки ответов в формате, удобном для frontend;
- будущей авторизации;
- будущих пользовательских лимитов;
- будущей админ-панели.

---

## Технологическая основа API

Проект использует **Next.js App Router** и **Route Handlers**.

Пример структуры:

```text
src/app/api/models/route.ts
# получение списка доступных моделей

src/app/api/compare/route.ts
# отправка prompt нескольким моделям

src/app/api/vote/route.ts
# сохранение голоса пользователя

src/app/api/history/route.ts
# получение истории сравнений

src/app/api/history/[taskId]/route.ts
# получение одного сохранённого сравнения
```

Каждый файл `route.ts` внутри `src/app/api` становится серверным API-маршрутом.

---

## Общий порядок появления API

API нужно добавлять постепенно, строго по roadmap.

```text
v0.3 - UI MVP
# API ещё может быть заглушкой или вообще отсутствовать

v0.4 - OpenRouter Integration
# появляется POST /api/compare и GET /api/models

v0.5 - Supabase Integration
# /api/compare начинает сохранять tasks и model_responses

v0.6 - Voting MVP
# появляется POST /api/vote

v0.7 - History MVP
# появляются GET /api/history и GET /api/history/[taskId]

v0.8 - First Deploy
# проверяем API на Vercel

v0.9 - MVP Stabilization
# усиливаем validation, errors, limits, timeout и fallback

v1.0 - Stable Prompt Arena
# API Prompt Arena считается стабильным
```

---

## API MVP

Для стабильного Prompt Arena MVP нужны следующие маршруты.

| Маршрут | Метод | Версия | Назначение |
|---|---:|---|---|
| `/api/models` | GET | v0.4 | Получить список доступных моделей |
| `/api/compare` | POST | v0.4-v0.5 | Отправить задачу нескольким моделям |
| `/api/vote` | POST | v0.6 | Сохранить выбор лучшего ответа |
| `/api/history` | GET | v0.7 | Получить историю сравнений |
| `/api/history/[taskId]` | GET | v0.7 | Получить одно сохранённое сравнение |

---

# 1. GET /api/models

## Назначение

Маршрут возвращает список моделей, которые разрешены в проекте.

Frontend не должен сам хранить окончательный список моделей. Он может иметь временный UI-список, но реальная проверка должна быть на backend.

---

## Версии

```text
v0.4
# можно вернуть модели из server-side allowlist

v0.5
# лучше возвращать активные модели из таблицы models в Supabase

v1.6
# админ сможет включать, отключать и ограничивать модели через Admin Panel
```

---

## Что должен возвращать endpoint

Пример успешного ответа:

```json
{
  "success": true,
  "data": {
    "models": [
      {
        "id": "uuid",
        "provider": "openrouter",
        "model_key": "openai/gpt-example",
        "display_name": "GPT Example",
        "description": "Balanced model for general tasks",
        "category": "balanced",
        "price_label": "balanced",
        "role_tags": ["prompt", "judge"],
        "supports_code": true,
        "supports_judge": true,
        "sort_order": 10
      }
    ]
  }
}
```

---

## Правила для /api/models

Endpoint должен:

- возвращать только `is_active = true`;
- не раскрывать внутренние секреты;
- не возвращать service-role данные;
- сортировать модели по `sort_order`;
- возвращать только модели, разрешённые для текущего этапа проекта;
- скрывать дорогие модели до появления лимитов и админ-контроля.

---

# 2. POST /api/compare

## Назначение

Главный endpoint Prompt Arena. Он получает задачу пользователя, выбранные модели и возвращает ответы нескольких AI-моделей.

---

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

---

## Пример запроса

```json
{
  "prompt": "Сравни React и Vue для небольшого MVP",
  "model_ids": [
    "uuid-model-1",
    "uuid-model-2"
  ],
  "mode": "prompt_arena"
}
```

---

## Валидация запроса

Backend должен проверить:

| Поле | Правило |
|---|---|
| `prompt` | обязательная строка |
| `prompt` | не пустой после `trim()` |
| `prompt` | не слишком короткий |
| `prompt` | не слишком длинный |
| `model_ids` | массив |
| `model_ids` | минимум 2 модели для сравнения |
| `model_ids` | максимум 4 модели для MVP |
| `model_ids` | каждая модель должна существовать в таблице `models` |
| `model_ids` | каждая модель должна иметь `is_active = true` |
| `mode` | для MVP только `prompt_arena` |

---

## Почему backend проверяет модели повторно

Frontend можно изменить вручную через DevTools или прямой HTTP-запрос.

Поэтому нельзя доверять тому, что пришло из браузера.

```text
Frontend показывает доступные модели.
# это удобно для пользователя

Backend повторно проверяет модели.
# это настоящая защита проекта
```

---

## Что делает /api/compare

Порядок работы:

1. Получить JSON-запрос.
1. Проверить `prompt`.
1. Проверить выбранные модели.
1. Проверить, что моделей не слишком много.
1. Создать запись в `tasks`.
1. Отправить prompt в OpenRouter для каждой модели.
1. Сохранить каждый ответ в `model_responses`.
1. Вернуть frontend список ответов.

---

## Частичная успешность

Если одна модель дала ошибку, весь запрос не должен падать.

Правильное поведение:

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

---

## Пример успешного ответа

```json
{
  "success": true,
  "data": {
    "task": {
      "id": "uuid-task",
      "mode": "prompt_arena",
      "prompt_text": "Сравни React и Vue для небольшого MVP"
    },
    "responses": [
      {
        "id": "uuid-response-1",
        "model_id": "uuid-model-1",
        "model_name": "Model A",
        "status": "success",
        "answer_text": "React лучше подходит...",
        "latency_ms": 4200
      },
      {
        "id": "uuid-response-2",
        "model_id": "uuid-model-2",
        "model_name": "Model B",
        "status": "error",
        "answer_text": null,
        "error_code": "MODEL_TIMEOUT",
        "error_message": "Модель не успела ответить."
      }
    ]
  }
}
```

---

## Что нельзя делать в /api/compare

Нельзя:

- принимать любой `model_key` напрямую от пользователя;
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

---

## Версия

```text
v0.6 - Voting MVP
# пользователь может выбрать лучший ответ
```

---

## Пример запроса

```json
{
  "task_id": "uuid-task",
  "response_id": "uuid-response",
  "vote_type": "best"
}
```

---

## Валидация запроса

Backend должен проверить:

| Поле | Правило |
|---|---|
| `task_id` | обязательный uuid |
| `response_id` | обязательный uuid |
| `vote_type` | для MVP только `best` |
| `response_id` | должен принадлежать указанному `task_id` |
| `response_id` | должен иметь статус `success` |

---

## Пример успешного ответа

```json
{
  "success": true,
  "data": {
    "vote": {
      "id": "uuid-vote",
      "task_id": "uuid-task",
      "response_id": "uuid-response",
      "vote_type": "best"
    }
  }
}
```

---

## Правило для повторного голосования

Для MVP можно выбрать простое правило:

```text
Одна задача - один голос в рамках текущей сессии.
# проще для первого MVP
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

---

## Версия

```text
v0.7 - History MVP
# появляется история сравнений
```

---

## Пример ответа

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid-task",
        "mode": "prompt_arena",
        "prompt_preview": "Сравни React и Vue...",
        "responses_count": 3,
        "winner_model_name": "Model A",
        "created_at": "2026-05-31T12:00:00.000Z"
      }
    ]
  }
}
```

---

## Правила для истории в MVP

До аккаунтов история может быть общей или сессионной.

Но в production лучше сразу не показывать чужие личные prompt без контроля доступа.

Безопасный вариант для ранней версии:

```text
v0.7
# показывать только публичные или технически обезличенные задачи

v1.5
# после аккаунтов показывать пользователю его личную историю
```

---

# 5. GET /api/history/[taskId]

## Назначение

Маршрут возвращает одну сохранённую задачу со всеми ответами и голосом.

---

## Пример ответа

```json
{
  "success": true,
  "data": {
    "task": {
      "id": "uuid-task",
      "mode": "prompt_arena",
      "prompt_text": "Сравни React и Vue для небольшого MVP",
      "created_at": "2026-05-31T12:00:00.000Z"
    },
    "responses": [
      {
        "id": "uuid-response-1",
        "model_name": "Model A",
        "answer_text": "React лучше подходит...",
        "status": "success"
      }
    ],
    "vote": {
      "response_id": "uuid-response-1",
      "vote_type": "best"
    }
  }
}
```

---

# Будущие API-маршруты

Эти маршруты не входят в первый MVP. Их нельзя делать раньше соответствующей версии roadmap.

| Маршрут | Метод | Версия | Назначение |
|---|---:|---|---|
| `/api/code/compare` | POST | v1.1 | Code Arena Lite без запуска кода |
| `/api/battle` | POST | v1.2 | Multi Model Battle |
| `/api/judge` | POST | v1.3 | Judge Mode |
| `/api/leaderboard` | GET | v1.4 | Рейтинг моделей |
| `/api/profile` | GET | v1.5 | Профиль пользователя |
| `/api/usage` | GET | v1.5-v1.6 | Использование и лимиты |
| `/api/admin/models` | GET/PATCH | v1.6 | Управление моделями |
| `/api/admin/limits` | GET/PATCH | v1.6 | Управление лимитами |
| `/api/code/run` | POST | v1.7 | Безопасный запуск кода в sandbox |
| `/api/team/run` | POST | v2.0 | Запуск AI Team Mode |

---

## Важное правило для Code Arena

Code Arena делится на две разные части.

```text
v1.1 - Code Arena Lite
# модели только пишут и объясняют код
# код пользователя не запускается
# sandbox не нужен

v1.7 - Code Arena Runner
# код реально запускается
# нужен sandbox, лимиты, логирование, защита и админ-контроль
```

Нельзя делать `/api/code/run` в MVP или в `v1.1`.

---

## Важное правило для AI Team Mode

AI Team Mode не входит в MVP.

```text
v2.0 - AI Team Mode
# несколько моделей работают как команда с ролями
```

До `v2.0` нельзя добавлять полноценные `team_runs`, `team_steps` и сложную командную логику в основной рабочий поток.

---

# Рекомендуемая структура папок API

```text
src/app/api/models/route.ts
# GET /api/models

src/app/api/compare/route.ts
# POST /api/compare

src/app/api/vote/route.ts
# POST /api/vote

src/app/api/history/route.ts
# GET /api/history

src/app/api/history/[taskId]/route.ts
# GET /api/history/[taskId]
```

Будущие маршруты:

```text
src/app/api/code/compare/route.ts
# v1.1 - Code Arena Lite

src/app/api/battle/route.ts
# v1.2 - Multi Model Battle

src/app/api/judge/route.ts
# v1.3 - Judge Mode

src/app/api/leaderboard/route.ts
# v1.4 - Leaderboard

src/app/api/profile/route.ts
# v1.5 - профиль пользователя

src/app/api/admin/models/route.ts
# v1.6 - управление моделями

src/app/api/admin/limits/route.ts
# v1.6 - управление лимитами

src/app/api/code/run/route.ts
# v1.7 - запуск кода в sandbox

src/app/api/team/run/route.ts
# v2.0 - AI Team Mode
```

---

# Серверные helper-файлы

Чтобы не дублировать код, лучше вынести общую логику в `src/lib/server`.

```text
src/lib/server/openrouter.ts
# работа с OpenRouter API

src/lib/server/supabase.ts
# серверный клиент Supabase

src/lib/server/api-response.ts
# единый формат успешных ответов и ошибок

src/lib/server/validation.ts
# общие схемы проверки данных

src/lib/server/model-allowlist.ts
# временный allowlist моделей до полной интеграции с Supabase

src/lib/server/limits.ts
# лимиты prompt, моделей, timeout и расходов
```

Важно:

```text
src/lib/server/*
# эти файлы нельзя импортировать в client components
```

---

# Единый формат ответа API

Все endpoints должны возвращать предсказуемый формат.

## Успешный ответ

```json
{
  "success": true,
  "data": {}
}
```

## Ошибка

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Введите задачу перед отправкой."
  }
}
```

## Частичный успех

```json
{
  "success": true,
  "partial": true,
  "data": {
    "responses": []
  },
  "warnings": [
    {
      "code": "MODEL_TIMEOUT",
      "message": "Одна модель не успела ответить."
    }
  ]
}
```

---

# Основные коды ошибок

| Код | Значение |
|---|---|
| `VALIDATION_ERROR` | Ошибка входных данных |
| `EMPTY_PROMPT` | Пустой prompt |
| `PROMPT_TOO_SHORT` | Prompt слишком короткий |
| `PROMPT_TOO_LONG` | Prompt слишком длинный |
| `MODELS_REQUIRED` | Не выбраны модели |
| `TOO_FEW_MODELS` | Выбрано меньше 2 моделей |
| `TOO_MANY_MODELS` | Выбрано слишком много моделей |
| `MODEL_NOT_ALLOWED` | Модель не разрешена |
| `MODEL_DISABLED` | Модель отключена |
| `OPENROUTER_ERROR` | Ошибка OpenRouter |
| `MODEL_TIMEOUT` | Модель не ответила вовремя |
| `DATABASE_ERROR` | Ошибка Supabase |
| `VOTE_ALREADY_EXISTS` | Голос уже сохранён |
| `RESPONSE_NOT_FOUND` | Ответ не найден |
| `TASK_NOT_FOUND` | Задача не найдена |
| `UNAUTHORIZED` | Нужна авторизация |
| `FORBIDDEN` | Нет доступа |
| `RATE_LIMITED` | Превышен лимит запросов |
| `INTERNAL_ERROR` | Внутренняя ошибка сервера |

---

# HTTP-статусы

| Статус | Когда использовать |
|---:|---|
| `200` | Успешный GET или успешная операция |
| `201` | Создана новая запись |
| `400` | Неверные данные запроса |
| `401` | Пользователь не авторизован |
| `403` | Пользователь не имеет доступа |
| `404` | Запись не найдена |
| `409` | Конфликт, например повторный vote |
| `429` | Превышен лимит |
| `500` | Ошибка сервера |
| `502` | Ошибка внешнего AI-провайдера |
| `504` | Timeout внешней модели |

---

# Правила безопасности API

## 1. Никаких секретов в frontend

```text
OPENROUTER_API_KEY
# только backend

SUPABASE_SERVICE_ROLE_KEY
# только backend

NEXT_PUBLIC_*
# только публичные значения, которые можно безопасно показать в браузере
```

---

## 2. Backend всегда проверяет входные данные

```text
Frontend validation
# удобство для пользователя

Backend validation
# настоящая защита
```

---

## 3. Backend проверяет доступность моделей

Нельзя принимать любую модель, которую пользователь отправил вручную.

Правильно:

```text
Получить model_id от frontend.
# frontend отправляет id разрешённой модели

Найти модель в таблице models.
# backend проверяет, что она существует

Проверить is_active.
# backend проверяет, что модель включена

Использовать model_key из базы.
# пользователь не управляет OpenRouter model key напрямую
```

---

## 4. Backend ограничивает расходы

Для MVP нужно ограничить:

- длину prompt;
- количество моделей;
- timeout ответа модели;
- максимальное количество output tokens;
- доступ к дорогим моделям.

Пример правила:

```text
MVP: максимум 4 модели за один запрос.
# чтобы не сжечь бюджет случайно

MVP: дорогие модели выключены по умолчанию.
# сначала стабильность, потом качество
```

---

## 5. API не показывает stack trace пользователю

Плохо:

```text
Показать пользователю полный текст ошибки сервера.
# можно раскрыть внутренние детали проекта
```

Правильно:

```text
Показать простое сообщение.
# пользователь понимает проблему

Записать технические детали в server log.
# разработчик сможет найти причину
```

---

# Минимальные лимиты для MVP

| Параметр | Рекомендация для MVP |
|---|---:|
| Минимальная длина prompt | 3 символа |
| Максимальная длина prompt | 12000 символов |
| Минимум моделей | 2 |
| Максимум моделей | 4 |
| Timeout одной модели | 45-60 секунд |
| Максимум output tokens | 1000-2000 |
| Повторные запросы | ограничить на v0.9 |

Эти значения можно менять после тестирования.

---

# Работа с OpenRouter

## Серверная функция

Лучше вынести работу с OpenRouter в отдельный файл.

```text
src/lib/server/openrouter.ts
# один общий модуль для запросов к OpenRouter
```

Функция должна принимать:

- `model_key`;
- `prompt`;
- `max_tokens`;
- `temperature`;
- `timeout`.

Функция должна возвращать:

- статус;
- текст ответа;
- latency;
- usage, если доступно;
- ошибку, если модель не ответила.

---

## Правило по OpenRouter model ID

OpenRouter model ID нельзя считать вечными.

Перед production нужно проверять актуальные модели через OpenRouter Models API и обновлять таблицу `models`.

```text
GET /api/v1/models
# endpoint OpenRouter для проверки доступных моделей
```

В проекте должен быть свой allowlist.

```text
OpenRouter models list
# внешний список моделей

Project models table
# внутренний разрешённый список проекта
```

---

# Работа с Supabase

## На этапе v0.5

`/api/compare` должен сохранять:

```text
tasks
# задача пользователя

model_responses
# ответы моделей
```

`/api/vote` на этапе v0.6 должен сохранять:

```text
votes
# выбранный лучший ответ
```

---

## Service role key

`SUPABASE_SERVICE_ROLE_KEY` можно использовать только в server-side API.

Нельзя:

```text
Использовать service role key в frontend.
# это опасно

Писать service role key в NEXT_PUBLIC переменную.
# это раскроет ключ в браузере
```

---

# Проверка API локально

## Проверка models

```bash
curl http://localhost:3000/api/models
# проверить список доступных моделей
```

## Проверка compare

```bash
curl -X POST http://localhost:3000/api/compare \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Сравни React и Vue","model_ids":["uuid-1","uuid-2"],"mode":"prompt_arena"}'
# отправить тестовый prompt в Prompt Arena API
```

## Проверка vote

```bash
curl -X POST http://localhost:3000/api/vote \
  -H "Content-Type: application/json" \
  -d '{"task_id":"uuid-task","response_id":"uuid-response","vote_type":"best"}'
# проверить сохранение голоса
```

## Проверка build перед commit

```bash
npm run build
# проверить, что API и проект собираются без ошибок
```

---

# Проверка API на Vercel

После deploy нужно проверить:

```bash
curl https://your-project.vercel.app/api/models
# проверить API models в production
```

Для `POST /api/compare` лучше сначала использовать дешёвые или бесплатные модели.

```text
Сначала dev/free модели.
# безопасно для бюджета

Потом quality модели.
# только после проверки лимитов
```

---

# Что не входит в API MVP

В первый MVP не входят:

- полноценная авторизация;
- личные профили;
- сложные тарифы;
- платёжная система;
- Admin Panel;
- запуск кода;
- sandbox;
- AI Team Mode;
- сложная аналитика расходов;
- автоматический подбор моделей;
- публичный API для сторонних разработчиков.

---

# Чек-лист готовности API MVP

API можно считать готовым для MVP, если:

- `/api/models` возвращает только разрешённые активные модели;
- `/api/compare` проверяет prompt и модели;
- `/api/compare` не раскрывает OpenRouter ключ;
- `/api/compare` умеет обрабатывать ошибку одной модели без падения всего запроса;
- `/api/compare` сохраняет task и model_responses после v0.5;
- `/api/vote` сохраняет выбор лучшего ответа после v0.6;
- `/api/history` показывает прошлые сравнения после v0.7;
- все ошибки возвращаются в едином формате;
- `npm run build` проходит успешно;
- `.env.local` не попадает в Git;
- production deploy на Vercel работает;
- новая функция не ломает старый Prompt Arena.

---

# Итоговое решение

Для проекта **Новая эпоха** API строится постепенно.

Первый стабильный API должен обслуживать только Prompt Arena:

```text
GET /api/models
# список моделей

POST /api/compare
# сравнение ответов моделей

POST /api/vote
# выбор лучшего ответа

GET /api/history
# история сравнений

GET /api/history/[taskId]
# просмотр одного сравнения
```

После стабильного `v1.0` можно добавлять новые режимы.

Главное правило:

```text
Сначала безопасный Prompt Arena.
# это основа проекта

Потом Code Arena Lite.
# без запуска чужого кода

Потом Battle, Judge и Leaderboard.
# расширение оценки моделей

Потом Accounts, Admin Panel и Limits.
# контроль пользователей и расходов

Только потом Code Arena Runner.
# безопасный запуск кода в sandbox

AI Team Mode - только v2.0.
# сложный режим после стабильной платформы
```
