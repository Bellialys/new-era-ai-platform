# AGENTS - правила работы с проектом

## Проект

Название: **Новая эпоха**.

Цель: создать AI-платформу для сравнения, оценки и совместной работы нескольких AI-моделей.

Первый рабочий результат: **Stable Prompt Arena**.

---

## Главный порядок разработки

1. Сначала рабочий простой MVP.
2. Потом OpenRouter integration.
3. Потом Supabase integration.
4. Потом voting и history.
5. Потом deploy на Vercel.
6. Потом Code Arena Lite.
7. Только позже Judge Mode, Leaderboard, accounts, admin limits, Code Runner и AI Team Mode.

Главный roadmap: `14-roadmap.md`.

Если другой файл спорит с `14-roadmap.md`, правильным считается `14-roadmap.md`.

---

## Технологический стек

- Next.js.
- React.
- TypeScript.
- Tailwind CSS.
- Supabase PostgreSQL.
- OpenRouter API.
- Vercel.
- GitHub.

---

## Правила безопасности

- Не вставлять реальные API-ключи в код.
- Не коммитить `.env.local`.
- Не создавать `NEXT_PUBLIC_OPENROUTER_API_KEY`.
- OpenRouter API key использовать только server-side.
- Supabase service role key использовать только server-side.
- Frontend не должен напрямую обращаться к OpenRouter.
- Backend обязан проверять allowlist моделей.
- Не логировать Authorization headers.
- Не показывать пользователю внутренний stack trace.

---

## Правила MVP

В MVP входит:

- главная страница;
- Prompt Arena;
- выбор 2-3 моделей;
- отправка prompt через backend;
- ответы моделей рядом;
- выбор лучшего ответа;
- сохранение в Supabase;
- история сравнений;
- деплой на Vercel.

В MVP не входит:

- запуск пользовательского кода;
- полноценный AI Team Mode;
- платёжная система;
- сложная админ-панель;
- дорогие модели без лимитов;
- публичный Leaderboard без данных.

---

## Правила кода

- Использовать TypeScript.
- Держать server-only код в `src/lib/server`.
- Не импортировать server-only файлы в client components.
- API routes держать в `src/app/api`.
- Общие UI-компоненты позже держать в `src/components`.
- Не добавлять тяжёлые зависимости без причины.
- Перед новой функцией проверять, не ломается ли старый сценарий.

---

## Команды проверки

```bash
npm install
# устанавливает зависимости и создаёт package-lock.json

npm run dev
# запускает локальную разработку

npm run typecheck
# проверяет TypeScript

npm run lint
# проверяет ESLint

npm run build
# проверяет production-сборку
```

---

## Что делать при сомнении

1. Проверить `14-roadmap.md`.
2. Проверить `04-mvp-scope.md`.
3. Проверить `07-architecture.md`.
4. Проверить `12-security-and-env.md`.
5. Выбрать более простой и безопасный вариант.
