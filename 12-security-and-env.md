# 12 - Безопасность и переменные окружения

## Назначение

Этот документ определяет правила безопасности для проекта **New Era AI**.

Цель - защитить:

- OpenRouter API keys;
- Supabase project keys;
- Vercel environment variables;
- локальные файлы `.env.local`;
- историю GitHub репозитория;
- пользовательские данные;
- историю AI-запросов;
- голоса и данные Leaderboard;
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
- `18-team-mode-spec.md`.

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
# база данных защищена через RLS и server rules
```

Неправильный поток:

```text
Browser -> OpenRouter directly
# запрещено, потому что OpenRouter API key будет раскрыт

Browser -> Supabase service role key
# запрещено, потому что service role обходит RLS

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
```

Эти значения никогда нельзя раскрывать client-side.

## 2.2 Публичные значения окружения

Некоторые значения могут быть публичными, потому что сами по себе не дают полного доступа.

```env
NEXT_PUBLIC_SUPABASE_URL=
# публичный Supabase project URL

NEXT_PUBLIC_SUPABASE_ANON_KEY=
# публичный Supabase anon key, безопасен только при включённом RLS

NEXT_PUBLIC_SITE_URL=
# публичный site URL

NEXT_PUBLIC_ENABLE_CODE_ARENA=
# публичный UI flag для видимости Code Arena

NEXT_PUBLIC_ENABLE_TEAM_MODE=
# публичный UI flag для видимости Team Mode
```

Важное правило:

```text
NEXT_PUBLIC_ means visible in browser.
# никогда не помещать секреты в NEXT_PUBLIC variables
```

---

# 3. Локальный файл окружения

Локальная разработка использует `.env.local` в корне проекта.

Пример структуры:

```text
new-era-ai/
  .env.local
  .env.example
  package.json
  src/
  docs/
```

## 3.1 Рекомендуемый `.env.local`

```env
OPENROUTER_API_KEY=your_openrouter_api_key_here
# server-only OpenRouter API key

NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url_here
# public Supabase URL

NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
# public Supabase anon key

SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
# server-only Supabase service role key

DATABASE_URL=your_database_url_here
# optional direct database URL for migrations and server operations

NEXT_PUBLIC_SITE_URL=http://localhost:3000
# local public site URL

APP_ENV=development
# development, preview или production

NEXT_PUBLIC_ENABLE_CODE_ARENA=false
# показывает или скрывает Code Arena в UI

ENABLE_CODE_RUNNER=false
# server-side flag для Code Arena Runner, должен оставаться false до v1.7

NEXT_PUBLIC_ENABLE_TEAM_MODE=false
# показывает или скрывает AI Team Mode в UI

ENABLE_TEAM_MODE=false
# server-side flag для AI Team Mode, должен оставаться false до v2.0
```

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
# NEXT_PUBLIC variables попадают в client bundle

Do not screenshot pages with visible keys.
# screenshots могут раскрыть секреты
```

---

# 4. `.env.example`

В репозитории должен быть `.env.example`, но не `.env.local`.

`.env.example` показывает необходимые имена переменных без реальных секретов.

Рекомендуемый `.env.example`:

```env
OPENROUTER_API_KEY=
# server-only OpenRouter API key

NEXT_PUBLIC_SUPABASE_URL=
# public Supabase URL

NEXT_PUBLIC_SUPABASE_ANON_KEY=
# public Supabase anon key

SUPABASE_SERVICE_ROLE_KEY=
# server-only Supabase service role key

DATABASE_URL=
# optional direct database URL

NEXT_PUBLIC_SITE_URL=http://localhost:3000
# local public site URL

APP_ENV=development
# development, preview или production

NEXT_PUBLIC_ENABLE_CODE_ARENA=false
# UI flag для Code Arena

ENABLE_CODE_RUNNER=false
# server flag для Code Arena Runner

NEXT_PUBLIC_ENABLE_TEAM_MODE=false
# UI flag для Team Mode

ENABLE_TEAM_MODE=false
# server flag для Team Mode
```

---

# 5. Правила `.gitignore`

