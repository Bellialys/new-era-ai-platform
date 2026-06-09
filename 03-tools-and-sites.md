# 03 - Инструменты и сайты проекта

## Назначение файла

Этот файл описывает инструменты, сайты, сервисы и технологии проекта **Новая эпоха**.

Файл нужен, чтобы заранее понимать:

- какие инструменты используются в MVP;
- какие сервисы нужны для разработки, базы данных, AI-моделей и деплоя;
- какие инструменты подключаются позже;
- где должны храниться секретные ключи;
- какие технологии нельзя добавлять раньше времени;
- как не перегрузить проект на старте.

Главный принцип проекта: **сначала простой рабочий MVP, потом постепенное расширение**.

Главный источник порядка версий: `14-roadmap.md`.

---

## Короткий итог по стеку

Основной стек проекта:

| Направление | Инструмент | Статус |
|---|---|---|
| Frontend | Next.js | Обязательно |
| UI | React | Обязательно |
| Язык | TypeScript | Обязательно |
| Стили | Tailwind CSS | Желательно сразу |
| UI-компоненты | shadcn/ui | Можно после базового UI |
| Backend | Next.js API Routes | Обязательно |
| AI-модели | OpenRouter API | Обязательно |
| База данных | Supabase PostgreSQL | Обязательно с `v0.5` |
| Деплой | Vercel | Обязательно с `v0.8` |
| Хранение кода | GitHub | Обязательно |
| Редактор | Visual Studio Code | Обязательно |
| Контроль версий | Git | Обязательно |
| Локальный запуск | Node.js + npm | Обязательно |
| API-проверка | Browser DevTools / curl / Postman | Постепенно |
| Тестирование | npm scripts / Playwright позже | После MVP |
| Ошибки и мониторинг | Vercel Logs / Sentry позже | После стабильного MVP |

---

## Инструменты по версиям проекта

| Версия | Что делаем | Основные инструменты |
|---|---|---|
| `v0.1` | Документация проекта | Markdown, VS Code, Git |
| `v0.2` | Создание Next.js проекта | Node.js, npm, Next.js, TypeScript, GitHub |
| `v0.3` | UI MVP | Next.js, React, Tailwind CSS |
| `v0.4` | Подключение OpenRouter | Next.js API Routes, OpenRouter API, `.env.local` |
| `v0.5` | Подключение Supabase | Supabase PostgreSQL, Supabase client |
| `v0.6` | Голосование | Supabase, API routes |
| `v0.7` | История сравнений | Supabase, страницы History |
| `v0.8` | Первый деплой | GitHub, Vercel, Environment Variables |
| `v0.9` | Стабилизация | Vercel Logs, DevTools, ручное тестирование |
| `v1.0` | Stable Prompt Arena | Весь MVP-стек |
| `v1.1` | Code Arena Lite | OpenRouter, Supabase, без запуска кода |
| `v1.2` | Multi Model Battle | OpenRouter, Supabase, voting logic |
| `v1.3` | Judge Mode | Judge-модели через OpenRouter |
| `v1.4` | Leaderboard | Supabase, агрегированные оценки |
| `v1.5` | Accounts and Profiles | Supabase Auth |
| `v1.6` | Admin Panel and Limits | Supabase, server-side checks, лимиты |
| `v1.7` | Code Arena Runner | Sandbox, isolated execution, logs |
| `v2.0` | AI Team Mode | Team workflow, roles, multi-step runs |

---

## Что обязательно нужно для MVP

Для MVP проекта нужны только инструменты, которые дают рабочий результат без лишней сложности.

Минимальный набор:

- Visual Studio Code;
- Node.js;
- npm;
- Git;
- GitHub;
- Next.js;
- React;
- TypeScript;
- Tailwind CSS;
- Vercel;
- Supabase;
- OpenRouter.

Этого достаточно, чтобы сделать:

- страницу Prompt Arena;
- выбор нескольких моделей;
- отправку одного запроса в несколько моделей;
- отображение ответов;
- сохранение задачи и ответов;
- голосование;
- историю сравнений;
- первый production deploy.

---

## Что не нужно добавлять в MVP

На старте нельзя перегружать проект. Эти инструменты и функции не нужны до стабильного MVP:

