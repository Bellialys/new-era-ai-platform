# 23 - Deep Documentation Audit

## Назначение файла

Этот файл фиксирует повторную углублённую проверку документации проекта **Новая эпоха** после этапов:

```text
v0.2 - Next.js Base
# базовая структура Next.js уже создана

v0.3 - Static UI MVP
# интерактивная Prompt Arena уже создана на mock-данных
```

Проверка нужна перед переходом к:

```text
v0.4 - OpenRouter Integration
# реальные ответы моделей через backend
```

---

# Короткий вывод

После второй проверки подтверждено: переходить к `v0.4 - OpenRouter Integration` можно только после синхронизации документации.

Причина: несколько файлов всё ещё содержат старые версии, старые slug-и, старый формат API-полей или устаревшее состояние проекта.

---

# Что уже согласовано хорошо

## README.md

README актуален и правильно показывает текущее состояние:

```text
v0.3 - Static UI MVP
# текущий этап проекта
```

README правильно перечисляет, что уже есть:

- `package.json`;
- базовая конфигурация Next.js;
- интерактивная страница `/arena`;
- mock-данные моделей;
- mock-генератор ответов;
- client-side состояние Prompt Arena;
- валидация prompt и выбора моделей;
- loading, empty, error и success-состояния;
- UI-выбор победителя.

## 03-tools-and-sites.md

Файл хорошо согласован с roadmap:

```text
v0.1 - документация
v0.2 - Next.js
v0.3 - UI MVP
v0.4 - OpenRouter
v0.5 - Supabase
v0.6 - голосование
v0.7 - история
v0.8 - деплой
```

## 05-user-roles.md

Файл логически нормальный:

- роли не перегружают MVP;
- гость используется до авторизации;
- полноценные accounts появляются в `v1.5`;
- Admin Panel появляется в `v1.6`;
- Code Runner только в `v1.7`.

## 13-deployment.md

Файл хорошо согласован с roadmap и правильно запрещает production deploy до локальной проверки.

## 17-code-arena-spec.md

Файл правильно разделяет:

```text
v1.1 - Code Arena Lite
# без запуска чужого кода

v1.7 - Code Arena Runner
# sandbox, тесты, лимиты
```

## 18-team-mode-spec.md

Файл правильно фиксирует, что AI Team Mode начинается только с `v2.0`.

---

# Найденные проблемы после повторной проверки

## DOC-01 - 02-project-plan.md использует старую нумерацию версий

### Где проблема

`02-project-plan.md` содержит старую схему:

```text
v0.0 - документация и структура проекта
v0.1 - создание Next.js проекта
v0.2 - базовая структура страниц и компонентов
v0.3 - UI MVP без реальных AI-запросов
```

### Почему это плохо

Главный roadmap уже другой:

```text
v0.1 - Project Documentation
v0.2 - Next.js Base
v0.3 - UI MVP
v0.4 - OpenRouter Integration
```

### Что сделать

Переписать `02-project-plan.md`, чтобы он не был вторым roadmap и не использовал `v0.0`.

---

## DOC-02 - 06-project-modes.md использует старые mode slug

### Где проблема

В `06-project-modes.md` есть TypeScript-тип:

```ts
type TaskMode =
  | "prompt_arena"
  | "code_arena_lite"
  | "multi_model_battle"
  | "judge_mode"
  | "leaderboard"
  | "code_arena_runner"
  | "ai_team_mode";
```

### Почему это плохо

В `08-database.md` уже используется другой стиль:

```text
prompt-arena
code-arena
multi-model-battle
judge-mode
ai-team-mode
```

Для проекта лучше закрепить единый slug-стиль:

```text
kebab-case
# prompt-arena, code-arena, multi-model-battle
```

### Что сделать

В `06-project-modes.md` заменить slug-и:

```ts
type ModeSlug =
  | "prompt-arena"
  | "code-arena"
  | "multi-model-battle"
  | "judge-mode"
  | "leaderboard"
  | "code-arena-runner"
  | "ai-team-mode";
```

---

