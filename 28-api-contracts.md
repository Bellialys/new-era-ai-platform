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

- Ответы API должны быть JSON, кроме явно описанных streaming-режимов `text/event-stream`.
- Ошибки должны возвращаться через безопасный формат `createErrorResponse`.
- Секреты, API keys, service role keys и Authorization headers нельзя логировать.
- `model_key` провайдера не должен быть доверенным значением из frontend.
- Backend повторно валидирует `prompt`, `modelIds`, `modeSlug` и выбранные модели.
- Все поля с AI-generated content (`answerText`, judge `reasoning`, verdict labels, code blocks, descriptions) остаются Untrusted Input для клиента и должны рендериться по `25-production-excellence.md`, раздел `9.1 AI Output Sanitization`.

## Rate Limiting

Публичные endpoints с дорогими или массовыми запросами защищены rate limiting. При превышении лимита возвращается `429` с заголовком `Retry-After` (секунды до сброса).

| Endpoint | Лимит | Окно | Ключ |
|---|---|---|---|
| `GET /api/models` | 60 req | 60 сек | IP-адрес |
| `POST /api/compare` | 10 req | 60 сек | user UUID или guest cookie `na_guest` |
| `POST /api/vote` | 30 req | 60 сек | user UUID или guest cookie `na_guest` |
| `GET /api/code-models` | 60 req | 60 сек | IP-адрес |
| `POST /api/code-compare` | 8 req / 3 guest req | 60 сек | user UUID или guest cookie `na_guest` |
| `POST /api/judge` | 3 req / 1 guest req | 60 сек | user UUID или guest cookie `na_guest` |
| `POST /api/code-run` | 10 req | 60 сек | user UUID; guests are not allowed |
| `GET /api/history` | 60 req | 60 сек | user UUID или guest cookie `na_guest` |
| `GET /api/history/[taskId]` | 60 req | 60 сек | user UUID или guest cookie `na_guest` |
| `GET /api/admin/audit` | no public quota | admin Supabase session | `requireAdmin()` |
| `GET /api/admin/usage` | no public quota | admin Supabase session | `requireAdmin()` |

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

Streaming-запрос:

```json
{
  "prompt": "Сравни Next.js и Nuxt для MVP",
  "modelIds": ["model-selection-id-1", "model-selection-id-2"],
  "modeSlug": "prompt-arena",
  "stream": true
}
```

Правила:

- `prompt` должен пройти ограничения длины MVP;
- `modelIds` должен содержать 2-3 модели;
- `modeSlug` сейчас должен быть `prompt-arena`;
- `stream: true` включает SSE-ответ `text/event-stream`, обычный запрос без `stream` сохраняет JSON-контракт;
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

Streaming events:

```text
event: model_start
data: {"modelId":"model-selection-id-1","modelName":"Model display name","modelRole":"general"}

event: model_token
data: {"modelId":"model-selection-id-1","token":"часть ответа"}

event: model_done
data: {"modelId":"model-selection-id-1","response":{"id":"temporary-response-id","modelId":"model-selection-id-1","modelName":"Model display name","status":"success","answerText":"Полный ответ","latencyMs":1234}}

event: model_error
data: {"modelId":"model-selection-id-2","response":{"id":"temporary-response-id","modelId":"model-selection-id-2","modelName":"Model display name","status":"error","answerText":null,"errorCode":"OPENROUTER_ERROR","errorMessage":"Safe message"}}

event: complete
data: {"status":"success","taskId":"saved-task-uuid-or-null","responses":[]}
```

`complete.responses` является финальным источником `response.id` для `/api/vote`, потому что до сохранения в Supabase streaming events могут использовать временные ids.

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

## `POST /api/judge` (v1.3+, current in v1.7)

Запускает AI judge для 2+ готовых ответов и, если передан `taskId`, best-effort сохраняет результат в `tasks.judge_verdict`.

Минимальный запрос:

```json
{
  "taskId": "saved-task-uuid",
  "prompt": "Сравни подходы к реализации rate limit",
  "responses": [
    {
      "modelId": "model-selection-id-1",
      "modelName": "Model A",
      "answerText": "..."
    },
    {
      "modelId": "model-selection-id-2",
      "modelName": "Model B",
      "answerText": "..."
    }
  ]
}
```

