# 08 - Database

## Назначение файла

Этот файл описывает текущую и будущую структуру Supabase для проекта **Новая эпоха**.

Текущий статус:

```text
v0.5.0
# Supabase Integration: models, tasks, model_responses и profiles описаны миграциями
```

## Главная идея базы

База должна хранить:

- пользователей и профили;
- доступные AI-модели;
- задачи пользователя;
- ответы моделей;
- выбор лучшего ответа в будущем `votes`;
- историю сравнений в будущем History MVP.

## Важное правило по modelIds

В текущем MVP `modelIds` работает в двух безопасных режимах.

Основной режим Supabase:

```text
Frontend получает models.id из GET /api/models.
# это публичный UUID из Supabase

Backend по models.id находит models.model_key.
# OpenRouter key остаётся только на сервере
```

Fallback режим:

```text
Если Supabase не настроен или catalog недоступен, GET /api/models возвращает hardcoded allowlist.
# в этом режиме modelIds временно равны OpenRouter model keys из server-side fallback
```

В обоих режимах backend повторно проверяет выбранные модели и не принимает произвольный model key.

## Основные таблицы

## 1. profiles

Профили пользователей.

| Поле | Тип | Назначение |
|---|---|---|
| `id` | uuid | ID пользователя из Supabase Auth |
| `email` | text | Email пользователя, если Supabase Auth его передал |
| `display_name` | text | Имя пользователя в интерфейсе |
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
| `description` | text | Описание модели |
| `price_label` | text | `free`, `cheap`, `balanced`, `expensive` или `unknown` |
| `is_active` | boolean | Доступна ли модель |
| `is_public` | boolean | Показывать ли модель в публичном каталоге |
| `role_tags` | text[] | Теги роли: `general`, `fast`, `coding`, `reasoning` и т.д. |
| `context_length` | integer null | Контекст модели, если известен |
| `max_output_tokens` | integer null | Максимум output tokens, если известен |
| `input_price_per_million` | numeric null | Цена input за миллион токенов |
| `output_price_per_million` | numeric null | Цена output за миллион токенов |
| `sort_order` | integer | Порядок отображения |
| `raw_metadata` | jsonb | Дополнительные provider metadata |
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
| `anonymous_session_id` | text null | Будущая связь для anonymous history/session |
| `mode_slug` | text | Например `prompt-arena` |
| `prompt_text` | text | Текст задачи пользователя |
| `prompt_hash` | text null | Будущий hash prompt для аналитики/дедупликации |
| `title` | text null | Будущий заголовок истории |
| `status` | text | `pending`, `running`, `completed`, `partial`, `failed`, `cancelled` |
| `selected_models` | jsonb | Список выбранных model keys для аудита запуска |
| `settings` | jsonb | Настройки запуска |
| `error_message` | text null | Ошибка на уровне задачи |
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
| `model_key` | text | OpenRouter model key, сохранённый server-side для истории |
| `display_name` | text null | Название модели на момент ответа |
| `response_text` | text null | Текст ответа модели |
| `status` | text | `success`, `error`, `timeout` или `cancelled` |
| `latency_ms` | integer null | Время ответа |
| `input_tokens` | integer null | Input tokens из OpenRouter usage |
| `output_tokens` | integer null | Output tokens из OpenRouter usage |
| `total_tokens` | integer null | Total tokens из OpenRouter usage |
| `estimated_cost` | numeric null | Будущая оценка стоимости |
| `raw_response` | jsonb | Безопасная provider metadata |
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

Статус: будущая таблица для `v0.6 Voting MVP`. В текущих обязательных миграциях Prompt Arena она не требуется.

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

## Текущий SQL-скелет v0.5

```sql
create table models (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'openrouter',
  model_key text not null unique,
  display_name text not null,
  description text,
  price_label text not null default 'unknown',
  is_active boolean not null default true,
  is_public boolean not null default true,
  role_tags text[] not null default '{}'::text[],
  context_length integer,
  max_output_tokens integer,
  input_price_per_million numeric,
  output_price_per_million numeric,
  sort_order integer not null default 0,
  raw_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table tasks (
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
  updated_at timestamptz not null default now()
);

create table model_responses (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks(id) on delete cascade,
  model_id uuid references models(id) on delete set null,
  model_key text not null,
  display_name text,
  status text not null,
  response_text text null,
  latency_ms integer null,
  input_tokens integer null,
  output_tokens integer null,
  total_tokens integer null,
  estimated_cost numeric null,
  raw_response jsonb not null default '{}'::jsonb,
  error_code text null,
  error_message text null,
  created_at timestamptz not null default now()
);
```

## Что уже сделано в v0.5

1. Созданы миграции для `models`, `tasks`, `model_responses` и `profiles`.
2. `models` заполняется curated free OpenRouter set.
3. Добавлен server-side Supabase client.
4. `/api/models` читает активные публичные модели из Supabase.
5. Если Supabase недоступен, `/api/models` использует hardcoded fallback.
6. Перед вызовом OpenRouter backend резолвит `selectionId` в server-only `model_key`.
7. `/api/compare` best-effort сохраняет `tasks` и `model_responses`.
8. `votes` остаётся будущим этапом `v0.6`.

---

## Будущие сущности Image Arena / Visual Arena

Image Arena не входит в текущие обязательные таблицы MVP. Нельзя менять scope `v0.5` так, будто визуальная генерация уже нужна сейчас.

После стабильной Prompt Arena можно добавить отдельную сущность, например:

```text
image_generations
# записи о сгенерированных изображениях

artifacts
# более общий вариант для будущих файлов: images, documents, code outputs
```

Минимальная будущая структура `image_generations`:

| Поле | Тип | Назначение |
|---|---|---|
| `id` | uuid | ID генерации |
| `task_id` | uuid | Связь с задачей Image Arena |
| `model_id` | uuid | Модель, которая создала изображение |
| `status` | text | `success`, `error`, `timeout` |
| `storage_bucket` | text | Bucket Supabase Storage |
| `storage_path` | text | Путь к файлу изображения |
| `prompt_text` | text | Визуальная идея пользователя |
| `width` | integer null | Ширина изображения |
| `height` | integer null | Высота изображения |
| `mime_type` | text null | Например `image/png` или `image/jpeg` |
| `error_code` | text null | Код ошибки |
| `error_message` | text null | Сообщение ошибки |
| `created_at` | timestamptz | Дата создания |

Правило хранения:

```text
Supabase Storage хранит файлы изображений.
# binary/image data не хранится в PostgreSQL

Supabase PostgreSQL хранит metadata и storage path.
# база нужна для истории, сравнения, победителя, лимитов и аудита
```

Для Image Arena также понадобятся лимиты на количество генераций, размер файлов, доступ к Storage и очистку старых artifacts.
