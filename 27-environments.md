# 27 - Environment Matrix

## Назначение файла

Этот документ описывает матрицу окружений проекта **Новая эпоха** и правила безопасной работы с Vercel, Supabase, переменными окружения, миграциями и production-данными.

Главная цель - физически и организационно разделить разработку, проверку и production, чтобы случайная команда, Codex-задача, Preview-деплой или локальный эксперимент не повредили реальные данные пользователей.

## Главный принцип

Production должен быть защищён не только правилами, но и архитектурно:

- отдельный Vercel production environment;
- отдельный Supabase production project;
- отдельные production secrets;
- отдельный порядок применения миграций;
- ограниченный доступ;
- обязательный rollback-plan перед изменениями.

Если есть сомнение, к какому окружению подключён код, команда или ключ, действие останавливается до ручной проверки.

## Матрица окружений

| Окружение | Где развёрнуто | Для чего | База данных | Данные | Доступ |
|---|---|---|---|---|---|
| Local | ПК разработчика / Codex | Разработка, дебаг, создание миграций | Local Supabase через Docker | Тестовые или seed-данные | Только разработчик |
| Preview | Vercel Preview Deployment для ветки или PR | Проверка PR перед мержем, smoke-тесты | Supabase Preview project или Supabase Branch | Изолированные тестовые данные | Разработчик, команда, QA |
| Staging | Отдельный staging-деплой или отдельный Vercel project | Pre-production, интеграционные тесты перед production | Supabase Staging project | Санитайз-копия production или расширенные seed-данные | Lead, команда, QA |
| Production | Основной сайт на Vercel | Реальные пользователи | Supabase Production project | Реальные данные пользователей | Только владелец, lead, on-call |

## Минимальная схема для MVP

Для текущего MVP можно начать с такой схемы:

| Этап | Минимум сейчас | Потом усилить |
|---|---|---|
| Local | `.env.local` + локальный запуск Next.js | `supabase start` + локальный Docker Supabase |
| Preview | Vercel Preview + отдельные Preview env vars | Supabase Branch per PR |
| Staging | Можно временно пропустить | Отдельный staging project перед публичным запуском |
| Production | Vercel Production + production Supabase | CI approval, backup verification, мониторинг |

Важно: даже если Staging временно не используется, правила Staging уже фиксируются в документации, чтобы потом не перестраивать процесс хаотично.

## Правила переменных окружения

### Общие правила

1. `.env.local` используется только локально.
2. `.env.local` никогда не добавляется в Git.
3. `.env.example` должен быть в Git и содержать только пустые значения или безопасные примеры.
4. Vercel Environment Variables настраиваются отдельно для Production, Preview и Development.
5. Production secrets вводятся вручную через Vercel Dashboard или защищённый secret manager.
6. Production secrets нельзя передавать в Codex, чат, README, issue, PR-комментарии или скриншоты.
7. Любая новая переменная должна быть добавлена в `.env.example` с пояснением.

## Текущие переменные проекта

| Переменная | Где используется | Можно в браузере | Правило |
|---|---|---|---|
| `OPENROUTER_API_KEY` | Backend / API routes | Нет | Только server-side. Никогда не использовать в client components. |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + server | Да | Публичный URL проекта Supabase. Для каждого окружения свой. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser + server | Да | Публичный ключ Supabase. Работает только вместе с RLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend / server-side only | Нет | Полный доступ в обход RLS. Запрещён в браузере. |
| `APP_ENV` | Server / app config | Нет | Должен явно показывать окружение: local, preview, staging или production. |
| `APP_URL` | Server / redirects / links | Нет | Для каждого окружения свой URL. |
| `NEXT_PUBLIC_SITE_URL` | Browser + server | Да | Публичный URL сайта для текущего окружения. |
| `MODEL_TIMEOUT_MS` | Backend | Нет | Лимит времени ответа модели. |
| `OPENROUTER_MAX_TOKENS` | Backend | Нет | Лимит токенов ответа модели. |
| `UPSTASH_REDIS_REST_URL` | Backend | Нет | Нужен для rate limiting перед публичным deploy. Vercel Marketplace alias: `KV_REST_API_URL`. |
| `UPSTASH_REDIS_REST_TOKEN` | Backend | Нет | Секретный токен Redis. Только server-side. Vercel Marketplace alias: `KV_REST_API_TOKEN`. |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | CI / smoke tooling | Нет | Опциональный Vercel Deployment Protection bypass secret для автоматических проверок protected Preview. Не использовать в browser/client code. |

## Нормализация `APP_ENV`

Рекомендуемые значения:

| Значение | Что означает |
|---|---|
| `local` | Локальный запуск на ПК разработчика |
| `development` | Допустимый alias для Local в текущем MVP |
| `preview` | Vercel Preview Deployment |
| `staging` | Staging перед production |
| `production` | Основной production-сайт |

Правило: код не должен выполнять production-действия, если `APP_ENV` не равен `production` и если явно не подтверждён production-контекст.

## Supabase projects per environment