| Инструмент или функция | Почему не добавлять сразу | Когда можно вернуться |
|---|---|---|
| Stripe | Оплата не нужна до стабильной ценности продукта | После `v1.0` или позже |
| Docker | Не нужен для обычного Next.js MVP | Перед Runner или отдельными сервисами |
| Kubernetes | Слишком сложно для старта | Не раньше масштабирования |
| Redis | Не нужен до серьёзных лимитов и очередей | После `v1.6` при необходимости |
| Очереди задач | Усложняют архитектуру | Когда появятся тяжёлые фоновые операции |
| Отдельный backend NestJS | Next.js API Routes достаточно | Только если Next.js станет тесным |
| Микросервисы | Слишком рано | После доказанной нагрузки |
| Code Runner | Опасно запускать чужой код | Только `v1.7` |
| AI Team Mode | Сложный многошаговый режим | Только `v2.0` |
| Полная платежная система | Рано до пользователей и лимитов | После аккаунтов и стабильной экономики |

---

## Visual Studio Code

**Visual Studio Code** - основной редактор кода.

В нём будем:

- писать код проекта;
- редактировать документацию;
- запускать терминал;
- работать с Git;
- проверять TypeScript ошибки;
- смотреть Markdown-файлы;
- управлять файлами проекта.

Рекомендуемые расширения:

| Расширение | Для чего нужно | Статус |
|---|---|---|
| ESLint | Проверка качества кода | Рекомендуется |
| Prettier | Форматирование кода | Рекомендуется |
| Tailwind CSS IntelliSense | Подсказки Tailwind CSS | Рекомендуется |
| GitLens | Удобная история Git | Необязательно |
| DotENV | Подсветка `.env` файлов | Рекомендуется |
| Markdown Preview Enhanced | Удобный просмотр Markdown | Необязательно |
| PostgreSQL / SQLTools | Работа с SQL | Позже |

Проверка VS Code через терминал:

```bash
code --version
# проверяет, доступна ли команда code в терминале
```

---

## Node.js и npm

**Node.js** нужен для запуска Next.js проекта.

**npm** нужен для установки пакетов и запуска команд проекта.

Проверка установки:

```bash
node -v
# показывает установленную версию Node.js

npm -v
# показывает установленную версию npm
```

Основные команды:

```bash
npm install
# устанавливает зависимости проекта из package.json

npm run dev
# запускает проект локально в режиме разработки

npm run build
# собирает production-версию проекта

npm run lint
# проверяет код на ошибки качества и стиля
```

Правило: перед каждым важным commit желательно запускать:

```bash
npm run build
# проверяет, собирается ли проект перед сохранением этапа
```

---

## Git

**Git** нужен для контроля версий.

В проекте Git обязателен, потому что каждый важный этап должен фиксироваться через commit.

Основные команды:

```bash
git status
# показывает, какие файлы изменены

git add .
# добавляет все изменения в подготовку к commit

git commit -m "Update tools and sites documentation"
# сохраняет изменения в истории Git

git log --oneline
# показывает короткую историю commit
```

Проверка, что `.env.local` не попадёт в GitHub:

```bash
git check-ignore -v .env.local
# проверяет, игнорируется ли файл .env.local через .gitignore
```

Если команда ничего не показывает, значит `.env.local` может случайно попасть в GitHub. Это нужно исправить.

---

## GitHub

**GitHub** нужен для хранения кода и документации проекта.

В GitHub хранятся:

- код проекта;
- документация;
- история commit;
- ветки разработки;
- Issues;
- Pull Requests;
- связь с Vercel.

Что важно:

- не загружать `.env.local`;
- не загружать настоящие API-ключи;
- не хранить секреты в Markdown-файлах;
- делать понятные commit-сообщения;
- сохранять важные этапы отдельно.

Рекомендуемая структура репозитория:

```text
new-era-ai/
  README.md
  docs/
    00-readme.md
    01-idea.md
    02-project-plan.md
    03-tools-and-sites.md
    04-mvp-scope.md
    05-user-roles.md
    06-project-modes.md
    07-architecture.md
    08-database.md
    09-api-structure.md
    10-ui-pages.md
    11-ai-models.md
    12-security-and-env.md
    13-deployment.md
    14-roadmap.md
    15-changelog.md
    16-decisions.md
    17-code-arena-spec.md
    18-team-mode-spec.md
  src/
    app/
    components/
    lib/
    types/
  .gitignore
  package.json
```

Пример commit после замены документации:

```bash
git add docs/03-tools-and-sites.md
# добавляет изменённый файл инструментов в commit

git commit -m "Update tools and sites plan"
# фиксирует обновление файла инструментов
```

---

