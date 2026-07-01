# 18 - AI Team Mode Spec

> **Реализовано в v2.0.0-alpha.1.** Документ изначально был написан как спецификация будущего (v0.5.3); секции с пометкой `[historical]` описывают устаревшую архитектуру (team_configs, team_steps, maxRoles=3, POST /api/team). Актуальная реализация: `POST /api/team-run`, 4 роли, таблицы `team_runs` + `team_run_steps`.

## Назначение файла

Этот файл описывает будущий режим **AI Team Mode** для проекта **Новая эпоха**.

AI Team Mode - это продвинутый режим, где несколько AI-моделей работают не как отдельные конкуренты, а как команда с ролями, порядком выполнения, промежуточными шагами и финальным собранным результатом.

Главное правило файла:

```text
AI Team Mode не входит в MVP.
# сначала нужно довести до стабильного состояния Prompt Arena

AI Team Mode начинается только с v2.0.
# режим нельзя внедрять раньше roadmap

14-roadmap.md является главным источником порядка версий.
# если есть конфликт, ориентируемся на roadmap
```
---

# 1. Место AI Team Mode в проекте

AI Team Mode является поздним режимом проекта.

Он появляется только после того, как уже готовы:

```text
v1.0 - Stable Prompt Arena
# базовый рабочий продукт

v0.7 - Code Arena Lite
# сравнение решений по коду без запуска чужого кода

v1.2 - Multi Model Battle
# формальное соревнование моделей

v1.3 - Judge Mode
# автоматическая оценка ответов

v1.4 - Leaderboard
# рейтинги и агрегированная статистика

v0.6 - Accounts and Profiles
# пользователи, профили, guest mode и база для персональной истории

v1.6 - Admin Panel and Limits
# лимиты, управление моделями, контроль расходов

v1.7 - Code Arena Runner
# sandbox и запуск кода, если он будет реализован

v2.0 - AI Team Mode
# командная работа нескольких AI-ролей
```

AI Team Mode нельзя делать до `v2.0`, потому что он зависит от:

- стабильной обработки AI-запросов;
- сохранения задач и ответов;
- истории запусков;
- лимитов пользователей;
- allowlist моделей;
- логирования расходов;
- админ-контроля;
- понятного UI;
- безопасной backend-архитектуры.

---

# 2. Что делает AI Team Mode

Пользователь вводит сложную задачу.

Система выбирает командный процесс и отправляет задачу нескольким AI-ролям.

Каждая роль выполняет свою часть работы.

Пример:

```text
Planner
# разбивает задачу на этапы

Architect
# предлагает архитектуру решения

Developer
# предлагает реализацию

Tester
# проверяет возможные ошибки

Security Reviewer
# проверяет риски безопасности

Editor
# собирает финальный ответ
```

Итогом становится не набор независимых ответов, а один финальный результат команды.

---

# 3. Почему режим не входит в MVP

AI Team Mode нельзя добавлять в ранний MVP по следующим причинам:

```text
много AI-запросов;
# стоимость быстро растёт

много промежуточных шагов;
# нужна дополнительная база данных

сложный UI;
# нужно показывать цепочку ролей и прогресс

сложная обработка ошибок;
# одна роль может упасть, а остальные уже выполнились

нужны лимиты;
# без лимитов пользователь может запустить дорогую цепочку

нужен allowlist моделей;
# нельзя позволять подставлять любые модели

нужен backend feature flag;
# режим должен быстро отключаться
```

Поэтому до `v2.0` этот режим должен оставаться только в документации и не должен влиять на MVP.

---

# 4. Главный принцип первой версии

Первая версия AI Team Mode должна быть ограниченной.

Нельзя начинать с бесконечных цепочек, нескольких раундов, сложных команд и автоматического самоулучшения.

Для `v2.0` используется минимальный безопасный вариант:

```text
максимум 3 роли;
# контроль стоимости

максимум 1 раунд;
# защита от бесконечного цикла

только pipeline flow;
# роли выполняются последовательно

только allowlist моделей;
# контроль доступа и расходов

каждый шаг сохраняется;
# можно восстановить выполнение

режим выключается backend feature flag;
# ENABLE_TEAM_MODE
```

---

# 5. Канонические роли

В проекте используется единый набор ролей.

