# 08 - Database

## Назначение файла

Этот файл описывает структуру Supabase PostgreSQL для проекта **Новая эпоха**.

Текущий статус документа:

```text
v1.7.0-alpha.1
# repo target: Prompt Arena + Auth/Guest/Profile + Code Arena + Judge + Admin audit database surface
# release gate: remote Supabase migration history, audit_log RLS and generated-column drift must stay reconciled
# task_text является каноническим полем текста задачи
# votes использует model_response_id и vote_type: best, like, dislike
# models.status должен быть generated column: active/inactive
# cast_best_vote — атомарный RPC для best vote
# tasks.judge_verdict хранит JSON-вердикт POST /api/judge
# public.audit_log хранит admin/governance audit events и не открыт anon/authenticated напрямую
```

## Главная идея базы

База хранит:

- пользователей и профили;
- anonymous guest sessions;
- доступные AI-модели;
- уровни доступа к моделям для guest/account;
- задачи пользователя;
- ответы моделей;
- голосование за лучший ответ;
- avatar storage metadata через `profiles.avatar_url`;
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
| `first_name` | text null | Имя |
| `last_name` | text null | Фамилия |
| `avatar_url` | text null | URL аватара из Supabase Storage |
| `role` | text | `user`, `admin` |
| `plan` | text | `free`, `premium` |
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
| `status` | text (generated) | `active` если `is_active = true`, иначе `inactive`. Вычисляемый столбец, только для чтения. |
| `access_level` | text | `anonymous`, `registered`, `premium` |
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
| `judge_verdict` | jsonb null | Вердикт `POST /api/judge`: победитель, reasoning и scores |
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

Важно по старой схеме:

```text
response_id и vote_type = winner не используются.
# актуальная схема использует model_response_id и vote_type = best
```

## 6. anonymous_sessions

Гостевые сессии для пользователей, которые выбрали режим `Продолжить как гость`.

| Поле | Тип | Назначение |
|---|---|---|
| `id` | uuid | ID гостевой сессии |
| `display_name` | text | Имя вида `Анонимус #4827` |
| `avatar_seed` | text | Seed для отображения аватара |
| `color_seed` | text | Seed для цвета guest card |
| `created_at` | timestamptz | Дата создания |
| `last_seen_at` | timestamptz | Дата последнего использования |
| `converted_user_id` | uuid null | Будущая связь при конвертации гостя в аккаунт |

Доверенный guest identity хранится в httpOnly cookie `na_guest`. `localStorage` используется только для отображения карточки и не является auth-фактором.

## 7. Storage bucket avatars

`avatars` - Supabase Storage bucket для фото профиля.

Правила target-состояния:

- bucket private;
- upload/update/delete только владельцу;
- путь файла: `{user_id}/avatar.{jpg|png|webp}`;
- `profiles.avatar_url` хранит URL/путь текущего аватара.

Storage bucket и RLS policies должны быть проверены отдельно в release gate, потому что `schema:check` проверяет только PostgreSQL public schema.

## 8. audit_log

`public.audit_log` хранит server-side audit events для admin/governance функций.

| Поле | Тип | Назначение |
|---|---|---|
| `id` | uuid | ID записи аудита |
| `actor_id` | uuid null | Пользователь-инициатор, если известен |
| `action` | text | Название действия |
| `target_type` | text null | Тип объекта действия |
| `target_id` | text null | ID объекта действия |
| `payload` | jsonb null | Безопасные технические детали события без секретов |
| `created_at` | timestamptz | Дата создания |

Правила доступа:

- RLS включён на `public.audit_log`;
- `anon` и `authenticated` не получают прямой доступ к таблице;
- `service_role` имеет только `SELECT` и `INSERT`;
- policies `audit_log_service_role_select` и `audit_log_service_role_insert` ограничены ролью `service_role`;
- чтение наружу идёт через `GET /api/admin/audit` и `requireAdmin()`.

## 9. RPC cast_best_vote

Атомарная функция для сохранения best vote. Добавлена миграцией
`20260615191924_atomic_best_vote_rpc.sql` и усилена release-gate migration
`20260617212741_reconcile_release_gate_security_and_models.sql`.

Сигнатура:

```sql
create or replace function public.cast_best_vote(
  p_task_id uuid,
  p_response_id uuid,
  p_user_id uuid,
  p_anon_id text
) returns public.votes
language plpgsql
security invoker
set search_path = public
```

Поведение:

- Если у данного пользователя/guest уже есть best vote на этот `task_id` — заменяет его (upsert по уникальному индексу).
- Возвращает запись `public.votes`.
- Функция работает как `SECURITY INVOKER`; execute grant оставлен только для
  `service_role` и `postgres`, `anon`/`authenticated` не имеют прямого execute.
- Вызывается через server-side `supabase.rpc('cast_best_vote', {...})` из
  `src/lib/server/votes.ts`.

