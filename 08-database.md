# 08 - Database

## Назначение файла

Этот файл описывает структуру Supabase PostgreSQL для проекта **Новая эпоха**.

Текущий статус документа:

```text
v0.5.1
# Supabase MVP: models, tasks, model_responses, profiles, votes
# task_text является каноническим полем текста задачи
```

## Главная идея базы

База хранит:

- пользователей и профили;
- доступные AI-модели;
- задачи пользователя;
- ответы моделей;
- голосование за лучший ответ;
- историю сравнений для будущего History MVP;
- технические данные для аудита запусков и отладки ошибок.

## Важное правило по modelIds

В MVP `modelIds` работает в двух безопасных режимах.

Основной режим Supabase:

```text
Frontend получает models.id из GET /api/models.
# это публичный UUID модели внутри проекта

Backend по models.id находит models.model_key.
# OpenRouter model key остаётся на сервере
```

Fallback режим:

```text
Если Supabase не настроен или каталог моделей недоступен, GET /api/models возвращает hardcoded allowlist.
# в fallback-режиме selectionId может быть временно равен OpenRouter model key из server-side списка
```

В обоих режимах backend повторно проверяет выбранные модели и не принимает произвольный model key от клиента.

## Правило по тексту задачи

Каноническое поле текста задачи:

```text
tasks.task_text
# единое поле для Prompt Arena и будущих Arena-режимов
```

Не использовать в новом коде:

```text
prompt_text
# старое имя поля, оставалось только как временная совместимость
```

Переход был сделан через две стадии:

1. Добавить `task_text`, синхронизировать его с `prompt_text` и сохранить обратную совместимость.
2. Перевести код на `task_text`, затем удалить `prompt_text` миграцией `20260609082216_drop_prompt_text.sql`.

## Основные таблицы

## 1. profiles

Профили пользователей Supabase Auth.

| Поле | Тип | Назначение |
|---|---|---|
| `id` | uuid | ID пользователя из Supabase Auth |
| `email` | text null | Email пользователя |
| `display_name` | text null | Имя пользователя в интерфейсе |
| `created_at` | timestamptz | Дата создания |
| `updated_at` | timestamptz | Дата обновления |

Связь:

```text
profiles.id -> auth.users.id
# профиль привязан к пользователю Supabase Auth
```

На раннем MVP приложение может работать без авторизации. В таком случае `tasks.user_id` может быть `null`.

## 2. models

Список моделей, разрешённых для использования в проекте.

| Поле | Тип | Назначение |
|---|---|---|
| `id` | uuid | Публичный ID модели внутри проекта |
| `provider` | text | Провайдер, например `openrouter` |
| `model_key` | text | Технический ID модели у провайдера |
| `display_name` | text | Название модели в UI |
| `description` | text null | Описание модели |
| `price_label` | text | `free`, `cheap`, `balanced`, `expensive`, `unknown` |
| `is_active` | boolean | Можно ли использовать модель |
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
# frontend должен работать через models.id, а backend сам резолвит model_key
```

## 3. tasks

Задачи, которые пользователь отправляет в Arena.

| Поле | Тип | Назначение |
|---|---|---|
| `id` | uuid | ID задачи |
| `user_id` | uuid null | ID пользователя, если есть авторизация |
| `anonymous_session_id` | text null | Связь для anonymous history/session |
| `mode_slug` | text | Режим: `prompt-arena`, `code-arena`, `multi-model-battle`, `ai-team-mode`, `judge-mode`, `leaderboard` |
| `task_text` | text | Текст задачи пользователя |
| `prompt_hash` | text null | Будущий hash задачи для аналитики/дедупликации |
| `title` | text null | Будущий заголовок истории |
| `status` | text | `pending`, `running`, `completed`, `partial`, `failed`, `cancelled` |
| `selected_models` | jsonb | Список выбранных model keys для аудита запуска |
| `settings` | jsonb | Настройки запуска |
| `error_message` | text null | Ошибка на уровне задачи |
| `created_at` | timestamptz | Дата создания |
| `updated_at` | timestamptz | Дата обновления |

Правильное имя таблицы:

```text
tasks
# не prompts, потому что задача может относиться к разным Arena-режимам
```

Ограничение для текста задачи:

```text
char_length(task_text) >= 3 and char_length(task_text) <= 8000
# защищает от пустых и слишком больших задач на уровне БД
```

## 4. model_responses

Ответы моделей на задачу.

| Поле | Тип | Назначение |
|---|---|---|
| `id` | uuid | ID ответа |
| `task_id` | uuid | Связь с `tasks.id` |
| `model_id` | uuid null | Связь с `models.id` |
| `model_key` | text | OpenRouter model key, сохранённый server-side для истории |
| `display_name` | text null | Название модели на момент ответа |
| `response_text` | text null | Текст ответа модели |
| `status` | text | `success`, `error`, `timeout`, `cancelled` |
| `error_code` | text null | Код ошибки |
| `error_message` | text null | Сообщение ошибки |
| `latency_ms` | integer null | Время ответа |
| `input_tokens` | integer null | Input tokens из usage |
| `output_tokens` | integer null | Output tokens из usage |
| `total_tokens` | integer null | Total tokens из usage |
| `estimated_cost` | numeric null | Будущая оценка стоимости |
| `raw_response` | jsonb | Безопасная provider metadata |
| `created_at` | timestamptz | Дата создания |

Правильная связь:

```text
model_responses.task_id -> tasks.id
# не prompt_id
```

## 5. votes

Голоса пользователя или anonymous session за ответы моделей.

| Поле | Тип | Назначение |
|---|---|---|
| `id` | uuid | ID голоса |
| `task_id` | uuid | Связь с `tasks.id` |
| `model_response_id` | uuid | Связь с `model_responses.id` |
| `user_id` | uuid null | ID пользователя, если есть авторизация |
| `anonymous_session_id` | text null | ID anonymous session, если нет авторизации |
| `vote_type` | text | `best`, `like`, `dislike` |
| `reason` | text null | Будущее объяснение выбора |
| `created_at` | timestamptz | Дата создания |
| `updated_at` | timestamptz | Дата обновления |

Правила голосования:

```text
Один task - один best vote от одного user_id.
# пользователь выбирает один лучший ответ в сравнении

