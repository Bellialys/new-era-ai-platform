# 15 - Changelog проекта

## Назначение файла

Этот файл хранит историю важных изменений проекта **Новая эпоха**.

Changelog нужен, чтобы быстро понимать:

- что уже изменено;
- что добавлено;
- что исправлено;
- что удалено;
- какие решения повлияли на проект;
- какие ограничения ещё остаются;
- какая версия проекта сейчас готовится.

Changelog не заменяет Git history. Git показывает технические изменения в файлах, а changelog объясняет смысл изменений для проекта.

---

# Главное правило

`14-roadmap.md` является главным источником порядка версий.

`15-changelog.md` не должен придумывать другой порядок разработки. Он только фиксирует, что уже сделано, что изменено и какие версии готовятся по roadmap.

```text
git commit
# фиксирует техническое изменение в репозитории

changelog
# объясняет смысл изменения для проекта
```

---

# Канонический порядок версий

| Версия | Название | Краткий смысл |
|---|---|---|
| `v0.1` | Project Documentation | Документация, идея, структура, план проекта |
| `v0.2` | Next.js Base | Базовый Next.js проект |
| `v0.3` | UI MVP | Главная страница и Prompt Arena UI без реального AI |
| `v0.4` | OpenRouter Integration | Реальные ответы через server-side API |
| `v0.5` | Supabase Integration | Сохранение задач, ответов и моделей |
| `v0.6` | Voting MVP | Сохранение выбора лучшего ответа |
| `v0.7` | History MVP | История сравнений |
| `v0.8` | First Deploy | Публикация рабочего MVP на Vercel |
| `v0.9` | MVP Stabilization | Безопасность, лимиты, ошибки, UX |
| `v1.0` | Stable Prompt Arena | Первая стабильная версия проекта |
| `v1.1` | Code Arena Lite | Сравнение моделей по коду без запуска кода |
| `v1.2` | Multi Model Battle | Формальные бои моделей |
| `v1.3` | Judge Mode | Модель-судья оценивает ответы |
| `v1.4` | Leaderboard | Рейтинг моделей |
| `v1.5` | Accounts and Profiles | Авторизация, профили, личная история |
| `v1.6` | Admin Panel and Limits | Управление моделями, режимами, лимитами и стоимостью |
| `v1.7` | Code Arena Runner | Безопасный запуск кода в sandbox |
| `v2.0` | AI Team Mode | Командная работа моделей с ролями |

---

# Важные правила changelog

## Code Arena Runner

Code Arena Runner должен быть только на `v1.7`.

Нельзя указывать Code Arena Runner как `v1.5`, потому что до безопасного запуска кода проекту нужны:

- аккаунты;
- лимиты;
- контроль расходов;
- админ-панель;
- feature flags;
- логирование;
- security review;
- отдельная sandbox-архитектура.

## UI-vote и saved-vote

Нужно различать:

```text
v0.3 - UI winner selection
# локальный выбор победителя без сохранения

v0.6 - Voting MVP
# сохранение голоса через /api/vote и Supabase
```

## API-contract и UI-view

Нужно различать:

```text
ArenaApiResponse
# контракт /api/compare, источник истины - 09-api-structure.md

ArenaResponseView
# UI-представление после добавления modelRole на клиенте
```

---

# Формат записи

Для каждой версии используется такой формат:

```text
# v0.4 - OpenRouter Integration

## Статус

Planned
# запланировано

## Дата

Не выпущено
# дата будет добавлена после release

## Added

- Добавлено ...

## Changed

- Изменено ...

## Fixed

- Исправлено ...

## Removed

- Удалено ...

## Security

- Улучшена безопасность ...

## Known Issues

- Известное ограничение ...
```

Не каждый раздел обязателен.

---

# [Unreleased]

## Статус

```text
Active
# текущие незавершённые изменения
```

## Added

- Добавлен `README.md` как главный входной файл GitHub.
- Добавлен `.gitignore` для Next.js проекта.
- Добавлен `.env.example` без настоящих секретов.
- Добавлен `19-development-checklist.md`.
- Добавлен `20-stage-2-verification.md`.
- Добавлен `21-stage-3-verification.md`.
- Добавлен `22-documentation-audit.md`.
- Добавлен `23-documentation-audit-deep.md`.
- Добавлен `24-documentation-sync-report.md`.
- Добавлен `25-code-consistency-audit.md`.
- Добавлен `AGENTS.md` с правилами работы над проектом.
- Добавлен `package.json`.
- Добавлены конфигурации Next.js, TypeScript, ESLint и Tailwind CSS.
- Добавлена структура `src/app`.
- Добавлена главная страница `/`.
- Добавлена интерактивная страница `/arena`.
- Добавлены типы Prompt Arena.
- Добавлены mock-данные моделей.
- Добавлен mock-генератор ответов.
- Добавлены компоненты Prompt Arena.

## Changed

- `README.md` обновлён под состояние `v0.3 - Static UI MVP` и текущий аудит перед `v0.4`.
- `00-readme.md` обновлён: убрано устаревшее указание на обязательную папку `docs/`, закреплена текущая структура документации в корне репозитория.
- `02-project-plan.md` синхронизирован с `14-roadmap.md`.
- `04-mvp-scope.md` синхронизирован с текущими лимитами MVP и состоянием `v0.3`.
- `06-project-modes.md` синхронизирован с единым стилем `modeSlug`, API и TypeScript.
- `09-api-structure.md` закреплён как источник истины для `/api/compare`.
- `12-security-and-env.md` обновлён: структура проекта приведена к текущему виду `src/`, добавлены правила для `package-lock.json`, `.env.example`, лимитов prompt/model и server-side ключей.
- `15-changelog.md` обновлён после глубокого аудита кода и документации.
- В документации закреплены единые лимиты: `MIN_PROMPT_LENGTH=3`, `MAX_PROMPT_LENGTH=8000`, `MAX_MODELS_PER_COMPARE=3`.
- В документации уточнено различие между локальным UI-выбором победителя в `v0.3` и сохранённым голосом в `v0.6`.
- В документации уточнено различие между `ArenaApiResponse` и `ArenaResponseView`.