Параметры:

| Параметр | Тип | Значение |
|---|---|---|
| `p_task_id` | uuid | ID задачи |
| `p_response_id` | uuid | ID выбранного ответа |
| `p_user_id` | uuid null | ID авторизованного пользователя (null для guest) |
| `p_anon_id` | text null | ID anonymous guest-сессии из cookie `na_guest` (null для auth пользователя) |

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
  access_level text not null default 'anonymous',
  is_public boolean not null default true,
  role_tags text[] not null default '{}'::text[],
  context_length integer,
  max_output_tokens integer,
  input_price_per_million numeric,
  output_price_per_million numeric,
  sort_order integer not null default 100,
  raw_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- generated column: computed from is_active, read-only
  status text generated always as (case when is_active then 'active' else 'inactive' end) stored
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  first_name text,
  last_name text,
  avatar_url text,
  role text not null default 'user',
  plan text not null default 'free',
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
  judge_verdict jsonb,
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

create table public.anonymous_sessions (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  avatar_seed text not null,
  color_seed text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  converted_user_id uuid references auth.users(id) on delete set null
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  payload jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_log enable row level security;

grant insert, select on public.audit_log to service_role;

create policy audit_log_service_role_select
on public.audit_log
for select
to service_role
using (true);

create policy audit_log_service_role_insert
on public.audit_log
for insert
to service_role
with check (true);
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
| `20260609095422_align_votes_indexes.sql` | Очистка старых votes indexes и финальное выравнивание best/reaction indexes |
| `20260610061249_add_models_status_column.sql` | Добавляет generated column `status` в `public.models` (`active`/`inactive`) |
| `20260615191924_atomic_best_vote_rpc.sql` | Создаёт RPC `cast_best_vote` — атомарный replace best vote |
| `20260617083258_anonymous_sessions.sql` | Создаёт guest sessions для Access Gate |
| `20260617083442_models_access_level.sql` | Добавляет `models.access_level` |
| `20260617084057_profiles_extend_v0_6_4.sql` | Расширяет `profiles` для Profile MVP |
| `20260617084255_avatars_storage_rls.sql` | Создаёт `avatars` bucket и Storage RLS policies |
| `20260617212741_reconcile_release_gate_security_and_models.sql` | Release-gate reconciliation: governance metadata, deactivation of unavailable model IDs, generated `models.status`, `cast_best_vote` security-invoker hardening |
| `20260624034630_add_judge_verdict_to_tasks.sql` | Добавляет `tasks.judge_verdict jsonb null` для результата `POST /api/judge` |
| `20260624055408_add_audit_log.sql` | Создаёт `public.audit_log`, индексы, service_role grants и RLS policies без прямого доступа anon/authenticated |

Release-gate note:

```text
Remote Supabase migration history and local migration filenames are aligned
through 20260624055408_add_audit_log.

Remote post-migration verification on 2026-06-18:
# models.status is generated always as (...), mismatch count = 0
# governance metadata exists for 21/21 model rows
# active/public model count = 16
# unavailable OpenRouter IDs are inactive/non-public
# cast_best_vote is SECURITY INVOKER with execute only for service_role/postgres

v1.7.0-alpha.1 sync on 2026-06-24:
# remote migrations include 20260624034630 add_judge_verdict_to_tasks
# remote migrations include 20260624055408 add_audit_log
# audit_log RLS is enabled
# audit_log policies exist only for service_role SELECT/INSERT
# anon/authenticated do not have direct audit_log SELECT
```

Удалённые устаревшие локальные миграции:

```text
0007_harden_profiles_and_indexes.sql
# дубль timestamp-миграции 20260607212653, в remote-истории не применён

0008_votes_mvp.sql
# старая несовместимая votes-схема через response_id/winner, в remote-истории не применена
```

Важно:

```text
20260609054344_db_integrity_fixes.sql уже применён в Supabase.
# файл нужен в репозитории для истории миграций

20260609082216_drop_prompt_text.sql уже применён в Supabase.
# это финальный cleanup после деплоя кода, который пишет tasks.task_text

20260609095422_align_votes_indexes.sql уже применён в Supabase.
# это финальное выравнивание индексов votes под best/like/dislike
```

## Что уже сделано к v1.7.0-alpha.1 в рабочем дереве

1. Созданы таблицы `models`, `tasks`, `model_responses`, `profiles`, `votes`.
2. Включён RLS на основных публичных таблицах.
3. `models` заполняется curated OpenRouter model set.
4. Добавлен server-side Supabase client.
5. `/api/models` читает активные публичные модели из Supabase.
6. Если Supabase недоступен, `/api/models` использует hardcoded fallback (16 моделей — другой список, чем в Supabase-каталоге, это намеренно).
7. Перед вызовом OpenRouter backend резолвит `selectionId` в server-only `model_key`.
8. `/api/compare` best-effort сохраняет `tasks` и `model_responses`.
9. `votes` подготовлена для выбора лучшего ответа и реакций.
10. Добавлены индексы и constraints для целостности данных.
11. Добавлены triggers для автоматического обновления `updated_at` в `tasks`, `models` и `votes`.
12. Код Prompt Arena переведён с `prompt_text` на `task_text`.
13. История миграций Supabase синхронизирована с репозиторием.
14. Старые локальные миграции `0007` и `0008` удалены из репозитория.
15. Server-side voting helper переведён на актуальную схему `model_response_id` и `best`.
16. Основная Prompt Arena сохраняет Winner vote через `POST /api/vote`, если `/api/compare` вернул сохранённый `taskId`.
17. Model catalog governance metadata подготовлены через `raw_metadata` без изменения `model_key`.
18. Добавлен generated column `status` в `models` (`active`/`inactive` в зависимости от `is_active`).
19. Деактивированы недоступные бесплатные модели: `z-ai/glm-4.5-air:free`, `moonshotai/kimi-k2.6:free`.
20. Создан атомарный RPC `cast_best_vote`; release-gate hardening перевёл его на `SECURITY INVOKER` с execute только для `service_role`.
21. Добавлены target-миграции `anonymous_sessions`, `models.access_level`, расширенный `profiles` и `avatars` storage.
22. Code Arena Lite использует `tasks.mode_slug = 'code-arena'`.
23. Judge Mode сохраняет `tasks.judge_verdict`.
24. `public.audit_log` создан для admin/governance событий с RLS и service_role-only доступом.
25. Code Arena Runner запускает код через внешний Piston runner для авторизованных пользователей; пользовательский код не выполняется в server-side процессе приложения.

## Будущие сущности Image Arena / Visual Arena

Image Arena не входит в текущий обязательный scope `v1.7.0-alpha.1`. Нельзя менять scope так, будто визуальная генерация уже нужна сейчас.

После стабильной Prompt Arena можно добавить отдельные сущности:

```text
image_generations
# записи о сгенерированных изображениях

artifacts
# общий вариант для будущих файлов: images, documents, code outputs
```

Минимальная будущая структура `image_generations`:

| Поле | Тип | Назначение |
|---|---|
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

## v2.0 Foundation Tables

Добавлены в `20260628031516_database_v2_foundation.sql`. Все таблицы: RLS enabled, service_role only (кроме `leaderboard_snapshots` — public read).

### usage_events

Учёт каждого AI-запроса (токены, стоимость, latency, ошибки).

| Колонка | Тип | Описание |
|---|---|---|
| `id` | uuid | PK |
| `user_id` | uuid null | FK → auth.users |
| `guest_id` | text null | Анонимный session ID |
| `mode_slug` | text | `prompt-arena`, `ai-team-mode`, `code-arena` и т.д. |
| `model_key` | text | OpenRouter model key |
| `prompt_tokens` | integer null | Токены промпта |
| `completion_tokens` | integer null | Токены ответа |
| `latency_ms` | integer null | Время ответа |
| `cost_usd` | numeric(12,8) null | Стоимость в USD |
| `error_code` | text null | Код ошибки, если запрос упал |
| `created_at` | timestamptz | Дата события |

### team_runs / team_run_steps

История AI Team Mode запусков с пошаговыми выходами ролей.

`team_runs` — одна строка на запуск (4 роли → один `final_answer`).
`team_run_steps` — одна строка на роль: `planner`, `researcher`, `critic`, `finalizer`.

### code_runs

История запусков кода через внешний Piston runner (только авторизованные пользователи).

Хранит: `language`, `code`, `stdin`, `stdout`, `stderr`, `exit_code`, `runner_url`, `latency_ms`.

Код не исполняется внутри Supabase или приложения — только metadata о внешнем выполнении.

### leaderboard_snapshots

Ежедневные снапшоты рейтинга моделей. Позволяют показывать Leaderboard без агрегации на лету.

Поля: `snapshot_date`, `model_key`, `model_display_name`, `total_votes`, `wins`, `losses`, `ties`, `win_rate`, `elo_score` (nullable).

RLS: public SELECT (снапшоты — публичные агрегированные данные); INSERT только service_role.

### artifacts

Metadata файлов (изображений, документов, code output). Binary data хранится в Supabase Storage, в PG — только путь и атрибуты.

Поля: `artifact_type` (`image` | `document` | `code_output`), `storage_path`, `mime_type`, `size_bytes`, `metadata` (jsonb), `task_id`.

### model_price_history

Append-only история цен моделей OpenRouter (input/output per million tokens), с полями `effective_from` / `effective_to` и `source`.

### cleanup_log

Аудит-трейл автоматических retention jobs: `cleanup_type`, `rows_deleted`, `oldest_deleted_at`.
