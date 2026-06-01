# 22 - Documentation Audit

## Назначение файла

Этот файл фиксирует проверку документации проекта **Новая эпоха** после выполнения этапов:

```text
v0.2 - Next.js Base
# создана базовая структура Next.js

v0.3 - Static UI MVP
# создан интерактивный mock-интерфейс Prompt Arena
```

Цель проверки - найти противоречия между документацией, roadmap, базой данных, API и фактическим состоянием репозитория.

---

# Общий вывод

Документация в целом достаточно полная и уже хорошо описывает идею проекта, MVP, roadmap, архитектуру, базу данных, API, безопасность и будущие режимы.

Но после добавления реального кода v0.2-v0.3 появились места, которые нужно синхронизировать.

Главные проблемы:

1. `02-project-plan.md` частично использует старую нумерацию версий.
2. `09-api-structure.md` конфликтует с `08-database.md` по `vote_type`.
3. `09-api-structure.md` использует API-поля в `snake_case`, хотя для frontend удобнее и уже ранее было решено использовать `taskId`, `responseId`, `modelIds`.
4. `04-mvp-scope.md` указывает лимит prompt 4000 символов, а `.env.example` и `08-database.md` используют 8000.
5. Нужно явно разделить локальный UI-выбор победителя в `v0.3` и сохранение голоса в `v0.6`.
6. `16-decisions.md` говорит про папку `docs/`, хотя документация фактически лежит в корне репозитория.
7. Часть документации на русском, а `12-security-and-env.md` написан на английском. Это не ломает логику, но ухудшает единый стиль проекта.

---

# Проверенные файлы

Проверены ключевые документы:

- `README.md`;
- `02-project-plan.md`;
- `04-mvp-scope.md`;
- `08-database.md`;
- `09-api-structure.md`;
- `10-ui-pages.md`;
- `12-security-and-env.md`;
- `13-deployment.md`;
- `14-roadmap.md`;
- `16-decisions.md`;
- `19-development-checklist.md`;
- `20-stage-2-verification.md`;
- `21-stage-3-verification.md`.

---

# Что согласовано хорошо

## README.md

`README.md` уже правильно показывает текущее состояние:

```text
v0.3 - Static UI MVP
# текущий этап проекта
```

В README указано, что уже есть:

- `package.json`;
- базовая конфигурация Next.js;
- интерактивная страница `/arena`;
- mock-данные моделей;
- mock-генератор ответов;
- client-side состояние Prompt Arena;
- валидация prompt и выбора моделей;
- loading, empty, error и success-состояния;
- UI-выбор победителя.

## 14-roadmap.md

`14-roadmap.md` остаётся главным источником порядка разработки.

Канонический порядок правильный:

```text
v0.1 - Project Documentation
v0.2 - Next.js Base
v0.3 - UI MVP
v0.4 - OpenRouter Integration
v0.5 - Supabase Integration
v0.6 - Voting MVP
v0.7 - History MVP
v0.8 - First Deploy
v0.9 - MVP Stabilization
v1.0 - Stable Prompt Arena
```

## 13-deployment.md

`13-deployment.md` хорошо согласован с roadmap и правильно запрещает production deploy до локальной проверки, build, commit, push и готовых env-переменных.

---

# Найденные проблемы

## DOC-01 - Старый порядок версий в 02-project-plan.md

### Проблема

`02-project-plan.md` содержит старый порядок:

```text
v0.0 - документация и структура проекта
v0.1 - создание Next.js проекта
v0.2 - базовая структура страниц и компонентов
v0.3 - UI MVP
```

Это конфликтует с `14-roadmap.md`, где порядок такой:

```text
v0.1 - Project Documentation
v0.2 - Next.js Base
v0.3 - UI MVP
```

### Риск

Будущий разработчик может начать считать `02-project-plan.md` вторым roadmap и ошибиться в версиях.

### Что исправить

Переписать раздел `Канонический порядок разработки` в `02-project-plan.md` по `14-roadmap.md`.

Также лучше переименовать фазы:

```text
Фаза 1 - Project Documentation / v0.1
Фаза 2 - Next.js Base / v0.2
Фаза 3 - Static UI MVP / v0.3
Фаза 4 - OpenRouter Integration / v0.4
```

---

## DOC-02 - Конфликт vote_type между API и базой

### Проблема

`08-database.md` задаёт значения `votes.vote_type`:

```text
user
judge
system
```

Но `09-api-structure.md` показывает запрос:

```json
{
  "task_id": "uuid-task",
  "response_id": "uuid-response",
  "vote_type": "best"
}
```

`best` не входит в разрешённые значения базы.

### Риск

Если реализовать API по `09-api-structure.md`, insert в Supabase упадёт из-за check constraint.

### Что исправить

Для MVP сделать так:

```json
{
  "taskId": "uuid-task",
  "responseId": "uuid-response"
}
```

А на backend выставлять:

```text
vote_type = user
# обычный голос пользователя
```

Если позже нужен другой тип голоса, использовать:

```text
judge
# выбор модели-судьи

system
# системный выбор
```

---

## DOC-03 - API-поля snake_case вместо frontend camelCase

### Проблема

В `09-api-structure.md` для API body используются поля:

```text
task_id
response_id
model_ids
```

Для frontend/TypeScript удобнее и уже логически принято использовать:

```text
taskId
responseId
modelIds
```

При этом база данных должна оставаться в `snake_case`:

```text
task_id
response_id
selected_models
```

### Риск

