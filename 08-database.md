# 08 - База данных

## Назначение файла

Этот файл описывает базу данных проекта **Новая эпоха**.

Основная база данных проекта - **Supabase PostgreSQL**.

База нужна, чтобы проект мог сохранять:

- задачи пользователей;
- выбранные AI-модели;
- ответы моделей;
- голосование за лучший ответ;
- историю сравнений;
- будущие бои моделей;
- будущие оценки Judge Mode;
- будущий Leaderboard;
- будущие аккаунты, профили и лимиты;
- будущие данные Code Arena Runner и AI Team Mode.

## Главный источник порядка версий

Порядок добавления таблиц должен соответствовать файлу:

```text
14-roadmap.md
# главный источник порядка разработки
```

Если этот файл конфликтует с `14-roadmap.md`, главным считается `14-roadmap.md`.

Краткий порядок:

```text
v0.5 - Supabase Integration
# минимальные таблицы для Prompt Arena

v0.6 - Voting MVP
# голосование за лучший ответ

v0.7 - History MVP
# история сравнений

v1.1 - Code Arena Lite
# можно использовать tasks и model_responses без запуска кода

v1.3 - Judge Mode
# добавляется judge_results

v1.4 - Leaderboard
# добавляется leaderboard_scores

v1.5 - Accounts and Profiles
# добавляется profiles и привязка к auth.users

v1.6 - Admin Panel and Limits
# добавляются лимиты, usage logs и управление моделями

v1.7 - Code Arena Runner
# добавляются code_test_cases и code_results

v2.0 - AI Team Mode
# добавляются team_configs, team_runs и team_steps
```

## Главный принцип проектирования базы

Базу данных нужно делать постепенно.

Правило:

```text
Сначала минимальная рабочая схема.
# Prompt Arena должен заработать без лишней сложности

Потом история и голосование.
# пользователь должен видеть прошлые сравнения и выбирать победителя

Потом таблицы для новых режимов.
# Code Arena, Battle, Judge Mode, Leaderboard и AI Team Mode добавляются отдельно

Сложные таблицы не добавлять раньше времени.
# меньше риска сломать MVP
```

## Стиль названий

Для базы данных используется стиль `snake_case`.

Пример:

```text
model_responses
# таблица ответов моделей

created_at
# дата создания записи

prompt_text
# текст запроса пользователя
```

Причины:

- это нормальный стиль для PostgreSQL;
- Supabase удобно работает с такими названиями;
- SQL-запросы проще читать;
- не нужно использовать кавычки вокруг названий полей.

Файлы проекта можно называть через дефис, например `08-database.md`, но таблицы и поля базы лучше держать в `snake_case`.

## Минимальная база для MVP

Для первого рабочего MVP нужны 4 основные таблицы:

1. `models` - список разрешённых AI-моделей.
2. `tasks` - задачи пользователя.
3. `model_responses` - ответы моделей.
4. `votes` - выбор лучшего ответа.

Этого достаточно для Prompt Arena:

```text
Пользователь вводит задачу.
# создаётся запись в tasks

Пользователь выбирает несколько моделей.
# backend проверяет их через models

Backend получает ответы через OpenRouter.
# создаются записи в model_responses

Пользователь выбирает лучший ответ.
# создаётся или обновляется запись в votes

Пользователь открывает историю.
# backend читает tasks, model_responses и votes
```

## Общая схема MVP

```text
models
# список доступных AI-моделей
  |
  | model_id
  v
model_responses
# ответы моделей
  ^
  |
  | task_id
  |
tasks
# задачи пользователя
  |
  | response_id
  v
votes
# выбранный лучший ответ
```

Связи:

```text
Одна задача имеет много ответов.
# tasks -> model_responses

Один ответ принадлежит одной задаче.
# model_responses -> tasks

Одна модель может дать много ответов в разных задачах.
# models -> model_responses

Один голос выбирает один ответ в рамках задачи.
# votes -> model_responses
```

# Таблица 1 - models

## Назначение

Таблица `models` хранит список AI-моделей, которые разрешены в проекте.

