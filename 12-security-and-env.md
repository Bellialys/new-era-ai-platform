# 12 - Безопасность и переменные окружения

## Назначение

Этот документ определяет правила безопасности для проекта **Новая эпоха**.

Цель - защитить:

- OpenRouter API keys;
- Supabase project keys;
- Vercel environment variables;
- локальный файл `.env.local`;
- историю GitHub репозитория;
- пользовательские данные;
- историю AI-запросов;
- голоса и данные будущего Leaderboard;
- будущие платные лимиты;
- будущий Code Arena Runner sandbox;
- будущую admin panel.

Этот файл должен быть согласован с:

- `02-project-plan.md`;
- `04-mvp-scope.md`;
- `07-architecture.md`;
- `08-database.md`;
- `09-api-structure.md`;
- `11-ai-models.md`;
- `14-roadmap.md`;
- `16-decisions.md`;
- `17-code-arena-spec.md`;
- `18-team-mode-spec.md`;
- `31-image-arena-spec.md`.

`14-roadmap.md` является главным источником порядка версий.

---

# 1. Главный принцип безопасности

Секреты никогда не должны быть видны во frontend-коде, browser requests, публичных логах, GitHub commits, screenshots, примерах документации или API responses.

Правильный поток:

```text
Browser
# только пользовательский интерфейс

Next.js API route
# защищённый backend layer

OpenRouter API
# вызывается только из backend

Supabase
# база данных защищается через RLS и server-side rules
```

Неправильный поток:

```text
Browser -> OpenRouter directly
# запрещено, потому что OpenRouter API key будет раскрыт

Browser -> Supabase service role key
# запрещено, потому что service role key обходит RLS

GitHub -> real .env.local
# запрещено, потому что секреты будут раскрыты
```

Если secret key был закоммичен, опубликован, отправлен, записан в лог или показан на screenshot, его нужно считать скомпрометированным.

Обязательное действие после утечки:

```text
Revoke old key.
# старый утёкший ключ больше нельзя использовать

Create new key.
# сразу выполнить ротацию credentials

Update .env.local and Vercel variables.
# заменить скомпрометированное значение везде

Check Git history.
# убедиться, что секрет больше не виден в истории
```

---

# 2. Что считается секретом

Секрет - это любое значение, которое может тратить деньги, открывать доступ к приватным данным, изменять базу данных, выполнять deploy приложения или управлять infrastructure.

## 2.1 Критические секреты

```env
OPENROUTER_API_KEY=
# приватный ключ для AI model requests, может тратить деньги

SUPABASE_SERVICE_ROLE_KEY=
# приватный Supabase key, обходит Row Level Security, только server-side

DATABASE_URL=
# прямой database connection string, только server-side

VERCEL_TOKEN=
# token для Vercel automation, приватный

GITHUB_TOKEN=
# token для GitHub automation, приватный

JWT_SECRET=
# будущий секрет для подписи token, приватный

STRIPE_SECRET_KEY=
# будущий payment secret, приватный

ADMIN_SECRET=
# необязательный внутренний admin secret, приватный

UPSTASH_REDIS_REST_URL=
# URL Upstash Redis для production rate limiting; без него каждый serverless instance
# считает лимиты независимо — rate limit де-факто не работает между репликами
# Vercel Marketplace Upstash alias: KV_REST_API_URL

UPSTASH_REDIS_REST_TOKEN=
# токен доступа к Upstash Redis; обязателен вместе с UPSTASH_REDIS_REST_URL
# Vercel Marketplace Upstash alias: KV_REST_API_TOKEN

VERCEL_AUTOMATION_BYPASS_SECRET=
# секрет Vercel Deployment Protection для автоматических smoke/e2e проверок protected Preview
```

Эти значения никогда нельзя раскрывать client-side.

## 2.2 Публичные значения окружения

Некоторые значения могут быть публичными, потому что сами по себе не дают полного доступа.

```env
NEXT_PUBLIC_SUPABASE_URL=
# публичный Supabase project URL

NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
# публичный Supabase publishable key, безопасен только при включённом RLS

NEXT_PUBLIC_SITE_URL=
# публичный site URL
```

> **Примечание:** часть feature-флагов больше не обязательна для обычной локальной сборки.
> Для production activation AI Team Mode флаги `NEXT_PUBLIC_ENABLE_TEAM_MODE=true`
> и `ENABLE_TEAM_MODE=true` обязательны: первый включает UI, второй разрешает backend `/api/team-run`.

