# 13 - Деплой проекта

## Назначение файла

Этот файл описывает деплой проекта **Новая эпоха**.

Деплой нужен, чтобы локальный проект постепенно и безопасно превратить в рабочий сайт, доступный пользователям через интернет.

Документ фиксирует:

- как запускать проект локально;
- как готовить GitHub repository;
- как подключать Vercel;
- как подключать Supabase;
- как добавлять переменные окружения;
- как проверять OpenRouter на production;
- как делать первый deploy;
- как проверять сайт после deploy;
- как откатываться, если новая версия сломала проект;
- что нельзя выкладывать в production раньше времени.

Главная цель - сделать деплой контролируемым, повторяемым и безопасным.

---

## Связанные файлы

Этот файл должен быть согласован с:

- `02-project-plan.md`;
- `04-mvp-scope.md`;
- `07-architecture.md`;
- `08-database.md`;
- `09-api-structure.md`;
- `10-ui-pages.md`;
- `11-ai-models.md`;
- `12-security-and-env.md`;
- `14-roadmap.md`;
- `16-decisions.md`;
- `17-code-arena-spec.md`;
- `18-team-mode-spec.md`.

Главный источник порядка версий - `14-roadmap.md`.

Если этот файл конфликтует с `14-roadmap.md`, правильным считается `14-roadmap.md`.

---

# 1. Главный принцип деплоя

Проект нельзя выкладывать в интернет хаотично.

Правильный порядок:

```text
Сначала локальная проверка.
# проект должен запускаться на компьютере

Потом build.
# проект должен успешно собираться

Потом commit.
# фиксируем рабочее состояние

Потом push в GitHub.
# отправляем код в удалённый репозиторий

Потом Vercel deploy.
# Vercel собирает и публикует сайт

Потом production проверка.
# проверяем сайт уже в интернете
```

Главное правило:

**если проект не работает локально, его нельзя отправлять в production.**

---

# 2. Место деплоя в roadmap

Деплой не должен быть самым первым этапом.

Правильный порядок по `14-roadmap.md`:

```text
v0.1 - Project Documentation
# документация и структура проекта

v0.2 - Next.js Base
# локальный проект запускается

v0.3 - UI MVP
# есть интерфейс Prompt Arena без реального AI

v0.4 - OpenRouter Integration
# реальные ответы AI-моделей через backend

v0.5 - Supabase Integration
# сохранение задач, ответов и моделей

v0.5.1 - Migration Sync
# синхронизация migrations

v0.5.2 - Health and Voting Foundation
# health route, smoke-check, исправленная база votes

v0.5.3 - Voting MVP Stabilization
# основная Prompt Arena сохраняет Winner vote, CI добавлен

v0.6 - Auth, Guest Mode and Profile
# гостевой режим, регистрация, профиль

v0.7 - History MVP
# история сравнений

v0.9 - First Deploy Stabilization
# production env, smoke, UX

v1.0 - Stable Prompt Arena
# первая стабильная версия
```

Первый production deploy лучше делать на `v0.8`, когда уже есть:

- рабочая Prompt Arena;
- backend API routes;
- OpenRouter integration;
- Supabase integration;
- Voting MVP;
- History MVP;
- базовые проверки ошибок;
- корректные environment variables.

---

# 3. Что не входит в первый deploy

В первый deploy нельзя включать сложные функции, которые ещё не готовы по безопасности.

Не входит в `v0.8`:

```text
Code Arena Runner
# запуск чужого кода запрещён до v1.7

AI Team Mode
# командная работа моделей запрещена до v2.0

Платежи
# не нужны для первого MVP

Сложная админ-панель
# появляется только на v1.6

Полноценные пользовательские лимиты
# базовая защита раньше, полноценные лимиты после аккаунтов

Автоматический sandbox
# отдельная сложная инфраструктура для v1.7
```

Для первого deploy достаточно стабильного **Prompt Arena MVP**.

---

# 4. Production архитектура

Общая схема production:

