# AGENTS

## ⚡ Первым делом для AI-агентов

Стартовый минимум перед любой работой:

1. **`24-codex-active-rule-set.md`** — индекс действующих правил Codex, включает список всех обязательных документов и главный алгоритм работы.
2. **`23-codex-quality-rules.md`** — стандарты качества выполнения задач и чек-листы; обязателен к полному прочтению.
3. **`.project/state.json`** — текущая версия, фаза и активные задачи.
4. **`14-roadmap.md`** — главный источник порядка будущих этапов.
5. **`25-production-excellence.md`** — production-grade стандарты для v1.7+.

Полный обязательный список документов находится в `24-codex-active-rule-set.md`,
раздел **«Обязательные документы перед работой Codex»**. Если читаешь только
один файл — читай `24-codex-active-rule-set.md`.

---

## Назначение файла

Этот файл содержит правила для AI-агентов и разработчиков, которые помогают работать над проектом **Новая эпоха**.

Главный источник текущей версии и активных задач: `.project/state.json` и `.project/tasks/*.json`.
Главный источник порядка будущих этапов: `14-roadmap.md`.
Главный активный набор правил для Codex/AI-агентов: `24-codex-active-rule-set.md`.

Если этот файл конфликтует с `.project/state.json` по текущей версии или фазе — правильным считается `.project/state.json`.
Если документы конфликтуют по порядку будущих этапов — правильным считается `14-roadmap.md`.

---

## Иерархия документов

При конфликте документов применять в следующем порядке:

1. **Безопасность и защита данных** — абсолютный приоритет.
2. **`23-codex-quality-rules.md`** — стандарты качества выполнения задач, self-review и чек-листы; имеет приоритет сразу после безопасности для вопросов надёжности реализации.
3. **`.project/state.json` и `.project/tasks/*.json`** — текущая версия, фаза, активные задачи и статусы.
4. **`14-roadmap.md`** — порядок этапов разработки.
5. **`21-access-gate-policy.md`** — обязательные правила доступа (AUTH_REQUIRED, guest).
6. **`25-production-excellence.md`** — дополнительные production-grade требования для v1.7+.
7. Старые документы не имеют приоритета над более новыми, если они конфликтуют с этим индексом.

---

## Текущий статус проекта

<!-- SYNC:CURRENT_PHASE_START -->
**Текущая фаза:** v2.0 - AI Team Mode
<!-- SYNC:CURRENT_PHASE_END -->

<!-- SYNC:PROJECT_VERSION_START -->
**Текущая версия:** `v2.0.0-alpha.1`
<!-- SYNC:PROJECT_VERSION_END -->

<!-- SYNC:PROJECT_STATUS_START -->
**Статус проекта:** `in_development`
<!-- SYNC:PROJECT_STATUS_END -->

> **Разграничение версий:**
> - `v2.0.0-alpha.1` — **текущий alpha-этап**: AI Team Mode (4 роли за feature flag; только авторизованные пользователи).
> - `v1.0.0` — **текущий стабильный релиз**: Stable Arena MVP (production smoke passed, Vercel live).
> - `v1.7.0` — предыдущий завершённый этап: Code Arena Runner.
> - `v1.8.0` — завершённый этап: Image Arena MVP.
> - `v0.5.3` — последний полностью зафиксированный стабильный MVP-релиз до v1.0.

```text
v2.0.0-alpha.1 - AI Team Mode
# реализовано: /api/team-run, /team UI за feature flag, /api/image-compare, audit log, Upstash rate limit coverage
# v2.0.0-alpha.1: typecheck ✓  lint ✓  build ✓  test 337/337 ✓  docs:check ✓
# production Team Mode activation: V200-02 done ✓ (Upstash/KV env + ENABLE_TEAM_MODE + NEXT_PUBLIC_ENABLE_TEAM_MODE + redeploy + smoke)
```

Текущий alpha-этап:

```text
v2.0 - AI Team Mode
# 4 роли (Planner → Researcher → Critic → Finalizer) за NEXT_PUBLIC_ENABLE_TEAM_MODE; только авторизованные пользователи
```

---

## Главные правила

1. Не добавлять секретные ключи в репозиторий.
2. Не коммитить `.env.local`.
3. Все AI-запросы должны идти через backend route handlers.
4. Не вызывать OpenRouter напрямую из frontend.
5. Перед новой функцией выполнять `typecheck`, `lint`, `build`.
6. Для API/routing/Supabase/OpenRouter изменений выполнять `npm run smoke`, если он применим.
7. Не запускать пользовательский код внутри server-side процесса приложения; в v1.7 запуск разрешён только через внешний runner с auth/rate limit и требованиями изоляции из `25-production-excellence.md`, раздел `6.1 Code Runner Isolation Requirements`.
8. Не добавлять AI Team Mode раньше **v2.0**.
9. Сохранять поэтапную разработку без хаоса.
10. Все решения должны приниматься с расчётом на масштабирование до 1M+ пользователей.
11. Любой код должен быть сопровождаемым: полная типизация, отсутствие `any` без обоснования, документированные публичные интерфейсы.
12. При реализации новой функции проводить мини-анализ: «Как это делают в Google/Meta/Stripe?» (если применимо).
13. Любой AI-generated output считается Untrusted Input и рендерится только по правилам `25-production-excellence.md`, раздел `9.1 AI Output Sanitization`.
14. Любые Next.js App Router data/mutation изменения должны учитывать cache и revalidation по `23-codex-quality-rules.md`, раздел `17`.

## Режим работы AI-агентов