Минимальный ответ:

```json
{
  "status": "ok",
  "verdict": {
    "winnerModelId": "model-selection-id-1",
    "winnerModelName": "Model A",
    "winnerLabel": "A",
    "reasoning": "2-3 sentence explanation",
    "scores": {
      "model-selection-id-1": 8,
      "model-selection-id-2": 7
    }
  }
}
```

Rules:

- requires Supabase auth cookie or httpOnly guest cookie `na_guest`;
- `prompt` must be at least 3 characters;
- `responses` must contain at least 2 items with non-empty `answerText`;
- model names are used only for UI/result mapping; judge prompt uses blind labels;
- rate limit: authenticated users 3 requests/min, guests 1 request/min;
- verdict/reasoning является AI-generated structured output: backend должен валидировать его строгой схемой, а frontend рендерит как недоверенный текст по `25-production-excellence.md`, раздел `9.1`;
- safe errors include `AUTH_REQUIRED`, `RATE_LIMIT`, `INVALID_BODY`, `INVALID_PROMPT`, `INVALID_RESPONSES`, `INSUFFICIENT_RESPONSES`, `JUDGE_PARSE_ERROR`, `INTERNAL_ERROR`.

## `POST /api/code-run` (v1.7)

Запускает пользовательский код через внешний Piston runner. Код не выполняется через `eval`, `exec`, `child_process` или локальный server-side sandbox приложения.

Минимальный запрос:

```json
{
  "language": "TypeScript",
  "code": "console.log('hello')"
}
```

Минимальный ответ:

```json
{
  "stdout": "hello\n",
  "stderr": "",
  "exitCode": 0,
  "cpuTime": 0,
  "language": "TypeScript"
}
```

Rules:

- requires a real Supabase authenticated user; guest identity returns `401 AUTH_REQUIRED`;
- `language` must be one of the configured Code Arena languages supported by `LANGUAGE_CONFIG`;
- `code` is required and must not exceed `CODE_RUN_MAX_CHARS` (`10000`);
- Piston receives a single file, empty stdin/args, `run_timeout = 5000` and `compile_timeout = 10000`;
- response output is truncated to 5000 characters for stdout and stderr;
- rate limit: 10 runs/min per user UUID;
- runner isolation, no-network, no-secrets, timeout, cleanup and production enablement requirements are governed by `25-production-excellence.md`, section `6.1 Code Runner Isolation Requirements`;
- safe errors include `AUTH_REQUIRED`, `RATE_LIMIT`, `INVALID_JSON`, `VALIDATION_ERROR`, `PISTON_ERROR`, `INTERNAL_ERROR`.

## `GET /api/admin/audit` (v1.6+, current in v1.7)

Возвращает последние audit events для admin UI. Endpoint читает `public.audit_log` через server-side service role, но внешний доступ дополнительно закрыт `requireAdmin()`.

Запрос не принимает query-параметры в текущей реализации.

Минимальный ответ:

```json
{
  "entries": [
    {
      "id": "audit-row-uuid",
      "actorId": "user-uuid-or-null",
      "actorName": "Display name or null",
      "action": "admin.models.update",
      "targetType": "model",
      "targetId": "model-id",
      "payload": {},
      "createdAt": "2026-06-24T05:54:08.000Z"
    }
  ]
}
```

Rules:

- requires Supabase auth cookie for a user whose `profiles.role = 'admin'`;
- non-admin or missing auth returns `403 FORBIDDEN`;
- database misconfiguration/query failure returns safe `500 INTERNAL_ERROR`;
- response is limited to 50 newest rows ordered by `created_at desc`;
- no `anon`/`authenticated` direct table access is granted for `public.audit_log`;
- no public route rate limit is configured because access is admin-only and the result size is capped.

## `GET /api/admin/usage` (v1.6+, current in v1.7)

Возвращает admin-сводку usage по авторизованным пользователям за текущий UTC-день и последние 7 дней.