Каждое окружение должно иметь собственный Supabase-контекст.

| Окружение | Supabase источник | Правило |
|---|---|---|
| Local | `supabase start` | Использовать локальную Docker-БД. Не подключать Local к production. |
| Preview | Supabase Branch или отдельный Preview project | Проверка PR и миграций изолированно от production. |
| Staging | Отдельный Staging project | Максимально похож на production, но без реальных PII. |
| Production | Основной Production project | Только реальные пользователи и controlled migrations. |

Запрещено использовать production `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` или database password в Local, Preview или Staging.

## Service Role policy

`SUPABASE_SERVICE_ROLE_KEY` - самый опасный ключ Supabase в проекте.

Он может обходить Row Level Security и выполнять действия с повышенными правами.

Разрешено:

- API Routes;
- Server Actions;
- server-side utilities;
- backend-only jobs;
- CI/CD jobs, если это явно нужно.

Запрещено:

- client components;
- файлы с `'use client'`;
- `src/components/*`;
- browser-side Supabase client;
- public JavaScript bundle;
- README, issue, PR, screenshots;
- любые переменные с префиксом `NEXT_PUBLIC_`.

## Проверка service role в клиентском коде

Пример guardrail для CI:

```bash
find src -type f \( -name "*.ts" -o -name "*.tsx" \) \
  ! -path "src/app/api/*" \
  ! -name "*.server.ts" \
  -print0 | xargs -0 grep -n "SUPABASE_SERVICE_ROLE_KEY\|service_role"
# ищет опасные упоминания service role вне backend-зоны
```

Если команда что-то нашла в client-side зоне, CI должен завершиться с ошибкой.

## Env validation

В проекте нужно добавить runtime/build-time проверку переменных окружения через Zod или аналогичный валидатор.

Цель:

- если обязательной переменной нет, приложение падает сразу при запуске или build;
- client env и server env разделены;
- server-only secrets нельзя случайно импортировать в browser bundle;
- `APP_ENV=production` требует полного набора production-переменных.

Правило для будущей реализации:

| Файл | Назначение |
|---|---|
| `src/env.ts` | Единая схема env-переменных |
| `.env.example` | Документация всех переменных без секретов |
| CI check | Проверка, что env schema и `.env.example` не расходятся |

## Supabase Auth Redirect URLs

Для каждого окружения должны быть настроены свои URLs в Supabase Auth.

| Окружение | Site URL | Redirect URLs |
|---|---|---|
| Local | `http://localhost:3000` | `http://localhost:3000/**` |
| Preview | Vercel Preview URL | Preview URL или wildcard для preview-деплоев |
| Staging | Staging domain | Staging domain callback URLs |
| Production | Основной домен | Только production domain callback URLs |

Правило: OAuth и magic links не должны вести из Preview в Production или наоборот.

## Порядок работы с миграциями

Миграции идут только в одну сторону:

Local -> Preview -> Staging -> Production

### Local

```bash
supabase start
# запускает локальный Supabase через Docker

supabase db reset
# пересоздаёт только локальную БД и применяет миграции заново

supabase migration up
# применяет новые миграции локально

supabase db lint
# проверяет SQL и структуру БД на проблемы
```

### Preview

Preview используется для проверки PR и миграций до мержа.

Правила:

- Preview не подключается к production DB;
- Preview использует Supabase Branch или отдельный Preview project;
- миграции проверяются на тестовых или seed-данных;
- после закрытия PR временная Preview-БД может быть удалена.

### Staging

Staging используется перед production.

Правила:

- Staging должен быть максимально похож на production;
- реальные PII должны быть удалены или заменены;
- smoke tests и integration tests выполняются на Staging;
- только после Staging можно идти в Production.

### Production

Production миграции выполняются только контролируемо.

Правила:

- только `up`-миграции;
- без `reset`;
- без `down` как обычного способа rollback;
- перед миграцией должен быть backup или проверенный restore point;
- должен быть rollback-plan приложения через предыдущий Vercel deployment.

## Запрещённые команды для Production

Эти действия запрещены на production-БД:

```bash
supabase db reset
# запрещено для production: пересоздаёт базу и уничтожает данные

supabase migration down
# запрещено для production: может откатить схему и повредить данные

DROP TABLE table_name;
# запрещено вручную на production: удаляет таблицу

TRUNCATE table_name;
# запрещено вручную на production: очищает таблицу

DELETE FROM table_name;
# запрещено без WHERE: удаляет все строки
```

Дополнительно запрещено:

- менять production-схему вручную через Supabase Dashboard;
- применять SQL из чата без review;
- запускать миграции из локального терминала без понимания, к какому project ref подключён Supabase CLI;
- использовать production database password в `.env.local`.

## Safe migration checklist

Перед любой миграцией:

1. Миграция создана файлом в `supabase/migrations`.
2. Нет ручного изменения схемы через dashboard.
3. Миграция проверена локально.
4. `typecheck` прошёл.
5. `lint` прошёл.
6. `test` прошёл, если тесты есть.
7. `build` прошёл.
8. Preview deploy успешен.
9. Smoke tests на Preview успешны.
10. Staging проверен, если окружение уже включено.
11. Rollback-plan готов.
12. Документация обновлена.
13. Commit создан.