## Next.js

**Next.js** - основа проекта.

Он используется сразу для двух частей:

- frontend;
- backend API routes.

В проекте Next.js нужен для:

- страниц сайта;
- компонентов интерфейса;
- API-маршрутов;
- отправки запросов к OpenRouter;
- работы с Supabase;
- деплоя на Vercel.

Почему Next.js подходит:

- frontend и backend можно держать в одном проекте;
- хорошо работает с Vercel;
- подходит для быстрого MVP;
- поддерживает TypeScript;
- удобно разделять страницы, API и компоненты.

Создание нового проекта:

```bash
npx create-next-app@latest new-era-ai
# создаёт новый проект Next.js

cd new-era-ai
# переходит в папку проекта

npm run dev
# запускает проект локально
```

---

## React

**React** используется внутри Next.js для интерфейса.

React нужен для:

- компонентов;
- карточек ответов моделей;
- формы ввода prompt;
- выбора моделей;
- кнопки запуска сравнения;
- отображения результата;
- голосования;
- истории сравнений.

Примеры будущих компонентов:

```text
PromptInput
# поле ввода задачи пользователя

ModelSelector
# выбор AI-моделей для сравнения

ResponseCard
# карточка ответа одной модели

VoteButtons
# кнопки выбора лучшего ответа

HistoryList
# список прошлых сравнений
```

---

## TypeScript

**TypeScript** нужен, чтобы проект был безопаснее и понятнее.

Он помогает:

- описывать типы данных;
- заранее находить ошибки;
- уменьшать хаос при росте проекта;
- безопаснее работать с API;
- безопаснее работать с базой.

В проекте обязательно описывать типы для:

- моделей;
- задач;
- ответов моделей;
- голосов;
- пользователей;
- режимов проекта;
- ошибок API.

Пример типов, которые понадобятся:

```text
ModelConfig
# описание доступной AI-модели

Task
# задача пользователя

ModelResponse
# ответ одной модели

Vote
# голос пользователя за лучший ответ

ApiError
# единый формат ошибки API
```

---

## Tailwind CSS

**Tailwind CSS** нужен для быстрой стилизации интерфейса.

Он подходит для MVP, потому что позволяет быстро делать:

- кнопки;
- карточки;
- сетки;
- адаптивную верстку;
- отступы;
- цвета;
- формы.

Tailwind можно включить сразу при создании Next.js проекта.

Важно: не тратить слишком много времени на дизайн до `v1.0`. Сначала рабочая логика, потом улучшение внешнего вида.

---

## shadcn/ui

**shadcn/ui** - набор UI-компонентов, которые можно добавить в проект.

Может пригодиться для:

- кнопок;
- карточек;
- вкладок;
- таблиц;
- модальных окон;
- dropdown-меню;
- форм;
- уведомлений.

Статус для проекта:

- не обязателен для самого первого UI;
- полезен после появления базовой структуры страниц;
- можно добавить до `v1.0`, если не тормозит MVP.

Правило: если shadcn/ui усложняет старт, сначала делаем простые компоненты вручную.

---

## OpenRouter

**OpenRouter** нужен для подключения разных AI-моделей через один API.

В проекте OpenRouter используется для:

- Prompt Arena;
- Code Arena Lite;
- Multi Model Battle;
- Judge Mode;
- Leaderboard;
- AI Team Mode.

Главное правило безопасности:

**OpenRouter API key никогда не должен попадать в браузер.**

Правильно:

```text
Frontend -> Next.js API Route -> OpenRouter
```

Неправильно:

```text
Frontend -> OpenRouter
```

Переменная окружения:

```env
OPENROUTER_API_KEY=your_openrouter_key_here
# секретный ключ OpenRouter, нельзя загружать в GitHub
```

Что нужно контролировать:

- список разрешённых моделей;
- стоимость моделей;
- timeout запросов;
- количество выбранных моделей;
- максимальный размер prompt;
- ошибки OpenRouter;
- частичный успех, если одна модель ответила, а другая упала.

Проверка моделей должна выполняться перед production через OpenRouter Models API, как описано в `11-ai-models.md`.

---

## Supabase

**Supabase** используется как база данных проекта.

Основа Supabase - PostgreSQL.

В MVP Supabase нужен для хранения:

- списка моделей;
- задач пользователя;
- ответов моделей;
- голосов;
- истории сравнений.

Минимальные таблицы MVP:

```text
models
# список доступных AI-моделей

tasks
# задачи пользователя

model_responses
# ответы моделей

votes
# голоса за лучший ответ
```

Позже добавляются:

```text
profiles
# профили пользователей, начиная с v1.5

usage_logs
# логи использования и лимиты, начиная с v1.6

code_results
# результаты запуска кода, начиная с v1.7

team_runs
# запуски AI Team Mode, начиная с v2.0

team_steps
# шаги AI Team Mode, начиная с v2.0
```

Переменные окружения Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
# публичный URL Supabase проекта

NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key_here
# публичный publishable key Supabase

SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
# секретный service role key, только backend
```

Важно:

- `NEXT_PUBLIC_SUPABASE_URL` можно использовать на клиенте;
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` можно использовать на клиенте при правильно настроенном RLS;
- `SUPABASE_SERVICE_ROLE_KEY` нельзя использовать на клиенте;
- RLS нужно включать до публичного запуска;
- schema базы описана в `08-database.md`.

---

## Vercel

**Vercel** нужен для размещения проекта в интернете.

Vercel подходит, потому что:

- хорошо работает с Next.js;
- подключается к GitHub;
- автоматически деплоит проект;
- поддерживает Environment Variables;
- показывает логи ошибок;
- позволяет делать Preview Deployments.

Что хранить в Vercel Environment Variables:

```env
OPENROUTER_API_KEY=your_openrouter_key_here
# ключ OpenRouter для production

NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
# URL Supabase проекта

NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key_here
# publishable key Supabase

SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
# service role key только для backend
```

Правило: если переменной нет в Vercel, production может работать иначе, чем локальный проект.

Перед деплоем:

```bash
npm run build
# проверяет production-сборку локально

git status
# проверяет, какие файлы изменены

git add .
# добавляет изменения в commit

git commit -m "Prepare project for deployment"
# фиксирует изменения перед деплоем

git push
# отправляет изменения в GitHub, после чего Vercel может начать деплой
```

---

## Browser DevTools

**Browser DevTools** нужны для проверки frontend и API.

С их помощью проверяем:

- ошибки JavaScript;
- сетевые запросы;
- ответы API;
- статус-коды;
- адаптивность;
- проблемы верстки;
- скорость загрузки.

Открытие:

```text
F12
# открывает инструменты разработчика в браузере

Ctrl + Shift + I
# альтернативное открытие DevTools
```

Что особенно важно смотреть:

- вкладка Console;
- вкладка Network;
- статус запросов `/api/models`, `/api/compare`, `/api/vote`, `/api/history`;
- отсутствие секретных ключей в ответах frontend.

---

## curl

**curl** можно использовать для быстрой проверки API без Postman.

Пример проверки списка моделей:

```bash
curl http://localhost:3000/api/models
# отправляет GET-запрос к локальному API моделей
```

Пример проверки compare API:

```bash
curl -X POST http://localhost:3000/api/compare \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Explain what MVP means","modelIds":["model-1","model-2"]}'
# отправляет тестовый POST-запрос на сравнение моделей
```

Важно: настоящие ключи нельзя вставлять в команды, которые потом попадут в GitHub или скриншоты.

---

## Postman или Insomnia

**Postman** или **Insomnia** нужны для удобной проверки API.

На самом старте можно обойтись DevTools и curl.

Добавлять Postman лучше после появления API-маршрутов:

- `/api/models`;
- `/api/compare`;
- `/api/vote`;
- `/api/history`.

Проверять через Postman можно:

- корректные запросы;
- пустой prompt;
- слишком длинный prompt;
- неизвестную модель;
- частичную ошибку одной модели;
- сохранение в Supabase;
- голосование.

---

## Supabase Dashboard

**Supabase Dashboard** нужен для управления базой.

В нём можно:

- создавать таблицы;
- запускать SQL migration;
- смотреть данные;
- проверять RLS;
- смотреть Auth;
- проверять API keys;
- смотреть логи.

Что нельзя делать хаотично:

- менять таблицы без записи в документации;
- удалять поля без проверки API;
- выключать RLS перед production;
- использовать service role key на клиенте.

После изменения базы нужно обновлять:

- `08-database.md`;
- `09-api-structure.md`;
- `16-decisions.md`, если решение архитектурное.

---

## Figma

**Figma** нужна для дизайна и макетов.

Для MVP Figma не обязательна.

Её можно использовать для:

- главной страницы;
- страницы Arena;
- карточек ответов;
- History;
- Leaderboard;
- Admin Panel;
- AI Team Mode.

