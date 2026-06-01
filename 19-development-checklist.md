# 19 - Чек-лист разработки

## Назначение файла

Этот файл фиксирует ближайшие практические шаги разработки проекта **Новая эпоха**.

Он нужен, чтобы после документации и Static UI MVP перейти к реальному backend без хаоса:

- сначала подтвердить локальную сборку;
- потом зафиксировать `package-lock.json`;
- потом подключать backend routes;
- потом подключать реальные AI-ответы;
- потом подключать Supabase;
- потом добавлять сохранённое голосование, историю и деплой.

Главный порядок версий берётся из `14-roadmap.md`.

---

# Текущее состояние репозитория

## Уже есть

- Проектная документация `00-18`.
- Главный `README.md` для GitHub.
- `.gitignore` для Next.js проекта.
- `.env.example` без секретных значений.
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
- Интерактивная страница `/arena`.
- Типы Arena в `src/types/arena.ts`.
- `ArenaApiResponse` и `ArenaResponseView`.
- Mock-данные моделей в `src/data/mock-arena.ts`.
- Mock-генератор ответов в `src/lib/arena/mock-responses.ts`.
- Mock-ответы используют `answerText`.
- `modelRole` добавляется на клиенте по `modelId`.
- Компоненты Prompt Arena в `src/components/arena`.
- Лимит prompt `MAX_PROMPT_LENGTH=8000` применён в UI.
- Старые responses сбрасываются при изменении prompt или выбора моделей.
- `ResponseCard` показывает `answerText`, `errorMessage` и `errorCode`.
- Отчёты аудита и исправлений: `22`, `23`, `24`, `25`, `26`.

## Ещё нет

- `package-lock.json`, потому что зависимости нужно установить локально через `npm install`.
- Локальной проверки после последних удалённых правок.
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
- [x] Добавить `AGENTS.md`.

## Что нужно проверить локально

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

## Важное ограничение

`package-lock.json` не создан через GitHub-инструмент, потому что его должен создать `npm install` на компьютере с установленным Node.js.

После `npm install` файл `package-lock.json` нужно добавить в Git.

```bash
git add package-lock.json
# добавляет lock-файл зависимостей

git commit -m "chore: add package lock"
# фиксирует точные версии установленных зависимостей
```

---

# Этап 3 - Static UI MVP

## Цель

Сделать первый интерфейс Prompt Arena без реальных AI-запросов, но с логикой, близкой к будущему `/api/compare`.

## Готово

- [x] Главная страница `/`.
- [x] Страница `/arena`.
- [x] Поле ввода задачи.
- [x] Выбор 2-3 моделей.
- [x] Кнопка запуска сравнения.
- [x] Mock-ответы моделей.
- [x] Карточки ответов рядом.
- [x] Вынести повторяющиеся UI-блоки в компоненты.
- [x] Добавить client-side состояние для prompt.
- [x] Добавить состояние loading.
- [x] Добавить состояние empty.
- [x] Добавить состояние error.
- [x] Добавить валидацию пустого prompt.
- [x] Добавить валидацию минимального количества выбранных моделей.
- [x] Добавить ограничение максимум 3 модели.
- [x] Добавить `MAX_PROMPT_LENGTH=8000` в UI.
- [x] Добавить mock-генерацию ответов после нажатия кнопки.
- [x] Перевести mock-ответы на `answerText`.
- [x] Разделить `ArenaApiResponse` и `ArenaResponseView`.
- [x] Добавлять `modelRole` на клиенте по `modelId`.
- [x] Отображать `errorMessage` и `errorCode` для ошибочных ответов.
- [x] Запретить выбирать ошибочный ответ победителем.
- [x] Сбрасывать старые responses при изменении prompt или выбора моделей.
- [x] Добавить UI-выбор победителя.
- [x] Добавить кнопку очистки формы.
- [x] Добавить базовую мобильную адаптацию.

## Что осталось проверить локально

- [ ] После pull выполнить `npm install`.
- [ ] Создать `package-lock.json`.
- [ ] Выполнить `npm run typecheck`.
- [ ] Выполнить `npm run lint`.
- [ ] Выполнить `npm run build`.
- [ ] Проверить `/arena` в браузере.
- [ ] После локальной проверки исправить возможные ошибки ESLint или TypeScript.
- [ ] После просмотра в браузере улучшить отступы и мобильную сетку, если потребуется.

## Проверка

```bash
npm install
# устанавливает зависимости, если ещё не выполнено, и создаёт package-lock.json

npm run dev
# запускает проект локально

npm run typecheck
# проверяет TypeScript

npm run lint
# проверяет ESLint

npm run build
# проверяет production-сборку
```

## Ручной тест `/arena`

Проверить:

- пустой prompt даёт ошибку;
- prompt короче 3 символов даёт ошибку;
- prompt ограничивается 8000 символами;
- выбор 1 модели даёт ошибку;
- выбор больше 3 моделей даёт единый текст ошибки;
- после запуска появляются mock-ответы;
- после изменения prompt старые ответы исчезают;
- после изменения выбора моделей старые ответы исчезают;
- успешный ответ можно выбрать лучшим;
- ошибочный ответ нельзя выбрать победителем;
- кнопка очистки сбрасывает форму и ответы.

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

- OpenRouter key хранится только в `.env.local` и Vercel Environment Variables.
- Не создавать публичную переменную для приватного OpenRouter key.
- Frontend не обращается к OpenRouter напрямую.
- Backend проверяет allowlist моделей.
- В MVP максимум 3 модели на один compare-запрос.
- Backend повторно проверяет `MAX_PROMPT_LENGTH=8000`.

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

- Service role key только на сервере.
- Не импортировать server client в client components.
- Не сохранять секреты в базе.
- Ошибки базы показывать пользователю безопасно, без stack trace.

---

# Этап 6 - Voting MVP

## Цель

Добавить сохранённый выбор лучшего ответа.

Важно:

```text
v0.3
# только локальный UI-выбор победителя

v0.6
# сохранение выбора через /api/vote и таблицу votes
```

## Нужно создать

- `POST /api/vote`.
- Проверку `taskId`.
- Проверку `responseId`.
- Проверку, что response относится к task.
- Запись `vote_type = user` на backend.

---

# Следующий практический шаг

Сейчас ближайший шаг:

```bash
npm install
# создать настоящий package-lock.json

npm run typecheck
# проверить TypeScript

npm run lint
# проверить ESLint

npm run build
# проверить production-сборку

git add package-lock.json
# добавить lock-файл

git commit -m "chore: add package lock"
# сохранить lock-файл зависимостей
```

После зелёной проверки можно переходить к `v0.4 - OpenRouter Integration`.
