# 34 - Environment Variables Check Implementation

Техническое описание Environment Variables Checker. Политика и правила —
в `docs/34-env-check-policy.md`.

## 1. Добавленные файлы

| Файл | Назначение |
|---|---|
| `env-check.config.json` | единый источник правды по переменным (имена, валидация, placeholder-примеры) |
| `scripts/check-env.mjs` | сам чекер (загрузка env, валидация, leak detection, репортеры) |
| `scripts/check-env.test.mjs` | тесты на `node:test` (изолированы через `ENV_CHECK_DIR`) |
| `.env.local.example` | генерируется командой `env:check:example` (только placeholders) |
| `docs/34-env-check-policy.md` | политика и правила безопасности |
| `docs/34-env-check-implementation.md` | этот документ |

## 2. Добавленные npm-команды

```bash
npm run env:check            # basic-проверка (для запуска сайта)
npm run env:check:migrations # проверка переменных для миграций
npm run env:check:full       # полный набор переменных
npm run env:check:json       # JSON-репортер (full), без значений
npm run env:check:example    # генерация .env.local.example
npm run test:env-check       # тесты самого чекера
```

Дополнительно добавлен `prebuild`:

```bash
"prebuild": "npm run env:check"
# перед каждым build запускается ТОЛЬКО basic-проверка
```

`prebuild` намеренно запускает `basic`, а не `migrations`/`full`, чтобы обычный
`npm run build` не требовал `DATABASE_URL` и `SUPABASE_ACCESS_TOKEN`.

## 3. Как работает загрузка переменных

Скрипт использует `loadEnvConfig` из `@next/env`, чтобы читать `.env`-файлы так
же, как Next.js:

```js
import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv; // в @next/env loadEnvConfig — на default-экспорте
loadEnvConfig(BASE_DIR, true, silentLogger);
```

- `BASE_DIR` — корень проекта (`scripts/..`), либо `ENV_CHECK_DIR` для тестов;
- передаётся «тихий» logger, чтобы не печатать `Environments: .env.local`;
- на Vercel/CI файлов `.env.local` нет — переменные уже лежат в `process.env`,
  и `loadEnvConfig` их не перезаписывает.

`loadEnvConfig` **не переопределяет** уже существующие значения `process.env`,
поэтому переданные снаружи переменные (Vercel, CI, inline) имеют приоритет.

## 4. Как работает JSON-репортер

`--json` печатает структуру **только со статусами**, без значений:

```json
{
  "status": "failed",
  "mode": "basic",
  "summary": { "ok": 2, "missing": 1, "empty": 0, "invalid": 1, "optional": 0, "warnings": 0, "fatal": 0 },
  "details": [
    { "name": "NEXT_PUBLIC_SUPABASE_URL", "status": "ok", "required": true, "category": "public", "message": "exists" },
    { "name": "OPENROUTER_API_KEY", "status": "invalid", "required": true, "category": "secret", "message": "must start with sk-or-v1-" }
  ]
}
```

В JSON попадают только `name`, `status`, `required`, `category`, `message`.
Значений переменных, `process.env` и длин — нет.

## 5. Как работает GitHub Actions output

Если `process.env.CI === "true"` или передан `--ci`, к обычному выводу
добавляются аннотации GitHub Actions:

```text
::error::MISSING: OPENROUTER_API_KEY is required
::error::INVALID: OPENROUTER_API_KEY must start with sk-or-v1-
::warning::WARNING: .env.local file not found
```

`::error::` — для `MISSING`/`EMPTY`/`INVALID`/`FATAL`, `::warning::` — для
`WARNING`. Значения по-прежнему не выводятся.

## 6. Как работает генерация `.env.local.example`

`--generate-example` создаёт/обновляет `.env.local.example` **только из
placeholder-значений** поля `example` в `env-check.config.json`.

- скрипт **никогда** не берёт значения из `process.env` или `.env.local`;
- переменные группируются по `category` с комментариями;
- результат безопасно коммитить в git.

## 7. Как добавить новую переменную в будущем

1. Добавьте объект в `variables` в `env-check.config.json`:
   - `name`, `required`, `category` (`public`/`secret`), `groups`
     (`basic`/`migrations`/`full`), `validation`, `example`;
   - при необходимости `aliases` (альтернативные имена).
2. Выберите тип валидации: `regex`, `nonEmptyString` или
   `supabaseServiceRoleJwt`.
3. Запустите `npm run env:check:example`, чтобы обновить `.env.local.example`.
4. Запустите `npm run env:check` (или нужный режим) для проверки.
5. Для секретов **никогда** не используйте префикс `NEXT_PUBLIC_`.

Менять сам `scripts/check-env.mjs` для новой переменной обычно не нужно — только
конфиг.

## 8. Как проверить, что скрипт не раскрывает секреты

- Запустите `npm run env:check` — в выводе только имена и статусы.
- Запустите `npm run test:env-check` — тесты проверяют, что:
  - значения секретов не попадают в вывод (sentinel-значения отсутствуют);
  - `--json` не содержит значений;
  - `--generate-example` не берёт реальные значения из окружения;
  - секрет с `NEXT_PUBLIC_` даёт `FATAL` (exit 3);
  - missing/empty/invalid обязательной переменной дают `failed` (exit 1).
- Тесты изолированы через `ENV_CHECK_DIR` (временная папка), поэтому реальные
  `.env.local`-секреты в них не загружаются.

## Замечание про режимы `full`/`migrations` локально

Локально `.env.local` обычно содержит только `basic`-переменные, поэтому
`npm run env:check:full` и `npm run env:check:migrations` будут сообщать
`MISSING: DATABASE_URL` / `MISSING: SUPABASE_ACCESS_TOKEN` и завершаться с
exit code 1. Это **корректное** поведение: миграционные секреты задаются только
в окружении, где реально выполняются миграции. На обычный `build` это не влияет,
так как `prebuild` запускает только `basic`.