```text
Planner
# планирует задачу и разбивает её на этапы

Architect
# проектирует архитектуру решения

Developer
# предлагает реализацию, код или техническое решение

Tester
# проверяет логику, ошибки, тестовые сценарии и крайние случаи

Security Reviewer
# проверяет безопасность, секреты, env, API, sandbox и опасные действия

Critic
# ищет слабые места ответа

Editor
# собирает финальный результат в понятный вид

Judge
# оценивает итоговый результат по критериям
```

## Таблица ролей

| Роль | Назначение | Когда использовать |
|---|---|---|
| Planner | Разбивает задачу на этапы | Для сложных задач, проектов и планирования |
| Architect | Проектирует структуру решения | Для архитектуры, базы данных, API и систем |
| Developer | Предлагает реализацию | Для программирования и технических задач |
| Tester | Проверяет ошибки и тестовые сценарии | Для QA, тестирования и проверки логики |
| Security Reviewer | Проверяет безопасность | Для API, env, sandbox, ключей и пользовательского кода |
| Critic | Ищет слабые места | Для улучшения качества ответа |
| Editor | Собирает финальный результат | Для итогового ответа пользователю |
| Judge | Оценивает результат | Для выбора лучшего варианта или выставления оценки |

---

# 6. Обязательная роль Editor

В первой версии AI Team Mode роль `Editor` должна быть обязательной.

Причина:

```text
несколько AI-ответов не равны готовому результату.
# нужен финальный сборщик

Editor приводит результат к единому виду.
# пользователь получает один понятный ответ

Editor убирает повторы и противоречия.
# командная работа становится полезной
```

Минимальная команда для `v2.0`:

```text
Planner -> Critic -> Editor
# безопасная и недорогая первая команда
```

---

# 7. Security Reviewer

`Security Reviewer` - важная роль для проекта.

Она нужна, потому что платформа работает с:

- OpenRouter API key;
- Supabase publishable key;
- Supabase service role key;
- Next.js API routes;
- Vercel Environment Variables;
- пользовательскими prompt-запросами;
- будущим Code Arena Runner;
- sandbox;
- разными ролями моделей.

`Security Reviewer` проверяет:

```text
секреты;
# не попали ли API-ключи в код или ответ

NEXT_PUBLIC;
# не вынесены ли серверные ключи в frontend

опасные команды;
# eval, exec, child_process, shell, удаление файлов

API-риски;
# нет ли утечки данных через endpoint

Supabase RLS;
# не нарушены ли права доступа

sandbox-риски;
# код не должен видеть env и файловую систему проекта

расходы;
# нет ли слишком дорогой цепочки моделей
```

---

# 8. Типы командного процесса

В базе используется поле:

```text
flow_type
# тип командного процесса
```

В API используется camelCase:

```text
flowType
# поле в request body
```

Не использовать `schema` как бизнес-поле, потому что `schema` является техническим термином PostgreSQL.

## Поддерживаемые значения flow_type

Для первой версии `v2.0`:

```text
pipeline
# роли выполняются последовательно
```

Для будущих версий:

```text
critique
# ответ создаётся, критикуется и улучшается

parallel
# несколько ролей работают параллельно, потом Editor собирает итог
```

В `v2.0` разрешён только `pipeline`.

---

# 9. Pipeline flow

`pipeline` - базовый безопасный процесс.

Пример полного pipeline:

```text
Planner -> Architect -> Developer -> Tester -> Security Reviewer -> Critic -> Editor -> Judge
```

Для первой версии полный pipeline не используется.

Первая версия должна ограничиваться тремя ролями.

Пример минимального pipeline:

```text
Planner -> Critic -> Editor
# планирование, критика, финальная сборка
```

Пример технического pipeline:

```text
Architect -> Security Reviewer -> Editor
# архитектура, проверка рисков, финальный ответ
```

Пример code review pipeline:

```text
Developer -> Tester -> Security Reviewer
# без запуска кода, только анализ
```

---

# 10. Critique flow

`critique` - будущий процесс, не для первой версии.

Пример:

```text
Developer -> Critic -> Developer -> Editor -> Judge
# решение, критика, улучшение, сборка, оценка
```

Почему не добавлять в `v2.0`:

```text
нужны дополнительные раунды;
# стоимость выше

нужна сложная логика остановки;
# иначе цепочка может стать слишком длинной

нужны usage logs и лимиты;
# контроль расходов обязателен
```

Critique flow можно добавить только после стабильной работы pipeline.

---

# 11. Ограничения v2.0 (актуально)

