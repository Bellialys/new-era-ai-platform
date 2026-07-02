# Новая эпоха - New Era AI Platform

**Новая эпоха** - AI-платформа для сравнения, оценки и совместной работы нескольких AI-моделей.

Пользователь вводит одну задачу, выбирает несколько AI-моделей, получает ответы рядом, сравнивает качество и выбирает лучший результат.

Главный источник порядка версий - `14-roadmap.md`.

## Текущий статус

<!-- SYNC:CURRENT_PHASE_START -->
**Текущая фаза:** v2.0 - AI Team Mode
<!-- SYNC:CURRENT_PHASE_END -->

<!-- SYNC:PROJECT_STATUS_START -->
**Статус проекта:** `in_development`
<!-- SYNC:PROJECT_STATUS_END -->

<!-- SYNC:PROJECT_VERSION_START -->
**Текущая версия:** `v2.0.0-alpha.1`
<!-- SYNC:PROJECT_VERSION_END -->

Текущая рабочая версия проекта: **v2.0.0-alpha.1 - AI Team Mode**.

Статус синхронизирован с `.project/state.json`; порядок будущих этапов описан в `14-roadmap.md`.

Реально готово:

- Next.js App Router проект;
- главная страница `/`;
- интерактивная страница `/arena`;
- backend route `GET /api/models`;
- backend route `POST /api/compare`;
- backend route `GET /api/health`;
- backend route `POST /api/vote`;
- backend route `POST /api/guest`;
- backend route `GET /api/code-models`;
- backend route `POST /api/code-compare`;
- backend route `POST /api/judge`;
- backend route `POST /api/code-run`;
- backend route `GET /api/admin/audit`;
- backend route `GET /api/admin/usage`;
- серверная интеграция OpenRouter;
- Supabase PostgreSQL migrations для `models`, `tasks`, `model_responses` и `profiles`;
- server-side Supabase client для сохранения Prompt Arena;
- browser-side Supabase client только с publishable key;
- чтение моделей из Supabase с fallback на hardcoded allowlist;
- server-side allowlist моделей как аварийный fallback;
- проверка `prompt`, `modelIds`, `modeSlug`;
- безопасные API-ошибки через `ApiError`;
- отмена устаревших запросов на клиенте через `AbortController`;
- best-effort сохранение задач и ответов в Supabase;
- сохранение Winner vote из основной Prompt Arena через backend route;
- синхронизированная история Supabase migrations;
- исправленная схема `votes` на `model_response_id` и `vote_type = 'best' | 'like' | 'dislike'`;
- smoke-check script `npm run smoke`;
- минимальный GitHub Actions CI;
- Access Gate и guest mode через server-set httpOnly cookie `na_guest`;
- Auth SSR, login/signup/logout, reset/update password flow;
- профиль, базовая статистика, avatar upload и email change request;
- Code Arena: сравнение кодовых решений отдельно от запуска; запуск кода доступен авторизованным пользователям через внешний Piston runner;
- backend route `POST /api/team-run` с auth gate, backend flag `ENABLE_TEAM_MODE`, rate limiting и DI-паттерном для engine;
- страница `/team` — AI Team Mode UI с feature flag `NEXT_PUBLIC_ENABLE_TEAM_MODE`;
- `package-lock.json`;
- текущая локальная сетка `state:check`, `docs:check`, `typecheck`, `lint`, `build` и `test` проходит; production Team Mode activation остаётся отдельным P1 gate.

Пока не готово как стабильный пользовательский этап:

- Release Gate P1 `Production Env Activation`: Upstash Redis env в Vercel Production, `ENABLE_TEAM_MODE=true`, `NEXT_PUBLIC_ENABLE_TEAM_MODE=true`, production redeploy и smoke;
- повторная проверка docs/state/typecheck/lint/build/test перед закрытием gate;
- live smoke внешнего runner и admin routes на целевом окружении;
- Image Arena;
- публичный выход AI Team Mode: считается активированным только после успешного V200-02 production smoke; до этого UI/API остаются alpha за feature flags.

## Главная цель

Создать продвинутую AI-платформу с режимами:

- Prompt Arena;
- Code Arena;
- Multi Model Battle;
- AI Team Mode;
- Judge Mode;
- Leaderboard.

Первый стабильный MVP - **Stable Prompt Arena**.

