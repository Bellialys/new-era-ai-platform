# AGENTS

## ⚡ Первым делом для AI-агентов

Перед любой работой прочитать обязательно:

1. **`24-codex-active-rule-set.md`** — индекс действующих правил Codex, включает список всех обязательных документов и главный алгоритм работы.
2. **`.project/state.json`** — текущая версия, фаза и активные задачи.
3. **`14-roadmap.md`** — главный источник порядка будущих этапов.

Если читаешь только один файл — читай `24-codex-active-rule-set.md`.

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
2. **`.project/state.json` и `.project/tasks/*.json`** — текущая версия, фаза, активные задачи и статусы.
3. **`14-roadmap.md`** — порядок этапов разработки.
4. **`21-access-gate-policy.md`** — обязательные правила доступа (AUTH_REQUIRED, guest).
5. **`23-codex-quality-rules.md`** — качество реализации, self-review, документация.
6. Старые документы не имеют приоритета над более новыми, если они конфликтуют с этим индексом.

---

## Текущий статус проекта

<!-- SYNC:CURRENT_PHASE_START -->
**Текущая фаза:** v0.7 - Code Arena Lite stabilization
<!-- SYNC:CURRENT_PHASE_END -->

<!-- SYNC:PROJECT_VERSION_START -->
**Текущая версия:** `v0.7.0-alpha.1`
<!-- SYNC:PROJECT_VERSION_END -->

<!-- SYNC:PROJECT_STATUS_START -->
**Статус проекта:** `in_development`
<!-- SYNC:PROJECT_STATUS_END -->

> **Разграничение версий:**
> - `v0.7.0-alpha.1` — текущая alpha-стабилизация Code Arena Lite.
> - `v0.6` — реализация Auth, Guest Mode, Profile, Avatar, Email Management и User-linked Arena находится в verification, не `done`.
> - `v0.5.4` — Vote Security & Auth Foundation находится в verification до commit/release gate.
> - `v0.5.3` — последний полностью зафиксированный стабильный MVP-релиз.

```text
v0.7 - Code Arena Lite stabilization
# текущая alpha: Code Arena Lite без запуска пользовательского кода
# v0.6/v0.7 нельзя считать stable, пока не пройдены typecheck, lint, build, docs:check, smoke и нужные DB checks
```

Ближайший плановый UX-подэтап:

```text
v0.7.1 - Arena UX and Fair Voting
# streaming, blind voting, Code Diff, быстрый share/copy и guest anti-abuse
```

Следующий главный этап:

```text
v0.8 - History and Production Readiness
# история сравнений, публичные ссылки, критерии оценки, preview/production smoke, observability baseline
```

---

## Главные правила

1. Не добавлять секретные ключи в репозиторий.
2. Не коммитить `.env.local`.
3. Все AI-запросы должны идти через backend route handlers.
4. Не вызывать OpenRouter напрямую из frontend.
5. Перед новой функцией выполнять `typecheck`, `lint`, `build`.
6. Для API/routing/Supabase/OpenRouter изменений выполнять `npm run smoke`, если он применим.
7. Не добавлять Code Arena Runner раньше **v1.7** и без отдельного sandbox/security review.
8. Не добавлять AI Team Mode раньше **v2.0**.
9. Сохранять поэтапную разработку без хаоса.

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

В основном режиме `v0.7.0-alpha.1`:

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

- **Code Arena Runner / запуск пользовательского кода** — не раньше v1.7
- **Judge Mode** — не раньше v1.3
- **Leaderboard** — не раньше v1.4
- **AI Team Mode** — не раньше v2.0

Добавление любой из этих функций раньше указанных версий требует явного подтверждения от пользователя.
<!-- SYNC:DEFERRED_FEATURES_END -->

---

## CLAUDE.md

Файл `CLAUDE.md` существует в корне проекта и содержит краткие правила для AI-агентов и ссылки на главные документы.

Конфигурация для Claude/Codex задаётся через:
- `CLAUDE.md` — краткий обзор стека, ключевых ограничений и команд для AI-агентов;
- `AGENTS.md` (этот файл) — общие правила и текущий статус проекта;
- `24-codex-active-rule-set.md` — полный индекс действующих правил.