Реализованные ограничения в v2.0.0-alpha.1:

```text
roles = 4 (fixed)
# Planner → Researcher → Critic → Finalizer; порядок фиксирован

maxRounds = 1
# один проход, без итераций

flowType = pipeline
# строго последовательная цепочка; параллельных вызовов нет

Finalizer required
# четвёртая роль всегда собирает финальный ответ

allowlist models only
# только ALLOWED_MODELS; неизвестный ID → TEAM_DEFAULT_MODEL_ID

auth users only
# только kind === "user"; гости получают 401

rate limit = 3/10min per user
# Upstash Redis в production; in-memory локально

context truncation = 2000 chars
# контекст обрезается между шагами для экономии токенов
```

> `[historical]` В исходной спецификации `maxRoles = 3`. В реализации зафиксировано 4 роли.

---

# 12. Feature flags

Для AI Team Mode нужны два feature flag.

```env
NEXT_PUBLIC_ENABLE_TEAM_MODE=false
# показывает или скрывает страницу /team во frontend

ENABLE_TEAM_MODE=false
# реально разрешает или запрещает /api/team-run на backend
```

Важное правило:

```text
NEXT_PUBLIC_ENABLE_TEAM_MODE не является защитой.
# пользователь может вызвать API вручную

ENABLE_TEAM_MODE является обязательной backend-проверкой.
# endpoint должен быть закрыт на сервере
```

Backend обязан проверять `ENABLE_TEAM_MODE` до создания задачи, вызова OpenRouter и записи в базу.

---

# 13. База данных

AI Team Mode использует таблицы из DB v2 Foundation (`20260628031516_database_v2_foundation.sql`):

```text
team_runs
# один запуск Team Mode — один ряд (task_id, user_id, model_key, status, final_answer)

team_run_steps
# один ряд на роль (team_run_id, role_id, role_label, prompt, response, latency_ms)
# каскадное удаление при удалении team_runs (ON DELETE CASCADE)
```

Персистентность best-effort: сохранение выполняется, если Supabase доступен, и не блокирует ответ.

> `[historical]` Исходная спецификация описывала таблицы `team_configs` (шаблоны команд) и `team_steps` (шаги с `role_slug`, `status`, `round_number`). В финальной реализации эти схемы заменены на `team_runs` + `team_run_steps`. Таблицы `team_configs` и `team_steps` **не созданы и не планируются** в текущей ветке.

Они добавляются только перед `v2.0`.

---

# 14. Таблица team_configs

`team_configs` хранит шаблоны команд.

```sql
create table public.team_configs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  description text,
  flow_type text not null default 'pipeline',
  roles jsonb not null default '[]'::jsonb,
  is_public boolean not null default false,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint team_configs_flow_type_check check (
    flow_type in ('pipeline', 'critique', 'parallel')
  )
);
```

## Пример roles

```json
[
  {
    "role": "Planner",
    "model_key": "model/example-fast"
  },
  {
    "role": "Critic",
    "model_key": "model/example-balanced"
  },
  {
    "role": "Editor",
    "model_key": "model/example-fast"
  }
]
```

## Правила team_configs

```text
roles хранится в jsonb.
# состав команды может быть гибким

is_system = true.
# системный шаблон, созданный проектом

is_public = true.
# публичный шаблон для пользователей

user_id = null.
# системный или общий шаблон
```

---

# 15. Таблица team_runs

`team_runs` хранит один запуск AI Team Mode.

```sql
create table public.team_runs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  team_config_id uuid references public.team_configs(id) on delete set null,
  flow_type text not null default 'pipeline',
  status text not null default 'pending',
  max_roles integer not null default 3,
  max_rounds integer not null default 1,
  final_output text,
  final_response_id uuid references public.model_responses(id) on delete set null,
  error_message text,
  raw_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint team_runs_status_check check (
    status in ('pending', 'running', 'completed', 'partial', 'failed', 'cancelled')
  ),
  constraint team_runs_flow_type_check check (
    flow_type in ('pipeline', 'critique', 'parallel')
  ),
  constraint team_runs_max_roles_check check (max_roles between 1 and 8),
  constraint team_runs_max_rounds_check check (max_rounds between 1 and 5)
);
```

## Почему нужны final_output и final_response_id

```text
final_output
# простой финальный текст результата команды

final_response_id
# опциональная связь с model_responses
```

