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
- Mutating endpoints должны иметь согласованную UI/cache invalidation strategy по `23-codex-quality-rules.md`, раздел `17`, если результат влияет на Arena, Voting, Judge Mode, Leaderboard или user/session views.

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
| `POST /api/team-run` | 3 req | 10 min | user UUID; guests are not allowed |
| `POST /api/image-compare` | 5 req | 60 сек | user UUID; guests are not allowed |
| `GET /api/history` | 60 req | 60 сек | user UUID или guest cookie `na_guest` |
| `GET /api/history/[taskId]` | 60 req | 60 сек | user UUID или guest cookie `na_guest` |
| `POST /api/profile/avatar` | 5 req | 60 сек | user UUID |
| `DELETE /api/profile/avatar` | 5 req | 60 сек | user UUID (общий счётчик с POST) |
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

## `GET /api/admin/models`

Возвращает административный список всех моделей каталога (включая неактивные) с агрегированным числом ответов по каждой модели. Доступ только для администратора.

> **Identity:** требуется `requireAdmin()` — валидный auth-cookie пользователя, чья запись в `profiles.role` равна `"admin"`. Иначе `403 FORBIDDEN`.

Минимальный ответ:

```json
{
  "status": "success",
  "models": [
    {
      "id": "model-uuid",
      "name": "Model display name",
      "model_key": "provider/model-key",
      "badge": ["Free"],
      "is_active": true,
      "access_level": "registered",
      "totalResponses": 0
    }
  ]
}
```

Rules:
- Только admin: `requireAdmin()` проверяет auth-cookie и `profiles.role === "admin"`; нет публичной квоты / rate limit.
- Список берётся из таблицы `models` (поля `id, display_name, model_key, role_tags, price_label, is_active, access_level`), сортировка по `display_name`. Поле ответа `name` маппится из `display_name`; колонок `name`/`badge` в таблице нет.
- `badge` — массив: вычисляется через `badgeFromTags(role_tags, price_label)`; единственно возможные значения — `["Free Coding"]`, `["Free Reasoning"]`, `["Free Fast"]` или `["Free"]` (при `price_label === "free"`), иначе пустой массив `[]`.
- `access_level` берётся из строки модели; если значение отсутствует — подставляется `"registered"`.
- `totalResponses` — число строк в `model_responses` с данным `model_id` (агрегируется в памяти; строки с `model_id === null` игнорируются).
- Возвращает `200` с `{ status: "success", models }`; ошибки — `4xx/5xx` с телом `{ status: "error", errorCode, message, requestId? }`.
- safe errors include `FORBIDDEN` (403, не admin или нет сессии), `INTERNAL_ERROR` (500, Supabase не сконфигурирован / сбой запроса к `models`).

## `PATCH /api/admin/models/[id]`

Обновляет одну модель в каталоге (флаг активности, отображаемое имя, уровень доступа). Доступно только администратору.

> **Identity:** только администратор. `requireAdmin()` проверяет cookie-сессию Supabase и роль `profiles.role === "admin"`; иначе `403 FORBIDDEN`.

Минимальный запрос:

```json
{
  "is_active": true,
  "name": "Model display name",
  "access_level": "registered"
}
```

Минимальный ответ:

```json
{
  "status": "success"
}
```

Rules:
- Только `requireAdmin()`; публичной квоты / rate limit нет. Неаутентифицированный пользователь или не-админ → `403 FORBIDDEN`.
- Тело должно быть валидным JSON, иначе `400 INVALID_JSON`.
- Поддерживаются только три поля; каждое опционально, но должно быть передано хотя бы одно:
  - `is_active` — обязательно `boolean`, иначе `400 VALIDATION_ERROR`.
  - `name` — строка, обрезается по краям; после trim должна быть непустой и не длиннее 100 символов, иначе `400 VALIDATION_ERROR`. Публичное поле `name` пишется в столбец `display_name` таблицы `models` (отдельного столбца `name` нет).
  - `access_level` — одно из `anonymous`, `registered`, `premium`, иначе `400 VALIDATION_ERROR`.
- Если ни одного валидного поля не набралось → `400 VALIDATION_ERROR` ("No valid fields to update.").
- Несуществующий `id` не даёт явной ошибки (update по `eq("id", id)` просто не затрагивает строк, ответ всё равно `200 success`).
- При успехе пишется запись аудита (`logAuditEvent`, action `model.update`, payload `{ before, after }`); сбой аудита логируется, но не влияет на ответ.
- safe errors include `FORBIDDEN`, `INVALID_JSON`, `VALIDATION_ERROR`, `INTERNAL_ERROR`.