```text
Пользователь
# открывает сайт в браузере

Vercel Frontend
# Next.js страницы и интерфейс

Vercel Server Functions
# Next.js API routes

OpenRouter API
# AI-модели

Supabase PostgreSQL
# база данных

Vercel Environment Variables
# production переменные окружения
```

Правильный поток AI-запроса:

```text
Browser -> Next.js API route -> OpenRouter -> Next.js API route -> Browser
# OpenRouter API key не попадает в браузер
```

Правильный поток сохранения результата:

```text
Browser -> Next.js API route -> Supabase -> Next.js API route -> Browser
# запись в базу проходит через контролируемый backend
```

Запрещённый поток:

```text
Browser -> OpenRouter
# нельзя, потому что ключ OpenRouter будет раскрыт

Browser -> Supabase service role key
# нельзя, потому что service role key обходит RLS
```

---

# 5. Окружения проекта

Проект должен иметь несколько окружений.

| Окружение | Назначение | Где используется |
|---|---|---|
| Local | разработка на компьютере | VS Code, `.env.local` |
| Preview | тестовые сборки Vercel | pull request или preview deploy |
| Production | рабочий сайт | основной Vercel domain |

## 5.1 Local

Local используется для разработки.

```text
.env.local
# локальные секреты и настройки

npm run dev
# запуск проекта на компьютере

http://localhost:3000
# локальный адрес проекта
```

## 5.2 Preview

Preview используется для проверки изменений перед production.

```text
Vercel Preview Deployment
# отдельная тестовая сборка

Preview Environment Variables
# переменные для тестовой среды
```

Preview не должен использовать дорогие модели без необходимости.

## 5.3 Production

Production используется для реальных пользователей.

```text
Vercel Production Deployment
# основная версия сайта

Production Environment Variables
# реальные рабочие переменные
```

В production нельзя включать экспериментальные функции без feature flags.

---

# 6. Ветки Git

Для простого MVP достаточно одной основной ветки.

Рекомендуемый старт:

```text
main
# основная ветка проекта
```

Для более аккуратной разработки позже можно добавить:

```text
feature/arena-ui
# отдельная ветка для интерфейса Arena

feature/openrouter-api
# отдельная ветка для OpenRouter integration

feature/supabase
# отдельная ветка для Supabase integration
```

Главное правило:

**production должен деплоиться только из стабильной ветки.**

На старте это может быть `main`.

---

# 7. Локальная подготовка

## 7.1 Проверка инструментов

Перед запуском проекта нужно проверить инструменты.

```bash
node -v
# показывает установленную версию Node.js

npm -v
# показывает установленную версию npm

git --version
# показывает установленную версию Git

code --version
# показывает установленную версию Visual Studio Code
```

Если какая-то команда не работает, деплой начинать рано.

## 7.2 Если проект создаётся с нуля

```bash
npx create-next-app@latest new-era-ai
# создаёт новый Next.js проект

cd new-era-ai
# переходит в папку проекта

npm run dev
# запускает проект локально
```

## 7.3 Если проект уже создан

```bash
npm install
# устанавливает зависимости из package.json

npm run dev
# запускает проект локально
```

После запуска сайт должен открываться локально:

```text
http://localhost:3000
# локальный адрес проекта
```

---

# 8. Локальная проверка перед commit

Перед каждым важным commit нужно выполнить минимум:

```bash
npm run build
# проверяет, собирается ли проект для production

npm run lint
# проверяет ошибки стиля и возможные проблемы кода
```

Если в проекте ещё нет lint script, его можно добавить позже.

Минимальный вариант проверки:

```bash
npm run build
# обязательная проверка перед production
```

Ручная проверка страниц:

```text
/
# главная страница

/arena
# Prompt Arena

/history
# история, начиная с v0.7

/api/health
# проверка живого backend endpoint, если создан

/api/models
# список доступных моделей, если endpoint создан
```

Если одна из основных страниц падает, deploy делать нельзя.

---

# 9. Переменные окружения

