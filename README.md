# Новая эпоха - New Era AI Platform

**Новая эпоха** - AI-платформа для сравнения, оценки и совместной работы нескольких AI-моделей.

Пользователь вводит одну задачу, выбирает несколько AI-моделей, получает ответы рядом, сравнивает качество и выбирает лучший результат.

## Главная цель

Создать продвинутую AI-платформу с режимами:

- Prompt Arena;
- Code Arena;
- Multi Model Battle;
- AI Team Mode;
- Judge Mode;
- Leaderboard.

## Первый MVP

Первый рабочий MVP - **Stable Prompt Arena**.

В MVP нужно реализовать:

- ввод задачи пользователем;
- выбор 2-3 AI-моделей;
- отправку запроса через backend;
- получение ответов через OpenRouter API;
- отображение ответов рядом;
- выбор лучшего ответа;
- сохранение задачи, ответов и голоса в Supabase PostgreSQL;
- базовую историю сравнений;
- деплой на Vercel.

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

## Главные правила разработки

1. Сначала создаём простой рабочий MVP.
2. Не добавляем сложные режимы раньше времени.
3. Все AI-запросы идут только через backend.
4. Секретные ключи не хранятся в GitHub.
5. `.env.local` используется только локально.
6. Production-секреты хранятся только в Vercel Environment Variables.
7. Перед новой функцией проверяем, что старая часть не сломалась.
8. Каждый важный этап фиксируем через Git commit.

## Документация проекта

Основные документы лежат в корне репозитория:

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
| `12-security-and-env.md` | Безопасность и env |
| `13-deployment.md` | Деплой |
| `14-roadmap.md` | Главный roadmap |
| `15-changelog.md` | Журнал изменений |
| `16-decisions.md` | Архитектурные решения |
| `17-code-arena-spec.md` | Code Arena |
| `18-team-mode-spec.md` | AI Team Mode |
| `19-development-checklist.md` | Чек-лист ближайшей разработки |

## Текущее состояние

Сейчас репозиторий находится на стартовом этапе.

Готово:

- проектная документация;
- roadmap;
- описание MVP;
- описание архитектуры;
- описание базы данных;
- описание API;
- правила безопасности;
- стартовые файлы репозитория.

Ещё не готово:

- Next.js проект;
- `package.json`;
- frontend-страницы;
- backend API routes;
- OpenRouter integration;
- Supabase integration;
- Vercel deploy.

## Локальная разработка

После создания Next.js проекта команды будут такими:

```bash
npm install
# устанавливает зависимости проекта

npm run dev
# запускает проект локально

npm run build
# проверяет production-сборку

npm run lint
# проверяет код линтером
```

## Безопасность

Нельзя добавлять в GitHub:

- `.env.local`;
- реальные OpenRouter API keys;
- реальные Supabase service role keys;
- любые production-секреты.

Для примера переменных используется только `.env.example`.