Для первой версии достаточно `final_output`.

`final_response_id` полезен позже для:

- Judge Mode;
- Leaderboard;
- истории;
- сравнения командных ответов;
- повторной оценки результата.

---

# 16. Таблица team_steps

`team_steps` хранит каждый шаг команды.

```sql
create table public.team_steps (
  id uuid primary key default gen_random_uuid(),
  team_run_id uuid not null references public.team_runs(id) on delete cascade,
  role_slug text not null,
  role_name text not null,
  model_key text not null,
  step_order integer not null,
  round_number integer not null default 1,
  input_text text,
  output_text text,
  status text not null default 'pending',
  error_message text,
  input_tokens integer,
  output_tokens integer,
  estimated_cost numeric(12, 6),
  raw_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint team_steps_status_check check (
    status in ('pending', 'running', 'completed', 'failed', 'skipped')
  ),
  constraint team_steps_step_order_check check (step_order >= 1),
  constraint team_steps_round_number_check check (round_number >= 1)
);
```

## Почему round_number, а не round

```text
round_number
# понятное поле для номера раунда

round
# не использовать, менее понятно и может путаться с техническими терминами
```

---

# 17. Индексы

```sql
create index team_configs_user_id_idx on public.team_configs (user_id);
create index team_configs_is_public_idx on public.team_configs (is_public);
create index team_configs_is_system_idx on public.team_configs (is_system);

create index team_runs_task_id_idx on public.team_runs (task_id);
create index team_runs_user_id_idx on public.team_runs (user_id);
create index team_runs_team_config_id_idx on public.team_runs (team_config_id);
create index team_runs_status_idx on public.team_runs (status);

create index team_steps_team_run_id_idx on public.team_steps (team_run_id);
create index team_steps_role_slug_idx on public.team_steps (role_slug);
create index team_steps_status_idx on public.team_steps (status);
```

---

# 18. API

## Endpoint

```text
POST /api/team-run
# запускает AI Team Mode (реализовано в v2.0.0-alpha.1)
```

Endpoint доступен только если:

```text
авторизованный пользователь (kind === "user")
# гости получают 401 AUTH_REQUIRED

модель находится в ALLOWED_MODELS allowlist
# нельзя подставлять произвольные OpenRouter ID; неизвестные fallback на TEAM_DEFAULT_MODEL_ID

лимит пользователя не превышен
# rate limit: 3 запроса / 10 минут на user UUID

prompt 10–4000 символов
# пустые или слишком длинные промпты отклоняются с 400 VALIDATION_ERROR
```

> `[current]` Backend gate `ENABLE_TEAM_MODE` реализован в `/api/team-run`: при значении, отличном от `"true"`, endpoint возвращает controlled `503 SERVICE_UNAVAILABLE` до запуска ролей, OpenRouter-вызовов и записи данных.

---

# 19. Request body

```json
{
  "prompt": "Спроектируй MVP платформы сравнения AI-моделей",
  "mode": "team-mode",
  "flowType": "pipeline",
  "teamConfigId": null,
  "roles": [
    {
      "role": "Planner",
      "model_key": "model/example-fast"
    },
    {
      "role": "Critic",
      "model_key": "model/example-balanced"
    },
    {
      "role": "Editor",
      "model_key": "model/example-fast"
    }
  ],
  "maxRounds": 1
}
```

## Поля request body

| Поле | Тип | Обязательное | Описание |
|---|---|---|---|
| prompt | string | Да | Сложная задача пользователя |
| mode | string | Нет | Значение `team-mode` |
| flowType | string | Нет | В v2.0 только `pipeline` |
| teamConfigId | string/null | Нет | ID сохранённой команды |
| roles | array | Да | Список ролей |
| roles[].role | string | Да | Каноническая роль |
| roles[].model_key | string | Да | OpenRouter model ID из allowlist |
| maxRounds | number | Нет | В v2.0 только `1` |

---

# 20. Response body

```json
{
  "success": true,
  "data": {
    "taskId": "00000000-0000-0000-0000-000000000000",
    "teamRunId": "11111111-1111-1111-1111-111111111111",
    "flowType": "pipeline",
    "status": "completed",
    "finalOutput": "Итоговый план MVP...",
    "finalResponseId": null,
    "steps": [
      {
        "stepId": "22222222-2222-2222-2222-222222222222",
        "role": "Planner",
        "modelKey": "model/example-fast",
        "stepOrder": 1,
        "roundNumber": 1,
        "status": "completed",
        "outputText": "План работы..."
      }
    ]
  }
}
```