## `GET /api/admin/stats`

Возвращает агрегированную статистику платформы для админ-панели: число пользователей, задач, голосов и моделей (всего и активных).

> **Identity:** только админ. `requireAdmin()` читает Supabase-сессию из cookie, затем проверяет `profiles.role === "admin"` через service-client; иначе `403 FORBIDDEN`.

Минимальный ответ:

```json
{
  "status": "success",
  "totalUsers": 0,
  "totalTasks": 0,
  "totalVotes": 0,
  "totalModels": 0,
  "activeModels": 0
}
```

Rules:
- Доступ только для админа: `requireAdmin()` (нет публичной квоты / rate limit отсутствует).
- Query-параметров и тела запроса нет.
- Все пять значений — целочисленные счётчики (`count: "exact", head: true`); при `null` из БД нормализуются в `0`, поэтому поля всегда присутствуют и не бывают `null`.
- `totalUsers` — `profiles`, `totalTasks` — `tasks`, `totalVotes` — `votes`, `totalModels` — все `models`, `activeModels` — `models` с `is_active = true`.
- При отсутствии конфигурации БД — `500 INTERNAL_ERROR`.
- safe errors include `FORBIDDEN`, `INTERNAL_ERROR`.

## `GET /api/admin/users`

Возвращает список всех пользователей платформы: данные из Supabase Auth (id, email, даты) объединяются с профилем (display_name, role, plan). Только для администраторов.

> **Identity:** `requireAdmin()` проверяет cookie-сессию через `supabase.auth.getUser()`, затем читает `profiles.role` через service-client и требует `role === "admin"`. Любой иной случай — `403 FORBIDDEN`.

Минимальный ответ:

```json
{
  "status": "success",
  "users": [
    {
      "id": "user-uuid",
      "email": "user@example.com",
      "displayName": "Display name or null",
      "role": "user",
      "plan": "free",
      "createdAt": "2026-06-20T10:00:00.000Z",
      "lastSignInAt": "2026-06-20T10:00:00.000Z"
    }
  ]
}
```

Rules:
- Auth: требуется админ — `requireAdmin()`; нет публичной квоты / rate limit.
- Источники данных: `supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })` (максимум 1000 пользователей за вызов) и таблица `profiles` (`id, display_name, role, plan`), объединяемые по `id`.
- Поля на пользователя: `id`, `email` (string или `null`), `displayName` (`profile.display_name` или `null`), `role` (по умолчанию `"user"`), `plan` (по умолчанию `"free"`), `createdAt` (`auth.created_at`), `lastSignInAt` (`auth.last_sign_in_at` или `null`).
- Auth-пользователи без строки в `profiles` всё равно попадают в ответ со значениями по умолчанию.
- Если service-client не сконфигурирован, либо ошибка `listUsers`/запроса профилей — `500 INTERNAL_ERROR`.
- safe errors include `FORBIDDEN`, `INTERNAL_ERROR`.

## `PATCH /api/admin/users/[id]`

Обновляет роль и/или план пользователя по его id (только для администратора). Любое изменение пишется в `audit_log`.

> **Identity:** `requireAdmin()` — запрос проходит, только если auth-cookie принадлежит пользователю с `profiles.role = "admin"`; иначе `403 FORBIDDEN`.

Минимальный запрос:

```json
{
  "role": "admin",
  "plan": "pro"
}
```

Минимальный ответ:

```json
{
  "status": "success"
}
```

Rules:
- Требует `requireAdmin()`; нет публичной квоты / нет rate limit.
- Тело должно быть валидным JSON, иначе `400 INVALID_JSON`.
- Оба поля опциональны, но хотя бы одно из `role` / `plan` обязано присутствовать; пустой набор → `400 VALIDATION_ERROR` ("No valid fields to update.").
- `role` — одно из `user`, `admin`; `plan` — одно из `free`, `pro`. Иначе `400 VALIDATION_ERROR`.
- Применяет только распознанные поля к строке `profiles` с `id = [id]`; неизвестные ключи игнорируются. Несуществующий `id` не возвращает ошибку — ответ всё равно `{ "status": "success" }`.
- Перед обновлением читает прежние `role, plan` и пишет аудит-событие `user.role_change` (если менялась роль) либо `user.plan_change` с `payload.before`/`payload.after`. Сбой аудита логируется, но не влияет на ответ.
- Сбой клиента Supabase или ошибка update → `500 INTERNAL_ERROR`.
- safe errors include `FORBIDDEN`, `INVALID_JSON`, `VALIDATION_ERROR`, `INTERNAL_ERROR`.

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

## `POST /api/team-run` (v2.0)

