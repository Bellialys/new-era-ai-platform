# Аудит проекта — Новая эра AI Platform
**Дата:** 2026-06-27  
**Ревьюер:** Claude Code (read-only, без изменений кода)  
**Ветка:** main  
**Коммит:** `beac35e` release: v2.0.0-alpha.1 — AI Team Mode stabilization

> **Current status update — 2026-06-28:** этот аудит является историческим снимком на commit `beac35e`.
> Часть пунктов ниже уже устарела: `V200-01` закрыта как `done`, git tag `v2.0.0-alpha.1`
> существует, Team Mode default model приведена к allowlist, тестовая сетка выросла до 337 tests.
> Актуальный P1-блокер вынесен в `.project/tasks/V200-02.json`: Production Env Activation
> (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `ENABLE_TEAM_MODE=true`,
> `NEXT_PUBLIC_ENABLE_TEAM_MODE=true`, redeploy и production smoke).

---

## 1. Краткое резюме (Executive Summary)

Проект находится в **хорошем техническом состоянии**. Все автоматические проверки проходят. Кодовая база структурирована, архитектура последовательная, безопасность соблюдена на уровне API. За последние сессии выполнена значительная работа: реализован полный цикл AI Team Mode (v2.0-alpha), Image Arena (v1.8), Code Runner (v1.7), Admin Panel, Audit Log.

**Ключевые риски:**
- P1: Rate limiter в in-memory режиме — **не работает across Vercel serverless instances** без Upstash Redis. Это критично для production.
- P1: Production Team Mode activation ещё не закрыта — требуется V200-02: Upstash Redis env, `ENABLE_TEAM_MODE=true`, `NEXT_PUBLIC_ENABLE_TEAM_MODE=true`, redeploy и smoke.
- Superseded 2026-06-28: V200-01 уже закрыта как `done`.
- Superseded 2026-06-28: git tag `v2.0.0-alpha.1` существует.
- P2: Storage bucket `images` для Image Arena — наличие в Supabase не верифицировано.
- Superseded 2026-06-28: default model Team Mode приведена к allowlist (`meta-llama/llama-3.3-70b-instruct:free`).
- P3: Документация (`14-roadmap.md`, `AGENTS.md`, `00-readme.md`, Image Arena UI) содержит устаревшие версионные ссылки.

**Нет P0-проблем.** Публичных ключей или секретов в коде не найдено. `eval`, `new Function`, `dangerouslySetInnerHTML` в src отсутствуют.

---

## 2. Что это за проект

**Новая эра** — AI-платформа для сравнения нескольких AI-моделей по одному запросу (Prompt Arena). Пользователь вводит задачу, выбирает несколько AI-моделей, получает ответы рядом и выбирает лучший результат.

Платформа поддерживает несколько режимов:
- **Prompt Arena** — сравнение текстовых ответов нескольких моделей
- **Code Arena** — сравнение кодовых решений с опциональным запуском через Piston
- **Image Arena** — сравнение изображений от image-моделей (v1.8, auth required)
- **AI Team Mode** — 4 AI-роли (Planner → Researcher → Critic → Finalizer) работают последовательно (v2.0-alpha, feature-flagged)
- **Judge Mode** — одна модель оценивает ответы других
- **Leaderboard** — рейтинг моделей по голосам

---

## 3. Технический слепок

| Параметр | Значение |
|---|---|
| Версия | `2.0.0-alpha.1` |
| Git tag | На момент аудита: `v1.0.0` only. Current status update 2026-06-28: `v2.0.0-alpha.1` tag существует. |
| Ветка | main |
| Последний коммит | `beac35e` 2026-06-27 |
| Node.js | v26.3.0 |
| npm | v11.16.0 |
| Фреймворк | Next.js 16.2.9 (App Router, Turbopack) |
| Язык | TypeScript (strict) |
| БД | Supabase PostgreSQL (22 миграции) |
| Стилизация | Tailwind CSS |
| Тесты | Vitest 4.1.8 (node environment, NO jsdom) |
| CI | GitHub Actions (typecheck + lint + test + build + docs:check + smoke) |
| Deploy | Vercel |
| Rate limit | In-memory fallback + Upstash Redis (опционально) |

---

## 4. Карта файлов и папок

| Папка/файл | Назначение |
|---|---|
| `src/app/` | Next.js App Router pages и API routes |
| `src/app/api/` | 35 API route handlers |
| `src/app/admin/` | Admin panel pages (6 страниц) |
| `src/components/` | UI-компоненты (arena, auth, code-arena, history, layout, share, ui) |
| `src/lib/arena/` | Shared constants, team-mode engine, image models |
| `src/lib/server/` | Server-only хелперы: auth, supabase, openrouter, rate-limit, persistence |
| `src/lib/` | Browser-safe: supabase client, proxy, guest |
| `src/types/` | TypeScript типы (arena, history) |
| `supabase/migrations/` | 22 SQL-миграции |
| `scripts/` | Утилиты: state, sync, health-check, smoke, env-check, verify-models |
| `.project/` | Project state: state.json, task files, document-map |
| `.github/workflows/` | CI конфигурация (ci.yml) |
| `docs/` | SLO, runbook, privacy-retention, release-checklist, env-check docs |
| `archive/` | Устаревшие документы (исторические) |
| Корень | `CLAUDE.md`, `AGENTS.md`, `README.md`, `14-roadmap.md` + 25 docs-файлов |