---

# 21. Ошибки API

## Режим выключен

```json
{
  "success": false,
  "error": {
    "code": "TEAM_MODE_DISABLED",
    "message": "AI Team Mode сейчас отключён."
  }
}
```

## Слишком много ролей

```json
{
  "success": false,
  "error": {
    "code": "TEAM_TOO_MANY_ROLES",
    "message": "В первой версии AI Team Mode можно использовать максимум 3 роли."
  }
}
```

## Модель не разрешена

```json
{
  "success": false,
  "error": {
    "code": "MODEL_NOT_ALLOWED",
    "message": "Выбранная модель недоступна для этой роли."
  }
}
```

## Нет Editor

```json
{
  "success": false,
  "error": {
    "code": "EDITOR_ROLE_REQUIRED",
    "message": "Для AI Team Mode нужна роль Editor."
  }
}
```

---

# 22. Валидация

## Проверка prompt

```text
prompt обязателен.
# нельзя запускать пустую команду

prompt имеет max length.
# контроль токенов и стоимости

prompt очищается от опасных системных инструкций.
# базовая защита от prompt injection
```

## Проверка flowType

```text
pipeline
# разрешено в v2.0

critique
# запрещено в v2.0, можно позже

parallel
# запрещено в v2.0, можно позже

schema
# не использовать
```

## Проверка ролей

Разрешены только канонические роли:

```text
Planner
Architect
Developer
Tester
Security Reviewer
Critic
Editor
Judge
```

В `v2.0` нужно ограничить роли до 3 штук.

`Editor` обязателен.

## Проверка моделей

```text
model_key должен быть в allowlist.
# нельзя подставить любую модель

модель должна быть active.
# отключённые модели нельзя использовать

модель должна подходить роли.
# например, слабую модель нельзя ставить Judge для сложной оценки

дорогие модели требуют лимитов.
# контроль расходов
```

---

# 23. UI

## Страница

```text
/team
# страница AI Team Mode
```

Страница `/team` появляется только если:

```text
NEXT_PUBLIC_ENABLE_TEAM_MODE=true
# frontend показывает страницу
```

Но даже если страница скрыта, backend всё равно должен проверять:

```text
ENABLE_TEAM_MODE=true
# реальное разрешение API
```

---

# 24. Компоненты UI

```text
TeamModeHeader
# описание режима

TaskInput
# ввод задачи пользователя

TeamTemplateSelector
# выбор готового шаблона команды

TeamConfigSelector
# выбор сохранённой конфигурации

FlowTypeSelector
# выбор pipeline, позже critique или parallel

RoleList
# список ролей

RoleModelSelector
# выбор модели для каждой роли

RunTeamButton
# запуск команды

TeamCostWarning
# предупреждение о возможной стоимости

TeamProgress
# общий прогресс выполнения

TeamTimeline
# визуальная цепочка шагов

TeamStepCard
# отдельный шаг роли

FinalOutput
# итоговый результат команды

TeamRunActions
# сохранить, повторить, отправить в Judge Mode
```

---

# 25. TeamTimeline

Каждый шаг в TeamTimeline показывает:

```text
roleName
# название роли

modelKey
# модель

stepOrder
# порядок шага

roundNumber
# номер раунда

status
# pending, running, completed, failed, skipped

outputText
# результат роли

estimatedCost
# примерная стоимость шага, если доступна
```

---

# 26. Системные шаблоны команд

Для первой версии достаточно 3 системных шаблонов.

## MVP Planning Team

```json
{
  "name": "MVP Planning Team",
  "flowType": "pipeline",
  "roles": [
    {
      "role": "Planner",
      "model_key": "model/example-fast"
    },
    {
      "role": "Critic",
      "model_key": "model/example-balanced"
    },
    {
      "role": "Editor",
      "model_key": "model/example-fast"
    }
  ],
  "maxRounds": 1
}
```

## Code Review Team

```json
{
  "name": "Code Review Team",
  "flowType": "pipeline",
  "roles": [
    {
      "role": "Developer",
      "model_key": "model/example-code"
    },
    {
      "role": "Tester",
      "model_key": "model/example-balanced"
    },
    {
      "role": "Security Reviewer",
      "model_key": "model/example-strong"
    }
  ],
  "maxRounds": 1
}
```