Она нужна, чтобы:

- не хранить модели хаотично в frontend;
- включать и отключать модели без переписывания логики;
- показывать красивые названия моделей в UI;
- контролировать дорогие модели;
- разделять модели по ролям;
- использовать модели в разных режимах проекта;
- не дать пользователю подставить произвольный `model_key`.

## Главное правило allowlist

```text
Frontend показывает только модели из allowlist.
# пользователь не вводит model ID вручную

Frontend отправляет model_key на backend.
# это технический идентификатор модели

Backend проверяет model_key в таблице models.
# настоящая защита находится на сервере

Если модели нет в models или is_active = false, запрос отклоняется.
# контроль расходов и безопасности
```

## Поля таблицы models

| Поле | Тип | Обязательное | Описание |
|---|---|---|---|
| `id` | uuid | Да | Уникальный идентификатор записи |
| `provider` | text | Да | Источник модели, например `openrouter` |
| `model_key` | text | Да | Технический ID модели для OpenRouter |
| `display_name` | text | Да | Красивое название модели в интерфейсе |
| `description` | text | Нет | Краткое описание модели |
| `price_label` | text | Да | Уровень стоимости модели |
| `role_tags` | text[] | Да | Роли модели: prompt, code, judge, team, dev |
| `is_active` | boolean | Да | Можно ли использовать модель на backend |
| `is_public` | boolean | Да | Показывать ли модель обычным пользователям |
| `supports_text` | boolean | Да | Поддерживает ли текстовые задачи |
| `supports_code` | boolean | Да | Подходит ли для Code Arena |
| `supports_judge` | boolean | Да | Можно ли использовать как судью |
| `supports_image` | boolean | Да | Поддерживает ли изображения |
| `supports_json` | boolean | Да | Поддерживает ли структурированный JSON-ответ |
| `context_length` | integer | Нет | Контекст модели, если известен |
| `max_output_tokens` | integer | Нет | Внутренний лимит ответа в проекте |
| `input_price_per_million` | numeric | Нет | Цена input за 1 млн токенов |
| `output_price_per_million` | numeric | Нет | Цена output за 1 млн токенов |
| `sort_order` | integer | Да | Порядок отображения в UI |
| `raw_metadata` | jsonb | Да | Сырые данные из OpenRouter Models API |
| `created_at` | timestamptz | Да | Дата создания |
| `updated_at` | timestamptz | Да | Дата обновления |

## Почему убраны is_free и is_paid

Старый вариант с `is_free` и `is_paid` слишком грубый.

Лучше использовать `price_label`:

```text
free
# бесплатная или условно бесплатная модель

cheap
# дешёвая модель для частого использования

balanced
# нормальная модель для обычного MVP

expensive
# дорогая сильная модель, только после лимитов

unknown
# цена ещё не проверена
```

Так проще управлять моделями через админку в будущем.

## Возможные значения role_tags

```text
prompt
# модель подходит для Prompt Arena

code
# модель подходит для Code Arena

judge
# модель подходит для Judge Mode

team
# модель подходит для AI Team Mode

dev
# модель используется только для разработки
```

## SQL для models

```sql
create table public.models (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'openrouter',
  model_key text not null unique,
  display_name text not null,
  description text,
  price_label text not null default 'unknown',
  role_tags text[] not null default '{}',
  is_active boolean not null default true,
  is_public boolean not null default true,
  supports_text boolean not null default true,
  supports_code boolean not null default false,
  supports_judge boolean not null default false,
  supports_image boolean not null default false,
  supports_json boolean not null default false,
  context_length integer,
  max_output_tokens integer,
  input_price_per_million numeric(12, 6),
  output_price_per_million numeric(12, 6),
  sort_order integer not null default 100,
  raw_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint models_price_label_check check (
    price_label in ('free', 'cheap', 'balanced', 'expensive', 'unknown')
  ),
  constraint models_context_length_check check (
    context_length is null or context_length > 0
  ),
  constraint models_max_output_tokens_check check (
    max_output_tokens is null or max_output_tokens > 0
  ),
  constraint models_input_price_check check (
    input_price_per_million is null or input_price_per_million >= 0
  ),
  constraint models_output_price_check check (
    output_price_per_million is null or output_price_per_million >= 0
  )
);
```

