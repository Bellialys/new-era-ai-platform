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

Главный источник текущей версии и активных задач - `.project/state.json`.
Главный источник порядка будущих этапов - `14-roadmap.md`.

Если в документах возникает конфликт по текущей версии, приоритет имеет `.project/state.json`.
Если конфликт касается порядка будущих этапов, приоритет имеет `14-roadmap.md`.

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

<!-- SYNC:PROJECT_VERSION_START -->
**Текущая версия:** `v2.0.0-alpha.1`
<!-- SYNC:PROJECT_VERSION_END -->

Текущая рабочая версия: **v1.7.0-alpha.1 - Code Arena Runner**.

Канонический текущий статус фиксируется в `.project/state.json`, порядок версий - в `14-roadmap.md`.

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
- `POST /api/guest`;
- `GET /api/code-models`;
- `POST /api/code-compare`;
- `POST /api/judge`;
- `POST /api/code-run`;
- `GET /api/admin/audit`;
- `GET /api/admin/usage`;
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
- Access Gate, guest mode через httpOnly cookie `na_guest`;
- Auth SSR, profile, avatar upload, email/password management;
- Code Arena: сравнение кодовых решений отдельно от запуска, запуск кода через внешний runner только для авторизованных пользователей;
- `package-lock.json`;
- текущий `typecheck` проходит; полный release gate ещё должен пройти.

Пока не готово как стабильный релиз:

- release-gate для `v1.7.0-alpha.1`;
- live smoke внешнего runner и admin routes на целевом окружении;
- Image Arena;
- AI Team Mode.

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
| `v0.5.3` | Voting MVP Stabilization | Основная Prompt Arena сохраняет Winner vote через `/api/vote` | Завершён |
| `v0.5.4` | Vote Security & Auth Foundation | Vote dedup RPC, proxy/session refresh fix, security headers | Verify |
| `v0.6` | Auth, Guest Mode and Profile | Гости, аккаунты, профиль, аватар, email/password, ограничения моделей | Verify |
| `v0.7` | Code Arena Lite | Сравнение кодовых решений без запуска кода | Завершён |
| `v0.7.1` | Arena UX and Fair Voting | Streaming, Blind Arena, Code Diff, share/copy и guest anti-abuse | Завершён |
| `v0.8` | History and Production Readiness | История, публичные ссылки, критерии оценки, preview/production smoke, observability | Завершён |
| `v0.9` | Stable Arena Hardening | Финальная стабилизация перед v1.0 | Завершён |
| `v1.0` | Stable Arena MVP | Первая стабильная публичная версия | Завершён |
| `v1.1-v1.6` | Enterprise and Advanced Modes | Enterprise readiness, Battle, Judge, Leaderboard, admin, governance | Завершён |
| `v1.7` | Code Arena Runner | Внешний runner для авторизованных пользователей | В разработке |

## Первый настоящий MVP

Первый настоящий MVP - **Stable Prompt Arena**.

В него должны войти:

- поле ввода задачи;
- выбор 2-3 моделей;
- реальные ответы через backend;
- карточки ответов рядом;
- выбор лучшего ответа;
- сохранение в Supabase;
- streaming и blind voting;
- Code Diff для Code Arena Lite;
- публичные ссылки на сохранённые сравнения;
- многокритериальная оценка ответов;
- история сравнений;
- базовый деплой на Vercel;
- безопасное хранение ключей.

## Что нельзя делать сейчас

На этапе `v1.7.0-alpha.1` не добавлять:

- запуск пользовательского кода внутри server-side процесса приложения;
- обход auth/rate-limit для `/api/code-run`;
- AI Team Mode;
- Image Arena без отдельного safety/storage review;
- платёжную систему без отдельного billing review;
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

npm run smoke
# health/models smoke-check

npm run verify
# все проверки последовательно
```

## Главные правила

1. Работать по этапам.
2. Сначала делать рабочий MVP.
3. Не хранить секреты в GitHub.
4. Все AI-запросы отправлять через backend.
5. Перед новой функцией выполнять `typecheck`, `lint`, `build`.
6. Каждый важный этап фиксировать через Git commit.