Один task - один best vote от одного anonymous_session_id.
# guest-пользователь тоже не должен голосовать много раз за лучший ответ

like/dislike ограничиваются по model_response_id + voter + vote_type.
# защита от дублей реакций
```

## Текущий SQL-скелет целевого состояния

```sql
create table public.models (
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
  sort_order integer not null default 100,
  raw_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  anonymous_session_id text,
  mode_slug text not null default 'prompt-arena',
  task_text text not null,
  prompt_hash text,
  title text,
  status text not null default 'pending',
  selected_models jsonb not null default '[]'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.model_responses (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  model_id uuid references public.models(id) on delete set null,
  model_key text not null,
  display_name text,
  response_text text,
  status text not null default 'success',
  error_code text,
  error_message text,
  latency_ms integer,
  input_tokens integer,
  output_tokens integer,
  total_tokens integer,
  estimated_cost numeric,
  raw_response jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.votes (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  model_response_id uuid not null references public.model_responses(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  anonymous_session_id text,
  vote_type text not null default 'best',
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

## Миграции

Обязательная история миграций для текущего MVP:

| Файл | Назначение |
|---|---|
| `0001_prompt_arena_mvp.sql` | Базовые таблицы Prompt Arena |
| `0002_sync_free_models.sql` | Синхронизация списка бесплатных моделей |
| `0003_profiles.sql` | Таблица профилей |
| `0004_profiles_grants.sql` | Grants для profiles |
| `0005_service_role_models_select.sql` | Доступ service role к models |
| `0006_service_role_profiles_grants.sql` | Grants для profiles/service role |
| `20260607212653_harden_profiles_and_indexes.sql` | Усиление profiles, RLS policies и индексов |
| `20260608041610_align_mvp_tasks_and_votes.sql` | Выравнивание tasks/votes под MVP и временная совместимость task_text/prompt_text |
| `20260609054344_db_integrity_fixes.sql` | Integrity/security fixes: search_path, updated_at triggers, unique vote indexes |
| `20260609082216_drop_prompt_text.sql` | Финальное удаление старого `prompt_text` после перехода к `task_text` |

Важно:

```text
20260609054344_db_integrity_fixes.sql уже применён в Supabase.
# файл нужен в репозитории для истории миграций

20260609082216_drop_prompt_text.sql уже применён в Supabase.
# это финальный cleanup после деплоя кода, который пишет tasks.task_text
```

## Что уже сделано в v0.5.1

1. Созданы таблицы `models`, `tasks`, `model_responses`, `profiles`, `votes`.
2. Включён RLS на основных публичных таблицах.
3. `models` заполняется curated OpenRouter model set.
4. Добавлен server-side Supabase client.
5. `/api/models` читает активные публичные модели из Supabase.
6. Если Supabase недоступен, `/api/models` использует hardcoded fallback.
7. Перед вызовом OpenRouter backend резолвит `selectionId` в server-only `model_key`.
8. `/api/compare` best-effort сохраняет `tasks` и `model_responses`.
9. `votes` подготовлена для выбора лучшего ответа и реакций.
10. Добавлены индексы и constraints для целостности данных.
11. Добавлены triggers для автоматического обновления `updated_at` в `tasks` и `models`.
12. Код Prompt Arena переведён с `prompt_text` на `task_text`.
13. История миграций Supabase синхронизирована с репозиторием.

## Будущие сущности Image Arena / Visual Arena

Image Arena не входит в текущий обязательный scope Prompt Arena MVP. Нельзя менять scope `v0.5.1` так, будто визуальная генерация уже нужна сейчас.

После стабильной Prompt Arena можно добавить отдельные сущности:

```text
image_generations
# записи о сгенерированных изображениях

artifacts
# общий вариант для будущих файлов: images, documents, code outputs
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
| `task_text` | text | Визуальная идея пользователя |
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
