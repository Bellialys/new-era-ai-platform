# 26 - Code Fix Report

## Назначение файла

Этот файл фиксирует кодовые исправления после аудита `25-code-consistency-audit.md`.

Цель - закрыть главные расхождения между текущим `v0.3 - Static UI MVP` и будущим контрактом `v0.4 - OpenRouter Integration`.

---

# 1. Что исправлено в коде

## 1.1 Разделены API-response и UI-view response

Файл:

```text
src/types/arena.ts
# типы Prompt Arena
```

Добавлены типы:

```ts
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

Также временно оставлен alias:

```ts
export type ArenaResponse = ArenaResponseView;
```

Причина:

```text
Старые импорты ArenaResponse не ломают код сразу.
# можно постепенно заменить их на ArenaResponseView
```

---

## 1.2 Mock-ответы приведены к API-контракту

Файл:

```text
src/lib/arena/mock-responses.ts
# mock-генератор ответов
```

Исправлено:

```text
text -> answerText
# mock теперь ближе к будущему /api/compare

modelRole убран из mock response
# роль модели теперь не дублируется в API-like response

latencyMs сделан совместимым с опциональным API-полем
# при будущей ошибке модели latency может отсутствовать
```

---

## 1.3 PromptArena добавляет modelRole на клиенте

Файл:

```text
src/components/arena/prompt-arena.tsx
# контейнер Prompt Arena
```

Добавлено:

```text
buildResponseViews(apiResponses)
# превращает ArenaApiResponse в ArenaResponseView
```

Смысл:

```text
/api/compare возвращает только данные ответа.
# без modelRole

Frontend знает список моделей.
# role можно добавить по modelId
```

---

## 1.4 Добавлен лимит prompt 8000 символов

Файлы:

```text
src/components/arena/prompt-arena.tsx
src/components/arena/arena-form.tsx
```

Исправлено:

```text
MAX_PROMPT_LENGTH = 8000
# единый лимит из документации

validateForm проверяет верхнюю границу prompt.
# пользователь получает понятную ошибку

textarea получил maxLength.
# браузер ограничивает ввод
```

---

## 1.5 Убран дубль текста ошибки по количеству моделей

Файл:

```text
src/components/arena/prompt-arena.tsx
```

Добавлено:

```ts
const MAX_MODELS_ERROR_MESSAGE = "В MVP можно выбрать максимум три модели.";
```

Теперь для одного условия используется один текст ошибки.

---

## 1.6 Старые responses сбрасываются при изменении prompt или моделей

Файл:

```text
src/components/arena/prompt-arena.tsx
```

Добавлено:

```text
clearStaleResults()
# очищает responses, winnerResponseId и loading-состояние

requestIdRef
# защищает UI от устаревшего результата после setTimeout
```

Теперь если пользователь изменил prompt или список моделей после генерации, старые ответы исчезают и не остаются на экране как будто они относятся к новой задаче.

---

## 1.7 Карточка ответа использует answerText и errorMessage

Файл:

```text
src/components/arena/response-card.tsx
```

Исправлено:

```text
response.text больше не используется.
# старое поле убрано из рендера

response.answerText показывается при success.
# основной текст ответа модели

response.errorMessage показывается при error.
# пользователь видит причину ошибки модели

response.errorCode отображается отдельным badge.
# удобно для диагностики

Ошибка модели не может быть выбрана победителем.
# кнопка выбора отключается при status = error
```

---

# 2. Что осталось проверить локально

После pull из GitHub нужно выполнить:

```bash
npm install
# установить зависимости и создать package-lock.json

npm run typecheck
# проверить TypeScript

npm run lint
# проверить ESLint

npm run build
# проверить production-сборку
```

Если `package-lock.json` появился после `npm install`, его нужно добавить в Git:

```bash
git add package-lock.json
# добавить lock-файл зависимостей

git commit -m "chore: add package lock"
# зафиксировать точные версии зависимостей
```

---

# 3. Что не удалось сделать автоматически

`package-lock.json` не был создан через GitHub, потому что lock-файл должен формироваться npm по реальному registry-resolution.

Без точного `npm install` нельзя безопасно вручную угадать transitive dependencies.

Правильное решение:

```text
Создать package-lock.json локально через npm install.
# так lock-файл будет настоящим и воспроизводимым
```

---

# 4. Итог

Основные кодовые расхождения из `25-code-consistency-audit.md` закрыты:

```text
ArenaApiResponse и ArenaResponseView разделены.
# API и UI больше не смешиваются

Mock использует answerText.
# совпадает с 09-api-structure.md

modelRole добавляется на клиенте.
# не дублируется в API-like response

MAX_PROMPT_LENGTH=8000 применён в UI.
# лимит документации теперь есть в коде

Старые responses сбрасываются.
# UI не показывает устаревший результат

ResponseCard показывает answerText или errorMessage.
# success/error рендерятся корректно
```

Остался один внешний технический шаг:

```text
package-lock.json нужно создать локально и закоммитить.
# через npm install
```
