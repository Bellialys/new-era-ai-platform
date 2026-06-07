# 28 - Action Plan

## Назначение

Этот файл фиксирует ближайший практический план после аудита текущего кода проекта **Новая эпоха**.

Главный источник порядка версий остаётся `14-roadmap.md`. Если этот файл спорит с roadmap, правильным считается `14-roadmap.md`.

Цель плана: довести Prompt Arena до устойчивого состояния, подготовить v0.5 Supabase Integration и не начинать будущие режимы раньше стабильной базы.

---

# Текущий статус

По `14-roadmap.md` проект находится на этапе:

```text
v0.4.1 - OpenRouter Integration Fix
# текущий этап проекта
```

Следующий целевой этап:

```text
v0.5 - Supabase Integration
# подключить базу и сохранять задачи/ответы
```

В коде уже есть:

- Next.js App Router;
- Prompt Arena UI;
- `GET /api/models`;
- `POST /api/compare`;
- server-side OpenRouter слой;
- server-only Supabase client;
- миграция `supabase/migrations/0001_prompt_arena_mvp.sql`;
- сохранение `tasks` и `model_responses` как заготовка v0.5.

---

# Фаза 0 - обязательные исправления

Эта фаза нужна до новых функций, потому что она влияет на сборку, безопасность и стабильность контрактов.

## 1. Удалить корневые дубликаты server-файлов

Сейчас в корне репозитория есть файлы:

```text
index.ts
models.ts
openrouter.ts
utils.ts
```

Они дублируют `src/lib/server/*`, но содержат устаревший код. Из-за них `npm run typecheck` падает.

Нужно удалить их из Git:

```bash
git rm index.ts models.ts openrouter.ts utils.ts
```

Критерий готовности:

```bash
npm run typecheck
# проходит без ошибок
```

## 2. Закрыть расходный риск `/api/compare`

Сейчас публичный `POST /api/compare` может запускать несколько OpenRouter-запросов на один пользовательский запрос.

До Vercel deploy нужен минимальный rate limit:

- считать запросы по IP или anonymous session;
- ограничить число сравнений в коротком окне;
- возвращать безопасную ошибку `RATE_LIMIT`;
- не логировать prompt, Authorization headers и секреты.

Минимальный вариант для MVP: in-memory лимит для локального/Vercel preview и отдельная задача на устойчивый лимит через Supabase/Upstash позже.

## 3. Зафиксировать контракт `modeSlug`

Frontend сейчас отправляет:

```json
{
  "modeSlug": "prompt-arena"
}
```

Backend требует ровно `prompt-arena`, но тип `CompareRequest` всё ещё допускает `modeSlug?: string`.

Нужно выбрать один честный контракт:

- либо сделать `modeSlug` обязательным в типе;
- либо backend должен подставлять `prompt-arena` по умолчанию, если поле отсутствует.

Для текущего roadmap лучше сделать поле обязательным: режимы должны расширяться явно.

## 4. Свести `ArenaModel` к одному типу

Сейчас `ArenaModel` определён в двух местах:

```text
src/types/arena.ts
src/lib/server/models.ts
```

Нужно оставить один общий тип в `src/types/arena.ts`, а server allowlist должен импортировать его. Это убирает дрейф между client/server контрактами.

## 5. Синхронизировать env и constants

`.env.example` содержит MVP-лимиты, но код берёт значения из `src/lib/arena/constants.ts`.

Нужно выбрать правило:

- лимиты фиксируются в коде и `.env.example` только документирует значения;
- или server-side код читает env override с безопасным fallback.

Для MVP лучше: кодовые constants как источник истины, env override только для server-only параметров вроде timeout/max tokens.

---

# Фаза 1 - стабилизировать Prompt Arena

Эта фаза завершает текущий продуктовый сценарий до перехода к новым режимам.

## 6. Решить источник истины для моделей

Сейчас модели живут в двух местах:

- hardcoded allowlist в `src/lib/server/models.ts`;
- seed в `supabase/migrations/0001_prompt_arena_mvp.sql`.

Для v0.5 нужно перейти на настоящий Supabase flow:

- `GET /api/models` читает активные публичные модели из `public.models`;
- frontend отправляет `models.id` UUID, а не OpenRouter `model_key`;
- backend по UUID получает `models.model_key`;
- OpenRouter `model_key` остаётся server-side.

До полного v0.5 hardcoded allowlist можно оставить fallback-режимом для локальной разработки без Supabase.

## 7. Сохранять OpenRouter usage

OpenRouter response содержит `usage`, а таблица `model_responses` уже имеет поля:

```text
input_tokens
output_tokens
total_tokens
estimated_cost
```