Важное правило:

```text
NEXT_PUBLIC_ means visible in browser.
# никогда не помещать секреты в NEXT_PUBLIC variables
```

---

# 3. Локальный файл окружения

Локальная разработка использует `.env.local` в корне проекта.

Текущая структура проекта:

```text
new-era-ai-platform/
# корень репозитория

.env.local
# локальные секреты, не коммитить

.env.example
# безопасный пример переменных окружения

package.json
# зависимости и команды проекта

package-lock.json
# точные версии зависимостей после npm install, нужно закоммитить

src/
# код Next.js приложения
```

Папка `docs/` не является обязательной текущей структурой. Документация проекта сейчас лежит в корне репозитория.

## 3.1 Рекомендуемый `.env.local`

```env
OPENROUTER_API_KEY=your_openrouter_api_key_here
# server-only OpenRouter API key

NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url_here
# public Supabase URL

NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key_here
# public Supabase publishable key, безопасен только при включённом RLS

SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
# server-only Supabase service role key

DATABASE_URL=your_database_url_here
# optional direct database URL for migrations and server operations

NEXT_PUBLIC_SITE_URL=http://localhost:3000
# local public site URL

APP_ENV=development
# development, preview или production

UPSTASH_REDIS_REST_URL=https://your-upstash-endpoint.upstash.io
# URL Upstash Redis — обязателен для production rate limiting между serverless instances
# Vercel Marketplace Upstash alias: KV_REST_API_URL

UPSTASH_REDIS_REST_TOKEN=your_upstash_token_here
# токен Upstash Redis — server-only, никогда не в NEXT_PUBLIC_
# Vercel Marketplace Upstash alias: KV_REST_API_TOKEN

VERCEL_AUTOMATION_BYPASS_SECRET=your_vercel_automation_bypass_secret
# опционально: только для smoke/e2e против protected Vercel Preview

OPENROUTER_MAX_TOKENS=2048
# максимум токенов в ответе модели; можно переопределить без деплоя
```

> **Убрано из обязательных build env:** `NEXT_PUBLIC_ENABLE_CODE_ARENA`, `ENABLE_CODE_RUNNER`,
> `MIN_PROMPT_LENGTH`, `MAX_PROMPT_LENGTH`, `MAX_MODELS_PER_COMPARE` — эти значения заменены
> константами в `src/lib/arena/constants.ts`.
>
> **Production activation exception:** `NEXT_PUBLIC_ENABLE_TEAM_MODE` и `ENABLE_TEAM_MODE`
> читаются runtime-кодом Team Mode. Для включения Team Mode в production они должны быть выставлены
> в Vercel Production вместе с Upstash Redis env.

## 3.2 Что нельзя делать

```text
Do not commit .env.local.
# реальные секреты не должны попасть в Git history

Do not send .env.local in chat.
# реальные секреты нельзя отправлять в чат

Do not paste real keys into Markdown documentation.
# документация может стать публичной

Do not place real keys in frontend files.
# frontend code виден браузеру

Do not use NEXT_PUBLIC_ for private keys.
# такие переменные попадут в клиентский bundle
```

---

# 4. `.env.example`

Файл `.env.example` можно хранить в GitHub, потому что он содержит только пустые значения или безопасные placeholder-значения.

Правильный пример:

```env
OPENROUTER_API_KEY=
# server-only OpenRouter API key, не заполнять реальным ключом в GitHub

NEXT_PUBLIC_SUPABASE_URL=
# public Supabase URL

NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
# public Supabase publishable key, безопасен только при включённом RLS

SUPABASE_SERVICE_ROLE_KEY=
# server-only key, не использовать на клиенте

DATABASE_URL=
# optional server-only database URL

NEXT_PUBLIC_SITE_URL=http://localhost:3000
# public local site URL

APP_ENV=development
# development, preview или production

UPSTASH_REDIS_REST_URL=
# Upstash Redis URL для rate limiting (опционально локально, обязательно в production)
# Vercel Marketplace Upstash alias: KV_REST_API_URL

UPSTASH_REDIS_REST_TOKEN=
# Upstash Redis token (server-only)
# Vercel Marketplace Upstash alias: KV_REST_API_TOKEN

VERCEL_AUTOMATION_BYPASS_SECRET=
# Vercel Deployment Protection bypass secret для automation, server/CI only

OPENROUTER_MAX_TOKENS=2048
# максимум токенов в ответе модели
```