**Статистика:**
- Tracked files: ~230
- API routes: 35 (из них 5 с тест-файлами)
- Test files (vitest): 18 (243 теста)
- Client components (`"use client"`): 34
- Migrations: 22

---

## 5. Карта архитектуры

```
Browser
  │
  ├── Next.js App Router (Vercel)
  │     ├── Proxy (src/proxy.ts) — Supabase session refresh на каждый запрос
  │     ├── Pages (RSC + Client Components)
  │     │     ├── / , /arena, /code, /image, /team, /history, /leaderboard
  │     │     ├── /profile, /login, /signup, /auth/*
  │     │     └── /admin/* (requireAdmin guard)
  │     └── API Routes (src/app/api/*)
  │           ├── resolveRequestIdentity() — user (Supabase auth) или guest (httpOnly cookie)
  │           ├── checkRateLimit() — Upstash Redis или in-memory fallback
  │           ├── fetchOpenRouterResponse() / streamOpenRouterResponse()
  │           ├── saveArenaRun() / savePromptArenaRun() — best-effort persistence
  │           └── requireAdmin() — role check через Supabase service_role
  │
  ├── Supabase PostgreSQL
  │     ├── Tables: models, tasks, model_responses, votes, profiles, anonymous_sessions, audit_log
  │     ├── RLS: включен на всех таблицах; service_role обходит RLS
  │     └── cast_best_vote() RPC — атомарная замена лучшего голоса
  │
  ├── OpenRouter API
  │     ├── Text: /api/v1/chat/completions (streaming + batch)
  │     └── Images: /api/v1/images/generations (DALL-E 3, DALL-E 2, SD XL)
  │
  ├── Piston API (emkc.org/api/v2/piston/execute)
  │     └── /api/code-run — изолированный запуск кода (не на сервере приложения)
  │
  └── Upstash Redis (опционально)
        └── Fixed-window rate limiting для /api/compare, /api/vote, /api/code-run,
            /api/image-compare, /api/team-run, /api/judge, /api/history
```

**Ключевые архитектурные решения:**
- **Identity через cookie, не через body**: `resolveRequestIdentity()` читает Supabase auth cookie или httpOnly `na_guest` cookie; body userId игнорируется.
- **Best-effort persistence**: DB-ошибки не отменяют LLM-результаты. `saveArenaRun()` ловит ошибки, `taskId` возвращается как `null`.
- **DI для team-mode**: `runTeamMode()` принимает `callModel` как параметр — нет прямого импорта OpenRouter в engine.
- **Service role**: Supabase service_role client используется только на server-side, никогда в NEXT_PUBLIC_.
- **Admin guard**: двойная проверка — Supabase auth + profiles.role = 'admin' через service_role.

---

## 6. Карта функций

| Функция | Статус | Страница | API | Auth | Rate Limit |
|---|---|---|---|---|---|
| Prompt Arena (batch) | ✅ Live | `/arena` | `POST /api/compare` | user/guest | 10/min user, 5/min guest |
| Prompt Arena (stream) | ✅ Live | `/arena` | `POST /api/compare?stream=true` | user/guest | same |
| Blind voting | ✅ Live | `/arena` | — | — | — |
| Copy/Share | ✅ Live | `/arena`, `/share/[id]` | `GET /api/tasks/[id]` | user | — |
| Vote (best) | ✅ Live | `/arena` | `POST /api/vote` | user/guest | 30/min |
| Judge Mode | ✅ Live | `/arena` | `POST /api/judge` | user/guest | 3/min user, 1/min guest |
| Code Arena | ✅ Live | `/code` | `POST /api/code-compare` | user/guest | 8/min user, 3/min guest |
| Code Runner | ✅ Live (auth) | `/code` | `POST /api/code-run` | **user only** | 10/min |
| Image Arena | ✅ Live (alpha) | `/image` | `POST /api/image-compare` | **user only** | 5/min |
| AI Team Mode | ✅ Alpha (flag) | `/team` | `POST /api/team-run` | **user only** | 3/10min |
| История | ✅ Live | `/history` | `GET /api/history` | user | 60/min |
| История деталь | ✅ Live | `/history/[id]` | `GET /api/history/[id]` | user | — |
| Leaderboard | ✅ Live | `/leaderboard` | `GET /api/leaderboard` | none | — |
| Профиль | ✅ Live | `/profile` | `GET/PATCH /api/profile` | user | — |
| Avatar upload | ✅ Live | `/profile` | `POST /api/profile/avatar` | user | — |
| Email change | ✅ Live | `/profile` | `POST /api/profile/email` | user | — |
| Guest mode | ✅ Live | всюду | `POST /api/guest` | none | — |
| Auth (login/signup) | ✅ Live | `/login`, `/signup` | Supabase | — | — |
| Admin Dashboard | ✅ Live | `/admin` | — | **admin** | — |
| Admin Audit Log | ✅ Live | `/admin/audit` | `GET /api/admin/audit` | **admin** | — |
| Admin Usage | ✅ Live | `/admin/usage` | `GET /api/admin/usage` | **admin** | — |
| Admin Models | ✅ Live | `/admin/models` | `GET/PATCH /api/admin/models` | **admin** | — |
| Admin Users | ✅ Live | `/admin/users` | `GET/PATCH /api/admin/users` | **admin** | — |
| Daily usage limits | ✅ Live | — | `GET /api/usage` | user/guest | — |
| Health check | ✅ Live | — | `GET /api/health` | none | — |
| Sitemap/robots | ✅ Live | `/sitemap.xml`, `/robots.txt` | — | none | — |
| Privacy/Terms | ✅ Live (статик) | `/privacy`, `/terms` | — | none | — |
| Multi Model Battle | ⚠️ Partial | `/arena` (shared) | same as compare | — | — |