Запускает AI Team Mode: последовательное выполнение 4 ролей (Planner → Researcher → Critic → Finalizer) через один выбранный free-tier model.

Требует авторизованного пользователя (`kind === "user"`). Гости получают `401 AUTH_REQUIRED`.

Минимальный запрос:

```json
{
  "task": "Спроектируй архитектуру rate-limiting для AI-платформы",
  "modelId": "model-selection-id"
}
```

Поле `modelId` необязательно — при отсутствии или если ID не входит в `ALLOWED_MODELS`, используется `TEAM_DEFAULT_MODEL_ID`.

Минимальный ответ:

```json
{
  "taskId": "saved-task-uuid-or-null",
  "steps": [
    {
      "roleId": "planner",
      "output": "Шаг 1 ответ модели",
      "latencyMs": 1234
    },
    {
      "roleId": "researcher",
      "output": "Шаг 2 ответ модели",
      "latencyMs": 1234
    },
    {
      "roleId": "critic",
      "output": "Шаг 3 ответ модели",
      "latencyMs": 1234
    },
    {
      "roleId": "finalizer",
      "output": "Финальный результат",
      "latencyMs": 1234
    }
  ],
  "finalAnswer": "Финальный результат"
}
```

Rules:

- requires a real Supabase authenticated user (`kind === "user"`); guest or unauthenticated → `401 AUTH_REQUIRED`;
- `task` must be 10–4000 characters;
- `modelId` is validated against `ALLOWED_MODELS` allowlist; unknown IDs fall back to `TEAM_DEFAULT_MODEL_ID`;
- rate limit: 3 requests per 10 minutes per user UUID (Upstash Redis in production, in-memory locally);
- context window between steps is truncated to 2000 characters to prevent token overflow;
- best-effort persistence: current runtime saves `tasks` (mode_slug = `ai-team-mode`) and role rows in `model_responses`; `team_runs`/`team_run_steps` are DB v2 future storage until the v2.1 migration task switches writes to those tables;
- OpenRouter is called server-side only; `modelId` from frontend is a `selectionId`, never a raw provider key;
- safe errors include `SERVICE_UNAVAILABLE`, `AUTH_REQUIRED`, `RATE_LIMIT`, `VALIDATION_ERROR`, `INVALID_JSON`, `INTERNAL_ERROR`.

## `POST /api/image-compare` (v2.0, alpha)

Запускает Image Arena: генерирует изображения через несколько image-capable моделей и загружает их в Supabase Storage, если storage upload доступен; в alpha degraded mode может вернуть provider URL.

Требует авторизованного пользователя. Гости получают `401 AUTH_REQUIRED`.

> **Alpha endpoint.** API может измениться до стабильного v2.0 release. Не вызывать напрямую из frontend — только через backend route handler.

Минимальный запрос:

```json
{
  "idea": "Футуристический город на рассвете",
  "modelIds": ["uuid-image-model-1", "uuid-image-model-2"],
  "modeSlug": "image-arena"
}
```

Rules:

- requires a real Supabase authenticated user; guest or unauthenticated → `401 AUTH_REQUIRED`;
- backend validates `modeSlug = image-arena` and that selected models have image output capability;
- images are uploaded to Supabase Storage bucket `images` when the server storage client and provider download are available; in alpha degraded mode the response may return the provider URL when storage upload is unavailable or fails;
- frontend does NOT call image providers directly — only `POST /api/image-compare`;
- response contains image URLs/metadata, not binary image data or provider secrets;
- safe errors include `AUTH_REQUIRED`, `RATE_LIMIT`, `VALIDATION_ERROR`, `INTERNAL_ERROR`.

## `GET /api/profile`

Возвращает профиль текущего аутентифицированного пользователя.

> **Identity:** только верифицированный пользователь Supabase (auth-cookie через `getAuthenticatedUserId`). Гостевая `na_guest` cookie не принимается — без сессии возвращается `401 AUTH_REQUIRED`.

Минимальный ответ:

```json
{
  "status": "success",
  "profile": {
    "id": "user-uuid",
    "email": "user@example.com",
    "displayName": "Display name or null",
    "firstName": "Display name or null",
    "lastName": "Display name or null",
    "avatarUrl": null,
    "role": "user",
    "plan": "free",
    "createdAt": "2026-06-20T10:00:00.000Z",
    "updatedAt": "2026-06-20T10:00:00.000Z"
  }
}
```

