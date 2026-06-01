# 19 - Чек-лист разработки

## Назначение файла

Этот файл фиксирует ближайшие практические шаги разработки проекта **Новая эпоха**.

Он нужен, чтобы после документации перейти к коду без хаоса:

- сначала подготовить репозиторий;
- потом создать Next.js основу;
- потом сделать UI MVP;
- потом подключать OpenRouter;
- потом подключать Supabase;
- потом добавлять голосование, историю и деплой.

Главный порядок версий берётся из `14-roadmap.md`.

---

# Текущее состояние репозитория

## Уже есть

- Проектная документация `00-18`.
- Главный `README.md` для GitHub.
- `.gitignore` для Next.js проекта.
- `.env.example` без секретных ключей.
- Roadmap разработки.
- Описание MVP.
- Описание архитектуры.
- Описание API.
- Описание Supabase-схемы.
- Правила безопасности.

## Ещё нет

- `package.json`.
- Next.js проекта.
- TypeScript-конфигурации.
- `src/app`.
- UI страниц.
- API routes.
- Подключения OpenRouter.
- Подключения Supabase.
- Vercel deploy.

---

# Этап 1 - Repository Setup

## Цель

Подготовить репозиторий к созданию Next.js проекта.

## Готово

- [x] Добавить `README.md`.
- [x] Добавить `.gitignore`.
- [x] Добавить `.env.example`.
- [x] Добавить `19-development-checklist.md`.
- [x] Проверить, что `.env.local` не должен попадать в Git.

## Проверка

```bash
git status
# показывает изменённые и новые файлы

git log --oneline -5
# показывает последние коммиты
```

---

# Этап 2 - Next.js Base

## Цель

Создать базовый Next.js проект, который запускается локально.

## Рекомендуемые команды

```bash
npx create-next-app@latest . --ts --eslint --app --src-dir --import-alias "@/*"
# создаёт Next.js проект прямо в текущей папке репозитория

npm run dev
# запускает локальный сервер разработки

npm run build
# проверяет production-сборку

git status
# показывает, какие файлы созданы

git add .
# добавляет изменения в Git

git commit -m "Create Next.js base project"
# фиксирует базовую основу Next.js проекта
```

## Важное замечание

Если команда `create-next-app` спросит про Tailwind CSS, лучше выбрать `Yes`.

Если спросит про Turbopack, для первого MVP можно выбрать `No`, чтобы было меньше неожиданных проблем.

---

# Этап 3 - Static UI MVP

## Цель

Сделать первый интерфейс Prompt Arena без реальных AI-запросов.

## Нужно создать

- Главную страницу `/`.
- Страницу `/arena`.
- Поле ввода задачи.
- Выбор 2-3 моделей.
- Кнопку запуска сравнения.
- Mock-ответы моделей.
- Карточки ответов рядом.
- Состояния empty, loading, error, success.
- Адаптацию под мобильный экран.

## Проверка

```bash
npm run dev
# запускает проект локально

npm run build
# проверяет сборку
```

---

# Этап 4 - OpenRouter Integration

## Цель

Подключить реальные ответы моделей через backend.

## Нужно создать

- `src/app/api/models/route.ts`.
- `src/app/api/compare/route.ts`.
- `src/lib/server/openrouter.ts`.
- `src/lib/server/model-allowlist.ts`.
- `src/lib/server/limits.ts`.
- `src/lib/server/api-response.ts`.

## Правила безопасности

- `OPENROUTER_API_KEY` хранится только в `.env.local` и Vercel Environment Variables.
- Не создавать `NEXT_PUBLIC_OPENROUTER_API_KEY`.
- Frontend не обращается к OpenRouter напрямую.
- Backend проверяет allowlist моделей.
- В MVP максимум 3 модели на один compare-запрос.

---

# Этап 5 - Supabase Integration

## Цель

Сохранять задачи, ответы и модели в Supabase PostgreSQL.

## Нужно создать

- Supabase project.
- Таблицу `models`.
- Таблицу `tasks`.
- Таблицу `model_responses`.
- Таблицу `votes`.
- Server-side Supabase client.

## Важные правила

- `SUPABASE_SERVICE_ROLE_KEY` только на сервере.
- Не импортировать server client в client components.
- Не сохранять секреты в базе.
- Ошибки базы показывать пользователю безопасно, без stack trace.

---

# Этап 6 - Voting MVP

## Цель

Добавить выбор лучшего ответа.

## Нужно создать

- `src/app/api/vote/route.ts`.
- Кнопку выбора лучшего ответа в карточке модели.
- Визуальную метку победителя.
- Проверку, что `response_id` относится к `task_id`.

---

# Этап 7 - History MVP

## Цель

Добавить историю сравнений.

## Нужно создать

- `/history`.
- `/history/[taskId]`.
- `src/app/api/history/route.ts`.
- `src/app/api/history/[taskId]/route.ts`.

---

# Этап 8 - First Deploy

## Цель

Опубликовать рабочую версию на Vercel.

## Нужно проверить

- Репозиторий подключён к Vercel.
- Environment Variables добавлены в Vercel.
- `.env.local` не попал в GitHub.
- Главная страница открывается.
- `/arena` открывается.
- API routes работают.
- Секреты не видны в браузере.

---

# Запрещено делать раньше времени

## До Stable Prompt Arena нельзя добавлять

- полноценный AI Team Mode;
- Code Arena Runner;
- запуск пользовательского кода;
- платёжную систему;
- сложную админ-панель;
- дорогие модели без лимитов;
- публичный Leaderboard без достаточных данных.

## Почему

Эти функции требуют отдельной безопасности, лимитов, логирования, контроля расходов и стабильной базы проекта.

---

# Ближайший следующий шаг

Следующий практический шаг - создать базовый Next.js проект в этом репозитории.

Рабочая команда:

```bash
npx create-next-app@latest . --ts --eslint --app --src-dir --import-alias "@/*"
# создаёт Next.js проект в текущей папке репозитория
```

После создания проекта нужно проверить:

```bash
npm run dev
# запускает проект локально

npm run build
# проверяет production-сборку
```