Правило: Figma не должна тормозить разработку MVP. Если нет макета, делаем простой интерфейс в Next.js и улучшаем позже.

---

## Playwright

**Playwright** нужен для автоматического тестирования UI.

В MVP он не обязателен.

Добавлять лучше после того, как появились стабильные страницы:

- `/`;
- `/arena`;
- `/history`;
- `/leaderboard`.

Что можно тестировать:

- открытие страницы;
- ввод prompt;
- выбор моделей;
- запуск сравнения;
- появление карточек ответов;
- кнопки голосования;
- история сравнений.

До `v1.0` достаточно ручного тестирования и `npm run build`.

---

## Sentry

**Sentry** нужен для отслеживания ошибок в production.

В MVP можно не подключать сразу.

Сначала достаточно:

- Vercel Logs;
- browser console;
- server logs;
- ручной проверки.

Sentry можно добавить после `v1.0`, когда проект начнут тестировать другие пользователи.

---

## Analytics

Аналитика нужна для понимания поведения пользователей.

На старте не обязательна.

Позже можно отслеживать:

- количество сравнений;
- популярные модели;
- среднее количество выбранных моделей;
- какие ответы чаще побеждают;
- сколько запросов падает с ошибками;
- сколько стоит использование AI.

Важно: аналитику нельзя делать вместо нормального логирования расходов и ошибок.

---

## Stripe и платежи

**Stripe** или другая платежная система не нужна в MVP.

Сначала нужно доказать ценность проекта:

- люди вводят задачи;
- сравнивают ответы;
- голосуют;
- возвращаются к истории;
- используют режимы.

Платежи можно рассматривать позже, когда будут:

- аккаунты;
- лимиты;
- admin panel;
- понятная стоимость AI-запросов;
- понимание тарифов.

---

## Инструменты для Code Arena Runner

**Code Arena Runner** запрещён до `v1.7`.

Причина: запуск чужого кода - это риск безопасности.

До `v1.7` можно делать только **Code Arena Lite**:

- модель анализирует код;
- модель предлагает решение;
- модель объясняет ошибки;
- код не запускается на сервере.

Для Runner позже могут понадобиться:

- sandbox;
- изоляция процессов;
- ограничения CPU/RAM/time;
- отдельные контейнеры;
- логирование запусков;
- лимиты пользователей;
- запрет сетевого доступа;
- очистка временных файлов.

Пока эти инструменты не добавлять:

- Docker для Runner;
- отдельный runner service;
- execution queue;
- code execution logs;
- language sandboxes.

Они относятся к `v1.7`.

---

## Инструменты для AI Team Mode

**AI Team Mode** запрещён до `v2.0`.

До него должны быть готовы:

- Prompt Arena;
- Code Arena Lite;
- Multi Model Battle;
- Judge Mode;
- Leaderboard;
- Accounts;
- Admin Panel;
- Limits;
- стабильная база;
- стабильный API.

Для AI Team Mode позже понадобятся:

- team workflow;
- роли моделей;
- сохранение шагов;
- team_runs;
- team_steps;
- review step;
- cost tracking;
- лимиты на количество шагов.

В MVP эти инструменты не добавлять.

---

## Переменные окружения

Все секреты хранятся только в:

- `.env.local` локально;
- Vercel Environment Variables в production.

Пример `.env.local`:

```env
OPENROUTER_API_KEY=your_openrouter_key_here
# секретный ключ OpenRouter

NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
# публичный URL Supabase

NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key_here
# публичный publishable key Supabase

SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
# секретный ключ Supabase service role, только backend
```

Пример `.env.example`:

```env
OPENROUTER_API_KEY=
# сюда разработчик локально вставляет свой OpenRouter key

NEXT_PUBLIC_SUPABASE_URL=
# сюда вставляется публичный URL Supabase

NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
# сюда вставляется publishable key Supabase

SUPABASE_SERVICE_ROLE_KEY=
# сюда вставляется service role key, только backend
```

`.env.example` можно хранить в GitHub, потому что там нет настоящих ключей.

`.env.local` нельзя хранить в GitHub.

---

## .gitignore

В проекте обязательно должен быть `.gitignore`.

Минимальные строки:

```gitignore
.env.local
# запрещает загружать локальные секреты

.env
# запрещает загружать env-файл с секретами

node_modules
# запрещает загружать установленные зависимости

.next
# запрещает загружать сборку Next.js

.vercel
# запрещает загружать локальные данные Vercel
```