## DOC-03 - 06-project-modes.md смешивает TypeScript и database naming

### Где проблема

В `06-project-modes.md` TypeScript-пример использует поля:

```ts
type BaseTask = {
  id: string;
  mode: TaskMode;
  prompt_text: string;
  selected_model_ids: string[];
  created_at: string;
};
```

А `ModelResponse` использует:

```ts
task_id
model_id
error_message
latency_ms
created_at
```

### Почему это плохо

Для TypeScript/frontend/API лучше использовать `camelCase`, а для Supabase/PostgreSQL - `snake_case`.

### Что сделать

В TypeScript-примерах использовать:

```ts
type BaseTask = {
  id: string;
  modeSlug: ModeSlug;
  promptText: string;
  selectedModelIds: string[];
  createdAt: string;
};
```

А для базы оставить:

```text
mode_slug
prompt_text
selected_models
task_id
model_id
created_at
```

---

## DOC-04 - 09-api-structure.md использует snake_case в JSON API

### Где проблема

В API-примерах используются:

```text
model_ids
task_id
response_id
vote_type
```

### Почему это плохо

Frontend и API route handlers в Next.js удобнее писать в `camelCase`.

### Что сделать

Закрепить правило:

```text
API JSON: camelCase
Database SQL: snake_case
```

API body должен быть таким:

```json
{
  "prompt": "Сравни React и Vue для небольшого MVP",
  "modelIds": ["uuid-model-1", "uuid-model-2"],
  "modeSlug": "prompt-arena"
}
```

---

## DOC-05 - 09-api-structure.md использует `prompt_arena`, а база использует `prompt-arena`

### Где проблема

В API пример:

```json
{
  "mode": "prompt_arena"
}
```

В базе:

```text
mode_slug = prompt-arena
```

### Что сделать

Использовать везде:

```text
prompt-arena
```

И поле API:

```text
modeSlug
```

---

## DOC-06 - 09-api-structure.md конфликтует с 08-database.md по vote_type

### Где проблема

`09-api-structure.md` показывает:

```json
{
  "vote_type": "best"
}
```

Но `08-database.md` разрешает только:

```text
user
judge
system
```

### Почему это критично

Если API отправит `best`, Supabase check constraint отклонит запись.

### Что сделать

Для MVP API body должен быть:

```json
{
  "taskId": "uuid-task",
  "responseId": "uuid-response"
}
```

Backend сам записывает:

```text
vote_type = user
```

---

## DOC-07 - 09-api-structure.md разрешает максимум 4 модели, а MVP и env говорят 3

### Где проблема

`09-api-structure.md` говорит:

```text
model_ids - максимум 4 модели для MVP
```

Но `.env.example` и другие документы задают:

```text
MAX_MODELS_PER_COMPARE=3
```

### Что сделать

Везде использовать:

```text
MAX_MODELS_PER_COMPARE = 3
```

---

## DOC-08 - 04-mvp-scope.md использует лимит prompt 4000, а env/database используют 8000

### Где проблема

`04-mvp-scope.md`:

```text
Максимум: 4000 символов
```

`.env.example`:

```text
MAX_PROMPT_LENGTH=8000
```

`08-database.md`:

```sql
char_length(prompt_text) between 3 and 8000
```

### Что сделать

Везде использовать:

```text
MIN_PROMPT_LENGTH = 3
MAX_PROMPT_LENGTH = 8000
```

---

## DOC-09 - Нужно чётче разделить UI-vote и saved-vote

### Где проблема

В `v0.3` уже есть визуальный выбор победителя на странице `/arena`.

Но полноценный Voting MVP по roadmap находится в `v0.6`.

### Правильное разделение

```text
v0.3 - UI winner selection
# выбор победителя только в локальном состоянии страницы
# после обновления страницы не сохраняется

v0.6 - Voting MVP
# выбор сохраняется через /api/vote в таблицу votes
```

### Что исправить

Уточнить в:

- `04-mvp-scope.md`;
- `07-architecture.md`;
- `10-ui-pages.md`;
- `21-stage-3-verification.md`, если нужно.

---