Подробные правила безопасности описаны в `12-security-and-env.md`.

Здесь фиксируется deploy-часть.

## 9.1 Локальный файл `.env.local`

Пример структуры:

```env
OPENROUTER_API_KEY=your_openrouter_api_key_here
# server-only ключ OpenRouter

NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url_here
# публичный URL Supabase

NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key_here
# публичный publishable key Supabase

SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
# server-only ключ Supabase, запрещён во frontend

NEXT_PUBLIC_SITE_URL=http://localhost:3000
# локальный URL проекта

APP_ENV=development
# режим локальной разработки

NEXT_PUBLIC_ENABLE_CODE_ARENA=false
# показывает или скрывает Code Arena в интерфейсе

ENABLE_CODE_RUNNER=false
# запрещает запуск кода на backend

NEXT_PUBLIC_ENABLE_TEAM_MODE=false
# показывает или скрывает AI Team Mode в интерфейсе; production=true только вместе с ENABLE_TEAM_MODE

ENABLE_TEAM_MODE=false
# запрещает AI Team Mode на backend; production=true только после Upstash + smoke gate
```

## 9.2 Файл `.env.example`

`.env.example` можно коммитить, но только без реальных ключей.

```env
OPENROUTER_API_KEY=
# вставить локально, не коммитить реальный ключ

NEXT_PUBLIC_SUPABASE_URL=
# публичный URL Supabase

NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
# публичный publishable key Supabase

SUPABASE_SERVICE_ROLE_KEY=
# server-only, не использовать во frontend

NEXT_PUBLIC_SITE_URL=
# URL сайта

APP_ENV=
# development, preview или production

NEXT_PUBLIC_ENABLE_CODE_ARENA=false
# UI flag

ENABLE_CODE_RUNNER=false
# backend flag

NEXT_PUBLIC_ENABLE_TEAM_MODE=false
# UI flag; для production Team Mode activation выставить true вместе с ENABLE_TEAM_MODE

ENABLE_TEAM_MODE=false
# backend flag; без true /api/team-run возвращает 503
```

## 9.3 Проверка `.gitignore`

```bash
git check-ignore -v .env.local
# проверяет, игнорирует ли Git файл .env.local
```

Если команда ничего не выводит, нужно добавить `.env.local` в `.gitignore`.

```bash
echo ".env.local" >> .gitignore
# добавляет .env.local в список игнорируемых файлов
```

После этого снова проверить:

```bash
git check-ignore -v .env.local
# повторно проверяет, что .env.local не попадёт в Git
```

---

# 10. GitHub repository

## 10.1 Первый commit

```bash
git init
# создаёт локальный Git repository

git add .
# добавляет файлы в подготовку к commit

git commit -m "Initial project setup"
# создаёт первый commit
```

## 10.2 Подключение GitHub remote

```bash
git remote add origin https://github.com/username/new-era-ai.git
# подключает удалённый GitHub repository

git branch -M main
# переименовывает текущую ветку в main

git push -u origin main
# отправляет проект в GitHub
```

`username` нужно заменить на свой GitHub username.

## 10.3 Commit после каждого важного этапа

Примеры commit messages:

```bash
git commit -m "Add project documentation"
# документация проекта

git commit -m "Add Next.js base app"
# базовый Next.js проект

git commit -m "Add Prompt Arena UI"
# интерфейс Prompt Arena

git commit -m "Add OpenRouter API integration"
# подключение OpenRouter через backend

git commit -m "Add Supabase schema"
# схема базы данных

git commit -m "Add voting MVP"
# голосование за лучший ответ

git commit -m "Add history page"
# история сравнений

git commit -m "Prepare first Vercel deploy"
# подготовка первого deploy
```

---

# 11. Supabase перед deploy

Supabase лучше подключать до первого production deploy, если проект уже дошёл до `v0.5`.

## 11.1 Что должно быть готово

Перед deploy нужно проверить:

