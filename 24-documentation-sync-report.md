# 24 - Documentation Sync Report

## Назначение файла

Этот файл фиксирует результат синхронизации документации после углублённого аудита `23-documentation-audit-deep.md`.

Синхронизация выполнена перед переходом к:

```text
v0.4 - OpenRouter Integration
# реальные ответы моделей через backend
```

---

# Что было исправлено

## 1. 02-project-plan.md

Исправлено:

- убрана старая нумерация `v0.0`;
- порядок версий синхронизирован с `14-roadmap.md`;
- фазы разработки приведены к `v0.1-v1.0`;
- добавлено разделение между UI MVP и Stable Prompt Arena MVP;
- уточнено, что `v0.3` даёт локальный UI-выбор победителя, а `v0.6` сохраняет голос через API.

Статус:

```text
Done
# файл синхронизирован
```

---

## 2. 04-mvp-scope.md

Исправлено:

- лимит prompt изменён с `4000` на `8000`;
- закреплены единые MVP-лимиты;
- добавлено разделение `UI winner selection` и `saved vote`;
- документ сокращён и убраны лишние дубли;
- границы `v0.3` и `v1.0` описаны чётче.

Канонические лимиты:

```text
MIN_PROMPT_LENGTH = 3
# минимальная длина prompt

MAX_PROMPT_LENGTH = 8000
# максимальная длина prompt для MVP

MIN_MODELS_PER_COMPARE = 2
# минимальное количество моделей

MAX_MODELS_PER_COMPARE = 3
# максимальное количество моделей

MODEL_TIMEOUT_MS = 60000
# базовый timeout ответа модели
```

Статус:

```text
Done
# файл синхронизирован
```

---

## 3. 06-project-modes.md

Исправлено:

- старые slug-и с подчёркиваниями заменены на `kebab-case`;
- TypeScript-примеры переведены на `camelCase`;
- база данных оставлена в `snake_case`;
- добавлено правило единого стиля имён;
- уточнено различие между `v0.3` UI-выбором и `v0.6` saved vote.

Канонический стиль:

```text
modeSlug = prompt-arena
# API и TypeScript

mode_slug = prompt-arena
# база данных
```

Статус:

```text
Done
# файл синхронизирован
```

---

## 4. 09-api-structure.md

Исправлено:

- API JSON переведён на `camelCase`;
- database naming оставлен в `snake_case`;
- `prompt_arena` заменён на `prompt-arena`;
- `model_ids` заменено на `modelIds`;
- `task_id` заменено на `taskId`;
- `response_id` заменено на `responseId`;
- `mode` заменено на `modeSlug`;
- `vote_type: best` удалён из frontend API;
- для обычного пользовательского голоса backend должен записывать `vote_type = user`;
- максимум моделей исправлен с `4` на `3`;
- максимум prompt зафиксирован как `8000`.

Канонический запрос `/api/compare`:

```json
{
  "prompt": "Сравни React и Vue для небольшого MVP",
  "modelIds": ["uuid-model-1", "uuid-model-2"],
  "modeSlug": "prompt-arena"
}
```

Канонический запрос `/api/vote`:

```json
{
  "taskId": "uuid-task",
  "responseId": "uuid-response"
}
```

Статус:

```text
Done
# файл синхронизирован
```

---

## 5. 15-changelog.md

Исправлено:

- удалены устаревшие Known Issues о том, что код проекта ещё не создан;
- удалено устаревшее утверждение, что Next.js ещё не инициализирован;
- добавлены актуальные изменения `v0.2` и `v0.3`;
- зафиксированы новые Known Issues: нет `package-lock.json`, нет локальной проверки, нет OpenRouter, Supabase и Vercel deploy;
- добавлены исправления документации после аудита.

Статус:

```text
Done
# файл синхронизирован
```

---

## 6. 16-decisions.md

Исправлено:

- удалено обязательное требование хранить документацию в `docs/`;
- зафиксировано, что текущая документация лежит в корне репозитория;
- добавлено решение про единый стиль имён API, TypeScript, базы и slug-ов;
- уточнено, что `docs/` можно создать позже, если документация станет слишком большой.

Каноническое решение:

```text
Документация проекта хранится в корне репозитория.
# текущая структура проекта

API JSON и TypeScript = camelCase.
# modelIds, taskId, responseId, modeSlug

Supabase PostgreSQL = snake_case.
# model_id, task_id, response_id, mode_slug

Mode slug = kebab-case.
# prompt-arena, code-arena, multi-model-battle
```

Статус:

```text
Done
# файл синхронизирован
```

---

# Что осталось перед v0.4

Документация по главным блокирующим пунктам синхронизирована.

Перед началом OpenRouter Integration всё ещё нужно выполнить локальную техническую проверку проекта:

```bash
npm install
# устанавливает зависимости и создаёт package-lock.json

npm run typecheck
# проверяет TypeScript

npm run lint
# проверяет ESLint

npm run build
# проверяет production-сборку

npm run dev
# запускает проект локально
```

---

# Что можно улучшить позже

Эти пункты не блокируют `v0.4`:

1. Перевести `12-security-and-env.md` на русский язык.
2. Добавить в `12-security-and-env.md` отдельный раздел с текущим `.env.example` для `v0.3-v0.4`.
3. Уточнить в `07-architecture.md` и `10-ui-pages.md` различие между local UI-vote и saved vote.
4. После `npm install` добавить `package-lock.json` в Git.

---

# Итог

Блокирующие противоречия документации устранены.

Теперь документация готова для перехода к `v0.4 - OpenRouter Integration`, но код проекта всё равно нужно сначала проверить локально через npm-команды.