# Таблица 2 - tasks

## Назначение

Таблица `tasks` хранит исходную задачу пользователя.

Одна запись в `tasks` создаётся, когда пользователь отправляет prompt в один из режимов проекта.

## Поля таблицы tasks

| Поле | Тип | Обязательное | Описание |
|---|---|---|---|
| `id` | uuid | Да | Уникальный идентификатор задачи |
| `user_id` | uuid | Нет | Пользователь Supabase Auth, если есть вход |
| `anonymous_session_id` | text | Нет | Гостевая сессия до авторизации |
| `mode_slug` | text | Да | Режим работы проекта |
| `prompt_text` | text | Да | Текст задачи пользователя |
| `prompt_hash` | text | Нет | Хэш запроса для поиска повторов |
| `title` | text | Нет | Короткое название для истории |
| `status` | text | Да | Статус обработки задачи |
| `selected_models` | jsonb | Да | Список выбранных моделей |
| `settings` | jsonb | Да | Настройки режима |
| `error_message` | text | Нет | Общая ошибка задачи |
| `created_at` | timestamptz | Да | Дата создания |
| `updated_at` | timestamptz | Да | Дата обновления |

## Возможные значения mode_slug

```text
prompt-arena
# обычное сравнение ответов

code-arena
# сравнение решений по программированию

multi-model-battle
# формальный бой моделей

judge-mode
# оценка ответов моделью-судьёй

ai-team-mode
# командная работа моделей с ролями
```

`leaderboard` не обязан быть значением `mode_slug`, потому что Leaderboard чаще строится по уже сохранённым голосам и оценкам.

## Возможные значения status

```text
pending
# задача создана, но ещё не обработана

running
# модели отвечают

completed
# задача завершена успешно

partial
# часть моделей ответила, часть дала ошибку

failed
# задача завершилась ошибкой

cancelled
# пользователь или система отменили выполнение
```

## SQL для tasks

```sql
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  anonymous_session_id text,
  mode_slug text not null default 'prompt-arena',
  prompt_text text not null,
  prompt_hash text,
  title text,
  status text not null default 'pending',
  selected_models jsonb not null default '[]'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tasks_prompt_text_length check (char_length(prompt_text) between 3 and 8000),
  constraint tasks_mode_slug_check check (
    mode_slug in ('prompt-arena', 'code-arena', 'multi-model-battle', 'judge-mode', 'ai-team-mode')
  ),
  constraint tasks_status_check check (
    status in ('pending', 'running', 'completed', 'partial', 'failed', 'cancelled')
  )
);
```

## Почему selected_models хранится как jsonb

Для MVP удобно хранить список выбранных моделей в `jsonb`.

Пример:

```json
[
  "openrouter/model-one",
  "openrouter/model-two",
  "openrouter/model-three"
]
```

Позже можно сделать отдельную таблицу связей, если понадобится строгая нормализация. Для первого MVP это лишняя сложность.

# Таблица 3 - model_responses

## Назначение

Таблица `model_responses` хранит ответ каждой модели на конкретную задачу.

Если пользователь выбрал 3 модели, то для одной записи в `tasks` появятся 3 записи в `model_responses`.

## Поля таблицы model_responses

| Поле | Тип | Обязательное | Описание |
|---|---|---|---|
| `id` | uuid | Да | Уникальный идентификатор ответа |
| `task_id` | uuid | Да | Связь с задачей |
| `model_id` | uuid | Нет | Связь с таблицей models |
| `model_key` | text | Да | Технический ID модели |
| `display_name` | text | Нет | Название модели на момент ответа |
| `response_text` | text | Нет | Текст ответа модели |
| `status` | text | Да | Статус ответа |
| `error_message` | text | Нет | Ошибка конкретной модели |
| `latency_ms` | integer | Нет | Время ответа в миллисекундах |
| `input_tokens` | integer | Нет | Количество входных токенов |
| `output_tokens` | integer | Нет | Количество выходных токенов |
| `total_tokens` | integer | Нет | Общее количество токенов |
| `estimated_cost` | numeric | Нет | Примерная стоимость ответа |
| `raw_metadata` | jsonb | Да | Технические данные ответа |
| `created_at` | timestamptz | Да | Дата создания |

