# 19 - Development Checklist

## Назначение файла

Этот файл показывает, что уже готово и что делать дальше.

Текущий этап: **v0.4.1 - OpenRouter Integration Fix**.

Следующий этап: **v0.5 - Supabase Integration**.

## Текущий статус

## Готово

- [x] Project documentation.
- [x] Next.js base.
- [x] TypeScript.
- [x] ESLint.
- [x] Tailwind CSS.
- [x] Главная страница `/`.
- [x] Страница `/arena`.
- [x] `GET /api/models`.
- [x] `POST /api/compare`.
- [x] Server-side OpenRouter integration.
- [x] Server-side model allowlist.
- [x] Валидация `prompt`.
- [x] Валидация `modelIds`.
- [x] Валидация `modeSlug`.
- [x] Safe API errors через `ApiError`.
- [x] OpenRouter timeout.
- [x] Обработка non-JSON ответа OpenRouter.
- [x] Client-side AbortController для устаревших запросов.
- [x] `package-lock.json`.
- [x] Проверка `npm run typecheck`.
- [x] Проверка `npm run lint`.
- [x] Проверка `npm run build`.

## Не готово

- [ ] Supabase project.
- [ ] Таблица `models`.
- [ ] Таблица `tasks`.
- [ ] Таблица `model_responses`.
- [ ] Таблица `votes`.
- [ ] Server-side Supabase client.
- [ ] Сохранение task в `/api/compare`.
- [ ] Сохранение model responses в `/api/compare`.
- [ ] Возврат `taskId` из `/api/compare`.
- [ ] `/api/vote`.
- [ ] Страница истории.
- [ ] Vercel deploy.

## Проверка перед каждым commit

```bash
npm run typecheck
# проверяет TypeScript

npm run lint
# проверяет ESLint

npm run build
# проверяет production-сборку
```

## Рекомендуемый commit для текущих исправлений

```bash
git add .
# добавить все исправленные файлы

git commit -m "fix: stabilize OpenRouter integration and sync docs"
# зафиксировать исправления v0.4.1
```

## Следующий этап - v0.5 Supabase Integration

### Шаг 1 - создать Supabase проект

- [ ] Создать новый проект Supabase.
- [ ] Скопировать `NEXT_PUBLIC_SUPABASE_URL`.
- [ ] Скопировать `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- [ ] Скопировать `SUPABASE_SERVICE_ROLE_KEY`.
- [ ] Добавить значения только в `.env.local`.

### Шаг 2 - установить Supabase package

```bash
npm install @supabase/supabase-js
# устанавливает официальный клиент Supabase
```

### Шаг 3 - создать таблицы

- [ ] `models`.
- [ ] `tasks`.
- [ ] `model_responses`.
- [ ] `votes`.

Схема описана в `08-database.md`.

### Шаг 4 - перенести модели в Supabase

- [ ] Добавить текущие модели в таблицу `models`.
- [ ] Оставить `model_key` только для backend.
- [ ] Изменить `/api/models`, чтобы он читал модели из Supabase.

### Шаг 5 - изменить `/api/compare`

- [ ] Frontend отправляет `models.id`.
- [ ] Backend по `models.id` получает `model_key`.
- [ ] Backend вызывает OpenRouter через `model_key`.
- [ ] Backend создаёт запись в `tasks`.
- [ ] Backend сохраняет ответы в `model_responses`.
- [ ] Backend возвращает `taskId`.

### Шаг 6 - проверить сценарий

Проверить вручную:

- [ ] `/arena` открывается.
- [ ] модели загружаются из Supabase.
- [ ] prompt отправляется.
- [ ] реальные ответы приходят.
- [ ] task появляется в Supabase.
- [ ] responses появляются в Supabase.
- [ ] ошибки OpenRouter не ломают весь запрос.