Репозиторий должен игнорировать локальные секреты и временные файлы.

Рекомендуемые записи `.gitignore`:

```gitignore
.env
# игнорировать общий env file

.env.local
# игнорировать локальные секреты

.env.development.local
# игнорировать development secrets

.env.test.local
# игнорировать test secrets

.env.production.local
# игнорировать production secrets

.vercel
# игнорировать локальную Vercel configuration

.next
# игнорировать Next.js build output

node_modules
# игнорировать установленные dependencies

coverage
# игнорировать test coverage output

*.log
# игнорировать logs, которые могут содержать sensitive data
```

Проверка Git перед commit:

```bash
git status
# показывает изменённые файлы перед commit

git diff --cached
# позволяет проверить staged changes перед commit
```

---

# 6. Vercel Environment Variables

Vercel должен содержать те же обязательные environment variables, что и локальная разработка, но значения могут отличаться по environment.

Рекомендуемые группы Vercel:

```text
Development
# локальное и development testing

Preview
# pull request и branch deployments

Production
# реальный публичный проект
```

Правила:

```text
Use separate variables for Production.
# production не должен зависеть от локальных тестовых значений

Do not expose service role key to frontend.
# только API routes могут его использовать

Do not use expensive models by default in Preview.
# preview builds не должны тратить бюджет

Keep ENABLE_CODE_RUNNER=false before v1.7.
# Runner небезопасен до реализации sandbox

Keep ENABLE_TEAM_MODE=false before v2.0.
# Team Mode не входит в MVP
```

После изменения Vercel variables:

```bash
vercel env pull .env.local
# при необходимости подтягивает Vercel variables локально

npm run build
# проверяет, что проект собирается с текущими environment variables
```

---

# 7. Правила безопасности OpenRouter

OpenRouter должен вызываться только из server-side code.

Разрешённые места:

```text
src/app/api/arena/route.ts
# server API route для Prompt Arena

src/app/api/models/route.ts
# server API route для разрешённых моделей

src/lib/server/openrouter.ts
# server-only OpenRouter helper
```

Запрещённые места:

```text
React components
# client code не должен содержать API keys

Browser fetch directly to OpenRouter
# раскрывает usage control и может раскрыть request structure

NEXT_PUBLIC_OPENROUTER_API_KEY
# запрещённое имя переменной, никогда его не создавать
```

## 7.1 Server-only OpenRouter Helper

Рекомендуемый файл:

```text
src/lib/server/openrouter.ts
# helper, который используется только backend routes
```

Правила безопасности:

```text
Read OPENROUTER_API_KEY only on server.
# никогда не передавать ключ client-side

Use allowlisted model IDs.
# пользователи не должны отправлять произвольные платные model IDs

Validate prompt length.
# предотвращает чрезмерную стоимость и abuse

Set max_tokens.
# предотвращает неконтролируемую стоимость output

Set timeout.
# не даёт requests зависать

Handle provider errors.
# не раскрывает raw internal errors
```

## 7.2 Model Allowlist

Пользователям нельзя разрешать отправлять любой model ID по своему выбору.

Правильный подход:

```text
User selects model from UI.
# пользователь видит только разрешённые варианты

Backend receives model ID.
# backend не доверяет ему вслепую

Backend checks model ID in database or allowlist.
# разрешены только активные models

Backend sends request to OpenRouter.
# безопасный server-side call
```

Обязательные поля models определены в `08-database.md` и `11-ai-models.md`.

Для MVP backend должен проверять:

```text
is_active = true
# model включена

is_public = true
# model видна обычным пользователям

role_tags contains prompt
# model можно использовать в Prompt Arena

max_output_tokens is controlled
# model не может генерировать безлимитный output
```

---

# 8. Правила безопасности Supabase

Безопасность Supabase зависит от правильного использования ключей и Row Level Security.

## 8.1 Supabase Keys

```text
Anon key
# публичный, используется frontend, защищён RLS

Service role key
# приватный, только server-side, обходит RLS
```

Критическое правило:

```text
SUPABASE_SERVICE_ROLE_KEY must never be used in frontend code.
# он может обойти защиту базы данных
```

## 8.2 Row Level Security

RLS должен быть включён до хранения реальных пользователей или приватных данных.

Для MVP tables:

```sql
alter table public.models enable row level security;
-- защитить model table

alter table public.tasks enable row level security;
-- защитить submitted tasks

alter table public.model_responses enable row level security;
-- защитить AI responses

alter table public.votes enable row level security;
-- защитить voting data
```

Для публичного MVP чтение может быть открытым, но запись должна контролироваться через API routes.

Пример read policy для active public models:

```sql
create policy "Read active public models"
on public.models
for select
using (
  is_active = true
  and is_public = true
);
-- пользователи могут читать только активные публичные models
```

Принцип для записи:

```text
Do not allow direct public insert into sensitive tables unless it is intentionally designed.
# лучше использовать API routes для создания tasks, AI responses и votes
```

## 8.3 Использование Service Role

Service role можно использовать только в server-side API routes или доверенных backend scripts.

Разрешено:

```text
Server API route creates task.
# backend сначала валидирует input

Server API route saves AI response.
# backend контролирует model и output

Server API route calculates aggregate stats.
# backend контролирует query logic
```

Запрещено:

```text
Client component imports service role key.
# критическая утечка

Browser request contains service role key.
# критическая утечка

Public API returns service role key.
# критическая утечка
```

---

# 9. Безопасность API routes

Каждый API route должен валидировать input, применять limits и возвращать безопасные errors.

## 9.1 Обязательные проверки API

Для `/api/arena`:

```text
Check prompt exists.
# пустой prompt должен отклоняться

Check prompt length.
# длинные prompts могут создать высокую стоимость

Check selected models.
# можно использовать только разрешённые model IDs

Check model count.
# слишком много models создаёт высокую стоимость

Check request method.
# только POST должен создавать arena requests

Check timeout.
# long-running requests должны контролироваться

Check response size.
# избегать огромных database rows
```

Для `/api/vote`:

```text
Check task exists.
# vote должен относиться к реальной task

Check response exists.
# vote должен указывать на реальный model response

Check duplicate vote rules.
# предотвращает простой vote spam

Check IP or user identity later.
# более сильная защита после accounts
```

Для `/api/history`:

```text
Limit page size.
# предотвращает тяжёлые database reads

Order by creation date.
# предсказуемый порядок результата

Do not expose private metadata.
# не раскрывать internal data
```

## 9.2 Безопасные error responses

Нельзя возвращать raw internal errors в browser.

Плохой пример:

```text
Database connection failed with full connection string...
# раскрывает sensitive infrastructure data
```

Хороший пример:

```json
{
  "error": "Request failed. Please try again later."
}
```

Server logs могут содержать больше деталей, но не должны содержать secrets.

---

# 10. Защита от лишних расходов

AI requests могут тратить деньги. Проект должен контролировать usage до публичного запуска.

Минимальные MVP controls:

```text
Limit prompt length.
# уменьшает abuse и cost

Limit number of selected models.
# предотвращает дорогие multi-model requests

Use cheap or free models in development.
# защищает budget во время testing

Set max output tokens.
# предотвращает дорогие длинные answers

Disable very expensive models by default.
# использовать их только в специальных modes позже

Log model usage.
# нужно для будущих limits и debugging
```

Рекомендуемые MVP values:

```text
Max prompt length: 4000 characters
# достаточно для MVP tasks без неконтролируемой стоимости

Max selected models: 2 or 3
# достаточно для comparison mode

Max output tokens per model: 800 to 1500
# достаточно для readable answers

Request timeout: 45 to 60 seconds
# предотвращает зависание requests
```

Production values можно корректировать позже после реального testing.

---

# 11. Стратегия Rate Limit

Rate limiting нужно вводить поэтапно.

## 11.1 MVP Soft Limits

До accounts использовать простые controls:

```text
Limit prompt size.
# предотвращает огромные requests

Limit model count.
# предотвращает дорогие requests

Limit repeated vote attempts.
# уменьшает простой abuse

Limit history page size.
# защищает database reads
```

