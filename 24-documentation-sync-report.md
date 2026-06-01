# 24 - Documentation Sync Report

## Назначение файла

Этот файл фиксирует результат синхронизации документации после углублённого аудита `23-documentation-audit-deep.md` и дополнительного аудита согласованности кода перед `v0.4`.

Синхронизация выполнена перед переходом к:

```text
v0.4 - OpenRouter Integration
# реальные ответы моделей через backend
```

---

# 1. Что было исправлено ранее

## 1.1 02-project-plan.md

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

## 1.2 04-mvp-scope.md

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

## 1.3 06-project-modes.md

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

## 1.4 09-api-structure.md

Исправлено и закреплено:

- API JSON использует `camelCase`;
- database naming использует `snake_case`;
- `prompt_arena` заменён на `prompt-arena`;
- `model_ids` заменено на `modelIds`;
- `task_id` заменено на `taskId`;
- `response_id` заменено на `responseId`;
- `mode` заменено на `modeSlug`;
- `vote_type: best` удалён из frontend API;
- для обычного пользовательского голоса backend должен записывать `vote_type = user`;
- максимум моделей исправлен с `4` на `3`;
- максимум prompt зафиксирован как `8000`;
- `/api/compare` использует `answerText`, а не `text`;
- ошибки отдельных моделей возвращаются через `errorCode` и `errorMessage`.

Канонический запрос `/api/compare`:

```json
{
  "prompt": "Сравни React и Vue для небольшого MVP",
  "modelIds": ["uuid-model-1", "uuid-model-2"],
  "modeSlug": "prompt-arena"
}
```

Канонический ответ `/api/compare`:

```json
{
  "success": true,
  "data": {
    "task": {
      "id": "uuid-task",
      "modeSlug": "prompt-arena",
      "promptText": "Сравни React и Vue для небольшого MVP"
    },
    "responses": [
      {
        "id": "uuid-response-1",
        "modelId": "uuid-model-1",
        "modelName": "Model A",
        "status": "success",
        "answerText": "React лучше подходит...",
        "latencyMs": 4200
      },
      {
        "id": "uuid-response-2",
        "modelId": "uuid-model-2",
        "modelName": "Model B",
        "status": "error",
        "answerText": null,
        "errorCode": "MODEL_TIMEOUT",
        "errorMessage": "Модель не успела ответить."
      }
    ]
  }
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

## 1.5 16-decisions.md

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

# 2. Что исправлено после аудита кода

## 2.1 README.md

Исправлено:

- добавлен `25-code-consistency-audit.md` в список документации;
- обновлено текущее состояние проекта;
- добавлено напоминание, что `package-lock.json` создан локально, но ещё не закоммичен;
- закреплён канонический контракт `/api/compare`;
- уточнено, что `answerText` является API-полем, а `text` - временным старым UI/mock-полем;
- уточнено, что `modelRole` относится к UI-представлению и не должен дублироваться в API-ответе.

Статус:

```text
Done
# GitHub README обновлён
```

---

## 2.2 00-readme.md

Исправлено:

- убрано устаревшее указание, что документация хранится в папке `docs/`;
- закреплена текущая структура документации в корне репозитория;
- структура проекта приведена к текущему виду `src/app`, `src/components`, `src/lib`, `src/types`;
- добавлен раздел с каноническим контрактом `/api/compare`;
- добавлен раздел текущего состояния `v0.3 - Static UI MVP`;
- добавлены ограничения перед `v0.4`.

Статус:

```text
Done
# главный файл документации обновлён
```

---

## 2.3 12-security-and-env.md

Исправлено:

- файл приведён к русскоязычному стилю проекта;
- убрана старая структура `docs/`;
- добавлена текущая структура `new-era-ai-platform/`, `.env.local`, `.env.example`, `package.json`, `package-lock.json`, `src/`;
- добавлены правила для `package-lock.json`;
- добавлены правила для `.env.example`;
- добавлены лимиты `MIN_PROMPT_LENGTH`, `MAX_PROMPT_LENGTH`, `MAX_MODELS_PER_COMPARE`;
- уточнены server-side правила для OpenRouter и Supabase;
- добавлены проверки перед commit и push.

Статус:

```text
Done
# security/env документация обновлена
```

---

## 2.4 15-changelog.md

Исправлено:

- добавлен `25-code-consistency-audit.md`;
- обновлены изменения после аудита кода;
- добавлены Known Issues по `package-lock.json`, `answerText`, `modelRole`, `errorCode`, `errorMessage`, `MAX_PROMPT_LENGTH` и устаревшим responses;
- уточнено различие между `ArenaApiResponse` и `ArenaResponseView`.

Статус:

```text
Done
# changelog обновлён
```

---

## 2.5 25-code-consistency-audit.md

Добавлен новый файл аудита.

Он фиксирует:

- текущее зелёное состояние проверок;
- отсутствие `package-lock.json` в GitHub;
- расхождение `text` против `answerText`;
- проблему `modelRole` в API-response;
- отсутствие `errorCode` и `errorMessage` в текущем response-типе;
- необходимость `MAX_PROMPT_LENGTH=8000` в UI;
- необходимость единого текста ошибки для выбора моделей;
- необходимость сброса старых responses при изменении prompt или выбранных моделей;
- рекомендуемый порядок исправления кода перед `v0.4`.

Статус:

```text
Done
# новый аудит добавлен
```

---

# 3. Текущее состояние после синхронизации

Проект находится на этапе:

```text
v0.3 - Static UI MVP
# интерфейс Prompt Arena работает на mock-данных
```

По проверке:

```text
npm run typecheck
# 0 ошибок

