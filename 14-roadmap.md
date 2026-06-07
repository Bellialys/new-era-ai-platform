# 14 - Roadmap проекта

## Назначение файла

Этот файл является главным источником порядка разработки проекта **Новая эпоха**.

Если другие документы конфликтуют с этим roadmap, правильным считается этот файл.

Главное правило: **одна версия - один понятный рабочий результат**.

## Текущий статус

```text
v0.4.1 - OpenRouter Integration Fix
# текущий этап проекта
```

Сейчас уже есть:

- рабочий Next.js проект;
- Prompt Arena UI;
- `/api/models`;
- `/api/compare`;
- OpenRouter на backend;
- безопасная server-side allowlist моделей;
- валидация `prompt`, `modelIds`, `modeSlug`;
- исправленная обработка API-ошибок;
- базовый in-memory rate limit для `/api/compare`;
- server-only Supabase client и миграция как подготовка v0.5;
- successful `typecheck`, `lint`, `build`.

Следующий главный этап:

```text
v0.5 - Supabase Integration
# подключить базу и сохранять задачи/ответы
```

## Канонический порядок версий

| Версия | Название | Главный результат | Статус |
|---|---|---|---|
| `v0.1` | Project Documentation | Документация и структура проекта | Готово |
| `v0.2` | Next.js Base | Проект запускается локально | Готово |
| `v0.3` | UI MVP | Интерфейс Prompt Arena без реального AI | Готово |
| `v0.4` | OpenRouter Integration | Реальные AI-ответы через backend | Готово |
| `v0.4.1` | OpenRouter Integration Fix | Исправлена валидация, ошибки, документация | Текущий этап |
| `v0.5` | Supabase Integration | Сохранение задач и ответов в базе | Следующий этап |
| `v0.6` | Voting MVP | Сохранение выбора лучшего ответа | Позже |
| `v0.7` | History MVP | История сравнений | Позже |
| `v0.8` | First Deploy | Рабочая версия опубликована на Vercel | Позже |
| `v0.9` | MVP Stabilization | Лимиты, UX, обработка ошибок | Позже |
| `v1.0` | Stable Prompt Arena | Первая стабильная версия MVP | Позже |
| `v1.1` | Code Arena Lite | Сравнение решений по коду без запуска кода | Позже |
| `v1.2` | Multi Model Battle | Формальные бои моделей | Позже |
| `v1.3` | Judge Mode | Модель-судья оценивает ответы | Позже |
| `v1.4` | Leaderboard | Рейтинг моделей | Позже |
| `v1.5` | Accounts and Profiles | Авторизация, профили, личная история | Позже |
| `v1.6` | Admin Panel and Limits | Управление моделями и лимитами | Позже |
| `v1.7` | Code Arena Runner | Безопасный запуск кода в sandbox | Позже |
| `v1.8` | Image Arena MVP | Сравнение изображений от image-моделей | Позже |
| `v2.0` | AI Team Mode | Командная работа нескольких AI-моделей | Позже |

## v0.1 - Project Documentation

Цель: подготовить структуру проекта и документацию.

Готово:

- идея проекта;
- MVP scope;
- архитектура;
- database design;
- API design;
- roadmap;
- security rules;
- future specs для Code Arena и Team Mode.

## v0.2 - Next.js Base

Цель: создать проект, который запускается локально.

Готово:

- Next.js;
- React;
- TypeScript;
- ESLint;
- Tailwind CSS;
- базовая структура `src/app`;
- главная страница.

## v0.3 - UI MVP

Цель: сделать интерактивный UI Prompt Arena.

Готово:

- поле prompt;
- выбор 2-3 моделей;
- loading, empty, error, success состояния;
- карточки ответов;
- выбор победителя на клиенте;
- базовая мобильная адаптация.

## v0.4 - OpenRouter Integration

Цель: подключить реальные ответы AI-моделей через backend.

Готово:

- `GET /api/models`;
- `POST /api/compare`;
- `src/lib/server/openrouter.ts`;
- server-side allowlist;
- проверка моделей;
- timeout для OpenRouter;
- safe error response;
- UI вызывает реальный API.

## v0.4.1 - OpenRouter Integration Fix

Цель: исправить проблемы после первой интеграции OpenRouter.

Готово:

