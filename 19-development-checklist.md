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
- `AGENTS.md` с правилами для работы с проектом.
- `package.json`.
- `tsconfig.json`.
- `next.config.ts`.
- `eslint.config.mjs`.
- `postcss.config.mjs`.
- `next-env.d.ts`.
- `src/app/layout.tsx`.
- `src/app/globals.css`.
- Главная страница `/`.
- Стартовая страница `/arena`.

## Ещё нет

- `package-lock.json`, потому что зависимости нужно установить локально через `npm install`.
- Backend API routes.
- Подключения OpenRouter.
- Подключения Supabase.
- Vercel deploy.
- Production-проверки.

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

## Готово

- [x] Создать `package.json`.
- [x] Добавить команды `dev`, `build`, `start`, `lint`, `lint:fix`, `typecheck`.
- [x] Добавить зависимости Next.js, React и React DOM.
- [x] Добавить TypeScript.
- [x] Добавить ESLint.
- [x] Добавить Tailwind CSS через PostCSS.
- [x] Добавить `tsconfig.json`.
- [x] Добавить `next.config.ts`.
- [x] Добавить `eslint.config.mjs`.
- [x] Добавить `postcss.config.mjs`.
- [x] Добавить `next-env.d.ts`.
- [x] Добавить `src/app/layout.tsx`.
- [x] Добавить `src/app/globals.css`.
- [x] Добавить главную страницу `/`.
- [x] Добавить стартовую страницу `/arena`.
- [x] Исправить ссылку на документацию на главной странице.
- [x] Обновить `README.md` под состояние v0.2.
- [x] Добавить `AGENTS.md`.

## Что нужно проверить локально на компьютере

```bash
npm install
# устанавливает зависимости и создаёт package-lock.json

npm run dev
# запускает локальный сервер разработки

npm run typecheck
# проверяет TypeScript без production-сборки

npm run lint
# проверяет код через ESLint

npm run build
# проверяет production-сборку
```

## Ожидаемый результат

- Главная страница открывается по адресу `http://localhost:3000`.
- Страница Prompt Arena открывается по адресу `http://localhost:3000/arena`.
- Сайт показывает стартовый интерфейс без реальных AI-запросов.
- Ошибок сборки быть не должно.

## Важное ограничение

`package-lock.json` не создан через GitHub-инструмент, потому что его должен создать `npm install` на компьютере с установленным Node.js.

После `npm install` файл `package-lock.json` нужно добавить в Git.

```bash
git add package-lock.json
# добавляет lock-файл зависимостей

git commit -m "Add npm lockfile"
# фиксирует точные версии установленных зависимостей
```

---

# Этап 3 - Static UI MVP

## Цель

Сделать первый интерфейс Prompt Arena без реальных AI-запросов.

## Уже частично готово

- [x] Главная страница `/`.
- [x] Страница `/arena`.
- [x] Поле ввода задачи.
- [x] Выбор 2-3 моделей.
- [x] Кнопка запуска сравнения.
- [x] Mock-ответы моделей.
- [x] Карточки ответов рядом.

## Ещё нужно доработать на этапе 3

- [ ] Вынести повторяющиеся UI-блоки в компоненты.
- [ ] Добавить client-side состояние для prompt.
- [ ] Добавить состояние loading.
- [ ] Добавить состояние empty.
- [ ] Добавить состояние error.
- [ ] Добавить валидацию пустого prompt.
- [ ] Добавить валидацию минимального количества выбранных моделей.
- [ ] Добавить более аккуратную мобильную адаптацию.
- [ ] Добавить mock-генерацию ответов после нажатия кнопки.
- [ ] Добавить UI-выбор победителя.

## Проверка

```bash
npm run dev
# запускает проект локально

npm run typecheck
# проверяет TypeScript

npm run lint
# проверяет ESLint

npm run build
# проверяет production-сборку
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

Следующий практический шаг - локально установить зависимости и проверить проект.

```bash
npm install
# устанавливает зависимости проекта

npm run dev
# запускает локальный сервер

npm run typecheck
# проверяет TypeScript

npm run lint
# проверяет ESLint

npm run build
# проверяет production-сборку
```

Если все проверки проходят, можно переходить к этапу 3 - Static UI MVP.