## DOC-10 - 15-changelog.md устарел после v0.2-v0.3

### Где проблема

В `15-changelog.md` в Known Issues ещё написано:

```text
Основной код проекта ещё не создан.
Next.js проект ещё не инициализирован.
```

### Почему это плохо

Это уже неправда после этапов `v0.2` и `v0.3`.

### Что сделать

Обновить changelog:

```text
Основной код проекта создан частично.
Next.js base создан.
Static UI MVP создан.
package-lock.json ещё не создан до локального npm install.
OpenRouter ещё не подключён.
Supabase ещё не подключён.
```

---

## DOC-11 - 16-decisions.md говорит про docs/, но документация лежит в корне

### Где проблема

`16-decisions.md` фиксирует:

```text
docs/
# папка документации проекта
```

Фактически документы лежат в корне репозитория:

```text
00-readme.md
01-idea.md
02-project-plan.md
...
23-documentation-audit-deep.md
```

### Что сделать

Изменить решение:

```text
Документация проекта хранится в корне репозитория в Markdown-файлах с числовым префиксом.
```

И добавить:

```text
docs/ можно создать позже, если документация станет слишком большой.
```

---

## DOC-12 - 12-security-and-env.md частично не совпадает с .env.example

### Где проблема

`12-security-and-env.md` использует примеры:

```text
NEXT_PUBLIC_SITE_URL
NEXT_PUBLIC_ENABLE_CODE_ARENA
DATABASE_URL
JWT_SECRET
STRIPE_SECRET_KEY
ADMIN_SECRET
```

А `.env.example` сейчас содержит:

```text
OPENROUTER_API_KEY
OPENROUTER_SITE_URL
OPENROUTER_SITE_NAME
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
APP_ENV
APP_URL
MAX_MODELS_PER_COMPARE
MAX_PROMPT_LENGTH
MODEL_TIMEOUT_MS
```

### Оценка

Это не критическая ошибка, потому что `12-security-and-env.md` описывает и будущие переменные.

Но перед v0.4 лучше добавить раздел:

```text
Текущий .env.example для v0.3-v0.4
```

И перечислить реальные текущие переменные.

---

# Обновлённый приоритет исправлений

## Блок A - обязательно перед v0.4

1. `02-project-plan.md`
   - исправить старую нумерацию;
   - убрать `v0.0`;
   - синхронизировать фазы с `14-roadmap.md`.

2. `09-api-structure.md`
   - перейти на `camelCase` для API JSON;
   - заменить `prompt_arena` на `prompt-arena`;
   - заменить `model_ids` на `modelIds`;
   - заменить `task_id` на `taskId`;
   - заменить `response_id` на `responseId`;
   - убрать `vote_type: best`;
   - сделать максимум моделей 3.

3. `06-project-modes.md`
   - заменить mode slug-и на `kebab-case`;
   - TypeScript-примеры перевести на `camelCase`.

4. `04-mvp-scope.md`
   - заменить максимум prompt 4000 на 8000;
   - уточнить UI-vote в v0.3 и saved-vote в v0.6.

5. `15-changelog.md`
   - убрать устаревшие Known Issues про отсутствие кода и Next.js.

6. `16-decisions.md`
   - исправить решение про `docs/`.

## Блок B - можно после v0.4

1. `12-security-and-env.md`
   - добавить текущий список `.env.example` для v0.3-v0.4;
   - позже перевести документ на русский для единого стиля.

2. `07-architecture.md`
   - добавить уточнение UI-vote vs saved-vote.

3. `10-ui-pages.md`
   - добавить уточнение UI-vote vs saved-vote.

---

# Итог

Повторная проверка подтвердила, что предыдущий аудит был правильный, но неполный.

Теперь список файлов для обязательной синхронизации перед `v0.4` такой:

```text
02-project-plan.md
04-mvp-scope.md
06-project-modes.md
09-api-structure.md
15-changelog.md
16-decisions.md
```

После исправления этих файлов документация будет достаточно чистой, чтобы начинать OpenRouter Integration без риска написать API по устаревшей схеме.