**Примечание по Team Mode:** страница `/team` статически рендерится. Feature flag `NEXT_PUBLIC_ENABLE_TEAM_MODE=false` по умолчанию показывает заглушку "Скоро". Функция доступна при установке флага в `true`.

---

## 7. API Audit

### Основные routes

| Endpoint | Метод | Auth | Rate Limit | Validation | DB | External | Тесты |
|---|---|---|---|---|---|---|---|
| `/api/health` | GET | none | none | — | models count | — | нет |
| `/api/models` | GET | none | 60/min (IP) | — | Supabase catalog | — | нет |
| `/api/compare` | POST | user/guest→401 | 10/min user, 5/min guest | prompt 3-8000, models 2-5, modeSlug | tasks, model_responses | OpenRouter | нет |
| `/api/stream-compare` | POST | user/guest→401 | same | same | same | OpenRouter SSE | нет |
| `/api/vote` | POST | user/guest→401 | 30/min | taskId, responseId, voteType | votes (atomic RPC) | — | нет |
| `/api/judge` | POST | user/guest→401 | 3/min user, 1/min guest | taskId + responses | tasks.judge_verdict | OpenRouter | нет |
| `/api/guest` | POST | none | none | — | anonymous_sessions | — | нет |
| `/api/history` | GET | user→401 | 60/min | page, pageSize 1-50 | tasks + responses | — | нет |
| `/api/history/[id]` | GET | user→401 | — | UUID | tasks + responses | — | нет |
| `/api/tasks/[id]` | GET | user→401 | — | UUID | tasks + responses | — | нет |
| `/api/stats` | GET | none | — | — | tasks count | — | нет |
| `/api/usage` | GET | user/guest→401 | — | — | tasks count, profiles.plan | — | нет |
| `/api/leaderboard` | GET | none | — | — | tasks + votes + models | — | нет |

### Code Arena

| Endpoint | Метод | Auth | Rate Limit | Validation | External | Тесты |
|---|---|---|---|---|---|---|
| `/api/code-models` | GET | none | — | — | — | нет |
| `/api/code-compare` | POST | user/guest→401 | 8/min user, 3/min guest | prompt 10-6000, models 2-3 | OpenRouter | нет |
| `/api/code-run` | POST | **user only**→401 | 10/min | code≤10000, language allowlist | **Piston API** | ✅ да |

### Image Arena

| Endpoint | Метод | Auth | Rate Limit | Validation | Storage | Тесты |
|---|---|---|---|---|---|---|
| `/api/image-models` | GET | none | — | — | — | ✅ да |
| `/api/image-compare` | POST | **user only**→401 | 5/min | prompt≤1000, models 1-3, allowlist | OpenRouter Images → Supabase Storage `images/` | ✅ да |

### Team Mode

| Endpoint | Метод | Auth | Rate Limit | Validation | Тесты |
|---|---|---|---|---|---|
| `/api/team-run` | POST | **user only**→401 | 3/10min | task 10-4000 chars | ✅ да (20 тестов) |

### Profile

| Endpoint | Метод | Auth | Тесты |
|---|---|---|---|
| `/api/profile` | GET/PATCH | user | нет |
| `/api/profile/avatar` | POST | user | нет |
| `/api/profile/email` | POST | user | нет |
| `/api/profile/stats` | GET | user | нет |

### Admin (все → requireAdmin() → 403 если не admin)

| Endpoint | Метод | Тесты |
|---|---|---|
| `/api/admin/audit` | GET | ✅ да |
| `/api/admin/usage` | GET | нет |
| `/api/admin/models` | GET | нет |
| `/api/admin/models/[id]` | PATCH | нет |
| `/api/admin/stats` | GET | нет |
| `/api/admin/users` | GET | нет |
| `/api/admin/users/[id]` | PATCH | нет |

**Наблюдения по API:**
- `/api/image-compare` использует собственный error format `{ error: "...", message: "..." }` вместо стандартного `{ status, errorCode, message }` из `createErrorResponse()`. Это **несогласованность** (не уязвимость, но затрудняет единообразную обработку ошибок на клиенте).
- `/api/stream-compare` существует отдельно от `/api/compare` (который тоже умеет stream=true) — **дублирование логики**.
- Все опасные endpoints имеют auth gate. Нет ни одного незащищённого write-endpoint.

