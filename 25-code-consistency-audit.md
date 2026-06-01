# 25 - Code Consistency Audit

## Назначение файла

Этот файл фиксирует исторический аудит согласованности кода и документации, выполненный перед исправлениями из `26-code-fix-report.md`.

Важно:

```text
Этот файл описывает найденные проблемы на момент аудита.
# не все пункты в этом файле остаются актуальными после исправлений

Актуальный результат исправлений смотри в 26-code-fix-report.md.
# там зафиксировано, что было закрыто в коде
```

Главный источник порядка версий - `14-roadmap.md`.

Главный источник API-контракта - `09-api-structure.md`.

---

# 1. Состояние на момент аудита

На момент аудита проект находился на этапе:

```text
v0.3 - Static UI MVP
# интерфейс Prompt Arena работал на mock-данных
```

Локальные проверки на тот момент проходили:

```text
npm run typecheck
# 0 ошибок

npm run lint
# чисто

npm run build
# сборка проходила
```

Ограничение, которое остаётся актуальным:

```text
package-lock.json отсутствует в GitHub.
# нужно создать локально через npm install и закоммитить
```

---

# 2. Что было найдено на момент аудита

Были найдены расхождения между старым UI/mock-типом и будущим API-контрактом:

| Смысл | Было в старом коде | Нужно по API-контракту |
|---|---|---|
| Текст ответа | `text` | `answerText` |
| Роль модели | `modelRole` внутри response | Не возвращать из `/api/compare` |
| Ошибка модели | Нет `errorCode`, `errorMessage` | Есть `errorCode`, `errorMessage` |
| Текст при ошибке | Невозможно описать корректно | `answerText: null` |
| `latencyMs` | Обязательное поле | Опциональное поле |

Также были найдены UI-проблемы:

```text
MAX_PROMPT_LENGTH=8000 не был применён в UI.
# документация и код расходились

Были два текста ошибки для одного лимита моделей.
# UX был непоследовательным

Старые responses могли оставаться после изменения prompt или моделей.
# UI мог показывать устаревший результат
```

---

# 3. Рекомендованное решение

Аудит рекомендовал разделить два слоя:

```text
ArenaApiResponse
# то, что приходит от /api/compare

ArenaResponseView
# то, что рисует UI после добавления modelRole
```

Рекомендованный контракт:

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

---

# 4. Что было исправлено после аудита

После этого аудита был создан `26-code-fix-report.md`.

В коде исправлено:

```text
ArenaApiResponse и ArenaResponseView разделены.
# API и UI больше не смешиваются

Mock-ответы используют answerText.
# mock ближе к будущему backend-контракту

modelRole добавляется на клиенте по modelId.
# роль модели не дублируется в API-like response

MAX_PROMPT_LENGTH=8000 применён в UI.
# textarea ограничивает ввод, validateForm проверяет верхнюю границу

Старые responses сбрасываются при изменении prompt или моделей.
# UI не показывает устаревший результат

ResponseCard показывает answerText или errorMessage.
# success/error отображаются корректно
```

---

# 5. Что остаётся актуальным

После исправлений актуальными остаются только эти пункты:

```text
Создать package-lock.json локально через npm install.
# lock-файл нельзя безопасно угадать вручную

Прогнать локальные проверки после pull.
# npm run typecheck, npm run lint, npm run build

Начать v0.4 backend integration после зелёной проверки.
# подключение реального /api/compare
```

---

# 6. Итог

Этот файл нужен как след аудита и объяснение, почему были внесены исправления.

Актуальное состояние после исправлений находится в:

```text
26-code-fix-report.md
# отчёт исправлений кода

15-changelog.md
# актуальный changelog

README.md
# текущий статус репозитория
```