Rules:
- Требуется аутентифицированная сессия Supabase; без неё — `401 AUTH_REQUIRED`.
- Данные читаются из таблицы `profiles` по `id = userId` (`.single()`); если строка не найдена или ошибка запроса — `404 PROFILE_NOT_FOUND`.
- Если серверный клиент Supabase не сконфигурирован — `500 INTERNAL_ERROR`.
- Поля `email`, `displayName`, `firstName`, `lastName`, `avatarUrl` могут быть `null`; `role`/`plan` при отсутствии дефолтятся в `"user"`/`"free"`.
- Read-only; rate limit не применяется.
- safe errors include `AUTH_REQUIRED`, `PROFILE_NOT_FOUND`, `INTERNAL_ERROR`.

## `PATCH /api/profile`

Обновляет редактируемые поля профиля текущего пользователя: `displayName`, `firstName`, `lastName`.

> **Identity:** только верифицированный пользователь Supabase; обновляется строка `profiles` с `id = userId`.

Минимальный запрос:

```json
{
  "displayName": "Display name or null"
}
```

Минимальный ответ:

```json
{
  "status": "success"
}
```

Rules:
- Требуется аутентифицированная сессия Supabase; без неё — `401 AUTH_REQUIRED`.
- Тело должно быть валидным JSON, иначе — `400 INVALID_JSON`.
- Принимаются только ключи `displayName`, `firstName`, `lastName`; строковое значение обрезается (`trim()`), пустая строка → `null`, нестроковое → `null`.
- Любое значение длиной более 60 символов → `400 VALIDATION_ERROR`.
- Если ни одно из трёх полей не присутствует → `400 VALIDATION_ERROR` ("No valid fields to update.").
- Ответ не содержит обновлённый профиль (только `status`); за чтением полей — `GET /api/profile`. Rate limit не применяется.
- safe errors include `AUTH_REQUIRED`, `INVALID_JSON`, `VALIDATION_ERROR`, `INTERNAL_ERROR`.

## `POST /api/profile/avatar`

Загружает аватар пользователя в Supabase Storage (бакет `avatars`) и сохраняет подписанный URL в `profiles.avatar_url`.

> **Identity:** требуется аутентифицированный пользователь — `userId` из Supabase auth-cookie (`getAuthenticatedUserId`); guest-сессии не поддерживаются.

Тело запроса — `multipart/form-data` с полем `file` (не JSON):

```text
Content-Type: multipart/form-data; boundary=...

file=<binary image data>   # image/jpeg | image/png | image/webp, ≤ 2 MB
```

Минимальный ответ:

```json
{
  "status": "success",
  "avatarUrl": "https://<project>.supabase.co/storage/v1/object/sign/avatars/user-uuid/avatar.jpg?token=..."
}
```

Rules:
- Auth обязательна: без валидной Supabase user-cookie — `401 AUTH_REQUIRED`.
- Rate limit: 5 запросов / 60 сек на пользователя (ключ `avatar:user:{userId}`, общий с `DELETE`); превышение → `429 RATE_LIMIT` с заголовком `Retry-After`.
- Тело должно быть `multipart/form-data`; иначе `400 INVALID_REQUEST`.
- Поле `file` обязательно и должно быть `File`; иначе `400 VALIDATION_ERROR`.
- Допустимые MIME: `image/jpeg`, `image/png`, `image/webp`; максимальный размер 2 MB; нарушение → `400 VALIDATION_ERROR`.
- Файл сохраняется по пути `avatars/{userId}/avatar.{ext}` с `upsert: true` (перезаписывает существующий).
- После успешной загрузки best-effort удаляются устаревшие варианты других расширений (`avatar.jpg|png|webp`, кроме текущего); сбой очистки не влияет на ответ.
- При ошибке загрузки в Storage — `500 UPLOAD_FAILED`; при ошибке генерации подписанного URL (TTL 1 год) или несконфигурированном клиенте — `500 INTERNAL_ERROR`.
- Обновление `profiles.avatar_url` не фатально: при ошибке записи ответ всё равно `200` с `avatarUrl`.
- safe errors include `AUTH_REQUIRED`, `RATE_LIMIT`, `INVALID_REQUEST`, `VALIDATION_ERROR`, `UPLOAD_FAILED`, `INTERNAL_ERROR`.

## `DELETE /api/profile/avatar`

Удаляет аватар пользователя из Supabase Storage и очищает `profiles.avatar_url`.

> **Identity:** требуется аутентифицированный пользователь — `userId` из Supabase auth-cookie (`getAuthenticatedUserId`).

Минимальный ответ:

```json
{
  "status": "success"
}
```