- создан Supabase project;
- создана база PostgreSQL;
- применена MVP SQL schema из `08-database.md`;
- включены нужные RLS policies;
- получены `NEXT_PUBLIC_SUPABASE_URL` и `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`;
- `SUPABASE_SERVICE_ROLE_KEY` хранится только server-side;
- таблицы работают локально;
- ошибки базы корректно обрабатываются.

## 11.2 Минимальные таблицы для MVP

Для Stable Prompt Arena MVP нужны:

```text
models
# список разрешённых AI-моделей

tasks
# задачи пользователей

model_responses
# ответы моделей

votes
# выбор лучшего ответа
```

Позже добавляются:

```text
profiles
# v1.5, аккаунты и профили

usage_logs
# v1.5-v1.6, лимиты и расходы

code_results
# v1.7, результаты запуска кода

team_runs
# v2.0, командные запуски AI Team Mode
```

## 11.3 Проверка Supabase локально

```bash
npm run dev
# запускает проект локально
```

После запуска нужно проверить:

```text
Создание task.
# задача сохраняется в Supabase

Создание model_responses.
# ответы моделей сохраняются в Supabase

Создание vote.
# выбор лучшего ответа сохраняется

Чтение history.
# история загружается без ошибок
```

---

# 12. OpenRouter перед deploy

OpenRouter должен вызываться только через server-side API route.

## 12.1 Что проверить локально

```text
OPENROUTER_API_KEY есть в .env.local.
# ключ доступен backend-коду

Ключ не начинается с NEXT_PUBLIC.
# ключ не попадёт в браузер

Frontend не вызывает OpenRouter напрямую.
# запрос идёт через /api/arena или похожий endpoint

Ошибки OpenRouter обрабатываются.
# пользователь видит понятное сообщение

Есть timeout.
# запрос не висит бесконечно

Есть ограничение количества моделей.
# пользователь не может случайно запустить слишком дорогой запрос
```

## 12.2 Проверка списка моделей

Точные model ID нужно проверять перед production.

```bash
curl https://openrouter.ai/api/v1/models
# получает список доступных моделей OpenRouter
```

Если используется `jq`:

```bash
curl https://openrouter.ai/api/v1/models | jq ".data[].id"
# показывает только model ID
```

В production нельзя полагаться на старый список моделей без проверки.

---

# 13. Vercel deploy

## 13.1 Подключение проекта

Рекомендуемый способ:

```text
GitHub repository -> Vercel import -> Build -> Deploy
# Vercel автоматически собирает проект из GitHub
```

На Vercel нужно выбрать:

```text
Framework Preset: Next.js
# Vercel должен распознать Next.js проект

Root Directory: ./
# если Next.js проект лежит в корне repository

Build Command: npm run build
# команда production сборки

Install Command: npm install
# установка зависимостей

Output Directory: default
# для Next.js обычно менять не нужно
```

## 13.2 Environment Variables в Vercel

В Vercel нужно добавить переменные отдельно для Production и Preview.

Минимальный набор для `v0.8`:

```env
OPENROUTER_API_KEY=
# server-only OpenRouter key

NEXT_PUBLIC_SUPABASE_URL=
# публичный Supabase URL

NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
# публичный Supabase publishable key

SUPABASE_SERVICE_ROLE_KEY=
# server-only Supabase service role key

NEXT_PUBLIC_SITE_URL=
# production URL сайта

VERCEL_AUTOMATION_BYPASS_SECRET=
# optional: только для automation smoke/e2e against protected Preview

APP_ENV=production
# production окружение

NEXT_PUBLIC_ENABLE_CODE_ARENA=false
# Code Arena скрыта до v1.1

ENABLE_CODE_RUNNER=false
# Runner запрещён до v1.7

NEXT_PUBLIC_ENABLE_TEAM_MODE=false
# Team Mode скрыт до V200-02 production activation

ENABLE_TEAM_MODE=false
# Team Mode запрещён на backend до V200-02 production activation
```

Важно:

```text
OPENROUTER_API_KEY не должен быть NEXT_PUBLIC.
# иначе он попадёт в браузер

SUPABASE_SERVICE_ROLE_KEY не должен быть NEXT_PUBLIC.
# иначе пользователь сможет обойти RLS

NEXT_PUBLIC_* видны пользователю.
# туда нельзя помещать секреты

VERCEL_AUTOMATION_BYPASS_SECRET не должен быть NEXT_PUBLIC.
# это secret для автоматического обхода Vercel Deployment Protection в проверках
```

## 13.3 Первый deploy

После добавления переменных можно запустить deploy через Vercel interface.

Проверка после build:

```text
Build completed.
# сборка прошла успешно

No TypeScript errors.
# нет ошибок типов

No missing env errors.
# все нужные переменные добавлены

No secret in client bundle.
# секреты не попали во frontend
```

---

# 14. Проверка после production deploy

После deploy нужно вручную проверить сайт.

## 14.1 Основные страницы

```text
/
# главная страница открывается

/arena
# Prompt Arena открывается

/history
# история открывается, если версия v0.7 или выше
```

## 14.2 API endpoints

```text
/api/health
# backend отвечает, если endpoint создан

/api/models
# возвращает список разрешённых моделей

/api/arena
# принимает prompt и возвращает ответы моделей
```

Названия endpoints должны соответствовать `09-api-structure.md`.

## 14.3 Проверка Prompt Arena

Минимальный сценарий:

```text
Открыть /arena.
# пользователь видит форму ввода

Ввести простой prompt.
# например: Напиши короткое приветствие

Выбрать 2 модели.
# не запускать слишком много моделей сразу

Нажать Compare.
# отправить задачу

Получить ответы.
# ответы отображаются в интерфейсе

Выбрать лучший ответ.
# vote сохраняется

Открыть /history.
# задача появилась в истории
```

## 14.4 Проверка безопасности

```text
Открыть DevTools в браузере.
# проверить Network requests

Проверить, что OpenRouter key не виден.
# ключ не должен быть в request headers frontend

Проверить, что service role key не виден.
# ключ Supabase service role не должен попасть в браузер

Проверить ошибки.
# ошибки не должны показывать секреты или stack trace пользователю
```

---

# 15. Минимальный release checklist

Перед каждым production deploy:

```text
npm install выполнен.
# зависимости установлены

npm run build проходит.
# проект собирается

Основные страницы проверены локально.
# /, /arena, /history

API endpoints проверены локально.
# /api/models, /api/arena, /api/health

.env.local не попадает в Git.
# секреты не коммитятся

Vercel Environment Variables заполнены.
# production не падает из-за missing env

Supabase schema применена.
# нужные таблицы существуют

RLS policies проверены.
# пользователь не получает лишний доступ

OpenRouter model IDs проверены.
# список моделей актуален

Дорогие модели ограничены.
# защита от лишних расходов

Code Runner выключен.
# ENABLE_CODE_RUNNER=false до v1.7

Team Mode выключен.
# ENABLE_TEAM_MODE=false до V200-02 production activation

Git commit создан.
# рабочее состояние сохранено
```

---

# 16. Откат после неудачного deploy

Если production сломался, нужно не паниковать, а откатиться.

## 16.1 Быстрый откат через Vercel

```text
Vercel Dashboard -> Project -> Deployments -> выбрать старый рабочий deploy -> Promote to Production
# возвращает предыдущую рабочую версию
```

Это самый быстрый способ восстановить сайт.

## 16.2 Откат через Git

Если нужно откатить код:

```bash
git log --oneline
# показывает историю commit

git revert commit_hash
# создаёт новый commit, который отменяет ошибочное изменение

git push
# отправляет откат в GitHub
```

`commit_hash` нужно заменить на hash проблемного commit.

Не рекомендуется делать `git reset --hard` для shared repository без понимания последствий.

---

# 17. Feature flags

Сложные функции нужно включать через flags.