Проверка:

```bash
git check-ignore -v .env.local
# проверяет, что .env.local реально игнорируется Git
```

---

## Документация и полезные сайты

Основные сайты:

| Сайт | Для чего нужен |
|---|---|
| `nextjs.org` | Документация Next.js |
| `react.dev` | Документация React |
| `typescriptlang.org` | Документация TypeScript |
| `tailwindcss.com` | Документация Tailwind CSS |
| `ui.shadcn.com` | Компоненты shadcn/ui |
| `vercel.com` | Деплой проекта |
| `supabase.com` | База данных и Auth |
| `openrouter.ai` | AI-модели через API |
| `github.com` | Хранение кода |
| `nodejs.org` | Установка Node.js |
| `npmjs.com` | npm-пакеты |
| `figma.com` | Дизайн интерфейса |
| `postman.com` | Проверка API |
| `playwright.dev` | UI-тесты после MVP |

Правило: если инструмент влияет на архитектуру проекта, его добавление нужно фиксировать в `16-decisions.md`.

---

## Минимальный порядок подготовки компьютера

1. Установить Node.js.
2. Установить Git.
3. Установить Visual Studio Code.
4. Проверить команды `node`, `npm`, `git`, `code`.
5. Создать GitHub-репозиторий.
6. Создать Next.js проект.
7. Настроить `.gitignore`.
8. Создать `.env.local`.
9. Запустить проект локально.
10. Сделать первый commit.

Проверка инструментов:

```bash
node -v
# проверяет Node.js

npm -v
# проверяет npm

git --version
# проверяет Git

code --version
# проверяет Visual Studio Code CLI
```

---

## Минимальный порядок запуска нового проекта

```bash
npx create-next-app@latest new-era-ai
# создаёт новый Next.js проект

cd new-era-ai
# переходит в папку проекта

npm run dev
# запускает проект локально

git status
# проверяет состояние Git

git add .
# добавляет стартовые файлы в commit

git commit -m "Initial Next.js project"
# фиксирует старт проекта
```

После этого можно подключать документацию и начинать `v0.3 - UI MVP`.

---

## Правила добавления новых инструментов

Перед добавлением нового инструмента нужно ответить на 5 вопросов:

1. Он нужен для текущей версии roadmap?
2. Он не ломает текущий MVP?
3. Он не требует секретов на frontend?
4. Он не усложняет проект без явной пользы?
5. Его можно проверить через build, тест или ручную проверку?

Если хотя бы один ответ отрицательный, инструмент лучше отложить.

---

## Приоритет инструментов

### Высший приоритет

- Next.js;
- TypeScript;
- OpenRouter;
- Supabase;
- Vercel;
- GitHub;
- Git;
- VS Code.

### Средний приоритет

- Tailwind CSS;
- shadcn/ui;
- Postman;
- Figma;
- Browser DevTools;
- curl.

### Низкий приоритет до MVP

- Sentry;
- Playwright;
- Analytics;
- Stripe;
- Docker;
- Redis.

### Запрещено до нужной версии

- Code Runner tools до `v1.7`;
- AI Team workflow tools до `v2.0`;
- платёжная система до стабильной логики аккаунтов и лимитов;
- микросервисы до реальной необходимости.

---

## Чек-лист готовности инструментов для MVP

Перед началом активной разработки должно быть готово:

- [ ] установлен Node.js;
- [ ] установлен npm;
- [ ] установлен Git;
- [ ] установлен Visual Studio Code;
- [ ] создан GitHub-репозиторий;
- [ ] создан Next.js проект;
- [ ] включён TypeScript;
- [ ] настроен `.gitignore`;
- [ ] создан `.env.local` без загрузки в GitHub;
- [ ] создан OpenRouter API key;
- [ ] создан Supabase project;
- [ ] создан Vercel project;
- [ ] проверен локальный запуск через `npm run dev`;
- [ ] проверена production-сборка через `npm run build`;
- [ ] сделан первый Git commit.

---

## Итог

Для проекта **Новая эпоха** основной стек должен оставаться простым:

**Next.js + TypeScript + Supabase + OpenRouter + Vercel + GitHub + VS Code**

Этого достаточно для `v1.0 Stable Prompt Arena`.

Главное правило: **не добавлять инструменты ради инструментов**. Каждый новый сервис должен соответствовать roadmap, не ломать старые функции и давать понятную пользу текущему этапу.