## Возможные значения status

```text
success
# модель успешно ответила

error
# модель вернула ошибку

timeout
# модель не ответила вовремя

cancelled
# запрос был отменён
```

## SQL для model_responses

```sql
create table public.model_responses (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  model_id uuid references public.models(id) on delete set null,
  model_key text not null,
  display_name text,
  response_text text,
  status text not null default 'success',
  error_message text,
  latency_ms integer,
  input_tokens integer,
  output_tokens integer,
  total_tokens integer,
  estimated_cost numeric(12, 6),
  raw_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint model_responses_status_check check (
    status in ('success', 'error', 'timeout', 'cancelled')
  ),
  constraint model_responses_latency_check check (
    latency_ms is null or latency_ms >= 0
  ),
  constraint model_responses_tokens_check check (
    (input_tokens is null or input_tokens >= 0)
    and (output_tokens is null or output_tokens >= 0)
    and (total_tokens is null or total_tokens >= 0)
  ),
  constraint model_responses_cost_check check (
    estimated_cost is null or estimated_cost >= 0
  )
);
```

## Важное правило для ошибок моделей

Если модель дала ошибку, запись всё равно сохраняется.

Пример:

```text
status = error
# модель не ответила успешно

error_message = Model unavailable
# причина ошибки

response_text = null
# текста ответа нет
```

Это нужно для статистики стабильности моделей.

# Таблица 4 - votes

## Назначение

Таблица `votes` хранит выбор лучшего ответа.

В MVP это простой голос пользователя. Позже эти данные используются для Multi Model Battle и Leaderboard.

## Поля таблицы votes

| Поле | Тип | Обязательное | Описание |
|---|---|---|---|
| `id` | uuid | Да | Уникальный идентификатор голоса |
| `task_id` | uuid | Да | Связь с задачей |
| `response_id` | uuid | Да | Ответ, выбранный лучшим |
| `user_id` | uuid | Нет | Пользователь, если есть авторизация |
| `anonymous_session_id` | text | Нет | Гостевая сессия |
| `vote_type` | text | Да | Тип голоса |
| `created_at` | timestamptz | Да | Дата голосования |
| `updated_at` | timestamptz | Да | Дата обновления |

## Возможные значения vote_type

```text
user
# голос пользователя

judge
# выбор модели-судьи

system
# системный выбор, если понадобится позже
```

## SQL для votes

```sql
create table public.votes (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  response_id uuid not null references public.model_responses(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  anonymous_session_id text,
  vote_type text not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint votes_vote_type_check check (vote_type in ('user', 'judge', 'system'))
);
```

## Правило голосования для MVP

Для MVP лучше разрешить один пользовательский голос на одну задачу.

```text
Если пользователь выбирает другой ответ.
# обновляем существующий голос

Если пользователь голосует впервые.
# создаём новый голос
```

Так проще для UX и для будущего Leaderboard.

# Индексы MVP

## Индексы для models

```sql
create index models_is_active_idx on public.models (is_active);
create index models_is_public_idx on public.models (is_public);
create index models_price_label_idx on public.models (price_label);
create index models_sort_order_idx on public.models (sort_order);
create index models_role_tags_idx on public.models using gin (role_tags);
```

## Индексы для tasks

```sql
create index tasks_created_at_idx on public.tasks (created_at desc);
create index tasks_user_id_idx on public.tasks (user_id);
create index tasks_anonymous_session_id_idx on public.tasks (anonymous_session_id);
create index tasks_mode_slug_idx on public.tasks (mode_slug);
create index tasks_status_idx on public.tasks (status);
```

## Индексы для model_responses

