# 35 - Database Schema Sync Check

## Назначение

`schema:check` проверяет, что **реальная** Supabase PostgreSQL-схема соответствует
тому, на что рассчитывает проект и документация. Это помогает быстро поймать
дрейф схемы (расхождение между миграциями/документацией и фактической базой)
до того, как он сломает API.

Скрипт: `scripts/check-schema-sync.ts`. Команда: `npm run schema:check`.

## Что проверяется

**Таблицы (`public`):**

- `profiles`
- `models`
- `tasks`
- `model_responses`
- `votes`

**Колонки:**

- `tasks.task_text`
- `tasks.mode_slug`
- `model_responses.task_id`
- `votes.task_id`
- `models.model_key`
- `models.provider`
- `models.status`

> **Известный дрейф: `models.status`.** Текущие миграции описывают таблицу
> `models` с полями `is_active` / `is_public`, а **не** `status`
> (см. `supabase/migrations/0001_prompt_arena_mvp.sql`). Поэтому при запуске на
> текущей схеме `schema:check` может отметить `models.status` как `MISSING` —
> это **корректная** работа проверки: она показывает реальное расхождение.
> Нужно либо добавить колонку `models.status`, либо обновить список проверок и
> документацию. Это решение остаётся за владельцем проекта.

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
# подключается к Supabase Postgres и проверяет таблицы/колонки
```

Требует Node ≥ 22.6 (нативный TypeScript stripping). Dev и CI используют Node 24.
При первом запуске Node может вывести безвредное предупреждение
`MODULE_TYPELESS_PACKAGE_JSON` — на результат и exit code оно не влияет.

## Exit codes

| Code | Значение |
|---|---|
| `0` | все требуемые таблицы и колонки найдены |
| `1` | есть отсутствующие таблицы или колонки (дрейф схемы) |
| `2` | нельзя выполнить проверку (нет `SUPABASE_DB_URL` или база недоступна) |

## Почему это не в `verify` / CI / `build`

`schema:check` намеренно **не** добавлен в `npm run verify`, `prebuild` или
GitHub Actions, потому что требует:

- реальной строки подключения с секретом (`SUPABASE_DB_URL`);
- сетевого доступа к базе Supabase.

Добавление его в общий build/CI ломало бы сборку у всех, у кого нет доступа к
базе, и противоречило бы правилу «не вставлять секреты в CI». Это отдельная
ops/dev-проверка, которую запускают вручную против реальной базы. Отдельного
агрегатора Project Health Check в проекте сейчас нет; ближайший — `npm run verify`
(typecheck + lint + build + docs:check), и `schema:check` сознательно остаётся
вне него.

## Как добавить новую таблицу/колонку в проверку

Отредактируйте массивы `REQUIRED_TABLES` и `REQUIRED_COLUMNS` в
`scripts/check-schema-sync.ts`. Список намеренно держится в одном месте.