---

## 8. Database / Supabase Audit

### Таблицы и структура

| Таблица | Ключевые колонки | RLS | Примечание |
|---|---|---|---|
| `models` | id, model_key, name, display_name, is_active, is_public, access_level, status (generated), raw_metadata JSONB | ✅ | status = generated always as (is_active) |
| `tasks` | id, task_text, mode_slug, user_id, anonymous_session_id, settings JSONB, judge_verdict JSONB | ✅ | mode_slug CHECK constraint включает все режимы |
| `model_responses` | id, task_id, model_id, display_name, status, answer_text, latency_ms, input_tokens, output_tokens | ✅ | display_name = role label для Team Mode |
| `votes` | id, task_id, model_response_id, user_id, anonymous_session_id, vote_type | ✅ | unique index per (task, user, vote_type); atomic via cast_best_vote() RPC |
| `profiles` | id, first_name, last_name, display_name, avatar_url, role, plan | ✅ | auto-created on auth.users insert |
| `anonymous_sessions` | id, display_name, avatar_seed, color_seed, last_seen_at | ✅ | |
| `audit_log` | id, actor_id, action, target_type, target_id, payload JSONB, created_at | ✅ | service_role only; indexed by actor_id и created_at |

### Migrations

| Файл | Содержание |
|---|---|
| `0001_prompt_arena_mvp.sql` | tasks, model_responses, базовая структура |
| `0002_sync_free_models.sql` | Seed моделей в catalog |
| `0003_profiles.sql` | profiles + trigger на auth.users |
| `0004_profiles_grants.sql` | RLS grants |
| `0005_service_role_models_select.sql` | Grant service_role для models |
| `0006_service_role_profiles_grants.sql` | Grant service_role для profiles |
| `20260607_harden_profiles_and_indexes.sql` | Индексы, hardening |
| `20260608_align_mvp_tasks_and_votes.sql` | votes таблица, mode_slug CHECK, task_text |
| `20260609_db_integrity_fixes.sql` | Integrity fixes |
| `20260609_drop_prompt_text.sql` | Удаление prompt_text |
| `20260609_align_votes_indexes.sql` | Новые индексы votes |
| `20260610_add_models_status_column.sql` | Добавление models.status |
| `20260615_atomic_best_vote_rpc.sql` | cast_best_vote() RPC |
| `20260617_anonymous_sessions.sql` | anonymous_sessions |
| `20260617_models_access_level.sql` | models.access_level |
| `20260617_profiles_extend_v0_6_4.sql` | Расширение profiles |
| `20260617_avatars_storage_rls.sql` | Storage RLS для avatars |
| `20260617_reconcile_release_gate.sql` | Деактивация неверифицированных моделей, SECURITY INVOKER для cast_best_vote |
| `20260624_add_judge_verdict_to_tasks.sql` | tasks.judge_verdict JSONB |
| `20260624_add_audit_log.sql` | audit_log таблица |

**Ключевые наблюдения:**
- `tasks.settings JSONB` используется Team Mode для хранения `finalAnswer` — нет миграции, используется готовый JSONB.
- `cast_best_vote` исправлен на `SECURITY INVOKER` (убран `SECURITY DEFINER`) — правильно.
- RLS активирован на всех таблицах. service_role обходит RLS — используется только в server-side коде.
- Не проверялось: наличие Storage bucket `images` в Supabase — требуется для Image Arena.

---

## 9. Env / Secrets Audit

### Переменные, используемые в коде (names only)

| Переменная | Тип | Использование |
|---|---|---|
| `OPENROUTER_API_KEY` | 🔴 Secret | OpenRouter API, server-only |
| `SUPABASE_SERVICE_ROLE_KEY` | 🔴 Secret | Supabase service client, server-only |
| `NEXT_PUBLIC_SUPABASE_URL` | 🟡 Public | Browser + server Supabase client |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 🟡 Public (publishable, не anon) | Browser Supabase auth |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 🟡 Public (alias) | Fallback alias для publishable key |
| `NEXT_PUBLIC_SITE_URL` | 🟡 Public | HTTP-Referer в OpenRouter запросах |
| `NEXT_PUBLIC_ENABLE_TEAM_MODE` | 🟡 Public | Feature flag для /team страницы |
| `UPSTASH_REDIS_REST_URL` | 🔴 Secret | Rate limiting через Upstash |
| `UPSTASH_REDIS_REST_TOKEN` | 🔴 Secret | Rate limiting через Upstash |
| `MODEL_TIMEOUT_MS` | Конфиг | OpenRouter timeout (default 60000) |
| `OPENROUTER_MAX_TOKENS` | Конфиг | Max tokens (default 2048) |
| `VERCEL_ENV` | Vercel | Окружение (development/preview/production) |
| `VERCEL_GIT_COMMIT_SHA` | Vercel | Хэш коммита в /api/health |
| `NODE_ENV` | System | Secure flag для guest cookie |
| `npm_package_version` | System | Версия в /api/health |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | 🔴 Secret | Только для smoke против protected preview |

