# 42 — v2.0 AI Team Mode: Architecture Audit & MVP Plan

## Назначение файла

Спецификация и план реализации **AI Team Mode** — режима последовательной командной работы
нескольких AI-ролей над одной задачей.

Статус: **реализовано в v2.0.0-alpha.1**. PR18–PR22 выполнены и merged on main; V200-02 `Release Gate P1 - Production Env Activation` подтверждён в production и закрыт как `done`.

Production Team Mode активирован в production alpha: Vercel Production содержит Vercel Marketplace aliases `KV_REST_API_URL`/`KV_REST_API_TOKEN`, `ENABLE_TEAM_MODE=true`, `NEXT_PUBLIC_ENABLE_TEAM_MODE=true`; redeploy и production smoke пройдены.

---

## 1. Описание фичи

Пользователь вводит одну задачу. Система запускает **4 фиксированных роли** последовательно:

```
Planner → Researcher → Critic → Finalizer
```

Каждая роль — один LLM-вызов с ролевым system prompt, где контекст предыдущих шагов
передаётся следующей роли. Итог — финальный ответ от Finalizer.

### Что входит в MVP

- Страница `/team` для ввода задачи
- `POST /api/team-run` — последовательное выполнение 4 шагов
- Сохранение сессии в существующие таблицы `tasks` + `model_responses`
- UI: задача, прогресс-шаги, финальный ответ
- Auth gate: только авторизованные пользователи

### Что НЕ входит в MVP

- Реальное время / streaming между шагами
- Агентная память / автономные циклы
- Tool use / функциональные вызовы
- Фоновые очереди / jobs
- Кастомные роли пользователя
- Параллельные ветки выполнения
- История в отдельном разделе (используем общий `/history`)
- Голосование на шагах (только на финальном ответе)
- Billing / marketplace ролей

---

## 2. Аудит существующей архитектуры

### 2.1 Что можно использовать без изменений

| Компонент | Файл | Применение в Team Mode |
|---|---|---|
| `fetchOpenRouterResponse()` | `src/lib/server/openrouter.ts` | Вызов LLM для каждой роли с `systemPrompt` |
| `saveArenaRun()` | `src/lib/server/arena-persistence.ts` | Сохранение сессии и ответов ролей |
| `resolveRequestIdentity()` | `src/lib/server/auth.ts` | Auth gate (только `kind=user`) |
| `checkRateLimit()` | `src/lib/server/rate-limit.ts` | Rate limit на сессию |
| `ApiError` + `createErrorResponse()` | `src/lib/server/utils.ts` | Стандартные ошибки |
| `logApiRequest()` | `src/lib/server/utils.ts` | Логирование |
| `getApiKey()` | `src/lib/server/openrouter.ts` | OpenRouter API ключ |
| `tasks` table | DB | `mode_slug='ai-team-mode'` (уже в constraint), `task_text`, `settings` JSONB |
| `model_responses` table | DB | Один ряд на шаг: `display_name`=роль, `model_key`=модель, `response_text`=вывод |
| `tasks.settings` JSONB | DB | `{ preset, stepCount, finalAnswer }` |
| `tasks.judge_verdict` JSONB | DB | Не используется в Team Mode MVP |

### 2.2 mode_slug — уже готов в БД

Миграция `20260608041610_align_mvp_tasks_and_votes.sql` уже содержит:

```sql
check (
  mode_slug in (
    'prompt-arena', 'code-arena', 'multi-model-battle',
    'ai-team-mode',          -- ← уже есть
    'judge-mode', 'leaderboard'
  )
)
```

**Новая миграция для MVP не нужна.**

### 2.3 Паттерн Judge Mode — прямой прототип

`/api/judge` уже реализует ровно ту же структуру:
- `fetchOpenRouterResponse(userPrompt, modelId, { systemPrompt: JUDGE_SYSTEM_PROMPT })`
- Сохранение результата в существующую таблицу
- Auth + rate limit через стандартные хелперы

Team Mode — это Judge Mode, расширенный до 4 шагов с передачей контекста между ними.

### 2.4 Хранение шагов в model_responses

Каждый шаг команды сохраняется как ряд в `model_responses`:

```
task_id        → UUID сессии (из tasks.id)
model_key      → OpenRouter model key (напр. "google/gemma-4-26b-a4b-it:free")
display_name   → Роль: "Planner" | "Researcher" | "Critic" | "Finalizer"
response_text  → Вывод этой роли
status         → "success" | "error"
latency_ms     → Время ответа шага
```