Неправильный пример:

```env
OPENROUTER_API_KEY=[REDACTED_OPENROUTER_KEY]
# реальный ключ нельзя хранить в GitHub

NEXT_PUBLIC_OPENROUTER_API_KEY=[REDACTED_OPENROUTER_KEY]
# критическая ошибка: ключ попадёт в браузер
```

---

# 5. OpenRouter безопасность

OpenRouter подключается только с `v0.4 - OpenRouter Integration`.

Правильная схема:

```text
Frontend -> /api/compare -> OpenRouter
# ключ хранится только server-side
```

Неправильная схема:

```text
Frontend -> OpenRouter
# ключ может попасть в browser request
```

Backend обязан:

- брать `OPENROUTER_API_KEY` только из server-side environment;
- проверять allowlist моделей;
- не принимать произвольный `modelKey` от пользователя;
- ограничивать количество моделей;
- ограничивать длину prompt;
- ставить timeout на ответ модели;
- возвращать пользователю безопасную ошибку без stack trace;
- не логировать полный secret-bearing request.

---

# 6. Supabase безопасность

Supabase подключён и стабилизирован в `v0.5.2 - Supabase, migrations and health stabilization`.

Правила:

```text
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
# можно использовать на клиенте только вместе с RLS

SUPABASE_SERVICE_ROLE_KEY
# только server-side, нельзя отправлять в браузер

RLS
# должен быть включён для пользовательских данных
```

Таблицы MVP:

```text
models
# список разрешённых моделей

tasks
# задачи пользователей

model_responses
# ответы моделей

votes
# голоса пользователей
```

Для будущих аккаунтов использовать:

```text
profiles
# публичный профиль пользователя

auth.users
# системная таблица Supabase Auth
```

Не создавать вручную публичную таблицу `users` как основной источник истины для аккаунтов.

---

# 7. API validation

Backend обязан повторно проверять всё, что пришло с frontend.

Минимальная валидация `/api/compare`:

```text
prompt required
# prompt должен быть строкой

prompt.trim().length >= 3
# пустой prompt нельзя отправлять

prompt.length <= 8000
# лимит должен совпадать с MAX_PROMPT_LENGTH

modelIds.length >= 2
# сравнение требует минимум две модели

modelIds.length <= 3
# лимит MVP

modeSlug = prompt-arena
# для MVP разрешён только Prompt Arena
```

Минимальная валидация `/api/vote`:

```text
taskId required
# голос должен быть связан с задачей

responseId required
# голос должен быть связан с ответом

response.task_id = taskId
# нельзя голосовать за ответ из другой задачи
```

---

# 8. Error handling

Пользователь должен видеть понятную ошибку, но не должен видеть внутренние детали.

Правильно:

```json
{
  "status": "error",
  "errorCode": "VALIDATION_ERROR",
  "message": "Проверьте данные запроса."
}
```

Неправильно:

```text
Error: OPENROUTER_API_KEY is [REDACTED_OPENROUTER_KEY]...
# секрет нельзя показывать в ошибке

Database stack trace with connection string
# внутренние детали нельзя отдавать пользователю
```

Для частичной ошибки модели в `/api/compare` используется карточка ответа со статусом `error`:

```json
{
  "id": "uuid-response-2",
  "modelId": "uuid-model-2",
  "modelName": "Model B",
  "status": "error",
  "answerText": null,
  "errorCode": "MODEL_TIMEOUT",
  "errorMessage": "Модель не успела ответить."
}
```

---

# 9. GitHub правила

В GitHub можно хранить:

```text
.env.example
# безопасный пример переменных

package-lock.json
# lock-файл зависимостей, не секрет

Markdown документацию
# без реальных ключей

src/
# код приложения без секретов
```

В GitHub нельзя хранить:

```text
.env.local
# локальные секреты

.env.production
# production-секреты

real API keys
# любые настоящие ключи

private database dumps
# приватные данные пользователей
```

После локального `npm install` нужно закоммитить `package-lock.json`:

```bash
git add package-lock.json
# добавить lock-файл зависимостей

git commit -m "chore: add package lock"
# зафиксировать точные версии зависимостей
```