## Pre-deploy checklist для Staging -> Production

Перед деплоем в production:

1. Все GitHub checks зелёные.
2. `/api/health` на Staging возвращает OK.
3. Smoke tests на Staging прошли.
4. Миграции применены к Staging без ошибок.
5. Ошибок в логах Staging нет.
6. Release notes готовы.
7. Предыдущий Vercel deployment ID скопирован для rollback.
8. Проверено, что Vercel Production env vars заполнены.
9. Проверено, что Supabase Production project выбран правильно.
10. Production deploy подтверждён вручную владельцем или lead.

## Rollback policy

Rollback приложения:

- откатиться на предыдущий Vercel deployment;
- проверить `/api/health`;
- проверить `/arena`;
- проверить `GET /api/models`;
- проверить `POST /api/compare` на тестовом prompt.

Rollback базы данных:

- не делать хаотичный `migration down` на production;
- сначала оценить, можно ли исправить новой forward-миграцией;
- если данные повреждены, использовать backup/PITR/restore procedure;
- все действия фиксировать в incident note.

## PII sanitization для Staging

Если Staging наполняется данными из Production, реальные персональные данные должны быть заменены.

Примеры правил:

| Поле | Как санитайзить |
|---|---|
| Email | `user+{id}@test.local` |
| Phone | `+10000000000` или hash |
| Full name | `Test User {id}` |
| Prompt text | удалить или заменить синтетическим текстом, если prompt может содержать личные данные |
| IP address | hash или null |
| User agent | оставить только тип устройства, без уникальных фрагментов |

Важно: пользовательские prompts могут содержать PII, поэтому их нельзя бездумно копировать в Staging.

## Access policy

| Ресурс | Local | Preview | Staging | Production |
|---|---|---|---|---|
| Vercel project | Разработчик | Команда | Lead + команда | Владелец / lead |
| Supabase project | Разработчик | Команда | Lead + QA | Владелец / lead / on-call |
| Service role key | Локально при необходимости | Только server-side | Только server-side | Только server-side + минимум людей |
| SQL Editor | Можно | Осторожно | Read-only по возможности | Только emergency и audit |
| Database password | Можно для local | Ограниченно | Ограниченно | Не хранить локально |

## Codex policy

Codex не должен:

- просить production secrets в открытом виде;
- вставлять ключи в код;
- менять `.env.local` в Git;
- запускать production reset/drop/truncate/down-команды;
- подключать local-код к production Supabase;
- считать задачу завершённой без проверки `typecheck`, `lint`, `test` и `build`, если они применимы.

Codex может:

- создавать документацию;
- создавать миграции как файлы;
- добавлять guardrails;
- писать инструкции для ручной настройки Vercel/Supabase;
- проверять, что секреты не попали в репозиторий.

Для protected Vercel Preview автоматические проверки должны использовать
`VERCEL_AUTOMATION_BYPASS_SECRET` через заголовок `x-vercel-protection-bypass`.
Codex не должен создавать, ротировать или удалять этот secret без отдельного
явного подтверждения.

## Future hardening

Эти пункты не обязательны для самого первого MVP, но нужны перед публичным запуском или ростом проекта.

| Улучшение | Зачем |
|---|---|
| Supabase Branching per PR | Каждый PR получает изолированную БД, миграции проверяются отдельно. |
| GitHub Actions Environment Protection Rules | Production deploy требует ручного approval. |
| Sentry / monitoring | Быстро видеть ошибки по окружениям. |
| Automated backup verification | Проверять, что backup реально восстанавливается. |
| Read-only replica для аналитики | BI-запросы не нагружают production primary. |
| PII sanitization script | Безопасно копировать production-подобные данные в Staging. |
| SOPS / Doppler / 1Password | Централизованное управление secrets и ротация. |
| Terraform / Pulumi | Инфраструктура описана в коде, меньше ручных ошибок. |
| Audit log SQL-запросов | Видно, кто и когда сделал опасное действие. |
| Database firewall / IP allowlist | Production DB не доступна случайным локальным машинам. |

## Definition of Done для изменений окружений

Изменение окружения считается завершённым только если:

- документация обновлена;
- `.env.example` обновлён, если добавлялась новая переменная;
- реальные secrets не попали в Git;
- Vercel env vars настроены в нужных scope;
- Supabase project выбран правильно;
- production project не использовался для Local/Preview;
- `typecheck` прошёл;
- `lint` прошёл;
- `test` прошёл, если есть тесты;
- `build` прошёл;
- smoke-проверка выполнена, если затронут API;
- миграции проверены локально, если затронута БД;
- rollback-plan описан, если затронут production;
- commit создан.

## Короткое правило для проекта

Local - место для разработки.

Preview - место для проверки PR.

Staging - место для проверки почти как production.

Production - место для пользователей.

Никогда не использовать production как playground.