- Не сокращать искусственно анализ, планирование, self-review и отчёты, если задача сложная, рискованная или затрагивает архитектуру, безопасность, API, БД, auth, billing, runner, deployment или документационные правила.
- Для сложных задач фиксировать проверяемый reasoning summary: что известно, какие варианты рассмотрены, почему выбран подход, какие риски остаются, какие проверки подтверждают результат.
- Если бизнес-логика неоднозначна, не останавливаться на вопросе «что делать?». Сначала предложить 2-3 трактовки с плюсами/минусами и рекомендуемым вариантом.
- Если задача затрагивает больше 5 файлов, сначала выполнить Stop Signal: предложить план изменений по файлам и дождаться подтверждения пользователя.
- Для docs-only задач всё равно выполнять self-review, `state:check`, `docs:check`, staged diff review и проверку отсутствия секретов.
- Решения уровня production-grade должны опираться на evidence: код, state, roadmap, проверки, официальные docs или признанные стандарты (OWASP, NIST, W3C, Google SRE, OpenAPI, Supabase/Vercel/Next.js docs).

---

## Проверка перед commit

```bash
git pull
# подтянуть последние изменения

npm run typecheck
# проверяет TypeScript

npm run lint
# проверяет ESLint

npm run build
# проверяет production-сборку

npm run smoke
# проверяет базовый health/models smoke-check (для API/Supabase/OpenRouter изменений)

npm run verify
# комплексная проверка: запускает все 4 команды последовательно

npm run state:check
# проверяет project state и task-файлы

npm run docs:check
# проверяет синхронизацию документации

npm audit
# проверяет уязвимости зависимостей

npm run test
# если тесты есть, проверяет текущую тестовую базу
```

---

## Текущая архитектура

### API Routes

```text
src/app/api/models/route.ts
# список разрешённых моделей из Supabase catalog с fallback

src/app/api/compare/route.ts
# сравнение моделей через backend/OpenRouter

src/app/api/health/route.ts
# базовая диагностика health/configuration

src/app/api/vote/route.ts
# сохранение Winner vote поверх server-side votes helper

src/app/api/judge/route.ts
# AI judge verdict для сохранённых сравнений

src/app/api/code-run/route.ts
# внешний runner для авторизованных пользователей; пользовательский код не выполняется на сервере приложения

src/app/api/admin/audit/route.ts
# чтение audit_log для admin-пользователей

src/app/api/admin/usage/route.ts
# admin-сводка usage по пользователям
```

### Server Lib

```text
src/lib/server/models.ts
# server-side fallback allowlist

src/lib/server/model-catalog.ts
# server-side model catalog resolver

src/lib/server/openrouter.ts
# интеграция OpenRouter

src/lib/server/rate-limit.ts
# базовый in-memory rate limit для дорогих API-запросов

src/lib/server/arena-persistence.ts
# best-effort сохранение Prompt Arena в Supabase

src/lib/server/votes.ts
# server-side voting helper для актуальной votes-схемы

src/lib/server/supabase.ts
# server-only Supabase service-role client (persistence, обходит RLS)

src/lib/server/auth.ts
# серверная идентичность: проверенный пользователь или guest-cookie

src/lib/server/utils.ts
# ошибки, валидация, логирование
```

### Client Lib

```text
src/lib/supabase.ts
# браузерный Supabase client на cookie-сессиях (@supabase/ssr)

src/proxy.ts
# аутентификационный proxy Next.js 16, вызывает updateSession() для обновления Supabase-токена на каждый запрос

src/lib/supabase-proxy.ts
# реализация updateSession() (SSR cookie proxy)
```

### UI Components

```text
src/components/arena
# UI Prompt Arena
```

### Auth Pages & Components

```text
src/app/login/
# страница входа (SSR, готова как UI-заготовка)

src/app/signup/
# страница регистрации (UI-заготовка)

src/components/auth/
# auth-компоненты: login-form.tsx, signup-form.tsx, auth-status.tsx, reset/update password forms
# статус: реализация в verification до полного release gate
```

---

## Голосование и идентичность

```text
/api/vote и /api/compare никогда не доверяют userId из тела запроса.
# идентичность берётся из проверенной сессии Supabase или httpOnly guest-cookie

best-голос пишется атомарным RPC cast_best_vote.
# замена ответа + вставка в одной транзакции
```

---

## Важное правило по моделям

В основном режиме:

```text
modelIds = Supabase models.id UUID
# frontend не должен отправлять OpenRouter model_key напрямую
```

В fallback-режиме, если Supabase catalog недоступен:

```text
modelIds могут временно совпадать с server-side allowlist keys
# backend всё равно проверяет выбранные модели на сервере
```

---

## Не делать раньше времени

<!-- SYNC:DEFERRED_FEATURES_START -->
Следующие функции заморожены до соответствующих этапов roadmap:

- **AI Team Mode** — не раньше v2.0
- **Image Arena MVP** — не раньше v1.8
- **Расширенный собственный code sandbox вместо внешнего runner** — только после отдельного sandbox/security review и проверки `25-production-excellence.md`, раздел `6.1`

Добавление любой из этих функций раньше указанных версий требует явного подтверждения от пользователя.
<!-- SYNC:DEFERRED_FEATURES_END -->

---

## CLAUDE.md

Файл `CLAUDE.md` существует в корне проекта и содержит краткие правила для AI-агентов и ссылки на главные документы.

Конфигурация для Claude/Codex задаётся через:
- `CLAUDE.md` — краткий обзор стека, ключевых ограничений и команд для AI-агентов;
- `AGENTS.md` (этот файл) — общие правила и текущий статус проекта;
- `24-codex-active-rule-set.md` — полный индекс действующих правил.