```env
NEXT_PUBLIC_ENABLE_CODE_ARENA=false
# UI flag для Code Arena

ENABLE_CODE_RUNNER=false
# backend flag для запуска кода

NEXT_PUBLIC_ENABLE_TEAM_MODE=false
# UI flag для AI Team Mode; production=true только вместе с ENABLE_TEAM_MODE

ENABLE_TEAM_MODE=false
# backend flag для AI Team Mode; без true /api/team-run возвращает 503
```

Правило:

```text
Frontend flag скрывает кнопку или страницу.
# пользователь не видит недоступную функцию

Backend flag запрещает реальное выполнение.
# даже прямой API-запрос не запустит опасную функцию
```

Одного frontend flag недостаточно.

---

# 18. Деплой будущих версий

## 18.1 v1.1 - Code Arena Lite

Можно деплоить, если:

```text
Код не запускается.
# модели только пишут и объясняют код

Нет sandbox.
# Runner ещё не нужен

Нет code_results.
# результаты выполнения ещё не сохраняются

Есть предупреждение в UI.
# пользователь понимает, что код нужно проверять самостоятельно
```

## 18.2 v1.5 - Accounts and Profiles

Можно деплоить, если:

```text
Supabase Auth настроен.
# пользователь может войти

profiles работают.
# профиль создаётся и читается

RLS проверен.
# пользователь видит только свои данные

Личная история работает.
# пользователь видит свои сравнения
```

## 18.3 v1.6 - Admin Panel and Limits

Можно деплоить, если:

```text
Есть admin role.
# обычный пользователь не получает доступ

Есть управление моделями.
# можно включать и выключать модели

Есть управление лимитами.
# можно контролировать расходы

Admin routes защищены.
# доступ только администраторам
```

## 18.4 v1.7 - Code Arena Runner

Можно деплоить только после отдельной security review.

Обязательные условия:

```text
Sandbox изолирован.
# пользовательский код не имеет доступа к серверу

Есть timeout.
# код не выполняется бесконечно

Есть memory limit.
# код не забирает всю память

Есть network block.
# код не ходит во внешнюю сеть без разрешения

Есть user limits.
# пользователь не может запускать бесконечные тесты

Есть logging.
# можно расследовать ошибки и злоупотребления

Есть kill mechanism.
# зависший запуск можно остановить
```

До выполнения этих условий:

```env
ENABLE_CODE_RUNNER=false
# Runner выключен
```

## 18.5 v2.0 - AI Team Mode

Можно деплоить код, если:

```text
Есть лимиты стоимости.
# несколько моделей могут быстро расходовать бюджет

Есть team_runs и team_steps.
# командный процесс сохраняется

Есть понятный UI.
# пользователь видит роли и этапы

Есть защита от бесконечных циклов.
# модели не должны спорить бесконечно

Есть max rounds.
# ограничение количества раундов
```

Production activation считается закрытой только после отдельного gate V200-02:

```env
UPSTASH_REDIS_REST_URL=...
# глобальный Redis backend для rate limit

UPSTASH_REDIS_REST_TOKEN=...
# server-only token

ENABLE_TEAM_MODE=true
# backend разрешает /api/team-run

NEXT_PUBLIC_ENABLE_TEAM_MODE=true
# UI показывает /team
```

Обязательный smoke после redeploy:

```text
/api/health публично возвращает только { "status": "ok" }
/team показывает активный UI
unauthenticated POST /api/team-run блокируется auth gate, а не 503 feature flag
authenticated пользователь запускает Team Mode
rate limit подтверждён через Upstash, не memory fallback
```

---

# 19. Типичные ошибки деплоя

