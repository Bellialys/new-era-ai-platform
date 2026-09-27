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

`models:verify` обращается к OpenRouter `GET /api/v1/models?output_modalities=text`
и `GET /api/v1/images/models` и
проверяет четыре runtime-группы: fallback text catalog, Team default, Judge
primary/fallback и registered-only Image catalog. Для text catalog проверяются
минимальный count, уникальные непустые IDs и output modality `text`; Judge primary
и fallback обязаны различаться. Для Image catalog проверяются output modality
`image` и provider parameters `aspect_ratio`/`n`. Catalog drift
завершает команду с exit code `1`, malformed source или provider/runtime failure
— с exit code `2`.
`smoke` проверяет `/api/health` и `/api/models` на запущенном приложении.

Для `health:production` нужно задать `SMOKE_BASE_URL` или
`NEXT_PUBLIC_SITE_URL`, чтобы smoke-check смотрел на нужный deployment.

Если проверяется protected Vercel Preview, дополнительно задайте
`VERCEL_AUTOMATION_BYPASS_SECRET`. `smoke` передаст его только как
`x-vercel-protection-bypass` header и не выведет значение в лог.

### Scheduled `models:verify`

`.github/workflows/models-verify.yml` является обязательным operational
monitoring для provider drift:

- ежедневно в `03:17 UTC`;
- ручной запуск через `workflow_dispatch`;
- `permissions: contents: read`;
- fail closed, без `continue-on-error`;
- передаёт repository secret `OPENROUTER_API_KEY` только live verification step.

Workflow последовательно выполняет `npm run test:models-verify` и
`npm run models:verify -- --json`.

Pull request CI выполняет только `npm run test:models-verify` с mock discovery;
provider secret ему не передаётся. Поэтому PR test подтверждает parser/policy
контракт, но не текущую доступность моделей у OpenRouter.

Secret в GitHub Actions пока ожидается, поэтому до его добавления расписание
нельзя считать operational. Scheduled workflow не является branch-protected PR
gate и не заменяет production smoke или owner-approved paid Image generation
smoke.

## Env Requirements

Можно запускать без live provider-доступа:

- `env:check`
- `typecheck`
- `lint`
- `test`
- `test:models-verify`
- `test:env-check`
- `docs:check`
- `state:check`
- `build`

Требуют Supabase:

- `schema:check` - нужен `SUPABASE_DB_URL` или `DATABASE_URL`;
- `env:check:full` - также проверяет `SUPABASE_ACCESS_TOKEN`.

Требуют OpenRouter:

- `models:verify` - нужен `OPENROUTER_API_KEY`; scheduled/manual workflow
  получает его из GitHub Actions repository secret только на live-step.
- `test:models-verify` - использует mock discovery и не требует provider secret.

Требуют запущенное приложение или deployment:

- `smoke` - использует `SMOKE_BASE_URL`, `NEXT_PUBLIC_SITE_URL` или локальный
  `http://localhost:3000`.
  Для protected Vercel Preview также нужен `VERCEL_AUTOMATION_BYPASS_SECRET`,
  иначе Vercel Authentication вернёт 401 до попадания запроса в приложение.

## Security Rules

- Не добавлять реальные ключи в репозиторий.
- Не коммитить `.env.local`.
- Не печатать значения secrets в логах.
- Не использовать `SUPABASE_SERVICE_ROLE_KEY` в browser/client code.
- Не использовать `VERCEL_AUTOMATION_BYPASS_SECRET` в browser/client code.
- `models:verify` может выводить отсутствующие `model_key`, но не API key.
- `schema:check` может выводить безопасный error code, но не database URL.
