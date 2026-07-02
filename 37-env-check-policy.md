# 37 - Environment Variables Check Policy

## 1. Зачем нужен Environment Variables Checker

Чекер переменных окружения помогает быстро понять, **почему не работает** сайт,
Supabase, OpenRouter или миграции, не раскрывая при этом значения секретов.

Он отвечает на вопросы:

- какие обязательные переменные отсутствуют;
- какие объявлены, но пустые;
- какие имеют неправильный формат;
- нет ли опасной конфигурации (секрет в `NEXT_PUBLIC_`);
- в `.gitignore` ли `.env.local`.

Скрипт: `scripts/check-env.mjs`. Источник правды по переменным:
`env-check.config.json`.

## 2. Главное правило безопасности

**Значения секретов никогда не выводятся.** Скрипт печатает только имена
переменных и статусы. Он не показывает:

- значения переменных (даже частично, даже первые/последние символы);
- длину значений;
- payload или claims JWT;
- `process.env` целиком.

Вывод вида `OK: OPENROUTER_API_KEY exists` безопасно публиковать в логах CI.

## 3. Public и secret переменные

| Категория | Префикс | Где доступна | Примеры |
|---|---|---|---|
| `public` | `NEXT_PUBLIC_` | в браузере и на сервере | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` |
| `secret` | без `NEXT_PUBLIC_` | только на сервере | `SUPABASE_SERVICE_ROLE_KEY`, `OPENROUTER_API_KEY`, `SUPABASE_DB_URL`, `SUPABASE_ACCESS_TOKEN` |

`public`-переменные по дизайну попадают в клиентский бандл, поэтому в них **нельзя**
хранить ничего секретного.

## 4. Почему секрет нельзя начинать с `NEXT_PUBLIC_`

Next.js встраивает все переменные с префиксом `NEXT_PUBLIC_` в клиентский
JavaScript-бандл. Любой пользователь сайта может прочитать их в исходниках
страницы. Поэтому секрет с префиксом `NEXT_PUBLIC_` — это **утечка**, и чекер
помечает такую переменную как `FATAL` (exit code 3).

## 5. Обязательные переменные для режима `basic`

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` *(в этом проекте основное имя —
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, а `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  поддерживается как alias — см. примечание ниже)*
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENROUTER_API_KEY`

> **Примечание по именованию ключа Supabase.** Приложение читает
> `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (см. `src/lib/supabase.ts`). Чтобы чекер
> был правдивым и не ломал `npm run build`, основным именем в
> `env-check.config.json` указан `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, а
> стандартное `NEXT_PUBLIC_SUPABASE_ANON_KEY` объявлено как `alias`. Достаточно
> любого из двух имён.

## 6. Переменные для режима `migrations`

- `SUPABASE_DB_URL` *(alias `DATABASE_URL`)*
- `SUPABASE_ACCESS_TOKEN`

Это секреты, нужные только для работы с миграциями/Supabase CLI. Их **не**
требует обычный `npm run build` (см. правило про `prebuild`).

## 6a. Переменные для режима `full`

Группа `full` включает всё из `basic` плюс:

| Переменная | Тип | Описание |
|---|---|---|
| `UPSTASH_REDIS_REST_URL` | secret | URL Upstash Redis для глобального rate limiting. Без него каждый Vercel serverless instance считает лимиты независимо — rate limit работает только per-instance. Vercel Marketplace alias: `KV_REST_API_URL`. |
| `UPSTASH_REDIS_REST_TOKEN` | secret | Токен доступа к Upstash Redis. Обязателен вместе с `UPSTASH_REDIS_REST_URL`. Vercel Marketplace alias: `KV_REST_API_TOKEN`. |
| `APP_ENV` | optional | Окружение: `development`, `preview`, `production`. |
| `APP_URL` | optional | Публичный URL приложения. |
| `MODEL_TIMEOUT_MS` | optional | Таймаут ответа модели в мс (по умолчанию `OPENROUTER_TIMEOUT_MS` из constants.ts). |
| `OPENROUTER_MAX_TOKENS` | optional | Максимум токенов в ответе модели (по умолчанию 2048). |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | secret | Опциональный секрет Vercel Deployment Protection для smoke-проверок protected Preview. Используется только server/CI tooling, не в браузере. |

Группа `full` используется для проверки полной production-конфигурации:
```bash
node scripts/check-env.mjs full
```

## 7. Возможные статусы

| Статус | Значение |
|---|---|
| `OK` | переменная есть, не пустая и прошла валидацию |
| `MISSING` | обязательная переменная отсутствует |
| `EMPTY` | обязательная переменная есть, но пустая после trim |
| `INVALID` | переменная есть, но формат неправильный |
| `WARNING` | неблокирующая проблема, требует внимания |
| `OPTIONAL` | опциональная переменная не задана, запуск не блокируется |
| `FATAL` | опасная конфигурация, которую нельзя деплоить |

## 8. Exit codes

| Code | Значение |
|---|---|
| `0` | проверка прошла успешно |
| `1` | отсутствуют, пустые или невалидные обязательные переменные |
| `2` | неправильный вызов скрипта или ошибка аргументов |
| `3` | security-риск (например потенциальная утечка секрета в `NEXT_PUBLIC_`) |

## 9. Troubleshooting

- **MISSING** — переменная не объявлена. Добавьте её в `.env.local` (локально)
  или в Vercel Project Settings → Environment Variables (на деплое).
- **EMPTY** — переменная объявлена, но значение пустое. Впишите реальное значение.
- **INVALID** — формат неправильный. Сверьтесь с сообщением и `example` в конфиге
  (например `OPENROUTER_API_KEY` должен начинаться с `sk-or-v1-`).
- **FATAL** — опасная конфигурация, которую нельзя деплоить (секрет в
  `NEXT_PUBLIC_`, или `.env.local` не в `.gitignore`). Исправьте перед деплоем.
- **WARNING** — проблема не блокирует запуск, но требует внимания (например
  локально нет `.env.local`, или ключ объявлен в `.env.local` дважды).

## 10. Правила для Vercel

- На Vercel переменные приходят из **Project Settings → Environment Variables**,
  а не из `.env.local`.
- Отсутствие `.env.local` на Vercel **не считается ошибкой**.
- В production/CI не должно появляться предупреждение
  `WARNING: .env.local file not found`. Чекер подавляет это предупреждение, если
  `process.env.CI === "true"`, передан `--ci`, выставлен `VERCEL`/`VERCEL_ENV`
  или `NODE_ENV === "production"`.
- Protected Preview проверяется через `npm run smoke` только с
  `VERCEL_AUTOMATION_BYPASS_SECRET` в окружении. Скрипт передаёт его заголовком
  `x-vercel-protection-bypass` и никогда не печатает значение.
- Создание, ротация или удаление Vercel bypass secret считается изменением
  production/preview secret state и требует отдельного явного подтверждения.