## 11.2 Более строгие лимиты после Accounts

После `v1.5 - Accounts and Profiles` добавить user-based limits:

```text
Daily request limit per user.
# контролирует cost

Daily vote limit per user.
# защищает Leaderboard

Model access by user role.
# разделяет free, trusted и admin usage

Usage logs.
# отслеживает cost и abuse
```

## 11.3 Лимиты Admin Panel

После `v1.6 - Admin Panel and Limits` добавить admin controls:

```text
Enable or disable model.
# контролировать доступность model

Set per-model request limit.
# контролировать дорогие models

Set global daily budget.
# защищать финансы проекта

Review suspicious usage.
# выявлять abuse
```

---

# 12. Защита от Prompt Injection

Prompt injection нельзя полностью устранить, но проект должен уменьшить возможный ущерб.

Главные правила:

```text
Do not put secrets into prompts.
# AI model никогда не должна получать API keys

Do not send service role key to AI models.
# критическая утечка секрета

Do not send internal database URLs to AI models.
# infrastructure leak

Do not trust AI output as code execution permission.
# AI output - это текст, не authority

Separate user prompt from system rules.
# backend контролирует instruction structure
```

Для будущего Judge Mode:

```text
Judge models must receive only necessary evaluation data.
# не раскрывать лишние user data

Judge output must be validated.
# model может вернуть malformed JSON

Judge must not decide billing or permissions alone.
# backend остаётся source of truth
```

---

# 13. Правила логирования

Logs полезны, но могут раскрывать sensitive data.

Разрешённые logs:

```text
request_id
# полезно для debugging

model_id
# полезно для cost tracking

status
# success или failed

duration_ms
# performance monitoring

created_at
# timeline debugging

error_type
# безопасная категория error
```

Опасные logs:

```text
OPENROUTER_API_KEY
# никогда не логировать

SUPABASE_SERVICE_ROLE_KEY
# никогда не логировать

full DATABASE_URL
# никогда не логировать

full raw headers
# могут содержать secrets

full cookies
# могут содержать session data

private user data
# избегать, если это не необходимо и не защищено
```

Для MVP допустимо логировать ограниченную prompt metadata, но нужно избегать хранения sensitive user text в публичных logs.

---

# 14. Правила безопасности GitHub

GitHub repository никогда не должен содержать реальные secrets.

Перед каждым важным commit:

```bash
git status
# проверить изменённые файлы

git diff
# проверить unstaged changes

git diff --cached
# проверить staged changes
```

Если `.env.local` появился в Git status:

```bash
git restore --staged .env.local
# убрать .env.local из staged files, если он был добавлен по ошибке
```

Добавить `.env.local` в `.gitignore`:

```bash
echo ".env.local" >> .gitignore
# убедиться, что локальный env file игнорируется
```

Нельзя полагаться только на `.gitignore`, если файл уже однажды был закоммичен. Если secret был закоммичен, нужно выполнить ротацию ключа.

---

# 15. Безопасность Code Arena

Code Arena должна быть разделена на два отдельных этапа.

## 15.1 `v1.1 - Code Arena Lite`

Code Arena Lite разрешена до Runner, потому что она не выполняет код.

Разрешено:

```text
User submits coding task.
# только текстовая task

Models generate code answers.
# AI responses являются текстом

User compares code answers.
# только сравнение, без выполнения

User votes for best answer.
# только comparison
```

Запрещено в Lite:

```text
Run user code.
# нельзя до Runner

Run AI-generated code.
# нельзя до Runner

Execute tests.
# нельзя до Runner

Use Docker sandbox.
# относится к Runner stage

Store execution logs.
# относится к Runner stage
```

## 15.2 `v1.7 - Code Arena Runner`

Runner можно добавлять только после:

```text
v1.5 - Accounts and Profiles
# user identity and ownership

v1.6 - Admin Panel and Limits
# administrative control and usage limits

Security review
# отдельная проверка перед выполнением кода

Sandbox design
# изолированная execution environment
```

Runner не должен запускаться на той же простой serverless API route без sandbox control.