```sql
create index model_responses_task_id_idx on public.model_responses (task_id);
create index model_responses_model_id_idx on public.model_responses (model_id);
create index model_responses_model_key_idx on public.model_responses (model_key);
create index model_responses_status_idx on public.model_responses (status);
```

## Индексы для votes

```sql
create index votes_task_id_idx on public.votes (task_id);
create index votes_response_id_idx on public.votes (response_id);
create index votes_user_id_idx on public.votes (user_id);
create index votes_anonymous_session_id_idx on public.votes (anonymous_session_id);
```

## Уникальный голос на задачу

```sql
create unique index votes_one_user_vote_per_task_idx
on public.votes (task_id, user_id)
where user_id is not null and vote_type = 'user';

create unique index votes_one_guest_vote_per_task_idx
on public.votes (task_id, anonymous_session_id)
where anonymous_session_id is not null and vote_type = 'user';
```

# Полная SQL-миграция MVP

Эту миграцию можно использовать как базу для `v0.5 Supabase Integration`.

Важно: перед применением к реальному проекту нужно проверить её на чистой Supabase базе.

```sql
create extension if not exists pgcrypto;

create table public.models (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'openrouter',
  model_key text not null unique,
  display_name text not null,
  description text,
  price_label text not null default 'unknown',
  role_tags text[] not null default '{}',
  is_active boolean not null default true,
  is_public boolean not null default true,
  supports_text boolean not null default true,
  supports_code boolean not null default false,
  supports_judge boolean not null default false,
  supports_image boolean not null default false,
  supports_json boolean not null default false,
  context_length integer,
  max_output_tokens integer,
  input_price_per_million numeric(12, 6),
  output_price_per_million numeric(12, 6),
  sort_order integer not null default 100,
  raw_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint models_price_label_check check (
    price_label in ('free', 'cheap', 'balanced', 'expensive', 'unknown')
  ),
  constraint models_context_length_check check (
    context_length is null or context_length > 0
  ),
  constraint models_max_output_tokens_check check (
    max_output_tokens is null or max_output_tokens > 0
  ),
  constraint models_input_price_check check (
    input_price_per_million is null or input_price_per_million >= 0
  ),
  constraint models_output_price_check check (
    output_price_per_million is null or output_price_per_million >= 0
  )
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  anonymous_session_id text,
  mode_slug text not null default 'prompt-arena',
  prompt_text text not null,
  prompt_hash text,
  title text,
  status text not null default 'pending',
  selected_models jsonb not null default '[]'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tasks_prompt_text_length check (char_length(prompt_text) between 3 and 8000),
  constraint tasks_mode_slug_check check (
    mode_slug in ('prompt-arena', 'code-arena', 'multi-model-battle', 'judge-mode', 'ai-team-mode')
  ),
  constraint tasks_status_check check (
    status in ('pending', 'running', 'completed', 'partial', 'failed', 'cancelled')
  )
);

create table public.model_responses (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  model_id uuid references public.models(id) on delete set null,
  model_key text not null,
  display_name text,
  response_text text,
  status text not null default 'success',
  error_message text,
  latency_ms integer,
  input_tokens integer,
  output_tokens integer,
  total_tokens integer,
  estimated_cost numeric(12, 6),
  raw_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint model_responses_status_check check (
    status in ('success', 'error', 'timeout', 'cancelled')
  ),
  constraint model_responses_latency_check check (
    latency_ms is null or latency_ms >= 0
  ),
  constraint model_responses_tokens_check check (
    (input_tokens is null or input_tokens >= 0)
    and (output_tokens is null or output_tokens >= 0)
    and (total_tokens is null or total_tokens >= 0)
  ),
  constraint model_responses_cost_check check (
    estimated_cost is null or estimated_cost >= 0
  )
);

create table public.votes (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  response_id uuid not null references public.model_responses(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  anonymous_session_id text,
  vote_type text not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint votes_vote_type_check check (vote_type in ('user', 'judge', 'system'))
);

create index models_is_active_idx on public.models (is_active);
create index models_is_public_idx on public.models (is_public);
create index models_price_label_idx on public.models (price_label);
create index models_sort_order_idx on public.models (sort_order);
create index models_role_tags_idx on public.models using gin (role_tags);

create index tasks_created_at_idx on public.tasks (created_at desc);
create index tasks_user_id_idx on public.tasks (user_id);
create index tasks_anonymous_session_id_idx on public.tasks (anonymous_session_id);
create index tasks_mode_slug_idx on public.tasks (mode_slug);
create index tasks_status_idx on public.tasks (status);

create index model_responses_task_id_idx on public.model_responses (task_id);
create index model_responses_model_id_idx on public.model_responses (model_id);
create index model_responses_model_key_idx on public.model_responses (model_key);
create index model_responses_status_idx on public.model_responses (status);

create index votes_task_id_idx on public.votes (task_id);
create index votes_response_id_idx on public.votes (response_id);
create index votes_user_id_idx on public.votes (user_id);
create index votes_anonymous_session_id_idx on public.votes (anonymous_session_id);

create unique index votes_one_user_vote_per_task_idx
on public.votes (task_id, user_id)
where user_id is not null and vote_type = 'user';

create unique index votes_one_guest_vote_per_task_idx
on public.votes (task_id, anonymous_session_id)
where anonymous_session_id is not null and vote_type = 'user';
```

