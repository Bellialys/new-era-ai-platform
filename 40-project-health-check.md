# 40 - Project Health Check

## Назначение

Project Health Check собирает основные проверки проекта в понятные npm-команды.
Цель - быстро понять, что Prompt Arena MVP, документация, env-политика и базовые
инженерные проверки находятся в рабочем состоянии.

Health-check не должен печатать секреты. Команды могут сообщать имена
отсутствующих переменных, но не должны выводить значения `OPENROUTER_API_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `DATABASE_URL` или другие
private credentials.

## Команды

### `npm run health`

Общая проверка без live Supabase/OpenRouter запросов:

```bash
npm run env:check
npm run typecheck
npm run lint
npm run test
npm run test:env-check
npm run docs:check
npm run state:check
npm run build
```

Эта команда подходит для локальной разработки и CI, если заданы безопасные
placeholder-значения basic env. Она не запускает `schema:check`,
`models:verify` или `smoke`.

### `npm run health:local`

Локальная расширенная проверка:

```bash
npm run health
npm run schema:check
# только если SUPABASE_DB_URL или DATABASE_URL есть в окружении
```

Если database URL не задан, `schema:check` пропускается с понятным сообщением.
Секретная строка подключения не печатается.

### `npm run health:production`

Production-проверка для окружения, где доступны реальные сервисы:

```bash
npm run env:check:full
npm run typecheck
npm run lint
npm run test
npm run test:env-check
npm run docs:check
npm run state:check
npm run build
npm run models:verify
npm run smoke
```

`models:verify` обращается к OpenRouter `GET /api/v1/models` и проверяет, что
локальные model ids из `src/lib/server/models.ts` существуют в live catalog.
`smoke` проверяет `/api/health` и `/api/models` на запущенном приложении.

Для `health:production` нужно задать `SMOKE_BASE_URL` или
`NEXT_PUBLIC_SITE_URL`, чтобы smoke-check смотрел на нужный deployment.

## Env Requirements

Можно запускать без live provider-доступа:

- `env:check`
- `typecheck`
- `lint`
- `test`
- `test:env-check`
- `docs:check`
- `state:check`
- `build`

Требуют Supabase:

- `schema:check` - нужен `SUPABASE_DB_URL` или `DATABASE_URL`;
- `env:check:full` - также проверяет `SUPABASE_ACCESS_TOKEN`.

Требуют OpenRouter:

- `models:verify` - нужен `OPENROUTER_API_KEY`.

Требуют запущенное приложение или deployment:

- `smoke` - использует `SMOKE_BASE_URL`, `NEXT_PUBLIC_SITE_URL` или локальный
  `http://localhost:3000`.

## Security Rules

- Не добавлять реальные ключи в репозиторий.
- Не коммитить `.env.local`.
- Не печатать значения secrets в логах.
- Не использовать `SUPABASE_SERVICE_ROLE_KEY` в browser/client code.
- `models:verify` может выводить отсутствующие `model_key`, но не API key.
- `schema:check` может выводить безопасный error code, но не database URL.