Смешивание API naming и DB naming приведёт к путанице в route handlers.

### Что исправить

Зафиксировать правило:

```text
Frontend/API JSON: camelCase
# taskId, responseId, modelIds, modeSlug

Database/PostgreSQL: snake_case
# task_id, response_id, selected_models, mode_slug
```

---

## DOC-04 - mode в API отличается от mode_slug в базе

### Проблема

В `09-api-structure.md` пример `/api/compare` использует:

```json
{
  "mode": "prompt_arena"
}
```

А `08-database.md` использует:

```text
mode_slug = prompt-arena
```

### Риск

Можно случайно создать разные значения режима:

```text
prompt_arena
prompt-arena
Prompt Arena
```

### Что исправить

Использовать единый slug:

```text
prompt-arena
```

API body:

```json
{
  "modeSlug": "prompt-arena"
}
```

DB field:

```text
mode_slug = prompt-arena
```

---

## DOC-05 - Лимит prompt 4000 против 8000

### Проблема

`04-mvp-scope.md` рекомендует:

```text
Максимум: 4000 символов
```

Но `.env.example` использует:

```text
MAX_PROMPT_LENGTH=8000
```

И `08-database.md` проверяет:

```sql
char_length(prompt_text) between 3 and 8000
```

### Риск

Frontend, backend и база будут иметь разные лимиты.

### Что исправить

Сделать единый лимит для MVP:

```text
MIN_PROMPT_LENGTH = 3
MAX_PROMPT_LENGTH = 8000
MAX_MODELS_PER_COMPARE = 3
```

И синхронизировать:

- `.env.example`;
- `04-mvp-scope.md`;
- `08-database.md`;
- frontend validation;
- future backend validation.

---

## DOC-06 - Нужно разделить UI-выбор победителя и сохранение голоса

### Проблема

В `v0.3` уже реализован UI-выбор победителя на странице `/arena`.

Но по roadmap `v0.6 - Voting MVP` отвечает за полноценное голосование.

### Правильная логика

```text
v0.3 - Static UI MVP
# пользователь может визуально выбрать победителя только в состоянии страницы
# выбор не сохраняется в Supabase

v0.6 - Voting MVP
# выбор сохраняется через /api/vote в таблицу votes
```

### Что исправить

Уточнить это в:

- `04-mvp-scope.md`;
- `10-ui-pages.md`;
- `21-stage-3-verification.md`, если нужно более строго.

---

## DOC-07 - 16-decisions.md говорит про docs/, но документы лежат в корне

### Проблема

`16-decisions.md` фиксирует:

```text
docs/
# папка документации проекта
```

Но фактически документы проекта лежат в корне репозитория:

```text
00-readme.md
01-idea.md
02-project-plan.md
...
22-documentation-audit.md
```

### Риск

Позже можно случайно начать переносить документы в `docs/`, хотя текущая структура уже выбрана иначе.

### Что исправить

В `16-decisions.md` заменить решение на:

```text
Документация проекта хранится в корне репозитория в Markdown-файлах с числовым префиксом.
```

И добавить:

```text
docs/ можно создать позже, если документация станет слишком большой.
```

---

## DOC-08 - 12-security-and-env.md написан на английском

### Проблема

Большинство документации на русском, но `12-security-and-env.md` написан на английском.

### Риск

Это не техническая ошибка, но снижает единый стиль проекта.

### Что исправить

Есть два варианта:

1. Оставить английский как технический security-документ.
2. Перевести на русский, чтобы весь проект был в одном стиле.

Рекомендация: перевести позже, не блокировать v0.4.

---

# Приоритет исправлений

## Срочно перед v0.4

1. Исправить `02-project-plan.md` по `14-roadmap.md`.
2. Исправить `09-api-structure.md`:
   - `vote_type: best` убрать;
   - использовать `taskId`, `responseId`, `modelIds`, `modeSlug`;
   - использовать `prompt-arena`, а не `prompt_arena`.
3. Исправить лимит prompt в `04-mvp-scope.md` на 8000.
4. Исправить `16-decisions.md`, чтобы он не требовал папку `docs/`.

## Можно после v0.4

1. Перевести `12-security-and-env.md` на русский.
2. Сделать документацию короче и убрать дубли между файлами.
3. Добавить отдельную таблицу соответствия версий и файлов.

---

# Рекомендуемые канонические правила

## Названия API JSON

```text
camelCase
# для frontend и API JSON
```

Примеры:

```text
taskId
responseId
modelIds
modeSlug
voteType
```

## Названия PostgreSQL

```text
snake_case
# для Supabase PostgreSQL
```

Примеры:

```text
task_id
response_id
selected_models
mode_slug
vote_type
```

## Slug режима Prompt Arena

```text
prompt-arena
# единый mode slug для API и базы
```

## Тип голоса пользователя

```text
user
# обычный пользовательский голос в таблице votes
```

## Выбор победителя

```text
v0.3
# только UI-состояние, не сохраняется

v0.6
# сохраняется через /api/vote в Supabase
```

---

# Итог

Документация пригодна для продолжения разработки, но перед этапом `v0.4 - OpenRouter Integration` нужно синхронизировать 4 файла:

```text
02-project-plan.md
# исправить порядок версий

04-mvp-scope.md
# исправить лимит prompt и уточнить UI-vote vs saved vote

09-api-structure.md
# исправить API naming, modeSlug и vote_type

16-decisions.md
# исправить решение про docs/
```

После этих правок документация будет достаточно согласованной для перехода к OpenRouter Integration.