## Architecture Team

```json
{
  "name": "Architecture Team",
  "flowType": "pipeline",
  "roles": [
    {
      "role": "Planner",
      "model_key": "model/example-fast"
    },
    {
      "role": "Architect",
      "model_key": "model/example-strong"
    },
    {
      "role": "Editor",
      "model_key": "model/example-balanced"
    }
  ],
  "maxRounds": 1
}
```

---

# 27. Связь с Prompt Arena

Prompt Arena даёт базовую основу:

```text
tasks
# задача пользователя

model_responses
# ответы моделей

votes
# выбор лучшего ответа
```

AI Team Mode использует `tasks`, но вместо независимых `model_responses` создаёт цепочку `team_steps`.

Финальный результат команды может быть записан в:

```text
team_runs.final_output
# основной вариант для v2.0

model_responses
# опционально, если нужно сравнивать командный ответ с обычными ответами
```

---

# 28. Связь с Code Arena

AI Team Mode может помогать с кодовыми задачами через роли:

```text
Developer
# предлагает код

Tester
# предлагает тесты и проверяет логику

Security Reviewer
# проверяет опасные места

Judge
# оценивает качество решения
```

Важное ограничение:

```text
AI Team Mode не запускает пользовательский код сам по себе.
# запуск возможен только через Code Arena Runner после v1.7
```

Если Code Arena Runner подключён, Team Mode может использовать результаты Runner, но не должен обходить sandbox.

---

# 29. Связь с Judge Mode

Judge Mode может оценивать:

- ответы Prompt Arena;
- ответы Code Arena Lite;
- результаты Code Arena Runner;
- финальный результат AI Team Mode.

Для Team Mode оценка Judge должна быть отдельным шагом или отдельным запуском.

В `v2.0` Judge не обязателен.

---

# 30. Связь с Leaderboard

В будущем Leaderboard может учитывать не только отдельные модели, но и команды.

Примеры будущей аналитики:

```text
team_config win rate
# какая команда чаще даёт лучший результат

role performance
# какие роли чаще улучшают итог

model-role performance
# какая модель лучше работает в конкретной роли

cost per successful run
# сколько стоит успешный командный запуск
```

Для `v2.0` это не обязательно.

---

# 31. Безопасность

## Backend checks

Перед запуском Team Mode backend обязан проверить:

```text
ENABLE_TEAM_MODE=true
# режим включён

prompt валиден
# не пустой и не слишком длинный

roles валидны
# только канонические роли

Editor присутствует
# финальный результат обязателен

role count <= 3
# ограничение v2.0

maxRounds = 1
# ограничение v2.0

models active
# модели включены

models allowed
# модели есть в allowlist

user limit not exceeded
# лимит пользователя не превышен
```

## Запреты

```text
не передавать Supabase service role key в AI.
# секреты не должны попадать в prompt

не передавать OpenRouter API key в AI.
# ключи только на backend

не запускать код без sandbox.
# Team Mode не заменяет Runner

не давать AI доступ к .env.local.
# секреты остаются вне контекста моделей
```

---

# 32. Контроль расходов

AI Team Mode дорогой, потому что один запуск может вызвать несколько моделей.

Минимальные правила:

```text
maxRoles = 3
# максимум три запроса к моделям

maxRounds = 1
# один раунд

maxOutputTokens per step
# ограничить размер ответа роли

timeout per step
# ограничить зависание модели

estimated cost warning
# показать предупреждение пользователю

usage_logs
# записывать расходы после появления лимитов
```

---

# 33. Обработка частичного успеха

Одна роль может завершиться ошибкой.

Возможные варианты:

```text
failed
# весь запуск завершился ошибкой

partial
# часть ролей выполнилась, но одна роль упала

completed
# все обязательные роли выполнились
```

Для `v2.0` правило простое:

```text
если Editor не выполнился, запуск не считается completed.
# нет финального результата

если промежуточная роль упала, Editor может собрать результат только из успешных шагов.
# статус partial
```

---

# 34. Порядок реализации v2.0

## Шаг 1 - Feature flags

```bash
# добавить публичный флаг для UI
NEXT_PUBLIC_ENABLE_TEAM_MODE=false

# добавить серверный флаг для API
ENABLE_TEAM_MODE=false
```

## Шаг 2 - Константы ролей

