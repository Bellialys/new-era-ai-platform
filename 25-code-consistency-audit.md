# 25 - Code Consistency Audit

## Назначение файла

Этот файл фиксирует аудит согласованности кода и документации перед переходом к этапу:

```text
v0.4 - OpenRouter Integration
# реальные ответы моделей через backend API
```

Цель аудита - найти расхождения, которые не ломают текущий Static UI MVP, но могут создать проблемы при замене mock-логики на реальный backend.

Главный источник порядка версий - `14-roadmap.md`.

Главный источник API-контракта - `09-api-structure.md`.

---

# 1. Текущее состояние проверки

По локальному прогону проекта:

```text
npm run typecheck
# 0 ошибок

npm run lint
# чисто

npm run build
# сборка проходит, предупреждение про переписывание tsconfig исчезло
```

Вывод:

```text
v0.3 - Static UI MVP технически зелёный.
# текущий интерфейс работает на mock-данных
```

Ограничение:

```text
package-lock.json создан локально, но отсутствует в GitHub.
# нужно закоммитить lock-файл после npm install
```

---

# 2. Главная найденная проблема

Главная проблема - расхождение между TypeScript-типом ответа в коде и API-контрактом в документации.

Сейчас код использует UI/mock-тип:

```ts
export type ArenaResponse = {
  id: string;
  modelId: string;
  modelName: string;
  modelRole: string;
  status: ArenaResponseStatus;
  text: string;
  latencyMs: number;
};
```

Но `09-api-structure.md` для `/api/compare` описывает другой контракт:

```json
{
  "id": "uuid-response-1",
  "modelId": "uuid-model-1",
  "modelName": "Model A",
  "status": "success",
  "answerText": "React лучше подходит...",
  "latencyMs": 4200
}
```

Для ошибки документация ожидает:

```json
{
  "id": "uuid-response-2",
  "modelId": "uuid-model-2",
  "modelName": "Model B",
  "status": "error",
  "answerText": null,
  "errorCode": "MODEL_TIMEOUT",
  "errorMessage": "Модель не успела ответить."
}
```

---

# 3. Сравнение контракта

| Смысл | Текущий код | Канонический API-контракт |
|---|---|---|
| Текст ответа | `text` | `answerText` |
| Роль модели | `modelRole` внутри response | Не возвращать из `/api/compare` |
| Ошибка модели | Нет `errorCode`, `errorMessage` | Есть `errorCode`, `errorMessage` |
| Текст при ошибке | Невозможно описать корректно | `answerText: null` |
| `latencyMs` | Обязательное поле | Опциональное поле |

Вывод:

```text
09-api-structure.md правильнее кода для будущего v0.4.
# backend-контракт уже описан ближе к реальной архитектуре
```

Код нужно привести к документации, а не документацию к старому mock-типу.

---

# 4. Правильное архитектурное решение

Нужно разделить два слоя:

```text
ArenaApiResponse
# то, что приходит от /api/compare

ArenaResponseView
# то, что рисует UI после обогащения данными модели
```

Рекомендуемый тип:

```ts
export type ArenaResponseStatus = "success" | "error";

export type ArenaApiResponse = {
  id: string;
  modelId: string;
  modelName: string;
  status: ArenaResponseStatus;
  answerText: string | null;
  latencyMs?: number;
  errorCode?: string;
  errorMessage?: string;
};

export type ArenaResponseView = ArenaApiResponse & {
  modelRole: string;
};
```

Почему так правильно:

- API не дублирует `modelRole`, потому что роль уже известна клиенту по `modelId`;
- backend может вернуть ошибку модели без пустой карточки;
- UI может показывать `answerText ?? errorMessage`;
- переход на `v0.4` становится проще: mock-вызов заменяется на `fetch`, а не переписывается весь UI;
- `09-api-structure.md` остаётся источником истины для API.

---

# 5. Что нужно исправить в коде перед v0.4

## 5.1 Типы Prompt Arena

Файл:

```text
src/types/arena.ts
# типы Prompt Arena
```

Нужно:

```text
ArenaResponse -> разделить на ArenaApiResponse и ArenaResponseView.
# API и UI не должны быть одним типом
```

---

## 5.2 Mock-генератор ответов

Файл:

```text
src/lib/arena/mock-responses.ts
# генератор mock-ответов
```

Нужно:

```text
text -> answerText
# привести mock к будущему API-контракту

modelRole убрать из API-response
# добавлять роль на клиенте по modelId

latencyMs сделать необязательным в типе
# при ошибке latency может отсутствовать
```

---

## 5.3 Response card

Файл:

```text
src/components/arena/response-card.tsx
# карточка ответа модели
```

Нужно:

```text
Показывать answerText при status = success.
# обычный успешный ответ

Показывать errorMessage при status = error.
# пользователь видит причину ошибки модели

Не показывать пустую карточку при ошибке.
# это важно для частичной успешности compare-запроса
```