Запрос не принимает query-параметры в текущей реализации.

Минимальный ответ:

```json
{
  "users": [
    {
      "userId": "user-uuid",
      "displayName": "Display name or null",
      "plan": "free",
      "requestsToday": 2,
      "requestsWeek": 9
    }
  ]
}
```

Rules:

- requires Supabase auth cookie for a user whose `profiles.role = 'admin'`;
- reads `tasks` from the last 7 UTC days where `user_id` is not null;
- joins `profiles` for display name and plan;
- returns at most 50 users sorted by weekly request count descending;
- non-admin or missing auth returns `403 FORBIDDEN`;
- database misconfiguration/query failure returns safe `500 INTERNAL_ERROR`;
- no public route rate limit is configured because access is admin-only and the result size is capped.

## `GET /api/history` (v0.8)

Возвращает прошлые сравнения текущего вызывающего (пользователя или гостя), новейшие сверху.

> **Идентичность определяется из cookie, не из тела/параметров.**
> Backend использует service role (обходит RLS), поэтому каждый запрос истории
> фильтруется по `user_id` или `anonymous_session_id` владельца в самом WHERE.
> Чужие задачи в принципе не попадают в выборку.

Query-параметры (все необязательные):

```text
?limit=20         # размер страницы, по умолчанию 20, максимум 50
?cursor=<ISO>     # created_at последней строки прошлой страницы (keyset-пагинация)
?mode=code-arena  # фильтр по mode_slug (prompt-arena | code-arena); неизвестные игнорируются
```

Минимальный ответ:

```json
{
  "status": "success",
  "items": [
    {
      "taskId": "task-uuid",
      "modeSlug": "prompt-arena",
      "taskText": "Сравни Next.js и Nuxt для MVP",
      "status": "completed",
      "selectedModels": ["model-key-1", "model-key-2"],
      "modelCount": 2,
      "createdAt": "2026-06-20T10:00:00.000Z",
      "hasWinner": true
    }
  ],
  "nextCursor": "2026-06-20T10:00:00.000Z",
  "requestId": "uuid"
}
```

- `nextCursor` равен `null`, когда больше страниц нет;
- требует Supabase auth cookie или httpOnly guest cookie `na_guest`; иначе `401 AUTH_REQUIRED`;
- когда Supabase не сконфигурирован, возвращается пустой список (graceful empty).

## `GET /api/history/[taskId]` (v0.8)

Возвращает одно сравнение с его ответами и победителем, scoped к владельцу.

Минимальный ответ:

```json
{
  "status": "success",
  "task": {
    "taskId": "task-uuid",
    "modeSlug": "prompt-arena",
    "taskText": "Сравни Next.js и Nuxt для MVP",
    "status": "completed",
    "selectedModels": ["model-key-1", "model-key-2"],
    "settings": {},
    "createdAt": "2026-06-20T10:00:00.000Z",
    "errorMessage": null,
    "winnerResponseId": "model-response-uuid-or-null"
  },
  "responses": [
    {
      "responseId": "model-response-uuid",
      "modelKey": "model-key-1",
      "displayName": "Model display name",
      "status": "success",
      "responseText": "Ответ модели",
      "errorCode": null,
      "errorMessage": null,
      "latencyMs": 1234,
      "isWinner": true
    }
  ],
  "requestId": "uuid"
}
```

- `taskId` должен быть UUID, иначе `400 VALIDATION_ERROR`;
- задача, которая не существует **или** не принадлежит вызывающему, возвращает `404 TASK_NOT_FOUND` (существование не раскрывается);
- read-only: история не редактируется и не запускает повторных вызовов моделей.

## Request ID (v0.8)

Все history endpoints генерируют (или принимают входной) `x-request-id` и возвращают его
в заголовке ответа, в теле успешного ответа (`requestId`) и в теле ошибки. Логи сервера
содержат `rid=<requestId>` для корреляции. Секреты, cookie и Authorization headers не логируются.

## Related Docs

- `09-api-structure.md` - подробная структура API.
- `12-security-and-env.md` - правила безопасности API и env.
