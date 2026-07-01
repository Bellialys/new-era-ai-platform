# 42 — v2.0 AI Team Mode: Architecture Audit & MVP Plan

## Назначение файла

Спецификация и план реализации **AI Team Mode** — режима последовательной командной работы
нескольких AI-ролей над одной задачей.

Статус: **реализовано в v2.0.0-alpha.1**. PR18–PR22 выполнены и merged on main; текущий незакрытый шаг — V200-02 `Release Gate P1 - Production Env Activation`.

Production Team Mode не считается активированным, пока в Vercel Production не выставлены `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `ENABLE_TEAM_MODE=true`, `NEXT_PUBLIC_ENABLE_TEAM_MODE=true`, не выполнен redeploy и не пройден production smoke.

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
model_key      → OpenRouter model key (напр. "meta-llama/llama-3.3-70b-instruct:free")
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
  taskId: string;
  steps: Array<{
    role: "planner" | "researcher" | "critic" | "finalizer";
    output: string;
    latencyMs: number;
    error?: string;
  }>;
  finalAnswer: string;
  totalLatencyMs: number;
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
TEAM_DEFAULT_MODEL_ID: "meta-llama/llama-3.3-70b-instruct:free",
MODE_SLUG_AI_TEAM: "ai-team-mode",
```

---

## 5. Новые файлы (MVP)

```
src/lib/arena/team-mode.ts          # роли, system prompts, типы
src/app/api/team-run/route.ts       # основной API route
src/app/api/team-run/route.test.ts  # contract tests
src/app/team/page.tsx               # server component страница
src/components/arena/team-arena.tsx # client component
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
│  │ Синтезированный результат...            │        │
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

Этот раздел является исторической записью реализации v2.0. PR18–PR22 уже выполнены; следующая активная задача находится в `.project/tasks/V200-02.json`.

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
- `src/components/arena/team-arena.tsx`

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
- AGENTS.md → снять `ai-team-mode` из раздела «Не делать раньше времени»
- Release checklist: smoke, load test (3 concurrent sessions), rate limit verification
- Обновить AGENTS.md текущую фазу и AGENTS.md версию

### V200-02 — Production Env Activation

- Добавить в Vercel Production `UPSTASH_REDIS_REST_URL` и `UPSTASH_REDIS_REST_TOKEN`.
- Добавить в Vercel Production `ENABLE_TEAM_MODE=true`.
- Добавить в Vercel Production `NEXT_PUBLIC_ENABLE_TEAM_MODE=true`.
- Выполнить production redeploy.
- Проверить `/api/health` публично: только `{ "status": "ok" }`.
- Проверить, что `/team` показывает активный UI.
- Проверить, что unauthenticated `POST /api/team-run` блокируется auth gate, а не `503` от feature flag.
- Проверить authenticated Team Mode run.
- Проверить Upstash-backed rate limits для Team Mode, admin routes и `/api/guest`.

---

## 8. Риски и ограничения

| Риск | Уровень | Митигация |
|---|---|---|
| Latency: 4 последовательных LLM-вызова ≈ 10-20 сек | Средний | Показывать прогресс по шагам; Vercel `maxDuration=60` уже есть |
| Vercel timeout (60s по умолчанию) | Средний | `export const maxDuration = 60` на route; выбирать быстрые модели |
| Стоимость: 4× больше токенов чем compare | Средний | Жёсткий rate limit (3/10мин), только авторизованные пользователи |
| Контекст растёт с каждым шагом | Низкий | Truncate prompts, ограничить output каждого шага (≤ 2000 chars) |
| Critic/Finalizer получают hallucinated plan | Низкий | Не хуже одного LLM-вызова; для MVP приемлемо |
| Суперпользователь обходит лимит через разные сессии | Низкий | Upstash Redis rate limit по userId (не per-request) |
| Параллельное выполнение шагов невозможно (sequential) | n/a | MVP spec: только sequential |

---

## 9. Security checklist для PR19

- [ ] Задача пользователя считается Untrusted Input: sanitization перед вставкой в system prompt
- [ ] System prompt фиксирован на сервере, не принимается из запроса
- [ ] `model_key` выбирается из константы на сервере, не из тела запроса
- [ ] API key не логируется, не включается в ответ
- [ ] Stack trace не возвращается клиенту
- [ ] Rate limit key = verified `userId`, не из тела запроса
- [ ] Auth gate: `kind=user` обязателен (guest/none → 401)
- [ ] Вывод каждой роли трунцируется перед передачей следующей (контроль длины контекста)
- [ ] Стандартный outer try/catch: все ошибки → `createErrorResponse` → 500

---

## 10. Связанные документы

- `14-roadmap.md` — порядок этапов
- `17-code-arena-spec.md` — Code Arena как прецедент нового режима
- `AGENTS.md` — правила проекта (п.8: Team Mode не раньше v2.0)
- `src/app/api/judge/route.ts` — прямой прототип sequential LLM step pattern
- `src/lib/server/arena-persistence.ts` — `saveArenaRun()` используется без изменений