**Проверки безопасности:**
- ✅ `SUPABASE_SERVICE_ROLE_KEY` — `NEXT_PUBLIC_` prefix отсутствует
- ✅ `OPENROUTER_API_KEY` — только в server-side коде
- ✅ `eval`, `new Function`, `dangerouslySetInnerHTML` в src не найдены
- ✅ `.env.local` в `.gitignore`
- ✅ CI использует placeholder-значения, не реальные секреты
- ✅ env-check скрипт (`npm run env:check`) проверяет, что secret ключи не попали в NEXT_PUBLIC_

---

## 10. Тесты и проверки

### Результаты всех проверок

| Проверка | Результат | Детали |
|---|---|---|
| `npm run state:check` | ✅ PASS | state.json и все task-файлы валидны |
| `npm run docs:check` | ✅ PASS | SYNC-маркеры и package.json в синхронизации |
| `npm run lint` | ✅ PASS | 0 ошибок, 0 предупреждений (--max-warnings 0) |
| `npm run typecheck` | ✅ PASS | TypeScript без ошибок |
| `npm test` (vitest) | ✅ PASS | 18 файлов, **243/243 теста** |
| `npm run test:env-check` | ✅ PASS | 32/32 теста (Node test runner) |
| `npm run verify` | ✅ PASS | typecheck + lint + build + docs:check |
| `npm run build` | ✅ PASS | 48 страниц, 0 ошибок TypeScript |
| `npm run schema:check` | ⚠️ NOT RUN | Требует `SUPABASE_DB_URL` |
| `npm run models:verify` | ⚠️ NOT RUN | Требует live OpenRouter API |
| `npm run smoke` | ⚠️ NOT RUN | Требует запущенного сервера |

### Test coverage по областям

| Область | Тест файл | Количество тестов |
|---|---|---|
| `/api/team-run` route | `src/app/api/team-run/route.test.ts` | 20 |
| `/api/code-run` route | `src/app/api/code-run/route.test.ts` | ~15 |
| `/api/image-compare` route | `src/app/api/image-compare/route.test.ts` | ~12 |
| `/api/image-models` route | `src/app/api/image-models/route.test.ts` | ~6 |
| `/api/admin/audit` route | `src/app/api/admin/audit/route.test.ts` | ~8 |
| Team Mode engine | `src/lib/arena/team-mode.test.ts` | ~18 |
| History formatters | `src/components/history/format.test.ts` | 21 |
| Auth helpers | `src/lib/server/auth.test.ts` | ~15 |
| Admin guard | `src/lib/server/admin.test.ts` | ~8 |
| Audit log | `src/lib/server/audit.test.ts` | ~6 |
| History helper | `src/lib/server/history.test.ts` | ~15 |
| Model catalog | `src/lib/server/model-catalog.test.ts` | ~20 |
| Models fallback | `src/lib/server/models.test.ts` | ~12 |
| Rate limit | `src/lib/server/rate-limit.test.ts` | ~20 |
| Usage limits | `src/lib/server/usage-limits.test.ts` | ~10 |
| Utils | `src/lib/server/utils.test.ts` | ~15 |
| Votes | `src/lib/server/votes.test.ts` | ~12 |
| Guest | `src/lib/guest.test.ts` | ~10 |

**Итого на момент аудита:** 18 vitest-файлов, 243 теста + 32 env-check теста = 275 тестов.
**Current status update — 2026-06-28:** текущая сетка выросла до 337 tests.

### Что НЕ покрыто тестами

- `/api/compare` — нет route-level тестов (основной endpoint!)
- `/api/vote` — нет тестов
- `/api/judge` — нет тестов
- `/api/history` — нет тестов
- `/api/code-compare` — нет тестов
- `/api/stream-compare` — нет тестов
- `/api/guest` — нет тестов
- `/api/profile/*` — нет тестов
- `/api/leaderboard` — нет тестов
- UI/компонентные тесты — **jsdom не настроен**, vitest работает в `environment: "node"`, `.test.tsx` файлы не поддерживаются

---

## 11. Что работает

- ✅ **Prompt Arena** — полный цикл: ввод задачи → выбор моделей → SSE streaming → результаты → голосование → сохранение в Supabase
- ✅ **Blind voting** — порядок ответов перемешивается, реальные модели раскрываются после выбора
- ✅ **Code Arena** — сравнение кодовых решений + Code Diff
- ✅ **Code Runner** — запуск кода через внешний Piston (auth required), изоляция соблюдена
- ✅ **Image Arena** — генерация изображений через OpenRouter (DALL-E 3, DALL-E 2, SD XL), сохранение в Supabase Storage
- ✅ **AI Team Mode** — 4-ролевой конвейер (Planner → Researcher → Critic → Finalizer), feature-flagged
- ✅ **Judge Mode** — AI-судья с разбивкой по критериям
- ✅ **История** — список и детали с поддержкой всех режимов включая Team Mode
- ✅ **Leaderboard** — рейтинг по голосам
- ✅ **Auth (login/signup/logout/reset password)** — Supabase Auth SSR
- ✅ **Guest mode** — httpOnly cookie, отдельный rate limit
- ✅ **Профиль** — редактирование, аватар, email, статистика
- ✅ **Admin Panel** — dashboard, audit log, usage, models, users
- ✅ **Rate limiting** — покрыты все expensive endpoints; Upstash Redis как продакшн backend
- ✅ **Auth gate** — все write-endpoints требуют идентификации; Team Mode, Image Arena, Code Run — только user
- ✅ **Best-effort persistence** — DB-ошибки не теряют LLM-результаты
- ✅ **Daily usage limits** — anonymous/free/pro/admin с проверкой через profiles.plan
- ✅ **CI** — typecheck + lint + test + build + docs:check + smoke (continue-on-error)
- ✅ **Env checker** — 32 теста, FATAL на secret-в-NEXT_PUBLIC_
- ✅ **State/docs sync** — `npm run state:check` и `npm run docs:check` проходят