# Начальные данные для models

Реальные `model_key` нужно брать из `11-ai-models.md` и проверять через OpenRouter Models API перед production.

Ниже только безопасный шаблон.

```sql
insert into public.models (
  provider,
  model_key,
  display_name,
  description,
  price_label,
  role_tags,
  is_active,
  is_public,
  supports_text,
  supports_code,
  supports_judge,
  supports_image,
  supports_json,
  sort_order
)
values
(
  'openrouter',
  'provider/model-free-example',
  'Example Free Model',
  'Тестовая бесплатная или дешёвая модель для разработки MVP.',
  'free',
  array['prompt', 'dev'],
  true,
  true,
  true,
  false,
  false,
  false,
  false,
  10
),
(
  'openrouter',
  'provider/model-balanced-example',
  'Example Balanced Model',
  'Сбалансированная модель для Prompt Arena.',
  'balanced',
  array['prompt'],
  true,
  true,
  true,
  true,
  false,
  false,
  true,
  20
),
(
  'openrouter',
  'provider/model-judge-example',
  'Example Judge Model',
  'Будущая модель для Judge Mode. В MVP может быть отключена.',
  'expensive',
  array['judge'],
  false,
  false,
  true,
  true,
  true,
  false,
  true,
  30
);
```

# Безопасность доступа к базе

## Главный принцип

На раннем MVP проще и безопаснее работать с базой через backend API routes.

```text
Frontend -> Next.js API route -> Supabase
# браузер не пишет напрямую в базу

Frontend -> Next.js API route -> OpenRouter
# OpenRouter API key не попадает в браузер

Supabase service role key только на сервере.
# нельзя использовать его в клиентском коде
```

## Что нельзя делать

```text
Нельзя вставлять SUPABASE_SERVICE_ROLE_KEY в frontend.
# этот ключ даёт слишком большие права

Нельзя доверять model_key из браузера без проверки.
# пользователь может подставить дорогую модель

Нельзя разрешать прямую запись в tasks и model_responses без правил.
# иначе появятся мусорные или вредные записи
```

## RLS для MVP

Для первого MVP возможны два варианта.

### Вариант A - всё через server API

Это самый простой вариант для старта.

```text
Backend использует service role key.
# только сервер пишет в базу

Frontend не имеет прямой записи в таблицы.
# меньше ошибок безопасности

RLS можно включить позже перед публичным запуском.
# но перед production это нужно проверить отдельно
```

### Вариант B - RLS с публичным чтением models

Если нужно читать активные модели прямо с клиента, можно открыть только чтение публичных активных моделей.

```sql
alter table public.models enable row level security;

create policy "Public can read active public models"
on public.models
for select
using (is_active = true and is_public = true);
```