---

# 10. Запреты до нужных версий

## До `v1.7`

Запрещено запускать пользовательский код.

```text
Code Arena Runner
# только v1.7 после sandbox, лимитов и security review
```

## До `v2.0`

Запрещено делать полноценный AI Team Mode.

```text
AI Team Mode
# только после стабильной Prompt Arena, Judge Mode, Leaderboard, Accounts и Admin Limits
```

---

# 11. Проверка перед commit

Перед важным commit нужно проверить:

```bash
npm run typecheck
# проверить TypeScript

npm run lint
# проверить ESLint

npm run build
# проверить production-сборку

git status
# проверить список изменённых файлов
```

Перед push нужно убедиться:

```text
.env.local отсутствует в git status.
# секреты не попадут в GitHub

package-lock.json добавлен после npm install.
# версии зависимостей будут зафиксированы

API keys не вставлены в Markdown.
# документация безопасна

OpenRouter key не имеет NEXT_PUBLIC_ prefix.
# ключ не попадёт в браузер
```

---

# 12. Итог

Главное правило безопасности проекта:

```text
Frontend показывает интерфейс.
# без секретов

Backend вызывает OpenRouter и Supabase.
# все секреты остаются server-side

GitHub хранит код, документацию и package-lock.json.
# но не хранит .env.local и реальные ключи
```

---

# Актуализация безопасности v0.5

В текущей версии реализовано:

- OpenRouter API key читается только на server side;
- frontend не получает `OPENROUTER_API_KEY`;
- browser Supabase client использует только `NEXT_PUBLIC_SUPABASE_URL` и `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`;
- server Supabase client использует `NEXT_PUBLIC_SUPABASE_URL` и `SUPABASE_SERVICE_ROLE_KEY`;
- service role key не используется в frontend и не имеет префикса `NEXT_PUBLIC_`;
- список моделей проверяется на backend;
- `/api/models` читает Supabase catalog с hardcoded fallback;
- `modeSlug` проверяется на backend;
- все три endpoint защищены rate limit: `/api/models` (60 req/мин по IP), `/api/compare` (10 req/мин по user/guest), `/api/vote` (30 req/мин по user/guest);
- rate limit использует Upstash Redis в production (глобальный, между serverless instances) с in-memory fallback для локальной разработки; без `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` или Vercel Marketplace aliases `KV_REST_API_URL`/`KV_REST_API_TOKEN` production остаётся на per-instance fallback и не проходит release gate;
- `/api/compare` best-effort сохраняет `tasks` и `model_responses`;
- RLS и grants для текущих таблиц описаны Supabase migrations;
- неизвестные ошибки скрываются за `INTERNAL_ERROR`;
- пользовательские ошибки возвращаются как контролируемые `ApiError`;
- OpenRouter prompt body не логируется;
- Authorization headers не логируются.

Что добавить позже:

```text
Prompt privacy policy
# явно описать, что отправляется в OpenRouter

Cost limit
# ограничить дорогие модели и количество запросов

Supabase RLS
# регулярно проверять политики при добавлении votes/history/accounts
```

---

# Будущие риски Image Arena / Visual Arena

Image Arena не входит в первый MVP и должна быть отложена до стабильной Prompt Arena, Storage, лимитов и safety-контролей.

Основные риски:

- высокая стоимость image generation по сравнению с обычным текстовым prompt;
- быстрый расход лимитов при выборе 2-3 моделей;
- большие файлы и рост затрат на Storage;
- необходимость moderation/safety rules для визуальных prompt;
- риск раскрытия secret keys при неправильном вызове provider API;
- риск сохранения файлов вне управляемого Storage.

Обязательные правила:

```text
Image generation только через backend.
# frontend не вызывает OpenRouter напрямую

Secret keys не выводятся во frontend.
# OPENROUTER_API_KEY и service role key остаются server-side

Изображения хранятся в Supabase Storage в стабильном режиме.
# PostgreSQL хранит только metadata и storage path; alpha backend может вернуть provider URL, если Storage upload/fetch недоступен

Количество генераций ограничено.
# нужны лимиты на пользователя, IP, модель и период времени

Image-capable модели проходят allowlist.
# нельзя разрешать произвольный model key из frontend
```

До появления этих контролей нельзя добавлять `/image-arena` и `/api/image-arena/generate` в код.