---

## 12. Что не работает / неизвестно

- ⚠️ **Upstash Redis не настроен** — rate limiter работает in-memory и не шарится между serverless instances
- ⚠️ **Storage bucket `images`** — Image Arena сохраняет изображения в bucket `images`, но наличие этого bucket в Supabase не верифицировано; если он не создан, upload упадёт (graceful fallback на прямой URL OpenRouter есть)
- ⚠️ **Piston API (emkc.org)** — внешняя зависимость, не под нашим контролем; нет fallback при недоступности
- ✅ **Team Mode default model** — superseded 2026-06-28; текущий default `meta-llama/llama-3.3-70b-instruct:free` есть в ALLOWED_MODELS и покрыт consistency test
- ✅ **V200-01 task status** — superseded 2026-06-28; task закрыта как `done`
- ✅ **Git tag v2.0.0-alpha.1** — superseded 2026-06-28; tag существует
- ⚠️ **V200-02 Production Env Activation** — текущий P1 gate: Upstash Redis env + оба Team Mode флага + redeploy + production smoke
- ⚠️ **schema:check не запускался** — синхронизация миграций с live DB не проверена в этой сессии
- ⚠️ **models:verify не запускался** — model IDs не верифицированы против live OpenRouter
- ⚠️ **`/api/compare` без тестов** — главный endpoint без route-level unit тестов

---

## 13. Риски

### P1 — Высокий приоритет

| # | Риск | Файл | Описание |
|---|---|---|---|
| P1-1 | **Rate limiter in-memory** | `src/lib/server/rate-limit.ts` | Без `UPSTASH_REDIS_REST_URL`/`TOKEN` rate limit не шарится между Vercel serverless instances. Злоумышленник делает запросы параллельно на несколько функций и обходит лимит. Критично для `TEAM_RUN_RATE_LIMIT_MAX = 3/10min`. |
| P1-2 | **V200-02 Production Env Activation** | `.project/tasks/V200-02.json` | Team Mode не считается активным в production, пока не выставлены Upstash Redis env, `ENABLE_TEAM_MODE=true`, `NEXT_PUBLIC_ENABLE_TEAM_MODE=true`, не выполнен redeploy и smoke. |
| P1-3 | **Superseded: V200-01/git tag** | `.project/tasks/V200-01.json` | V200-01 закрыта как `done`, tag `v2.0.0-alpha.1` существует. Этот старый риск больше не актуален. |

### P2 — Средний приоритет

| # | Риск | Файл | Описание |
|---|---|---|---|
| P2-1 | **Supabase bucket `images` не верифицирован** | `src/app/api/image-compare/route.ts:60-91` | `uploadToStorage()` пытается загрузить в bucket "images". Если bucket не создан, Upload возвращает ошибку; есть fallback на прямой URL, но это не production-ready. |
| P2-2 | **Superseded: TEAM_DEFAULT_MODEL_ID** | `src/lib/arena/team-mode.ts:6` | Текущий default `meta-llama/llama-3.3-70b-instruct:free` присутствует в ALLOWED_MODELS и покрыт consistency test. Live OpenRouter verification остаётся отдельной env-dependent проверкой. |
| P2-3 | **`/api/compare` без тестов** | `src/app/api/compare/route.ts` | Основной endpoint (630 строк, SSE streaming + batch) не имеет route-level тестов. Регрессии трудно поймать. |
| P2-4 | **Image Arena error format несогласован** | `src/app/api/image-compare/route.ts` | Использует `{ error: "...", message: "..." }` вместо стандартного `{ status, errorCode, message }`. Клиентский код должен обрабатывать два формата. |
| P2-5 | **Piston без fallback** | `src/app/api/code-run/route.ts:118-131` | AbortSignal.timeout(15000) есть, но нет fallback если emkc.org недоступен — возвращается 502. |
| P2-6 | **Нет компонентных тестов** | `vitest.config.ts` | `environment: "node"`, только `.test.ts`. UI-компоненты (TeamRunForm, ImageArena, ArenaForm) не тестируются. |

### P3 — Низкий приоритет