## Технологический стек

| Часть | Технология |
|---|---|
| Frontend | Next.js, React, TypeScript |
| Backend | Next.js Route Handlers |
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth |
| AI API | OpenRouter API |
| Deploy | Vercel |
| Repository | GitHub |
| Editor | Visual Studio Code |

## Локальный запуск

```bash
npm install
# устанавливает зависимости проекта

npm run dev
# запускает локальный сервер разработки

npm run typecheck
# проверяет TypeScript без production-сборки

npm run lint
# проверяет код через ESLint

npm run build
# проверяет production-сборку

npm run smoke
# проверяет базовый health/models smoke-check

npm run health
# запускает общий health-check без live Supabase/OpenRouter проверок

npm run health:local
# общий health-check + schema:check, если задан SUPABASE_DB_URL

npm run health:production
# production-проверка с full env, models:verify и smoke

npm run env:check
# проверяет обязательные переменные окружения (без вывода значений секретов)
```

## Переменные окружения

Создай `.env.local` на основе `.env.local.example`. Файл `.env.example`
остаётся справочным каталогом переменных; основной локальный пример -
`.env.local.example`.

Проверить окружение можно безопасным чекером (не выводит значения секретов):

```bash
npm run env:check
# basic-проверка переменных для запуска сайта

npm run env:check:full
# полный набор переменных проекта

npm run env:check:example
# генерирует .env.local.example только из placeholder-значений
```

Политика и детали: `37-env-check-policy.md` и
`38-env-check-implementation.md`.

```bash
cp .env.local.example .env.local
# создаёт локальный файл переменных окружения
```

Минимум для реальных AI-ответов:

```env
OPENROUTER_API_KEY=your_real_openrouter_key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Минимум для Supabase persistence:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
# NEXT_PUBLIC_SUPABASE_ANON_KEY можно использовать как fallback alias для публичного ключа
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

Нельзя добавлять в GitHub:

- `.env.local`;
- реальные API-ключи;
- production-секреты;
- приватные переменные Vercel.

## API текущей версии

### `GET /api/models`

Возвращает список разрешённых моделей.

Основной режим:

```text
Supabase models catalog
# frontend получает публичные model ids
```

Fallback режим:

```text
server-side hardcoded allowlist
# используется, если Supabase недоступен или каталог пуст
```

### `POST /api/compare`

Текущий запрос:

```json
{
  "prompt": "Сравни Next.js и Nuxt для MVP AI-платформы",
  "modelIds": ["model-selection-id-1", "model-selection-id-2"],
  "modeSlug": "prompt-arena"
}
```

Текущий ответ:

```json
{
  "status": "success",
  "taskId": "saved-task-uuid-or-null",
  "responses": [
    {
      "id": "response-uuid-or-generated-id",
      "modelId": "model-selection-id-1",
      "modelName": "Model display name",
      "status": "success",
      "answerText": "Ответ модели",
      "latencyMs": 1234
    }
  ]
}
```

Важное правило:

- в Supabase mode `modelIds` равны UUID из таблицы `models`;
- в fallback mode `modelIds` могут временно совпадать с server-side OpenRouter model keys;
- OpenRouter `model_key` не должен приходить с frontend как доверенное значение;
- backend всегда повторно проверяет выбранные модели.

### `POST /api/vote`

Текущий запрос:

```json
{
  "taskId": "saved-task-uuid",
  "responseId": "saved-model-response-uuid",
  "voteType": "best"
}
```

`responseId` соответствует `votes.model_response_id`. Кнопка Winner в основной `/arena` активна только для сохранённых successful responses.
Идентичность берётся сервером из Supabase auth cookie или httpOnly guest cookie `na_guest`; frontend не передаёт user id или guest id в body.

### `GET /api/code-models`

Возвращает модели, доступные для Code Arena Lite.

### `POST /api/code-compare`

Запускает сравнение кодовых решений без выполнения пользовательского кода.

```json
{
  "prompt": "Напиши Next.js route handler для безопасного вызова OpenRouter",
  "modelIds": ["model-selection-id-1", "model-selection-id-2"],
  "language": "TypeScript",
  "framework": "Next.js"
}
```

`POST /api/code-compare` только сравнивает кодовые ответы моделей и не запускает их. `POST /api/code-run` отдельно передаёт код во внешний Piston runner; endpoint доступен только авторизованным пользователям и не выполняет пользовательский код на сервере приложения.

Подробный контракт API описан в `28-api-contracts.md`.

## Документация проекта

| Файл | Назначение |
|---|---|
| `00-readme.md` | Главный вход в документацию проекта |
| `01-idea.md` | Идея проекта |
| `02-project-plan.md` | Общий план разработки |
| `03-tools-and-sites.md` | Инструменты и сервисы |
| `04-mvp-scope.md` | Границы MVP |
| `05-user-roles.md` | Роли пользователей |
| `06-project-modes.md` | Режимы проекта |
| `07-architecture.md` | Архитектура |
| `08-database.md` | База данных |
| `09-api-structure.md` | API-структура |
| `10-ui-pages.md` | Страницы интерфейса |
| `11-ai-models.md` | AI-модели |
| `12-security-and-env.md` | Безопасность и переменные окружения |
| `13-deployment.md` | Деплой |
| `14-roadmap.md` | Главный roadmap |
| `15-changelog.md` | Журнал изменений |
| `16-decisions.md` | Архитектурные решения |
| `17-code-arena-spec.md` | Code Arena |
| `18-team-mode-spec.md` | AI Team Mode |
| `19-development-checklist.md` | Чек-лист разработки |
| `20-auth-guest-profile-plan.md` | План Auth, Guest Mode и Profile |
| `21-access-gate-policy.md` | Политика доступа |
| `.project/state.json` | Текущее состояние проекта и активные task ids |
| `.project/tasks/*.json` | Канонический список задач для Codex |
| `23-codex-quality-rules.md` | Правила качества для Codex |
| `24-codex-active-rule-set.md` | Активный rule set |
| `26-definition-of-done.md` | Definition of Done |
| `27-environments.md` | Главный документ по окружениям Local / Preview / Staging / Production |
| `28-api-contracts.md` | API contracts |
| `29-database-ownership.md` | Владение данными и связи таблиц |
| `30-data-retention-policy.md` | Политика хранения и удаления данных |
| `31-image-arena-spec.md` | Будущая Image Arena |
| `32-model-catalog-governance.md` | Управление каталогом AI-моделей |
| `33-feature-flags.md` | Feature flags |
| `34-manual-qa-checklist.md` | Manual QA checklist |
| `35-database-schema-sync.md` | Проверка соответствия Supabase-схемы (`npm run schema:check`) |
| `36-document-sync-policy.md` | Project State Sync System и политика синхронизации документов |
| `37-env-check-policy.md` | Политика Environment Variables Checker (`npm run env:check`) |
| `38-env-check-implementation.md` | Реализация Environment Variables Checker |
| `40-project-health-check.md` | Команды `health`, `health:local`, `health:production` и live-проверка моделей |
| `41-enterprise-readiness-roadmap.md` | План выхода на international corporate-grade уровень |
| `AGENTS.md` | Правила для AI-агентов и разработчиков |

Дополнительные audit/addendum документы в корне репозитория сохраняются как исторические или вспомогательные материалы. Основным документом по окружениям является только `27-environments.md`.


## Главные правила разработки

1. Текущий этап — `v2.0 - AI Team Mode`; порядок дальнейших этапов остаётся в `14-roadmap.md`.
2. Сначала чиним production-ошибки, потом добавляем новые функции.
3. Все AI-запросы идут только через backend. Секретные ключи не попадают во frontend и в GitHub.
4. Секреты хранятся только в `.env.local` (локально) и Vercel Environment Variables (production).
5. Перед каждым commit выполняем `npm run typecheck`, `npm run lint`, `npm run build`.
6. Перед новой функцией проверяем, что старая часть проекта не сломалась.
7. Все изменения схемы базы данных — только через миграции; после применения сверяем версии миграций (`list_migrations`) с локальными файлами.
8. Документация обновляется в том же commit, что и код. Изменил схему или API-контракт — сразу правишь соответствующий `.md`.
9. Model ID проверяем на OpenRouter перед добавлением в базу или код.
10. Запуск пользовательского кода в v1.7 разрешён только через внешний runner с auth, rate limit и без доступа к server-side секретам.
11. Каждый важный этап фиксируем через Git commit.
