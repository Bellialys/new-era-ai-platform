# 00 - README проекта

## Название проекта

**Новая эпоха** - AI-платформа для сравнения, оценки и совместной работы нескольких AI-моделей.

## Назначение файла

Этот файл является главным входом в документацию проекта.

Он нужен, чтобы быстро понять:

- что мы создаём;
- какой сейчас статус проекта;
- какие технологии используются;
- какие файлы читать дальше;
- какой порядок разработки является главным;
- какие функции нельзя добавлять раньше времени.

Главный источник порядка версий - `14-roadmap.md`.

Если в документах возникает конфликт по версиям, приоритет имеет `14-roadmap.md`.

## Краткое описание

Пользователь вводит одну задачу, выбирает несколько AI-моделей и получает ответы рядом.

Главная ценность проекта - не один ответ от одной модели, а сравнение нескольких моделей по одной задаче.

Пользователь сможет:

- отправлять одну задачу нескольким моделям;
- сравнивать ответы в Prompt Arena;
- выбирать лучший ответ;
- сохранять результаты;
- смотреть историю;
- позже использовать Code Arena, Multi Model Battle, Judge Mode, Leaderboard и AI Team Mode.

## Текущий статус

Текущая версия: **v0.5.3 - Voting MVP stabilization**.

Канонический статус и порядок версий фиксируются в `14-roadmap.md`.

Сейчас проект уже не является чистым mock UI.

Реально готово:

- Next.js проект;
- TypeScript;
- ESLint;
- Tailwind CSS;
- главная страница `/`;
- страница `/arena`;
- `GET /api/models`;
- `POST /api/compare`;
- `GET /api/health`;
- `POST /api/vote`;
- серверная интеграция OpenRouter;
- Supabase PostgreSQL migrations для `models`, `tasks`, `model_responses` и `profiles`;
- server-side Supabase client для сохранения Prompt Arena;
- browser-side Supabase client только с publishable key;
- чтение моделей из Supabase с fallback на hardcoded allowlist;
- server-side allowlist моделей как аварийный fallback;
- безопасная обработка ошибок API;
- проверка `prompt`, `modelIds`, `modeSlug`;
- отмена устаревших client-side запросов;
- best-effort сохранение задач и ответов в Supabase;
- сохранение Winner vote из основной Prompt Arena через backend route;
- синхронизированная история Supabase migrations;
- исправленная схема `votes` на `model_response_id` и `vote_type = 'best' | 'like' | 'dislike'`;
- smoke-check script `npm run smoke`;
- минимальный GitHub Actions CI;
- `package-lock.json`;
- успешные проверки `typecheck`, `lint`, `test`, `build`.

Пока не готово:

- история сравнений;
- production deploy на Vercel;
- полноценные пользовательские аккаунты и личная история;
- админ-панель;
- дополнительные режимы.

## Технологический стек

```text
Next.js
# frontend и backend route handlers

React
# UI-компоненты

TypeScript
# строгая типизация

Tailwind CSS
# стили интерфейса

OpenRouter API
# единый вход к разным AI-моделям

Supabase PostgreSQL + Auth + Storage
# PostgreSQL для Prompt Arena, Auth/profiles, Storage для будущих artifacts

Vercel
# деплой проекта

GitHub
# репозиторий и история изменений

Visual Studio Code
# основной редактор
```

## Главный порядок разработки

| Версия | Название | Главный результат | Статус |
|---|---|---|---|
| `v0.1` | Project Documentation | Документация проекта | Готово |
| `v0.2` | Next.js Base | Проект запускается локально | Готово |
| `v0.3` | UI MVP | Prompt Arena UI без реального AI | Готово |
| `v0.4` | OpenRouter Integration | Реальные ответы через backend | Готово |
| `v0.4.1` | OpenRouter Integration Fix | Исправлена валидация, ошибки и документация | Готово |
| `v0.5` | Supabase Integration | Модели, задачи и ответы через Supabase | Готово |
| `v0.5.1` | Migration Sync | Репозиторий и remote Supabase migrations синхронизированы | Готово |
| `v0.5.2` | Health and Voting Foundation | `/api/health`, smoke-check, исправленная база votes | Готово |
| `v0.5.3` | Voting MVP Stabilization | Основная Prompt Arena сохраняет Winner vote через `/api/vote` | Текущий стабильный MVP |
| `v0.6` | Auth, Guest Mode and Profile | Гости, аккаунты, профиль, ограничения моделей | Следующий этап |
| `v0.7` | History MVP | История сравнений | Позже |
| `v0.8` | First Deploy Stabilization | Проверка production, env, smoke, UX | Позже |
| `v0.9` | Stable Prompt Arena hardening | Финальная стабилизация перед v1.0 | Позже |
| `v1.0` | Stable Prompt Arena | Первая стабильная версия | Позже |
| `v1.1+` | Advanced modes | Code Arena, Judge, Leaderboard, Team Mode | Позже |

## Первый настоящий MVP

Первый настоящий MVP - **Stable Prompt Arena**.

В него должны войти:

- поле ввода задачи;
- выбор 2-3 моделей;
- реальные ответы через backend;
- карточки ответов рядом;
- выбор лучшего ответа;
- сохранение в Supabase;
- история сравнений;
- базовый деплой на Vercel;
- безопасное хранение ключей.

## Что нельзя делать сейчас

До завершения `v1.0` не добавлять:

- запуск пользовательского кода;
- полноценный Code Arena Runner;
- AI Team Mode;
- сложный Leaderboard;
- платёжную систему;
- тяжёлую админ-панель;
- много новых режимов одновременно.

## Главные файлы для работы

```text
README.md
# главный файл GitHub

00-readme.md
# главный вход в документацию

14-roadmap.md
# главный порядок версий

19-development-checklist.md
# ближайшие практические шаги

09-api-structure.md
# текущий и будущий API-контракт

08-database.md
# будущая структура Supabase

16-decisions.md
# архитектурные решения
```

## Проверочные команды

```bash
npm install
# устанавливает зависимости

npm run typecheck
# проверяет TypeScript

npm run lint
# проверяет ESLint

npm run build
# проверяет production-сборку
```

## Главные правила

1. Работать по этапам.
2. Сначала делать рабочий MVP.
3. Не хранить секреты в GitHub.
4. Все AI-запросы отправлять через backend.
5. Перед новой функцией выполнять `typecheck`, `lint`, `build`.
6. Каждый важный этап фиксировать через Git commit.