Финальный ответ Finalizer также хранится в `model_responses` + дублируется в
`tasks.settings.finalAnswer` для быстрого доступа без JOIN.

---

## 3. Роли MVP

### Роль 1: Planner

**Задача:** разбить задачу на структурированный план.

```
SYSTEM: You are a strategic planner. Break the user's task into a clear,
numbered action plan. Be concise: 5-8 steps maximum. Focus on WHAT to do,
not HOW. Output only the plan, no preamble.
```

### Роль 2: Researcher

**Задача:** наполнить каждый пункт плана знаниями и анализом.

```
SYSTEM: You are a research analyst. Given a task and its action plan,
expand each step with relevant knowledge, examples, and analysis.
Be thorough but structured. Stay within the plan's scope.

Context — Action plan from Planner:
{plannerOutput}
```

### Роль 3: Critic

**Задача:** выявить слабые места, риски, пропущенные детали.

```
SYSTEM: You are a critical reviewer. Review the plan and research below.
Identify: (1) logical gaps or missing steps, (2) risks or edge cases,
(3) assumptions that may not hold. Be constructive, not destructive.
Output a numbered list of findings.

Context — Plan: {plannerOutput}
Context — Research: {researcherOutput}
```

### Роль 4: Finalizer

**Задача:** синтезировать всё в финальный связный ответ.

```
SYSTEM: You are a senior synthesizer. Using the plan, research, and critique
below, produce a clear, actionable final answer to the original task.
Incorporate the critique's valid points. Write for a professional audience.
Output only the final answer.

Context — Plan: {plannerOutput}
Context — Research: {researcherOutput}
Context — Critique: {criticOutput}
```

---

## 4. API: POST /api/team-run

### Request

```typescript
{
  task: string;          // 10–4000 chars
  preset?: "balanced";   // MVP: только "balanced" (4 роли выше)
  modelId?: string;      // опционально; default: TEAM_DEFAULT_MODEL_ID
}
```

### Response (200 OK)

```typescript
{
  taskId: string | null;
  steps: Array<{
    roleId: "planner" | "researcher" | "critic" | "finalizer";
    output: string;
    latencyMs: number;
  }>;
  finalAnswer: string;
}
```

### Error responses

```typescript
// 401 — не авторизован
{ status: "error", errorCode: "AUTH_REQUIRED", message: "..." }

// 429 — rate limit
{ status: "error", errorCode: "RATE_LIMIT", message: "..." }

// 400 — валидация
{ status: "error", errorCode: "VALIDATION_ERROR", message: "..." }

// 500 — внутренняя ошибка
{ status: "error", errorCode: "INTERNAL_ERROR", message: "..." }
```

### Rate limits (предложение)

| Идентичность | Лимит |
|---|---|
| `kind=user` | 3 сессии / 10 мин (тяжёлый вызов — 4×LLM) |
| `kind=guest` / `kind=none` | блокируется 401 |

### Константы для `ARENA_CONSTANTS`

```typescript
TEAM_RUN_RATE_LIMIT_MAX: 3,
TEAM_RUN_RATE_LIMIT_WINDOW_MS: 600_000,    // 10 мин
TEAM_RUN_TASK_MIN_LENGTH: 10,
TEAM_RUN_TASK_MAX_LENGTH: 4000,
TEAM_DEFAULT_MODEL_ID: "google/gemma-4-26b-a4b-it:free",
MODE_SLUG_AI_TEAM: "ai-team-mode",
```

`TEAM_DEFAULT_MODEL_ID` обязан одновременно входить в `ALLOWED_MODELS` и live OpenRouter text discovery. На refresh 2026-09-17 `npm run models:verify` подтвердил текущий каталог: `8 text, 3 image`. Scheduled/manual `npm run models:verify` проверяет условия через provider discovery (`03:17 UTC`) и получает Actions secret `OPENROUTER_API_KEY` только на live-step. Pull request CI выполняет только mock `npm run test:models-verify` без provider secret.

---

## 5. Новые файлы (MVP)

```
src/lib/arena/team-mode.ts          # роли, system prompts, типы
src/app/api/team-run/route.ts       # основной API route
src/app/api/team-run/route.test.ts  # contract tests
src/app/team/page.tsx               # server component страница
src/app/team/team-run-form.tsx      # client form component
```

**Итого: 5 файлов.** Укладывается в ограничение.

---

## 6. Схема UI (страница /team)