Rules:
- Auth обязательна: без валидной Supabase user-cookie — `401 AUTH_REQUIRED`.
- Rate limit: 5 запросов / 60 сек на пользователя (ключ `avatar:user:{userId}`, общий счётчик с `POST`); превышение → `429 RATE_LIMIT` с заголовком `Retry-After`.
- Если Supabase-клиент не сконфигурирован — `500 INTERNAL_ERROR`.
- Удаляет из бакета `avatars` все варианты расширений: `{userId}/avatar.jpg|png|webp` одним вызовом `remove`.
- Устанавливает `profiles.avatar_url = null`; результаты `remove`/update не проверяются — при отсутствии исключения возвращается `200`.
- safe errors include `AUTH_REQUIRED`, `RATE_LIMIT`, `INTERNAL_ERROR`.

## `POST /api/profile/email`

Запрашивает смену email текущего пользователя через Supabase Auth `updateUser({ email })`. Письма-подтверждения отправляются на старый и новый адрес; смена применяется только после подтверждения по обеим ссылкам. `profiles.email` напрямую не обновляется — синхронизацию выполняет триггер Supabase Auth.

> **Identity:** только авторизованный пользователь (сессия Supabase из cookie). Без сессии — `401 AUTH_REQUIRED`.

Минимальный запрос:

```json
{
  "newEmail": "user@example.com"
}
```

Минимальный ответ:

```json
{
  "status": "success",
  "message": "Confirmation emails sent to both addresses. Check your inbox."
}
```

Rules:
- Требуется авторизация; при отсутствии пользователя — `401 AUTH_REQUIRED`. Rate limit отсутствует.
- `newEmail` обязателен, строка; перед валидацией `trim()` + `toLowerCase()`. Пустое/нестроковое → `400 VALIDATION_ERROR`.
- Формат проверяется регуляркой `^[^\s@]+@[^\s@]+\.[^\s@]+$`; несоответствие → `400 VALIDATION_ERROR`.
- Новый адрес должен отличаться от текущего (case-insensitive), иначе → `400 VALIDATION_ERROR`. Невалидный JSON → `400 INVALID_JSON`.
- Side effect: `supabase.auth.updateUser({ email }, { emailRedirectTo })` (redirect на `${NEXT_PUBLIC_SITE_URL ?? origin}/auth/callback?next=/profile`).
- Если адрес уже занят (сообщение содержит `already registered`) → `409 EMAIL_IN_USE`; прочие ошибки Supabase / отсутствие конфигурации → `500 INTERNAL_ERROR`.
- safe errors include `AUTH_REQUIRED`, `INVALID_JSON`, `VALIDATION_ERROR`, `EMAIL_IN_USE`, `INTERNAL_ERROR`.

## `GET /api/profile/stats`

Возвращает агрегированную арена-статистику текущего авторизованного пользователя: число сравнений (tasks), ответов моделей, голосов и время последней активности.

> **Identity:** требуется авторизованный пользователь — `userId` из Supabase-сессии (`getAuthenticatedUserId`). Гостевая `na_guest`-cookie не принимается; без сессии — `401 AUTH_REQUIRED`.

Минимальный ответ:

```json
{
  "status": "success",
  "stats": {
    "totalComparisons": 0,
    "totalResponses": 0,
    "totalVotes": 0,
    "lastActiveAt": "2026-06-20T10:00:00.000Z"
  }
}
```

Rules:
- Требуется авторизация; при отсутствии `userId` — `401 AUTH_REQUIRED`.
- `totalComparisons` — `count` строк `tasks` по `user_id`; `totalVotes` — `count` строк `votes` по `user_id`.
- `totalResponses` — `count` строк `model_responses` по `task_id IN (...)`; список task-id ограничен `limit(500)`, поэтому для пользователей с большим числом задач значение может быть занижено.
- `lastActiveAt` — `created_at` самой свежей задачи или `null`, если задач нет.
- Если Supabase-клиент недоступен — `200` с нулевой статистикой и `lastActiveAt: null` (ошибка не выбрасывается). Ошибка любого запроса → `500 INTERNAL_ERROR`.
- safe errors include `AUTH_REQUIRED`, `INTERNAL_ERROR`.

## `GET /api/health`

Публичный health-check: сообщает агрегированный статус сервиса и конфигурацию/доступность Supabase, OpenRouter и каталога моделей. Всегда отвечает HTTP 200, здоровье выражается полем `status`.

Минимальный ответ:

```json
{
  "status": "ok",
  "version": "1.7.0-alpha.1",
  "vercel": {
    "environment": "production",
    "commit": "abc1234"
  },
  "services": {
    "supabase": { "configured": true, "reachable": true, "activePublicModels": 0 },
    "openRouter": { "configured": true },
    "modelCatalog": { "status": "ok", "publicModels": 0, "error": null }
  }
}
```