---

## 5.4 Лимит prompt

Сейчас в документации и `.env.example` закреплено:

```text
MAX_PROMPT_LENGTH = 8000
# максимальная длина prompt для MVP
```

Но UI должен реально использовать этот лимит.

Файл:

```text
src/components/arena/prompt-arena.tsx
# форма Prompt Arena
```

Нужно:

```text
Добавить MAX_PROMPT_LENGTH = 8000.
# единая константа лимита

Добавить textarea maxLength={MAX_PROMPT_LENGTH}.
# браузер ограничит ввод

Добавить проверку в validateForm.
# защита UI-логики
```

Backend всё равно обязан повторно проверять лимит с `v0.4`.

---

## 5.5 Единый текст ошибки выбора моделей

Сейчас для одного условия используются два похожих текста:

```text
"В Static UI MVP можно выбрать максимум три модели."
# один вариант

"В MVP можно выбрать максимум три модели."
# второй вариант
```

Нужно вынести единый текст в константу:

```ts
const MAX_MODELS_ERROR_MESSAGE = "В MVP можно выбрать максимум три модели.";
```

Причина:

```text
Одна ошибка - один текст.
# UX должен быть предсказуемым
```

---

## 5.6 Сброс устаревших ответов

Проблема:

```text
Пользователь получил responses.
# на экране есть старые ответы

Потом изменил prompt или список моделей.
# старые responses могут остаться на экране

UI показывает результат от старого запроса.
# возникает рассинхрон состояния
```

Нужно:

```text
При изменении prompt сбрасывать responses и winnerResponseId.
# старый результат больше не относится к новой задаче

При изменении selectedModels сбрасывать responses и winnerResponseId.
# старый результат больше не относится к новому набору моделей
```

---

# 6. Что нужно исправить в Git

После локального `npm install` нужно добавить lock-файл:

```bash
git add package-lock.json
# добавить lock-файл зависимостей

git commit -m "chore: add package lock"
# зафиксировать точные версии зависимостей
```

Причина:

```text
Без package-lock.json версии зависимостей не зафиксированы полностью.
# npm install у другого разработчика может поставить отличающиеся версии
```

---

# 7. Что не является блокером

Не блокирует переход к исправлению кода:

```text
OpenRouter ещё не подключён.
# это задача v0.4

Supabase ещё не подключён.
# это задача v0.5

Vercel deploy ещё не выполнен.
# это задача v0.8

Leaderboard, Judge Mode, Code Arena Runner и AI Team Mode не реализованы.
# это будущие этапы по roadmap
```

---

# 8. Рекомендуемый порядок исправления

Правильный порядок:

```text
1. Закоммитить package-lock.json.
# зафиксировать зависимости

2. Исправить типы ArenaApiResponse и ArenaResponseView.
# убрать главный будущий конфликт API/UI

3. Перевести mock-responses.ts на answerText.
# mock будет имитировать будущий backend

4. Обновить response-card.tsx.
# карточка будет показывать success и error корректно

5. Добавить MAX_PROMPT_LENGTH в UI.
# документация и код совпадут

6. Вынести единый текст ошибки выбора моделей.
# убрать дубль текста

7. Сбрасывать responses при изменении prompt или моделей.
# убрать устаревший результат на экране

8. Прогнать npm run typecheck, npm run lint, npm run build.
# убедиться, что проект остался зелёным
```

---

# 9. Критерии готовности после исправления

Исправление считается готовым, если:

```text
src/types/arena.ts содержит ArenaApiResponse и ArenaResponseView.
# API и UI слои разделены

mock-responses.ts возвращает answerText.
# mock совпадает с 09-api-structure.md

response-card.tsx показывает errorMessage при status = error.
# частичная ошибка модели отображается нормально

prompt-arena.tsx ограничивает prompt до 8000 символов.
# MAX_PROMPT_LENGTH реально работает

При изменении prompt или моделей старые responses исчезают.
# UI не показывает устаревшие данные

package-lock.json есть в GitHub.
# зависимости зафиксированы

npm run typecheck проходит.
# TypeScript чистый

npm run lint проходит.
# lint чистый

npm run build проходит.
# production-сборка чистая
```

---

# 10. Итог

Проект на `v0.3` уже технически зелёный, но перед `v0.4` нужно устранить несколько важных расхождений.

Самое важное решение:

```text
09-api-structure.md остаётся источником истины.
# код нужно привести к контракту документации

text заменить на answerText.
# будущий backend должен совпасть с frontend-типами

modelRole не возвращать из /api/compare.
# UI добавляет роль модели сам по modelId

errorCode и errorMessage добавить в API-тип.
# ошибки моделей будут отображаться корректно
```