| # | Риск | Файл | Описание |
|---|---|---|---|
| P3-1 | **Superseded: 14-roadmap.md устарел** | `14-roadmap.md` | Current status update 2026-06-28: roadmap показывает `v2.0 - AI Team Mode`, `v2.0.0-alpha.1`, status `in_development`. |
| P3-2 | **Superseded: AGENTS.md contextual text устарел** | `AGENTS.md` | Current status update 2026-06-28: AGENTS.md показывает `v2.0.0-alpha.1`; test count обновлён до 337 и production activation вынесен в V200-02. |
| P3-3 | **00-readme.md и 15-changelog.md** | `00-readme.md`, `15-changelog.md` | Содержат SYNC-маркеры с устаревшими версиями. docs:check только проверяет presence, не content. |
| P3-4 | **Image Arena UI badge "v1.8"** | `src/app/image/page.tsx:23` | Хардкод `Alpha · v1.8` в UI. После перехода на v2.0-alpha не обновлён. |
| P3-5 | **TODO в models.ts** | `src/lib/server/models.ts:8` | Комментарий `TODO(v0.5.3): verify model IDs` — стал историческим долгом. |
| P3-6 | **stream-compare дублирует compare** | `src/app/api/stream-compare/route.ts` | Отдельный route для streaming когда `/api/compare?stream=true` уже умеет это же. |
| P3-7 | **Dependabot настроен, но audit в CI = continue-on-error** | `.github/dependabot.yml`, `ci.yml:41-42` | `npm audit --audit-level=high` с `continue-on-error: true` — уязвимости не блокируют CI. |

---

## 14. Технический долг

