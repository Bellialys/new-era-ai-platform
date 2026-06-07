# 08 - Database

## Назначение файла

Этот файл описывает будущую структуру Supabase PostgreSQL для проекта **Новая эпоха**.

Текущий статус:

```text
v0.4.1
# база данных ещё не подключена

v0.5
# следующий этап - Supabase integration
```

## Главная идея базы

База должна хранить:

- пользователей и профили;
- доступные AI-модели;
- задачи пользователя;
- ответы моделей;
- выбор лучшего ответа;
- историю сравнений.

## Важное правило по modelIds

В текущем коде `v0.4.1` поле `modelIds` содержит OpenRouter model keys.

Пример текущего значения:

```json
[
  "google/gemini-flash-1.5",
  "mistralai/mistral-small-3.1-24b-instruct"
]
```

Это допустимо только до подключения Supabase.

После `v0.5` нужно перейти на более безопасную схему:

```text
Frontend отправляет models.id
# публичный UUID из Supabase

Backend по models.id находит models.model_key
# технический ключ OpenRouter остаётся только на сервере

Backend отправляет model_key в OpenRouter
# пользователь не может подставить произвольную модель
```

## Основные таблицы

## 1. profiles

Профили пользователей.

| Поле | Тип | Назначение |
|---|---|---|
| `id` | uuid | ID пользователя из Supabase Auth |
| `display_name` | text | Имя пользователя в интерфейсе |
| `role` | text | `user` или `admin` |
| `created_at` | timestamptz | Дата создания |
| `updated_at` | timestamptz | Дата обновления |

На раннем MVP можно временно работать без авторизации и писать `user_id = null` в таблице `tasks`.

## 2. models

Список моделей, разрешённых для использования.

| Поле | Тип | Назначение |
|---|---|---|
| `id` | uuid | Публичный ID модели внутри проекта |
| `provider` | text | Например `openrouter` |
| `model_key` | text | Технический ID модели в OpenRouter |
| `display_name` | text | Название модели в UI |
| `role_label` | text | Краткая роль модели в UI |
| `badge` | text | Метка модели, например `Быстрый` |
| `description` | text | Описание модели |
| `is_active` | boolean | Доступна ли модель |
| `sort_order` | integer | Порядок отображения |
| `created_at` | timestamptz | Дата создания |
| `updated_at` | timestamptz | Дата обновления |

Критично:

```text
model_key нельзя доверять с frontend.
# пользователь не должен отправлять OpenRouter key напрямую после v0.5
```

## 3. tasks

Задачи, которые пользователь отправляет в Arena.

| Поле | Тип | Назначение |
|---|---|---|
| `id` | uuid | ID задачи |
| `user_id` | uuid null | ID пользователя, если есть авторизация |
| `task_text` | text | Текст задачи или prompt |
| `mode_slug` | text | Например `prompt-arena` |
| `status` | text | `created`, `completed`, `failed` |
| `created_at` | timestamptz | Дата создания |
| `updated_at` | timestamptz | Дата обновления |

Правильное имя таблицы - `tasks`.

Не использовать:

```text
prompts
# старое и слишком узкое название
```

## 4. model_responses

Ответы моделей на задачу.

| Поле | Тип | Назначение |
|---|---|---|
| `id` | uuid | ID ответа |
| `task_id` | uuid | Связь с `tasks.id` |
| `model_id` | uuid | Связь с `models.id` |
| `status` | text | `success` или `error` |
| `answer_text` | text null | Текст ответа модели |
| `latency_ms` | integer null | Время ответа |
| `error_code` | text null | Код ошибки |
| `error_message` | text null | Сообщение ошибки |
| `created_at` | timestamptz | Дата создания |

Не использовать:

```text
prompt_id
# правильное поле - task_id
```

## 5. votes

Выбор лучшего ответа.

| Поле | Тип | Назначение |
|---|---|---|
| `id` | uuid | ID голоса |
| `task_id` | uuid | Связь с `tasks.id` |
| `response_id` | uuid | Связь с `model_responses.id` |
| `user_id` | uuid null | ID пользователя, если есть авторизация |
| `vote_type` | text | Например `winner` |
| `created_at` | timestamptz | Дата создания |

Важно:

```text
Один task - один winner vote.
# в MVP пользователь выбирает один лучший ответ
```

## SQL-скелет для v0.5

```sql
create table models (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  model_key text not null unique,
  display_name text not null,
  role_label text,
  badge text,
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null,
  task_text text not null,
  mode_slug text not null default 'prompt-arena',
  status text not null default 'created',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table model_responses (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  model_id uuid not null references models(id),
  status text not null,
  answer_text text null,
  latency_ms integer null,
  error_code text null,
  error_message text null,
  created_at timestamptz not null default now()
);

create table votes (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  response_id uuid not null references model_responses(id) on delete cascade,
  user_id uuid null,
  vote_type text not null default 'winner',
  created_at timestamptz not null default now(),
  unique (task_id, vote_type)
);
```

## Что сделать в v0.5

1. Создать проект Supabase.
2. Создать таблицы `models`, `tasks`, `model_responses`, `votes`.
3. Заполнить `models` текущими OpenRouter-моделями.
4. Добавить server-side Supabase client.
5. Перед вызовом OpenRouter искать `model_key` по `models.id`.
6. Сохранять `tasks` и `model_responses` после `/api/compare`.
7. Пока не включать сложную авторизацию, если она тормозит MVP.