Rules:
- Public route: no auth, no cookies, no rate limit.
- HTTP-код всегда `200`; `status` принимает только `"ok"` или `"degraded"`.
- `status === "ok"` только когда одновременно: Supabase сконфигурирован (`NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`), OpenRouter сконфигурирован (`OPENROUTER_API_KEY`), Supabase достижим (`reachable !== false`), каталог собрался без ошибки и `publicModels > 0`; иначе `"degraded"`.
- `version` = `npm_package_version` или `null`; `vercel.environment` = `VERCEL_ENV` или `null`; `vercel.commit` = первые 7 символов `VERCEL_GIT_COMMIT_SHA` или `null`.
- `supabase.reachable`: `true`/`false` после count-запроса к `models` (`is_active = true and is_public = true`), либо `null`, если клиент не сконфигурирован.
- `supabase.activePublicModels` / `modelCatalog.publicModels`: число или `null` при ошибке/несконфигурированном клиенте; `modelCatalog.error` — строка сообщения при сбое сборки каталога, иначе `null`.
- safe errors include `none` — сбои деградируют поля ответа, а не HTTP-статус (всегда `200`).

## `GET /api/leaderboard`

Публичный рейтинг моделей: для каждой модели агрегируются число «битв» (ответов в `model_responses`) и побед (голоса `votes` с `vote_type = 'best'`), считается win-rate и место. Деградирует мягко — при отсутствии данных или ошибке БД возвращает пустой массив, а не 500.

> **Identity:** идентичность вычисляется, но на результат не влияет — эндпойнт публичный, рейтинг одинаков для гостя и авторизованного пользователя.

Минимальный ответ:

```json
{
  "status": "success",
  "data": [
    {
      "modelId": "model-uuid",
      "modelName": "Model display name",
      "badge": ["Free"],
      "wins": 0,
      "totalBattles": 0,
      "winRate": 0,
      "rank": 1
    }
  ]
}
```

Rules:
- Публичный: auth не требуется.
- Rate limit: 60 запросов / 60 000 мс, ключ `leaderboard:<ip>` (ip = `x-forwarded-for` → `x-real-ip` → `"anonymous"`). При превышении — `429` с заголовком `Retry-After`.
- `modelName` — это `models.display_name`; колонок `name`/`badge` в таблице нет. `badge` — массив из 0–1 строки, выводится через `badgeFromTags()` (`"Free Coding"` / `"Free Reasoning"` / `"Free Fast"` / `"Free"` или `[]`).
- `winRate = wins / totalBattles` (0 при `totalBattles === 0`); в выдачу попадают только модели с `totalBattles > 0`. Сортировка по `winRate`, затем `wins`; `rank` присваивается 1..N.
- Пустой `data` (`[]`) со `status: "success"` при отсутствии Supabase-клиента, отсутствии «битв» или ошибке любого из запросов — без выброса 500.
- safe errors include `RATE_LIMIT`, `INTERNAL_ERROR`.

## `GET /api/stats`

Возвращает агрегированную статистику текущей идентичности (пользователя или гостя): количество задач, голосов, разбивку задач по режимам и топ моделей-победителей.

> **Identity:** требуется идентичность — авторизованный пользователь (cookie сессии) или гость (cookie `na_guest`). При `kind === "none"` возвращается `401` с телом `{ "error": { "code": "AUTH_REQUIRED" } }` (плоский объект, НЕ формат `createErrorResponse`).

Минимальный ответ:

```json
{
  "stats": {
    "totalTasks": 0,
    "totalVotes": 0,
    "modeCounts": { "mode-slug": 0 },
    "topModels": [
      { "display_name": "Model display name", "count": 0 }
    ]
  }
}
```

Rules:
- Если Supabase-клиент не сконфигурирован — `200` с телом `{ "stats": null }`. Rate limit отсутствует.
- `modeCounts` — объект `{ mode_slug: count }`; пустой `{}`, если задач нет.
- `topModels` — до 10 элементов, отсортировано по убыванию `count`; имя из `model_responses.display_name`, при отсутствии — `model_key`, иначе `"Unknown"`.
- `totalVotes` — сумма `count` по `topModels`; список task_id для подсчёта ограничен `limit(500)`. Победы считаются по голосам `vote_type = 'best'` (через `votes.model_response_id` → `model_responses`).
- safe errors include `AUTH_REQUIRED`, `INTERNAL_ERROR`.

## `GET /api/usage`

Возвращает текущий дневной расход запросов и лимит для идентичности (пользователь или гость), а также её тарифный план.