- `package.json` обновлён до `0.4.1`;
- `package-lock.json` обновлён до `0.4.1`;
- `modeSlug` валидируется на backend;
- обычные validation errors больше не превращаются в `INTERNAL_ERROR`;
- `MODEL_NOT_ALLOWED` возвращается как контролируемая ошибка;
- OpenRouter non-JSON response обрабатывается безопасно;
- `OPENROUTER_MAX_TOKENS` вынесен в constants;
- клиент отменяет устаревшие запросы через `AbortController`;
- `latencyMs = 0` теперь корректно отображается;
- корневые дубликаты server-файлов удалены;
- `/api/compare` имеет базовый in-memory rate limit;
- OpenRouter `usage` сохраняется в поля токенов при настроенном Supabase;
- документация синхронизирована с реальным кодом.

Критерии готовности:

```bash
npm run typecheck
# должен пройти без ошибок

npm run lint
# должен пройти без ошибок

npm run build
# должен пройти без ошибок
```

## v0.5 - Supabase Integration

Цель: подключить базу данных и начать сохранять результаты сравнений.

Что сделать:

- создать проект Supabase;
- создать таблицы `models`, `tasks`, `model_responses`, `votes`;
- заполнить `models` текущими моделями;
- добавить server-side Supabase client;
- поменять `modelIds`: frontend отправляет UUID из `models.id`;
- backend получает `models.model_key` и вызывает OpenRouter;
- `/api/compare` создаёт запись в `tasks`;
- `/api/compare` сохраняет ответы в `model_responses`;
- ответ `/api/compare` возвращает `taskId`.

Уже подготовлено до полного v0.5:

- добавлена зависимость `@supabase/supabase-js`;
- добавлен server-only Supabase client;
- добавлена миграция `0001_prompt_arena_mvp.sql`;
- `/api/compare` умеет сохранять `tasks` и `model_responses`, если Supabase env заполнен.

Что всё ещё отличает проект от полноценного v0.5:

- `/api/models` пока читает hardcoded allowlist;
- frontend пока отправляет OpenRouter model keys, а не `models.id` UUID;
- локально/в Vercel ещё нужно применить Supabase migration и заполнить env.

Что не делать в v0.5:

- не добавлять аккаунты, если это тормозит MVP;
- не добавлять Leaderboard;
- не добавлять Code Arena;
- не добавлять Team Mode.

## v0.6 - Voting MVP

Цель: сохранять выбор лучшего ответа.

Что сделать:

- создать `/api/vote`;
- принимать `taskId`, `responseId`, `voteType`;
- сохранять winner vote в таблицу `votes`;
- не давать голосовать за error response;
- показывать выбранного победителя после сохранения.

## v0.7 - History MVP

Цель: дать пользователю открыть прошлые сравнения.

Что сделать:

- создать страницу истории;
- создать `/api/history`;
- создать `/api/history/[taskId]`;
- показывать task, responses, vote.

## v0.8 - First Deploy

Цель: опубликовать рабочую Prompt Arena на Vercel.

Что сделать:

- добавить переменные окружения в Vercel;
- проверить production build;
- проверить реальные OpenRouter calls;
- проверить Supabase connection;
- проверить базовый сценарий пользователя.

## v0.9 - MVP Stabilization

Цель: стабилизировать MVP.

Что сделать:

- заменить базовый in-memory rate limit на устойчивый production-ready лимит;
- улучшить ошибки;
- улучшить mobile UX;
- проверить edge cases;
- обновить документацию;
- подготовить `v1.0`.

## v1.0 - Stable Prompt Arena

Цель: первая стабильная версия проекта.

Критерии:

- пользователь вводит задачу;
- выбирает 2-3 модели;
- получает реальные ответы;
- выбирает победителя;
- данные сохраняются;
- история работает;
- проект опубликован;
- секреты не попали в GitHub.

## После v1.0

Только после стабильной Prompt Arena можно двигаться к:

- Code Arena Lite;
- Multi Model Battle;
- Judge Mode;
- Leaderboard;
- Accounts and Profiles;
- Admin Panel and Limits;
- Code Arena Runner;
- Image Arena MVP;
- AI Team Mode.

## v1.8 - Image Arena MVP

Цель: добавить будущий визуальный режим только после стабильной Prompt Arena, Storage, лимитов и safety-контролей.

Главный сценарий:

- пользователь вводит одну визуальную идею;
- выбирает 2-3 image-capable модели;
- backend вызывает модели через OpenRouter;
- изображения сохраняются в Supabase Storage;
- metadata и storage path сохраняются в Supabase PostgreSQL;
- пользователь сравнивает сетку изображений и выбирает победителя.

Ограничение:

```text
Не переносить Image Arena раньше Stable Prompt Arena.
# сначала должен быть стабильный текстовый MVP, лимиты, Storage и безопасность
```
