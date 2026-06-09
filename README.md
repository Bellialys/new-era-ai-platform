# Новая эпоха - New Era AI Platform

**Новая эпоха** - AI-платформа для сравнения, оценки и совместной работы нескольких AI-моделей.

Пользователь вводит одну задачу, выбирает несколько AI-моделей, получает ответы рядом, сравнивает качество и выбирает лучший результат.

## Текущий статус

Текущая версия проекта: **v0.4.1 - OpenRouter Integration Fix**.

Готово сейчас:

- Next.js App Router проект;
- главная страница `/`;
- интерактивная страница `/arena`;
- backend route `GET /api/models`;
- backend route `POST /api/compare`;
- серверная интеграция OpenRouter;
- server-side allowlist моделей;
- проверка `prompt`, `modelIds`, `modeSlug`;
- безопасные API-ошибки через `ApiError`;
- отмена устаревших запросов на клиенте через `AbortController`;
- `package-lock.json`;
- успешные проверки `typecheck`, `lint`, `build`.

Ещё не готово:

- Supabase integration;
- сохранение задач и ответов;
- сохранение голоса победителя;
- история сравнений;
- Vercel deploy;
- аккаунты пользователей;
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

Нельзя добавлять в GitHub:

- `.env.local`;
- реальные API-ключи;
- production-секреты;
- приватные переменные Vercel.

## API текущей версии

### `GET /api/models`

Возвращает список разрешённых моделей из server-side allowlist.

### `POST /api/compare`

Текущий запрос `v0.4.1`:

```json
{
  "prompt": "Сравни Next.js и Nuxt для MVP AI-платформы",
  "modelIds": [
    "google/gemini-flash-1.5",
    "mistralai/mistral-small-3.1-24b-instruct"
  ],
  "modeSlug": "prompt-arena"
}
```

Текущий ответ `v0.4.1`:

```json
{
  "status": "success",
  "modeSlug": "prompt-arena",
  "responses": [
    {
      "id": "generated-response-id",
      "modelId": "google/gemini-flash-1.5",
      "modelName": "Gemini Flash 1.5",
      "status": "success",
      "answerText": "Ответ модели",
      "latencyMs": 1234
    }
  ]
}
```

Важное правило:

- в `v0.4.1` поле `modelIds` содержит OpenRouter model keys из allowlist;
- в `v0.5+` после Supabase поле `modelIds` должно перейти на UUID из таблицы `models`, а OpenRouter `model_key` должен остаться только на backend.

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
| `27-environments.md` | Матрица окружений Local / Preview / Staging / Production |
| `27-final-documentation-review.md` | Текущая финальная проверка документации |
| `AGENTS.md` | Правила для AI-агентов и разработчиков |

## Главные правила разработки

1. Сначала делаем простой рабочий MVP.
2. Не добавляем сложные режимы раньше времени.
3. Все AI-запросы идут только через backend.
4. Секреты хранятся только в `.env.local` и Vercel Environment Variables.
5. Перед новой функцией проверяем, что старая часть не сломалась.
6. Каждый важный этап фиксируем через Git commit.