> **Identity:** требуется аутентифицированный пользователь (cookie сессии) ИЛИ гость с cookie `na_guest`. При `kind: "none"` возвращается `401` с телом `{ "error": "AUTH_REQUIRED" }`.

Минимальный ответ:

```json
{
  "used": 0,
  "limit": 5,
  "plan": "anonymous"
}
```

Rules:
- Read-only; выделенного rate-limit для маршрута нет — `used`/`limit` отражают дневную квоту создания задач, а не лимит обращений к эндпоинту.
- `used` — число задач (`tasks`) текущей идентичности с начала суток UTC (фильтр по `user_id` или `anonymous_session_id`); при недоступном клиенте `used = 0`.
- `limit` по плану: гость/аноним `5`, `free` `20`, `pro` `100`, admin (`profiles.role === "admin"`) `9999`. При отсутствии профиля/клиента — `20` (free).
- `plan` — одно из `"anonymous"`, `"free"`, `"pro"`, `"admin"`. Для гостя всегда `"anonymous"`; для пользователя — из `profiles.role`/`profiles.plan`, при отсутствии профиля/клиента — `"free"`.
- safe errors include `AUTH_REQUIRED`.

## `POST /api/stream-compare`

Стримит ответы 2–5 выбранных моделей на один промпт через Server-Sent Events (SSE) и best-effort сохраняет прогон в историю. Ответ — `text/event-stream`, а не JSON.

> **Identity:** доступ для верифицированного пользователя (auth-cookie Supabase) ИЛИ гостя по httpOnly-cookie `na_guest`. Личность определяется через `resolveRequestIdentity` и никогда не берётся из тела. При `kind: "none"` → `401 AUTH_REQUIRED`. Для гостя в ответ ставится cookie `na_guest` (HttpOnly, SameSite=Lax, Max-Age 30 дней).

Минимальный запрос:

```json
{
  "prompt": "Текст запроса (3–8000 символов)",
  "modelIds": ["model-selection-id", "model-selection-id"],
  "modeSlug": "prompt-arena"
}
```

Минимальный ответ (SSE-поток `text/event-stream`, последовательность событий):

```text
event: model_start
data: {"modelId":"model-selection-id","modelName":"Model display name","modelRole":"General-модель"}

event: model_token
data: {"modelId":"model-selection-id","token":"часть ответа"}

event: model_done
data: {"modelId":"model-selection-id","response":{"id":"model-response-uuid","modelId":"model-selection-id","modelName":"Model display name","status":"success","answerText":"полный текст","latencyMs":1234}}

event: complete
data: {"status":"success","taskId":"task-uuid","responses":[{"id":"model-response-uuid","modelId":"model-selection-id","modelName":"Model display name","status":"success","answerText":"полный текст","latencyMs":1234,"errorCode":null,"errorMessage":null}]}
```

При ошибке конкретной модели вместо `model_done` отправляется `model_error` (`response.status: "error"`, заполнены `errorCode`/`errorMessage`). Pre-stream ошибки возвращаются как JSON (не SSE).

Rules:
- Тело: `prompt` 3–8000 символов (иначе `400 VALIDATION_ERROR`); `modelIds` — массив из 2–5 непустых уникальных строк-`selectionId` (иначе `400 VALIDATION_ERROR`); `modeSlug` опционален (default `"prompt-arena"`), допустимы `prompt-arena`/`code-arena` (иначе `400 INVALID_MODE`). Невалидный JSON → `400 INVALID_JSON`.
- Auth: пользователь или гость; `kind: "none"` → `401 AUTH_REQUIRED`.
- Дневной лимит (`checkDailyLimit`, по `tasks` за сутки UTC; anonymous=5/free=20/pro=100/admin=9999): превышение → `429` с телом `{ "error": "DAILY_LIMIT_EXCEEDED", "used", "limit", "message" }`.
- Rate limit: ключ `stream-compare:user:<id>` / `stream-compare:guest:<id>`; пользователь 10 / гость 5 запросов за 60 000 мс; превышение → `429 RATE_LIMIT` с `Retry-After: 60`.
- `resolveSelectedModels` сверяет `selectionId` с каталогом и access level: неизвестный id или недоступный уровень → `403 MODEL_NOT_ALLOWED`. OpenRouter `model_key` в ответ не попадает.
- Per-model статус приходит в `model_done`/`model_error`; HTTP-статус потока остаётся 200. `complete.status` = `"success"`, если успешен хотя бы один ответ, иначе `"error"`. Прогон сохраняется best-effort (`taskId` может быть `null`).
- safe errors include `AUTH_REQUIRED`, `DAILY_LIMIT_EXCEEDED`, `RATE_LIMIT`, `INVALID_JSON`, `INVALID_MODE`, `VALIDATION_ERROR`, `MODEL_NOT_ALLOWED` (pre-stream JSON); in-stream per-model: `RATE_LIMIT`, `PROVIDER_ERROR`, `OPENROUTER_ERROR`, `NETWORK_ERROR`, `ABORTED`.