Минимальные требования Runner:

```text
Isolated sandbox.
# user code не может получить доступ к project secrets

Execution timeout.
# предотвращает infinite loops

Memory limit.
# предотвращает resource abuse

CPU limit.
# предотвращает heavy abuse

Network disabled by default.
# предотвращает exfiltration и abuse

File system isolation.
# предотвращает чтение server files

Language allowlist.
# выполняются только supported languages

Test case validation.
# tests должны контролироваться

Execution logs sanitized.
# logs не должны раскрывать secrets
```

Важное правило:

```text
ENABLE_CODE_RUNNER=false before v1.7.
# не включать code execution во время MVP
```

---

# 16. Безопасность AI Team Mode

AI Team Mode относится к `v2.0`, а не к MVP.

Перед включением Team Mode в проекте уже должны быть:

```text
Stable Prompt Arena.
# core comparison работает

Accounts.
# user identity существует

Limits.
# usage контролируется

Admin panel.
# models можно управлять

Cost tracking.
# multi-step mode может быть дорогим
```

Риски Team Mode:

```text
Many model calls per task.
# высокий cost risk

Long context chains.
# token cost risk

Role confusion.
# model может игнорировать назначенную role

Prompt injection.
# один шаг может испортить следующие steps

Large stored outputs.
# database growth risk
```

Обязательные controls:

```text
Limit number of rounds.
# контролировать cost

Limit number of roles.
# контролировать complexity

Limit context passed between steps.
# контролировать token usage

Validate final response.
# избегать broken или unsafe output

Keep ENABLE_TEAM_MODE=false before v2.0.
# не включать раньше времени
```

---

# 17. Защита Leaderboard

Leaderboard не должен быть простым для манипуляции.

Минимальная защита перед public Leaderboard:

```text
Prevent duplicate votes.
# уменьшает basic abuse

Store vote metadata.
# помогает выявлять suspicious patterns

Use accounts before serious ranking.
# anonymous votes слабее

Separate public score from internal score.
# позволяет moderation и recalculation

Do not let models vote for themselves.
# избегать искусственного scoring
```

Продвинутая защита после accounts:

```text
One vote per user per task.
# честное voting

Suspicious activity detection.
# выявлять abuse patterns

Admin moderation.
# удалять bad tasks или manipulated votes

Weighted judge evaluations.
# позже объединять user votes и judge results
```

---

# 18. Безопасность Admin Panel

Admin panel относится к `v1.6`.

Admin panel не должна быть публичной по умолчанию.

Обязательные controls:

```text
Authentication required.
# доступ только для logged-in admin

Admin role required.
# normal users не могут получить доступ

Server-side permission check.
# скрыть UI недостаточно

Audit important changes.
# записывать model и limit changes

Do not expose secrets in admin UI.
# admins могут управлять без просмотра keys
```

Запрещено:

```text
Admin access controlled only by frontend.
# browser checks можно обойти

Admin secret stored in NEXT_PUBLIC variable.
# public variable раскрывает secret

Service role key shown in UI.
# критическая утечка
```

---

# 19. Deployment Security Checklist

Перед local development:

```bash
cp .env.example .env.local
# создать local env file из безопасного example

npm install
# установить dependencies

npm run dev
# запустить local development server
```

Перед commit:

```bash
git status
# проверить изменённые файлы

git diff
# проверить local changes

npm run lint
# проверить code quality

npm run build
# проверить production build
```

Перед Vercel deployment:

```text
Check Vercel environment variables.
# required variables должны существовать

Check .env.local is not committed.
# secrets должны оставаться локальными

Check OpenRouter key is server-only.
# без frontend exposure

Check Supabase RLS.
# database должна быть защищена

Check expensive models are disabled by default.
# защита budget

Check Runner is disabled before v1.7.
# без unsafe execution

Check Team Mode is disabled before v2.0.
# без неконтролируемой multi-step cost
```

---

# 20. Безопасность по версиям

## `v0.1 - Documentation`

Обязательно:

```text
Security rules documented.
# этот файл существует

Secrets policy defined.
# keys не коммитятся

Runner forbidden before v1.7.
# безопасный roadmap
```

## `v0.2 - Next.js Base`

Обязательно:

```text
.env.example added.
# безопасный environment template

.env.local ignored.
# реальные secrets защищены

API route structure prepared.
# backend layer существует
```

## `v0.3 - UI MVP`

Обязательно:

```text
No real API keys in frontend.
# UI работает без раскрытия secrets

Mock data does not include secrets.
# безопасное local testing
```

## `v0.4 - OpenRouter Integration`

Обязательно:

```text
OpenRouter called from backend only.
# key остаётся secret

Model allowlist exists.
# пользователь не может выбрать произвольные models

Prompt and model count are limited.
# cost protection
```

## `v0.5 - Supabase Integration`

Обязательно:

```text
RLS enabled.
# database protection

Service role used only server-side.
# без frontend leak

Public reads are intentional.
# без accidental data exposure
```

## `v0.6 - Voting`

Обязательно:

```text
Votes validated.
# vote должен указывать на real response

Duplicate voting considered.
# basic anti-abuse
```

## `v0.7 - History`

Обязательно:

```text
History page is paginated.
# без тяжёлых database reads

Private data is not exposed.
# безопасный public display
```

## `v0.8 - Deployment`

Обязательно:

```text
Vercel variables configured.
# production может безопасно работать

Production secrets separate from local secrets.
# более безопасные operations
```

## `v0.9 - Stabilization`

Обязательно:

```text
Safe errors.
# без raw internal leaks

Basic logs.
# debugging без secrets

Basic usage limits.
# cost protection
```

## `v1.0 - Stable Prompt Arena`

Обязательно:

```text
Prompt Arena works safely.
# MVP usable

Secrets are protected.
# без exposed keys

Database writes are controlled.
# stable MVP data flow
```

## `v1.1 - Code Arena Lite`

Обязательно:

```text
No code execution.
# Lite означает text-only comparison

Code answers are stored as text.
# sandbox пока не нужен
```

## `v1.5 - Accounts and Profiles`

Обязательно:

```text
User ownership added.
# tasks и votes можно связать с user

Per-user limits become possible.
# лучший cost control
```

## `v1.6 - Admin Panel and Limits`

Обязательно:

```text
Admin role check server-side.
# protected admin actions

Model limits configurable.
# budget и access control
```

## `v1.7 - Code Arena Runner`

Обязательно:

```text
Sandbox ready.
# code execution изолирован

Timeouts ready.
# без infinite execution

Resource limits ready.
# без resource abuse

Security review complete.
# финальная проверка перед code execution
```

## `v2.0 - AI Team Mode`

Обязательно:

```text
Multi-step cost controls.
# Team Mode может быть дорогим

Role limits.
# предотвращает uncontrolled chains

Context limits.
# предотвращает huge token usage
```

---

# 21. Финальные правила

Проект должен соблюдать эти финальные правила:

```text
No secrets in frontend.
# browser никогда не должен видеть private keys

No secrets in GitHub.
# repository должен оставаться безопасным

No service role in client code.
# Supabase protection зависит от этого

No arbitrary model IDs from users.
# backend должен enforced allowlist

No unlimited prompts.
# cost protection

No unlimited model count.
# cost protection

No Code Arena Runner before v1.7.
# небезопасно без sandbox

No AI Team Mode before v2.0.
# слишком сложно и дорого для MVP

No raw internal errors in API responses.
# не раскрывать system details

No public release without checking environment variables.
# deployment должен быть безопасным
```

---

# 22. Рекомендация по commit

После замены этого файла сделать commit:

```bash
git add docs/12-security-and-env.md
# добавить обновлённую security and environment documentation в staged files

git commit -m "docs: update security and environment rules"
# сохранить исправленную security documentation
```

Если файл находится в корне проекта вместо `docs/`, использовать:

```bash
git add 12-security-and-env.md
# добавить обновлённую security and environment documentation в staged files

git commit -m "docs: update security and environment rules"
# сохранить исправленную security documentation
```
