# 35 - Database Schema Sync Check

## Назначение

`schema:check` проверяет, что **реальная** Supabase PostgreSQL-схема соответствует
тому, на что рассчитывает проект и документация. Это помогает быстро поймать
дрейф схемы (расхождение между миграциями/документацией и фактической базой)
до того, как он сломает API.

Скрипт: `scripts/check-schema-sync.mjs`. Команда: `npm run schema:check`.

## Что проверяется

**Таблицы (`public`):**

- `profiles`
- `models`
- `tasks`
- `model_responses`
- `votes`
- `anonymous_sessions`

**Колонки:**

- `profiles.id`
- `profiles.email`
- `profiles.display_name`
- `profiles.first_name`
- `profiles.last_name`
- `profiles.avatar_url`
- `profiles.role`
- `profiles.plan`
- `profiles.created_at`
- `profiles.updated_at`
- `models.id`
- `models.provider`
- `models.model_key`
- `models.display_name`
- `models.description`
- `models.role_tags`
- `models.price_label`
- `models.is_active`
- `models.is_public`
- `models.sort_order`
- `models.raw_metadata`
- `models.access_level`
- `models.status`
- `tasks.id`
- `tasks.task_text`
- `tasks.mode_slug`
- `tasks.status`
- `tasks.selected_models`
- `tasks.settings`
- `tasks.user_id`
- `tasks.anonymous_session_id`
- `tasks.error_message`
- `model_responses.id`
- `model_responses.task_id`
- `model_responses.model_id`
- `model_responses.model_key`
- `model_responses.display_name`
- `model_responses.response_text`
- `model_responses.status`
- `model_responses.error_code`
- `model_responses.error_message`
- `model_responses.latency_ms`
- `model_responses.input_tokens`
- `model_responses.output_tokens`
- `model_responses.total_tokens`
- `model_responses.raw_response`
- `votes.id`
- `votes.task_id`
- `votes.model_response_id`
- `votes.user_id`
- `votes.anonymous_session_id`
- `votes.vote_type`
- `votes.reason`
- `votes.created_at`
- `votes.updated_at`
- `anonymous_sessions.id`
- `anonymous_sessions.display_name`
- `anonymous_sessions.avatar_seed`
- `anonymous_sessions.color_seed`
- `anonymous_sessions.created_at`
- `anonymous_sessions.last_seen_at`
- `anonymous_sessions.converted_user_id`

**RPC-функции (`public`):**

- `cast_best_vote(p_task_id uuid, p_response_id uuid, p_user_id uuid, p_anon_id text)`

**Supabase Storage:**

- bucket `avatars`
- `public = false`
- `file_size_limit = 2097152` (2 MB)
- `allowed_mime_types = image/jpeg, image/png, image/webp`

`models.status` добавлен миграцией `20260610061249_add_models_status_column.sql`
как generated stored column, производная от `models.is_active`:

- тип: `text`
- выражение: `case when is_active then 'active' else 'inactive' end`
- режим: `generated always as (...) stored`
- отдельного `default active` у поля нет

`schema:check` должен проверять не только наличие `models.status`, но и то, что
это generated column, зависящая от `models.is_active`.

На текущем MVP выбор доступных моделей по-прежнему должен опираться на
`models.is_active` / `models.is_public`. Поле `models.status` отражает текущее
значение `is_active` в governance-friendly формате `active` / `inactive` и
проверяется как часть схемы. Если позже потребуется полноценный lifecycle
(`active`, `inactive`, `deprecated`, `blocked`), это нужно оформить отдельной
миграцией с backfill-правилами и ограничениями.

## Подключение и переменная окружения

Скрипт читает строку подключения из `.env.local`:

```env
SUPABASE_DB_URL=postgresql://USER:PASSWORD@HOST:5432/postgres
# либо DATABASE_URL как fallback
```

- `SUPABASE_DB_URL` берётся из Supabase → Project Settings → Database →
  Connection string (URI).
- Подключение идёт по SSL.
- Если `SUPABASE_DB_URL` не задан, скрипт завершится с кодом `2` и подсказкой.

### Безопасность

- значение `SUPABASE_DB_URL` **никогда** не выводится в консоль;
- host, user и пароль не печатаются;
- при ошибке подключения выводится только безопасный код ошибки
  (например `ECONNREFUSED`, `28P01`), а не строка подключения;
- строку подключения **нельзя** коммитить в код, документацию или git.
  `.env.local` уже в `.gitignore`.

## Запуск

```bash
npm run schema:check
# подключается к Supabase Postgres и проверяет таблицы/колонки/RPC/Storage
```

Файл скрипта имеет расширение `.mjs` и запускается напрямую через Node как native
ESM. Это убирает нестабильность запуска `node *.ts` без `tsx`, `ts-node` или
экспериментального TypeScript stripping.

## Exit codes

| Code | Значение |
|---|---|
| `0` | все требуемые schema objects найдены |
| `1` | есть отсутствующие или несовпадающие schema objects (дрейф схемы) |
| `2` | нельзя выполнить проверку (нет `SUPABASE_DB_URL` или база недоступна) |

## Почему это не в `verify` / CI / `build`

`schema:check` намеренно **не** добавлен в `npm run verify`, `prebuild`, обычный
`npm run health` или GitHub Actions, потому что требует:

- реальной строки подключения с секретом (`SUPABASE_DB_URL`);
- сетевого доступа к базе Supabase.

Добавление его в общий build/CI ломало бы сборку у всех, у кого нет доступа к
базе, и противоречило бы правилу «не вставлять секреты в CI». Это отдельная
ops/dev-проверка, которую запускают вручную против реальной базы.
`npm run health:local` запускает `schema:check` только если локально задан
`SUPABASE_DB_URL` или `DATABASE_URL`. Без этих переменных команда явно пропускает
проверку схемы и не печатает секреты.

## Как добавить новый schema object в проверку

Отредактируйте массивы `REQUIRED_TABLES`, `REQUIRED_COLUMNS`,
`REQUIRED_GENERATED_COLUMNS`, `REQUIRED_FUNCTIONS` или
`REQUIRED_STORAGE_BUCKETS` в `scripts/check-schema-sync.mjs`. Список намеренно
держится в одном месте.