npm run lint
# чисто

npm run build
# сборка проходит
```

Но перед `v0.4` нужно закрыть технические долги:

```text
package-lock.json отсутствует в GitHub.
# нужно закоммитить lock-файл

ArenaResponse использует text.
# нужно перейти на answerText

ArenaResponse содержит modelRole.
# API не должен дублировать роль модели

Нет errorCode и errorMessage.
# ошибки моделей нужно отображать явно

MAX_PROMPT_LENGTH=8000 не применён в UI.
# нужно добавить верхний лимит в textarea и validateForm

Старые responses не сбрасываются при изменении prompt или моделей.
# нужно убрать рассинхрон UI-состояния
```

---

# 4. Что осталось перед v0.4

Документация по главным блокирующим пунктам синхронизирована.

Перед началом OpenRouter Integration нужно выполнить кодовые исправления:

```text
1. Добавить package-lock.json в GitHub.
# зафиксировать версии зависимостей

2. Разделить ArenaApiResponse и ArenaResponseView.
# привести код к контракту 09-api-structure.md

3. Перевести mock-responses.ts на answerText.
# mock должен имитировать будущий backend

4. Обновить response-card.tsx для success/error.
# карточка должна показывать answerText или errorMessage

5. Добавить MAX_PROMPT_LENGTH=8000 в UI.
# документация и код должны совпадать

6. Сбрасывать старые responses при изменении prompt или моделей.
# UI не должен показывать устаревший результат

7. Прогнать проверки.
# typecheck, lint, build должны остаться зелёными
```

Команды проверки:

```bash
npm run typecheck
# проверить TypeScript

npm run lint
# проверить ESLint

npm run build
# проверить production-сборку
```

---

# 5. Итог

Блокирующие противоречия документации устранены.

Главное архитектурное решение перед `v0.4`:

```text
09-api-structure.md остаётся источником истины для API.
# код нужно привести к документации

/api/compare возвращает answerText, errorCode, errorMessage.
# это будущий backend-контракт

modelRole добавляется на клиенте по modelId.
# роль модели не дублируется в API-ответе

package-lock.json нужно закоммитить.
# версии зависимостей должны быть зафиксированы
```