```text
создать список канонических ролей.
# Planner, Architect, Developer, Tester, Security Reviewer, Critic, Editor, Judge
```

## Шаг 3 - Таблицы базы

```text
создать team_configs.
# шаблоны команд

создать team_runs.
# запуски команд

создать team_steps.
# шаги ролей
```

## Шаг 4 - API

```text
создать POST /api/team-run.
# запуск команды

добавить backend validation.
# роли, модели, лимиты, флаги

добавить последовательное выполнение ролей.
# pipeline
```

## Шаг 5 - UI

```text
создать /team.
# страница Team Mode

создать TeamTimeline.
# визуальная цепочка ролей

создать FinalOutput.
# итоговый результат
```

## Шаг 6 - Проверка

```bash
npm run lint
# проверить ошибки кода

npm run build
# проверить production-сборку

git status
# проверить изменённые файлы

git add .
# добавить изменения в Git

git commit -m "Add AI Team Mode foundation"
# зафиксировать этап
```

---

# 35. Что не делать в v2.0

В первой версии нельзя добавлять:

```text
бесконечные раунды;
# слишком дорого и опасно

parallel flow;
# сложнее обработка ошибок

автоматическое самоулучшение до идеала;
# нет безопасной точки остановки

свободный выбор любых OpenRouter model ID;
# только allowlist

запуск кода напрямую из Team Mode;
# только через Runner и sandbox

сложную аналитику команд;
# это после стабильной версии

платные тарифы;
# сначала нужна стабильная логика
```

---

# 36. Критерии готовности AI Team Mode v2.0

Режим считается готовым, если:

```text
/team открывается только при включённом frontend flag.
# UI скрыт, если режим отключён

/api/team-run закрыт при ENABLE_TEAM_MODE=false.
# backend-защита работает

можно запустить pipeline из 4 ролей.
# первая рабочая команда

Editor формирует final_output.
# пользователь получает итог

team_runs сохраняет запуск.
# есть история запуска

team_steps сохраняет каждый шаг.
# есть прозрачность работы команды

ошибки моделей обрабатываются.
# partial или failed status

лимиты ролей и раундов работают.
# нет бесконтрольных расходов

npm run build проходит.
# production-сборка не ломается
```

---

# 37. Главные риски

## Риск 1 - высокая стоимость

Проблема:

```text
один запуск = несколько AI-запросов.
# стоимость быстро растёт
```

Решение:

```text
maxRoles = 3
# ограничить роли

maxRounds = 1
# ограничить раунды

allowlist models
# не давать дорогие модели без контроля

usage logs
# видеть расходы
```

## Риск 2 - сложный UI

Проблема:

```text
пользователь может не понять, что делает каждая роль.
# режим станет запутанным
```

Решение:

```text
готовые шаблоны команд;
# меньше ручной настройки

TeamTimeline;
# видно, кто что сделал

FinalOutput;
# есть один итоговый ответ
```

## Риск 3 - плохая финальная сборка

Проблема:

```text
много ответов могут противоречить друг другу.
# нужен финальный сборщик
```

Решение:

```text
Editor обязателен.
# собирает итог

Critic полезен.
# ищет слабые места

Judge можно добавить позже.
# оценивает качество
```

## Риск 4 - безопасность

Проблема:

```text
AI Team Mode может генерировать код и советы по настройке API.
# есть риск секретов и опасных команд
```

Решение:

```text
Security Reviewer.
# отдельная роль безопасности

секреты не передавать в AI.
# ключи остаются на backend

код не запускать без sandbox.
# Runner только после v1.7
```

---

# 38. Итоговый канон

AI Team Mode - сильный, но поздний режим.

Канон:

```text
AI Team Mode = v2.0.
# не MVP и не ранняя функция

flow_type.
# поле в базе

flowType.
# поле в API

round_number.
# номер раунда

team_configs.
# шаблоны команд

team_runs.
# запуски команд

team_steps.
# шаги команд

final_output.
# финальный результат команды

Editor required.
# итоговый сборщик обязателен

Security Reviewer recommended.
# особенно для кода и архитектуры

ENABLE_TEAM_MODE.
# backend feature flag обязателен
```

Главное правило:

```text
AI Team Mode не должен блокировать MVP.
# сначала Stable Prompt Arena

AI Team Mode не должен запускаться без лимитов.
# контроль расходов

AI Team Mode не должен обходить безопасность Runner.
# код только через sandbox
```