| Долг | Приоритет | Описание |
|---|---|---|
| Закрыть V200-01 | P1 | Обновить status на "done", добавить checksPassed и commitHash |
| Проставить git tag | P1 | `git tag v2.0.0-alpha.1 beac35e` |
| Настроить Upstash Redis | P1 | Добавить в Vercel env UPSTASH_REDIS_REST_URL и TOKEN |
| Верифицировать Storage bucket `images` | P2 | Проверить/создать bucket в Supabase dashboard |
| Верифицировать TEAM_DEFAULT_MODEL_ID | P2 | `node scripts/verify-models.mjs` или `curl https://openrouter.ai/api/v1/models` |
| Тесты для /api/compare | P2 | Route-level тесты аналогично /api/team-run/route.test.ts |
| Компонентные тесты | P2 | Добавить jsdom в vitest config, написать тесты для TeamRunForm, ImageArena |
| Унифицировать error format | P2 | /api/image-compare → использовать ApiError + createErrorResponse() |
| Обновить 14-roadmap.md | P3 | v2.0 "Позже" → "В разработке"; SYNC-маркеры → v2.0.0-alpha.1 |
| Убрать TODO из models.ts | P3 | Удалить стали`ой комментарий v0.5.3 |
| Обновить Image Arena UI badge | P3 | `Alpha · v1.8` → `Alpha · v2.0` |
| Рассмотреть удаление /api/stream-compare | P3 | Если /api/compare покрывает все случаи |
| npm audit в CI без continue-on-error | P3 | Заблокировать CI при high-severity уязвимостях |

---

## 15. Что надо добавить

Согласно roadmap и product gaps:

1. **E2E тесты** — Playwright/Cypress для golden path: сравнение моделей, vote, история.
2. **Компонентные тесты** — Добавить jsdom в vitest, покрыть хотя бы TeamRunForm и ArenaForm.
3. **Тесты для /api/compare** — Главный endpoint без тестов; SSE streaming особенно.
4. **Observability** — Structured logging с request_id в каждом log-событии; Sentry или аналог.
5. **Content Security Policy** — Проверить/добавить CSP headers (next.config.ts).
6. **Streaming прогресс для Team Mode** — Текущий /api/team-run ждёт все 4 шага; SSE по шагам улучшит UX.
7. **Team Mode — выбор модели на UI** — Сейчас всегда TEAM_DEFAULT_MODEL_ID.
8. **Image Arena — сохранение в tasks** — Текущий /api/image-compare не пишет в `tasks`/`model_responses` → история не работает для изображений.
9. **Upstash Redis в документации** — Добавить в runbook обязательные шаги перед production deploy.
10. **Git tag policy** — Зафиксировать процедуру: тег ставится при каждом стабильном release.

---

## 16. Что надо изменить

1. **Закрыть V200-01**: `npm run state:task -- V200-01 done --check state:check --check docs:check --commit beac35e`
2. **Проставить git tag**: `git tag v2.0.0-alpha.1 beac35e && git push origin v2.0.0-alpha.1`
3. **Настроить Upstash Redis** в Vercel Environment Variables (Production + Preview).
4. **14-roadmap.md**: обновить таблицу версий и SYNC-маркеры (через `npm run docs:sync` после state:version).
5. **Image Arena error format**: перейти на `createErrorResponse()` + `ApiError`.
6. **Убрать TODO(v0.5.3)** из `src/lib/server/models.ts`.
7. **Image Arena UI badge** в `src/app/image/page.tsx:23`: `v1.8` → `v2.0`.

---

## 17. Что можно улучшить

1. **Rate limit Retry-After** в `/api/image-compare` хардкодится как `"60"` (строка, не точное значение). Заменить на вычисленное: `Math.ceil((resetAt - Date.now()) / 1000)`.
2. **Promise для fire-and-forget** в `/api/guest` (`supabase.from(...).update(...).then()`): можно обернуть в `void` для ясности намерений.
3. **Image Arena без сохранения в tasks** — пользователь не может видеть историю image-сравнений. Добавить сохранение аналогично Prompt Arena.
4. **Team Mode — verbose error mapping** — при ошибке OpenRouter пользователь видит INTERNAL_ERROR. Можно добавить различие: model_timeout vs quota_exceeded.
5. **Leaderboard page** — `refresh-button.tsx` существует как клиентский компонент, но leaderboard page, вероятно, можно было бы сделать полностью RSC с cache revalidation.
6. **Admin audit log** возвращает только 50 строк без пагинации — добавить cursor/page параметр.
7. **`npm audit` в CI** работает с `continue-on-error: true` — стоит перевести в fail-on-high для production-grade.

---

## 18. Рекомендуемый план следующих PR

> **Current status update — 2026-06-28:** старый suggested PR plan ниже superseded.
> V200-01 закрыта, tag `v2.0.0-alpha.1` существует, docs/state sync проходит.
> Текущий следующий шаг — V200-02 `Release Gate P1 - Production Env Activation`.

### V200-02 — Production Env Activation
- Добавить в Vercel Production `UPSTASH_REDIS_REST_URL` и `UPSTASH_REDIS_REST_TOKEN`.
- Добавить в Vercel Production `ENABLE_TEAM_MODE=true`.
- Добавить в Vercel Production `NEXT_PUBLIC_ENABLE_TEAM_MODE=true`.
- Выполнить production redeploy.
- Проверить `/api/health`, `/team`, unauth/auth `/api/team-run`, Upstash-backed rate limits.

### PR30 — после V200-02
- Nonce-based CSP.
- Remaining route-level tests.
- Не считать Team Mode активированным в production до закрытия V200-02.

### PR-4 — Image Arena fixes (2-3 файла, 2ч)
- Верифицировать/задокументировать bucket `images` в Supabase (runbook)
- `/api/image-compare`: унифицировать error format → `createErrorResponse()` + точный Retry-After
- `/api/image-compare`: добавить сохранение в `tasks`/`model_responses` (best-effort)
- Тесты для обновлённого route

### PR-5 — Tests for /api/compare (1 файл, 3ч)
- `src/app/api/compare/route.test.ts`
- Покрыть: auth gate, rate limit, validation, success (batch + stream mock), persistence failure, error paths, security

### PR-6 — Team Mode streaming (2-3 файла, 3ч)
- Переделать `/api/team-run` на SSE: отдавать каждый шаг по мере завершения
- Обновить `team-run-form.tsx` для получения потокового ответа
- Тесты

### PR-7 — Компонентные тесты (1 файл конфига + N тест-файлов, 4ч)
- Добавить `happy-dom` или `jsdom` в vitest config
- Тесты для TeamRunForm (idle/loading/success/error states)
- Тесты для ArenaForm

### PR-8 — E2E тесты (новый пакет, ~1 день)
- Playwright: golden path Prompt Arena, Team Mode, история
- CI шаг после build

---

## 19. Definition of Done для следующего этапа

Для перехода от `v2.0.0-alpha.1` к `v2.0.0-stable` необходимо:

- [ ] V200-01 задача закрыта (`status: "done"`, commitHash проставлен)
- [ ] Git tag `v2.0.0-alpha.1` проставлен
- [ ] Upstash Redis настроен в Vercel (Production + Preview)
- [ ] `npm run schema:check` проходит без ошибок
- [ ] `npm run models:verify` проходит — все ALLOWED_MODELS и TEAM_DEFAULT_MODEL_ID верифицированы в OpenRouter
- [ ] Supabase Storage bucket `images` существует и имеет правильные RLS политики
- [ ] `/api/compare` покрыт route-level тестами
- [ ] Image Arena error format унифицирован
- [ ] `npm run smoke` проходит на staging/preview окружении
- [ ] `npm audit --audit-level=high` проходит (0 high/critical уязвимостей)
- [ ] 14-roadmap.md SYNC-маркеры обновлены
- [ ] Release checklist (`docs/release-checklist.md`) пройден

---

## 20. Финальный вывод

**Проект технически здоров.** Кодовая база чистая, архитектура последовательная, безопасность соблюдена на уровне, который пройдёт большинство production security review. На момент аудита проходили 275 автоматических тестов; current status update — 337 tests. CI настроен и работает.

**Главная задача перед public production release** — не фичи, а инфраструктурные gaps:

1. V200-02 Production Env Activation (P1) — Upstash Redis env, `ENABLE_TEAM_MODE=true`, `NEXT_PUBLIC_ENABLE_TEAM_MODE=true`, redeploy и production smoke.
2. Верификация Storage bucket `images` (P2).
3. Live OpenRouter/model verification, если доступны production credentials (P2).
4. Тесты для /api/compare (P2) — самый важный endpoint без тестов.

Кодовая база готова к следующей итерации. Current recommendation 2026-06-28: закрыть V200-02 `Release Gate P1 - Production Env Activation` перед PR30 и перед объявлением Team Mode активным в production.