Для `tasks`, `model_responses` и `votes` лучше сначала не открывать прямую запись с клиента. Безопаснее делать запись через backend API.

# Будущие таблицы

Будущие таблицы не нужно добавлять в первый MVP. Они нужны только на своих этапах roadmap.

## v1.5 - profiles

`profiles` понадобится после добавления авторизации.

```sql
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'user',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_role_check check (role in ('user', 'moderator', 'admin', 'owner')),
  constraint profiles_status_check check (status in ('active', 'limited', 'blocked'))
);
```

## v1.2 - battles

`battles` понадобится для Multi Model Battle.

```sql
create table public.battles (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  battle_type text not null default 'user',
  winner_response_id uuid references public.model_responses(id) on delete set null,
  evaluation_method text not null default 'user_vote',
  category text,
  created_at timestamptz not null default now(),

  constraint battles_battle_type_check check (battle_type in ('user', 'judge', 'blind')),
  constraint battles_evaluation_method_check check (evaluation_method in ('user_vote', 'judge_vote', 'mixed'))
);
```

## v1.3 - judge_results

`judge_results` понадобится для Judge Mode.

```sql
create table public.judge_results (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  judge_model_key text not null,
  winner_response_id uuid references public.model_responses(id) on delete set null,
  scores jsonb not null default '{}'::jsonb,
  reason text,
  raw_judge_output jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
```

Пример `scores`:

```json
{
  "accuracy": 8,
  "completeness": 7,
  "logic": 9,
  "clarity": 8,
  "safety": 9,
  "final_score": 8.2
}
```

## v1.4 - leaderboard_scores

`leaderboard_scores` хранит готовые значения рейтинга моделей.

```sql
create table public.leaderboard_scores (
  id uuid primary key default gen_random_uuid(),
  model_key text not null,
  category text not null default 'general',
  mode_slug text not null default 'all',
  battle_count integer not null default 0,
  win_count integer not null default 0,
  user_vote_wins integer not null default 0,
  judge_vote_wins integer not null default 0,
  average_score numeric(5, 2),
  win_rate numeric(5, 2),
  updated_at timestamptz not null default now(),

  constraint leaderboard_counts_check check (
    battle_count >= 0
    and win_count >= 0
    and user_vote_wins >= 0
    and judge_vote_wins >= 0
  )
);
```

## v1.6 - usage_logs и user_limits

Эти таблицы нужны для контроля расходов, лимитов и админ-панели.

```sql
create table public.usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  anonymous_session_id text,
  task_id uuid references public.tasks(id) on delete set null,
  mode_slug text not null,
  model_key text,
  input_tokens integer,
  output_tokens integer,
  estimated_cost numeric(12, 6),
  created_at timestamptz not null default now()
);
```

```sql
create table public.user_limits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  role text not null default 'user',
  daily_request_limit integer not null default 20,
  monthly_token_limit integer,
  monthly_cost_limit numeric(12, 6),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## v1.7 - Code Arena Runner

Code Arena Lite не требует отдельного запуска кода.

Для Runner нужны таблицы `code_test_cases` и `code_results`.

Runner нельзя делать раньше `v1.7`.

```text
v1.1 - Code Arena Lite
# только сравнение кодовых ответов моделей

v1.7 - Code Arena Runner
# sandbox, тесты, лимиты и результаты запуска
```

### code_test_cases

```sql
create table public.code_test_cases (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  input_data jsonb not null default '{}'::jsonb,
  expected_output jsonb not null default '{}'::jsonb,
  test_type text not null default 'unit',
  is_hidden boolean not null default false,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),

  constraint code_test_cases_test_type_check check (test_type in ('unit', 'integration', 'edge', 'security'))
);
```

### code_results

```sql
create table public.code_results (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  response_id uuid not null references public.model_responses(id) on delete cascade,
  language text not null,
  status text not null default 'pending',
  passed_count integer not null default 0,
  failed_count integer not null default 0,
  execution_time_ms integer,
  memory_kb integer,
  stdout text,
  stderr text,
  raw_result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint code_results_status_check check (
    status in ('pending', 'running', 'passed', 'failed', 'error', 'timeout')
  ),
  constraint code_results_counts_check check (
    passed_count >= 0 and failed_count >= 0
  )
);
```

## v2.0 - AI Team Mode

AI Team Mode добавляется только после стабильной базы, режимов, лимитов и безопасности.

Основные таблицы:

```text
team_configs
# сохранённые составы AI-команд

