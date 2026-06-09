# Новая эпоха - New Era AI Platform

**Новая эпоха** - AI-платформа для сравнения, оценки и совместной работы нескольких AI-моделей.

Пользователь вводит одну задачу, выбирает несколько AI-моделей, получает ответы рядом, сравнивает качество и выбирает лучший результат.

Главный источник порядка версий - `14-roadmap.md`.

## Текущий статус

Текущая версия проекта: **v0.5.2 - Supabase, migrations and health stabilization**.

Статус синхронизирован с `14-roadmap.md`.

Реально готово:

- Next.js App Router проект;
- главная страница `/`;
- интерактивная страница `/arena`;
- backend route `GET /api/models`;
- backend route `POST /api/compare`;
- backend route `GET /api/health`;
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
- синхронизированная история Supabase migrations;
- исправленная схема `votes` на `model_response_id` и `vote_type = 'best' | 'like' | 'dislike'`;
- smoke-check script `npm run smoke`;
- `package-lock.json`;
- успешные проверки `typecheck`, `lint`, `test`, `build`.

Пока не готово как стабильный пользовательский этап:

- сохранение голосов как завершённый Voting MVP;
- история сравнений;
- production deploy на Vercel;
- полноценные пользовательские аккаунты и личная история;
- админ-панель;
- Code Arena, Judge Mode, Leaderboard и AI Team Mode.

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
```

## Переменные окружения

Создай `.env.local` на основе `.env.example`.

```bash
cp .env.example .env.local
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

Текущий запрос `v0.5.2`:

```json
{
  "prompt": "Сравни Next.js и Nuxt для MVP AI-платформы",
  "modelIds": ["model-selection-id-1", "model-selection-id-2"],
  "modeSlug": "prompt-arena"
}
```

Текущий ответ `v0.5.2`:

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
| `22-codex-action-backlog.md` | Backlog задач для Codex |
| `23-codex-quality-rules.md` | Правила качества для Codex |
| `24-codex-active-rule-set.md` | Активный rule set |
| `25-definition-of-done.md` | Definition of Done |
| `27-environments.md` | Главный документ по окружениям Local / Preview / Staging / Production |
| `28-api-contracts.md` | API contracts |
| `29-database-ownership.md` | Владение данными и связи таблиц |
| `30-data-retention-policy.md` | Политика хранения и удаления данных |
| `31-image-arena-spec.md` | Будущая Image Arena |
| `32-model-catalog-governance.md` | Управление каталогом AI-моделей |
| `33-feature-flags.md` | Feature flags |
| `34-manual-qa-checklist.md` | Manual QA checklist |
| `AGENTS.md` | Правила для AI-агентов и разработчиков |

Дополнительные audit/addendum документы в корне репозитория сохраняются как исторические или вспомогательные материалы. Основным документом по окружениям является только `27-environments.md`.

## Главные правила разработки

1. Сначала делаем простой рабочий MVP.
2. Не добавляем сложные режимы раньше времени.
3. Все AI-запросы идут только через backend.
4. Секреты хранятся только в `.env.local` и Vercel Environment Variables.
5. Перед новой функцией проверяем, что старая часть не сломалась.
6. Каждый важный этап фиксируем через Git commit.