## `GET /api/tasks/[taskId]`

Возвращает одну задачу Arena по её UUID вместе со всеми ответами моделей и id ответа-победителя. Публичный, без авторизации.

> **Identity:** публичный маршрут — куки/идентичность не проверяются; любой клиент может прочитать задачу по её UUID.

Минимальный ответ:

```json
{
  "task": {
    "id": "task-uuid",
    "modeSlug": "prompt-arena",
    "prompt": "User prompt text",
    "title": "Display name or null",
    "status": "completed",
    "createdAt": "2026-06-20T10:00:00.000Z",
    "settings": {},
    "winnerResponseId": "model-response-uuid",
    "judgeVerdict": null,
    "responses": [
      {
        "id": "model-response-uuid",
        "modelKey": "provider/model-key",
        "modelName": "Model display name",
        "status": "completed",
        "answerText": "Model answer text or null"
      }
    ]
  }
}
```

Rules:
- Auth: нет (public). Rate limit отсутствует.
- `taskId` обязан соответствовать `/^[0-9a-f-]{36}$/`; иначе `400 INVALID_ID`. Если Supabase-клиент недоступен → `503 DB_UNAVAILABLE`.
- `title` → `null`, `settings` → `{}`, `judgeVerdict` → `null` при отсутствии. В `responses[]`: `modelName` = `display_name` или `model_key`; `answerText` → `null`; `latencyMs`/`errorCode`/`errorMessage` опускаются, если отсутствуют.
- Коды `400/404/503` возвращаются в форме `{ "error": { "code": "..." } }`; путь `500` — в форме `{ "status": "error", "errorCode": "INTERNAL_ERROR", "message": "..." }`.
- `winnerResponseId` — `model_response_id` из голоса с `vote_type = 'best'` (через вложенный `votes(id, model_response_id, vote_type)`), иначе `null`.
- safe errors include `INVALID_ID`, `DB_UNAVAILABLE`, `NOT_FOUND`, `INTERNAL_ERROR`.

## `POST /api/guest`

Создаёт или переиспользует анонимную гостевую сессию: при валидном cookie `na_guest` обновляет `last_seen_at` и возвращает существующие данные, иначе создаёт строку в `anonymous_sessions` и ставит httpOnly cookie. Перед public release требуется abuse/rate-limit review (см. release-gate note выше).

> **Identity:** публичный маршрут. Identity берётся из httpOnly cookie `na_guest` (UUID). Тело запроса не читается. На ответе всегда выставляется/обновляется cookie `na_guest` (sameSite `lax`, `secure` в production, `path=/`, maxAge 1 год).

Минимальный запрос:

```json
{}
```

Минимальный ответ:

```json
{
  "status": "success",
  "sessionId": "user-uuid",
  "displayName": "Анонимус #1234",
  "avatarSeed": "ab12cd34",
  "colorSeed": "ef56gh78",
  "isNew": true
}
```

Rules:
- Публичный: auth не требуется, rate limit отсутствует. Тело и query-параметры не читаются.
- При валидном cookie `na_guest`, совпадающем со строкой в `anonymous_sessions`: статус `200`, `isNew: false`, поля из БД, `last_seen_at` обновляется best-effort.
- При отсутствии/невалидном cookie создаётся новая строка: статус `201`, `isNew: true`. `displayName` в формате `Анонимус #XXXX`; `avatarSeed`/`colorSeed` — короткие base36-строки.
- Если Supabase не сконфигурирован — новая сессия создаётся локально (`crypto.randomUUID()`, `201`, `isNew: true`), без записи в БД.
- При ошибке INSERT в `anonymous_sessions` (Supabase сконфигурирован) — `500 INTERNAL_ERROR`.
- safe errors include `INTERNAL_ERROR`.

## Request ID (v0.8)

Все history endpoints генерируют (или принимают входной) `x-request-id` и возвращают его
в заголовке ответа, в теле успешного ответа (`requestId`) и в теле ошибки. Логи сервера
содержат `rid=<requestId>` для корреляции. Секреты, cookie и Authorization headers не логируются.

## Related Docs

- `09-api-structure.md` - подробная структура API.
- `12-security-and-env.md` - правила безопасности API и env.