Нужно расширить `fetchOpenRouterResponse`, чтобы он возвращал usage, и сохранять токены в `model_responses`.

Это даст основу для:

- контроля расходов;
- будущего Leaderboard;
- аналитики качества и стоимости моделей.

## 8. Сохранить выбор победителя

Сейчас `winnerResponseId` хранится только в client state и исчезает после обновления страницы.

По roadmap сохранение победителя относится к v0.6 Voting MVP. Минимальный путь:

- добавить `POST /api/vote`;
- принимать `taskId` и `responseId`;
- проверять, что response принадлежит task;
- запрещать голос за error response;
- сохранять запись в `votes`.

Не нужно добавлять публичный Leaderboard в этой фазе.

## 9. Улучшить UX ожидания моделей

Сейчас сравнение возвращается после завершения всех выбранных моделей. Одна медленная модель может держать весь результат в loading state.

Рекомендуемый следующий UX-апгрейд:

- отображать карточки по мере готовности моделей;
- показывать индивидуальный статус `pending/success/error`;
- не блокировать быстрые ответы медленной моделью.

Для MVP можно начать без SSE: сначала разделить состояние карточек на клиенте и обновлять после одного API ответа. Настоящий streaming/SSE вынести в фазу инноваций.

---

# Фаза 2 - v0.5 Supabase Integration

Эта фаза должна соответствовать `14-roadmap.md`: база данных нужна до voting/history/leaderboard.

Что сделать:

- применить миграцию `0001_prompt_arena_mvp.sql` в Supabase;
- заполнить env:
  - `NEXT_PUBLIC_SUPABASE_URL`;
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`;
  - `SUPABASE_SERVICE_ROLE_KEY`;
- перевести `/api/models` на чтение из `public.models`;
- перевести `/api/compare` с OpenRouter model keys на Supabase UUID;
- сохранять `tasks` и `model_responses` при каждом сравнении;
- возвращать `taskId` в ответе API.

Что не делать в v0.5:

- accounts;
- admin panel;
- Leaderboard;
- Code Arena;
- Judge Mode;
- AI Team Mode;
- запуск пользовательского кода.

---

# Фаза 3 - новый режим Code Arena Lite

Новый режим лучше начинать после v1.0 Stable Prompt Arena или строго по roadmap на v1.1.

Рекомендуемый первый новый режим:

```text
Code Arena Lite
# сравнение решений по коду без запуска кода
```

Почему именно он:

- не требует sandbox;
- использует тот же backend pipeline;
- безопаснее Judge Mode и Runner;
- хорошо расширяет Prompt Arena без сложной инфраструктуры.

Что понадобится:

- реестр режимов вместо жёсткого `modeSlug === "prompt-arena"`;
- новая миграция, расширяющая `tasks_mode_slug_check`;
- страница `src/app/code-arena/page.tsx`;
- code-aware карточки ответов;
- моноширинное отображение кода;
- кнопка copy;
- без запуска пользовательского кода.

---

# Фаза 4 - инновации после стабильной базы

Эти функции не стоит делать до стабильной Prompt Arena, но их можно держать как направление развития.

## 1. Cost-aware Arena

Показывать не только качество ответа, но и стоимость:

- tokens;
- latency;
- estimated cost;
- error rate.

## 2. History MVP

Добавить:

- `/history`;
- `/history/[taskId]`;
- чтение сохранённых `tasks` и `model_responses`;
- anonymous session или server-side history route.

Важно: сейчас RLS открыт только для публичного чтения `models`. Для history нужны отдельные политики или backend routes через service role.

## 3. Leaderboard

После votes/history можно считать:

- win-rate;
- среднюю задержку;
- процент ошибок;
- среднюю стоимость;
- лучшие модели по категориям.

## 4. Streaming/SSE

Показывать ответы моделей вживую.

Это сильный UX-апгрейд, но его лучше делать после устойчивого сохранения результатов.

## 5. Judge Mode

LLM-судья оценивает ответы других моделей.

Делать после:

- сохранения ответов;
- voting;
- базовой истории;
- контроля расходов.

---

# Рекомендуемый ближайший порядок

```text
1. Удалить корневые дубликаты server-файлов.
2. Вернуть зелёные typecheck/lint/build.
3. Добавить минимальный rate limit для /api/compare.
4. Свести ArenaModel к одному типу.
5. Завершить v0.5 Supabase flow: модели из БД, UUID на клиенте, model_key только server-side.
6. Добавить /api/vote для сохранения победителя.
7. Только потом переходить к history и новым режимам.
```

Главная мысль: сначала сделать Prompt Arena устойчивой и сохраняемой, потом расширять платформу.