## Fixed

- Исправлена устаревшая нумерация версий в `02-project-plan.md`.
- Устранён конфликт `vote_type: best` против разрешённых значений `user`, `judge`, `system`.
- Исправлен API naming: `modelIds`, `taskId`, `responseId`, `modeSlug` вместо смешивания со `snake_case`.
- Исправлен mode slug: `prompt-arena` вместо `prompt_arena`.
- Исправлен лимит количества моделей: максимум `3`, а не `4`.
- Исправлен лимит prompt: максимум `8000`, а не `4000`.
- Удалены устаревшие Known Issues о том, что код проекта ещё не создан и Next.js ещё не инициализирован.
- Зафиксировано, что `text` в текущем коде является временным UI/mock-полем и должно быть заменено на `answerText` по контракту `09-api-structure.md`.
- Зафиксировано, что `modelRole` не должен дублироваться в API-ответе `/api/compare`, а должен добавляться на клиенте по `modelId`.

## Security

- Закреплено правило: секретные ключи нельзя хранить в коде.
- Закреплено правило: OpenRouter key используется только server-side.
- Закреплено правило: `SUPABASE_SERVICE_ROLE_KEY` используется только server-side.
- Закреплено правило: `.env.local` не должен попадать в GitHub.
- Закреплено правило: `.env.example` может быть в GitHub только без реальных секретов.
- Закреплено правило: backend обязан проверять allowlist моделей.
- Закреплено правило: backend обязан повторно проверять `MAX_PROMPT_LENGTH` и `MAX_MODELS_PER_COMPARE`.
- Закреплено правило: Code Arena Runner запрещён до `v1.7`.
- Закреплено правило: AI Team Mode запрещён до `v2.0`.

## Known Issues

- `package-lock.json` создан локально после `npm install`, но пока отсутствует в GitHub.
- `MAX_PROMPT_LENGTH=8000` есть в документации и `.env.example`, но ещё должен быть применён в UI-коде.
- В коде Prompt Arena текущий тип ответа использует `text`, а канонический API-контракт требует `answerText`.
- В коде Prompt Arena текущий response содержит `modelRole`, а будущий `/api/compare` не должен дублировать это поле.
- В коде Prompt Arena нужно добавить `errorCode` и `errorMessage` для отображения ошибок отдельных моделей.
- При изменении prompt или выбора моделей нужно сбрасывать старые responses, чтобы UI не показывал устаревший результат.
- OpenRouter ещё не подключён в коде.
- Supabase ещё не подключён в коде.
- Vercel deploy ещё не выполнен.
- Точные OpenRouter model ID нужно проверить перед production через OpenRouter Models API.
- Таблицы Supabase нужно создать после утверждения схемы MVP.
- Leaderboard, Judge Mode, Code Arena Runner и AI Team Mode пока являются будущими этапами.

---

# v0.1 - Project Documentation

## Статус

```text
Done
# стартовая документация создана
```

## Added

- Добавлен комплект проектной документации `00-18`.
- Описана идея AI-платформы сравнения моделей.
- Описаны границы MVP.
- Описан главный roadmap.
- Описана архитектура frontend, backend, OpenRouter, Supabase и Vercel.
- Описана структура базы данных.
- Описана структура API.
- Описаны страницы интерфейса.
- Описана стратегия AI-моделей.
- Описаны правила безопасности.
- Описаны будущие режимы Code Arena и AI Team Mode.

## Security

- Закреплено правило: API-ключи не вставлять в код.
- Закреплено правило: `.env.local` не коммитить.
- Закреплено правило: OpenRouter API key использовать только через backend.

---

# v0.2 - Next.js Base

## Статус

```text
Done
# базовый Next.js проект создан
```

## Added

- Добавлен `package.json`.
- Добавлены конфиги Next.js, TypeScript, ESLint и Tailwind CSS.
- Добавлена структура `src/app`.
- Добавлена базовая главная страница.

## Fixed

- Сборка больше не должна переписывать `tsconfig.json` при корректной настройке.

---

# v0.3 - Static UI MVP

## Статус

```text
In Progress
# интерфейс Prompt Arena уже работает на mock-данных, но перед v0.4 нужно закрыть найденные расхождения
```

## Added

- Добавлена страница `/arena`.
- Добавлен выбор 2-3 моделей.
- Добавлен ввод prompt.
- Добавлен mock-генератор ответов.
- Добавлены карточки ответов.
- Добавлен локальный UI-выбор победителя без сохранения в базу.

## Known Issues

- UI должен применять `MAX_PROMPT_LENGTH=8000`.
- Response type должен быть разделён на API-contract и UI-view.
- Mock-ответы нужно привести к будущему контракту `/api/compare`.
- Старые responses нужно сбрасывать при изменении prompt или выбора моделей.

---

# Следующий целевой этап

Следующий целевой этап после закрытия расхождений `v0.3`:

```text
v0.4 - OpenRouter Integration
# реальные ответы моделей через backend API
```

Перед началом `v0.4` нужно убедиться:

```bash
npm run typecheck
# TypeScript проходит

npm run lint
# ESLint проходит

npm run build
# production-сборка проходит

git status
# package-lock.json добавлен, .env.local отсутствует в Git
```