| Проблема | Причина | Решение |
|---|---|---|
| Vercel build failed | ошибка TypeScript или missing env | проверить build logs и переменные |
| OpenRouter не отвечает | нет ключа или неверный model ID | проверить `OPENROUTER_API_KEY` и allowlist моделей |
| Supabase не сохраняет данные | нет таблицы или RLS блокирует запрос | проверить schema и policies |
| На локальном работает, на Vercel нет | переменные есть локально, но не добавлены в Vercel | добавить Environment Variables |
| Секрет виден в браузере | переменная начинается с `NEXT_PUBLIC` | удалить, пересоздать ключ, обновить env |
| `/history` пустой | данные не сохраняются или фильтр неверный | проверить `tasks`, `model_responses`, `votes` |
| Очень дорогие запросы | выбрано много дорогих моделей | добавить лимиты и дешёвый dev набор |
| Runner доступен раньше времени | неверный feature flag | установить `ENABLE_CODE_RUNNER=false` |

---

# 20. Что нельзя делать

```text
Нельзя коммитить .env.local.
# секреты попадут в GitHub

Нельзя вставлять реальные ключи в README или docs.
# документация может быть публичной

Нельзя вызывать OpenRouter из браузера.
# ключ будет раскрыт

Нельзя использовать Supabase service role key во frontend.
# пользователь сможет обойти защиту

Нельзя деплоить Code Runner без sandbox.
# это риск для сервера и данных

Нельзя включать Team Mode без лимитов.
# несколько моделей могут быстро потратить бюджет

Нельзя делать production deploy без npm run build.
# можно выложить сломанную версию

Нельзя исправлять production прямо на сайте без commit.
# история изменений потеряется
```

---

# 21. Рекомендуемый порядок первого production deploy

```bash
npm install
# устанавливает зависимости

npm run build
# проверяет production сборку

git status
# показывает изменённые файлы

git add .
# добавляет изменения в commit

git commit -m "Prepare first production deploy"
# фиксирует подготовку к первому deploy

git push
# отправляет код в GitHub
```

После этого:

```text
Открыть Vercel Dashboard.
# перейти в проект

Проверить Environment Variables.
# убедиться, что все переменные добавлены

Запустить production deploy.
# дождаться успешной сборки

Открыть production URL.
# проверить сайт в браузере

Проверить Prompt Arena.
# выполнить реальный сценарий сравнения моделей

Проверить историю.
# убедиться, что данные сохраняются

Проверить Network в DevTools.
# убедиться, что секреты не видны
```

---

# 22. Итоговое правило

Деплой считается успешным только если:

```text
Сайт открывается.
# пользователь может зайти на проект

Prompt Arena работает.
# модели отвечают на запрос

Supabase сохраняет данные.
# история и голоса не теряются

OpenRouter key скрыт.
# ключ не виден в браузере

Service role key скрыт.
# ключ не попадает во frontend

Build проходит без ошибок.
# production сборка стабильна

Есть commit.
# можно понять, какая версия опубликована

Есть возможность отката.
# можно быстро вернуться к рабочему deploy
```

Главное правило проекта:

**сначала стабильный Prompt Arena MVP, потом расширение платформы.**

---

# Актуализация деплоя v0.5.3

Перед деплоем на Vercel нужно убедиться, что локально проходят проверки:

```bash
npm run typecheck
# проверяет TypeScript

npm run lint
# проверяет ESLint

npm run test
# запускает тесты проекта

npm run build
# проверяет production-сборку

npm run smoke
# проверяет health/models smoke-check
```

Минимальные переменные Vercel для v0.5.3:

```text
OPENROUTER_API_KEY
# секретный ключ OpenRouter, только server-side

NEXT_PUBLIC_SUPABASE_URL
# публичный URL Supabase project

NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
# публичный publishable key для browser Supabase client

SUPABASE_SERVICE_ROLE_KEY
# server-only key для сохранения tasks/model_responses, без NEXT_PUBLIC_

NEXT_PUBLIC_SITE_URL
# публичный URL сайта после деплоя
```

Реальные значения добавляются только в Vercel env и `.env.local`; они не должны попадать в Git или выводиться в логах.

Для Vercel Preview с включённой Vercel Authentication автоматический
`npm run smoke -- --url <preview-url>` требует
`VERCEL_AUTOMATION_BYPASS_SECRET` в окружении запуска. Скрипт отправляет secret
только через `x-vercel-protection-bypass` header и не печатает его значение.