```
┌─────────────────────────────────────────────────────┐
│  AI Team Mode                             v2.0 NEW  │
├─────────────────────────────────────────────────────┤
│  Введите задачу для команды AI                      │
│  ┌───────────────────────────────────────────┐      │
│  │ Опишите задачу...                         │      │
│  └───────────────────────────────────────────┘      │
│  [Запустить команду]                                │
├─────────────────────────────────────────────────────┤
│  Шаг 1: Planner      ✓ готов (1.2s)                │
│  ┌─────────────────────────────────────────┐        │
│  │ 1. Определить цели...                   │        │
│  └─────────────────────────────────────────┘        │
│  Шаг 2: Researcher   ✓ готов (3.1s)                │
│  ...                                                │
│  Шаг 3: Critic       ✓ готов (2.4s)                │
│  ...                                                │
│  Шаг 4: Finalizer    ✓ готов (2.8s)                │
│  ...                                                │
├─────────────────────────────────────────────────────┤
│  Финальный ответ                                    │
│  ┌─────────────────────────────────────────┐        │
│  │ Синтезированный результат...            │
│  └─────────────────────────────────────────┘        │
│  [Копировать]  [В историю]                          │
└─────────────────────────────────────────────────────┘
```

**Компоненты:**
- `TeamArena` (client) — форма ввода, запуск, прогресс-шаги
- `TeamStepCard` — карточка одного шага (роль, вывод, latency, статус)
- `/team/page.tsx` — server component, передаёт auth state

---

## 7. Последовательность PR

Этот раздел является исторической записью реализации v2.0. PR18–PR22 и V200-02 уже выполнены; следующую release-hardening задачу нужно заводить отдельным task-файлом.

### PR16 — Docs / State / Planning

Файлы: `42-v2-ai-team-mode-plan.md`, `.project/tasks/V200-01.json`, `.project/state.json`
Нет runtime кода. Только аудит и план.

### PR17 — Миграция (ПРОПУСТИТЬ для MVP)

`mode_slug='ai-team-mode'` уже в БД constraint. `tasks.settings` JSONB уже есть.
`model_responses` подходит без изменений.
**PR17 пропускается.** Если понадобится отдельная таблица `team_sessions` — это v2.1+.

### PR18 — Server helpers + unit tests

Новые файлы:
- `src/lib/arena/team-mode.ts` — экспортирует `TEAM_ROLES`, `buildRolePrompt()`, `TeamRunResult`
- Unit tests для `buildRolePrompt()` (детерминированная функция, не требует LLM mock)

Никакого UI, никакого API route. Только библиотечный слой с тестами.

### PR19 — /api/team-run + contract tests

Новые файлы:
- `src/app/api/team-run/route.ts`
- `src/app/api/team-run/route.test.ts`

Мокирует `fetchOpenRouterResponse` и `saveArenaRun`. Покрывает:
- auth gate (гость → 401)
- rate limit (→ 429)
- validation (пустая задача, слишком длинная)
- успешный запуск → 200 с taskId + steps + finalAnswer
- ошибка одного шага → partial результат (не крашит всю сессию)
- provider error → 500 safe response

### PR20 — /team UI page

Новые файлы:
- `src/app/team/page.tsx`
- `src/app/team/team-run-form.tsx`

Изменения в существующих:
- `src/components/layout/site-header.tsx` — добавить ссылку «Команда»
- `src/app/page.tsx` — добавить карточку Team Mode на главной

### PR21 — История / интеграция

Используем существующий `/history` — `mode_slug='ai-team-mode'` задачи появятся
автоматически в общей истории без изменений. PR21 — только visual polish:
- В `history` card показывать роль вместо названия модели для team задач
- Детальная страница `/history/[taskId]` показывает шаги по порядку

### PR22 — Стабилизация + v2.0 Release Checklist

- state.json → `currentVersion: "2.0.0-alpha.1"`
- AGENTS.md → снять `ai-team-mode` блокер после release-gate подтверждения
- полный regression gate: typecheck, lint, test, build, docs/state, smoke

---

## 8. Release-hardening status

На 2026-09-17 Team Mode runtime default синхронизирован с provider-recovery catalog:

```text
TEAM_DEFAULT_MODEL_ID = google/gemma-4-26b-a4b-it:free
```

Это значение покрыто unit tests, входит в `ALLOWED_MODELS` и было подтверждено live `models:verify`. Production Supabase model catalog остаётся отдельным release gate до применения pending migration `20260824193629_recover_openrouter_model_catalog.sql`.