team_runs
# конкретный запуск команды

team_steps
# отдельные шаги ролей внутри запуска
```

Подробная логика AI Team Mode описана в `18-team-mode-spec.md`.

Минимальная схема:

```sql
create table public.team_configs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  title text not null,
  description text,
  flow_type text not null default 'pipeline',
  roles jsonb not null default '[]'::jsonb,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint team_configs_flow_type_check check (flow_type in ('pipeline', 'critique'))
);
```

```sql
create table public.team_runs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.tasks(id) on delete cascade,
  team_config_id uuid references public.team_configs(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  flow_type text not null default 'pipeline',
  status text not null default 'pending',
  final_answer text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,

  constraint team_runs_status_check check (status in ('pending', 'running', 'completed', 'failed')),
  constraint team_runs_flow_type_check check (flow_type in ('pipeline', 'critique'))
);
```

```sql
create table public.team_steps (
  id uuid primary key default gen_random_uuid(),
  team_run_id uuid not null references public.team_runs(id) on delete cascade,
  role_slug text not null,
  model_key text not null,
  step_order integer not null,
  round_number integer not null default 1,
  input_text text,
  output_text text,
  status text not null default 'pending',
  raw_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,

  constraint team_steps_status_check check (status in ('pending', 'running', 'completed', 'failed')),
  constraint team_steps_round_number_check check (round_number >= 1)
);
```

# Что не добавлять в MVP

В первый MVP не добавлять:

- `profiles`;
- `user_limits`;
- `usage_logs`, если ещё нет контроля стоимости;
- `battles`;
- `judge_results`;
- `leaderboard_scores`;
- `code_test_cases`;
- `code_results`;
- `team_configs`;
- `team_runs`;
- `team_steps`.

Причина простая:

```text
MVP должен доказать главную идею Prompt Arena.
# сравнение ответов нескольких моделей

Лишние таблицы усложняют старт.
# больше миграций, связей, ошибок и проверок

Будущие режимы уже описаны, но не должны мешать первой версии.
# документация готова, реализация позже
```

# Проверочный список перед созданием базы

Перед применением миграции нужно проверить:

- Supabase проект создан;
- `.env.local` заполнен локальными переменными;
- service role key не используется в frontend;
- `models` содержит только проверенные model ID;
- `tasks.prompt_text` имеет разумный лимит длины;
- `votes` ограничивает один пользовательский голос на задачу;
- индексы созданы для истории и быстрых выборок;
- Code Arena Runner таблицы не добавлены раньше `v1.7`;
- AI Team Mode таблицы не добавлены раньше `v2.0`.

# Примеры команд для будущей работы

```bash
supabase migration new create_mvp_tables
# создаёт новый файл миграции Supabase

supabase db reset
# пересоздаёт локальную базу и применяет миграции заново

supabase db push
# применяет локальные миграции к удалённой базе Supabase

git add supabase/migrations
# добавляет миграции базы в Git

git commit -m "Add MVP database schema"
# фиксирует схему базы данных MVP
```

# Итог

Для MVP проекта **Новая эпоха** достаточно 4 таблиц:

```text
models
# список разрешённых моделей

tasks
# задачи пользователей

model_responses
# ответы моделей

votes
# выбор лучшего ответа
```

Эта схема поддерживает:

- Prompt Arena;
- сохранение истории;
- голосование;
- базовую статистику моделей;
- дальнейшее расширение под Code Arena, Battle, Judge Mode, Leaderboard и AI Team Mode.

Главное правило: **не добавлять сложные таблицы раньше этапа, где они реально нужны**.
