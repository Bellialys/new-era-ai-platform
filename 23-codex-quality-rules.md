# 23 - Codex Quality Rules

## Статус

```text
Status: active
# эти правила действуют для всех будущих задач Codex
```

## Назначение файла

Этот файл дополняет project state (`.project/state.json` и `.project/tasks/*.json`) и задаёт правила качества для Codex.

Codex должен считать этот документ обязательным перед выполнением любых задач, особенно если меняются:

- API routes;
- Supabase migrations;
- auth/guest/profile logic;
- UI-компоненты;
- npm dependencies;
- бизнес-логика проекта.

## Production-grade принцип

Качество выполнения задач имеет приоритет сразу после безопасности. Если скорость конфликтует с надёжностью, проверяемостью, безопасностью, сопровождаемостью или прозрачностью решений, выбирать надёжность.

Для сложных задач Codex не должен экономить анализ. Нормальный режим работы — подробный reasoning summary, decision log, оценка альтернатив, рисков, проверок и ссылок на авторитетные источники: OWASP ASVS/Threat Modeling, NIST SSDF, W3C WCAG, Google SRE, OpenAPI, Supabase/Vercel/Next.js docs.

Минимальный публичный формат решения:

```text
Контекст -> варианты -> выбранное решение -> почему -> риски -> проверки -> остаточные ограничения
```

## Обновлённый алгоритм работы Codex

Codex должен работать по расширенной схеме:

```text
Research -> Анализ требований -> Проектирование -> Self-Review проекта -> План реализации -> Self-Review плана -> Разработка -> Тестирование -> Проверки -> Security review -> Performance review -> Рефакторинг -> Документация -> Code Review -> Commit -> Push/CI verify -> Отчёт
```

## 1. Self-Review плана

Перед изменениями Codex должен проверить свой план:

- соответствует ли план текущему этапу из `14-roadmap.md`;
- не смешивает ли он guest mode, auth, profile, avatar upload, voting и history;
- не затрагивает ли больше файлов, чем необходимо;
- не требует ли новая задача дополнительного подтверждения пользователя;
- есть ли риск потери данных;
- нужны ли Supabase migrations;
- нужны ли изменения документации;
- включает ли план обоснование выбора архитектуры: почему именно такое решение подходит текущему roadmap/state;
- рассмотрена ли минимум одна альтернатива и явно названы её недостатки;
- оценено ли влияние на смежные модули, тесты, документацию и release gates;
- нужен ли ADR: краткий decision record в плане или отдельный файл `docs/adr/<slug>.md`, если решение критично для архитектуры, API, БД, auth, billing, runner или production operations;
- есть ли оценка сложности, рисков, rollback/forward-fix path и проверок, которые подтвердят результат;
- если бизнес-логика неоднозначна, предложены ли 2-3 трактовки с плюсами/минусами и рекомендуемым вариантом.

Если план затрагивает больше 5 файлов или меняет архитектуру, Codex должен явно предупредить пользователя и предложить разделить задачу.

## 2. Self-Review кода перед commit

Перед `git commit` Codex должен пройтись по изменённым файлам и проверить:

- нет ли `console.log`;
- нет ли `debugger`;
- нет ли временных комментариев типа `TODO remove`, `temp`, `test only`, `remove later`;
- нет ли неиспользуемых импортов;
- нет ли мёртвого кода;
- нет ли лишних файлов, не относящихся к задаче;
- ошибки в `catch` обработаны осмысленно;
- нет ли дублирования кода;
- не превышает ли новая/изменённая функция разумную цикломатическую сложность (желательно < 10);
- не превышает ли глубина вложенности разумный предел (желательно < 3); если превышает — рассмотреть guard clauses, extracted helpers или декомпозицию;
- не стал ли файл слишком длинным; если файл > 300 строк, рассмотреть разделение на модули или объяснить, почему текущая структура лучше;
- все ли публичные функции/методы/экспортируемые helpers имеют JSDoc с описанием параметров, возвращаемого значения и возможных исключений;
- отсутствует ли `any` в TypeScript без комментария-обоснования, почему строгая типизация невозможна или чрезмерно дорога;
- проверен ли асинхронный код на race conditions, stale closures, lost updates, duplicate side effects и отмену устаревших запросов;
- если один паттерн повторяется 3+ раза, рассмотреть вынос в helper, util или hook.

Разрешено оставить TODO только если это осознанный технический долг с понятной причиной. Лучше фиксировать технический долг в отдельном документе, а не засорять код.

## 3. Документация обязательна

Если изменения затрагивают API routes, Codex должен обновить документацию по API:

- параметры запроса;
- формат ответа;
- error codes;
- auth/guest requirements.

Если изменения затрагивают env variables, Codex должен обновить:

- `.env.local.example` как основной локальный пример;
- `.env.example` как справочный каталог переменных, если он остаётся применимым;
- deployment documentation;
- Vercel/Supabase setup notes, если применимо.

Если изменения затрагивают бизнес-логику, Codex должен обновить соответствующий документ:

- `14-roadmap.md`;
- `20-auth-guest-profile-plan.md`;
- `21-access-gate-policy.md`;
- `.project/state.json` и `.project/tasks/*.json`;
- `23-codex-quality-rules.md`, если меняются правила качества.

Если есть breaking change, Codex должен обновить changelog-документ проекта.

Для каждой новой фичи, меняющей архитектуру или поведение, создавать ADR в `docs/adr/` или фиксировать краткий ADR в плане/отчёте, если отдельный файл пока избыточен. Формат ADR:

```text
Название
Контекст
Рассмотренные варианты
Решение
Последствия
Проверки
```

Для API поддерживать OpenAPI-спецификацию. Если спецификации ещё нет, при изменении API предложить её создание и не выдавать ручной markdown-контракт за сгенерированную OpenAPI-документацию.

При изменении архитектуры, потоков данных, auth, runner, storage или deployment обновлять диаграммы Mermaid в соответствующем документе или явно фиксировать, почему диаграмма не требуется.

## 4. Git workflow

Codex должен использовать Conventional Commits.

Разрешённые префиксы:

```text
feat:
# новая функциональность

fix:
# исправление ошибки

refactor:
# рефакторинг без изменения поведения

docs:
# документация

chore:
# техническое обслуживание

test:
# тесты
```

Правила commit:

- commit message писать на английском;
- один commit = одна логическая задача;
- не смешивать новую функцию и большой рефакторинг;
- после коммита в основную ветку дождаться CI, если это возможно в текущей среде; при красном статусе немедленно исправить через fix-commit или согласованный rollback/forward-fix;
- перед commit выполнить `git diff --cached`;
- проверить, что в commit не попали секреты, временные файлы и лишние изменения.

Если Codex работает локально или через IDE, перед началом этапа желательно создать feature branch:

```bash
git checkout -b feature/guest-access-gate
# создать отдельную ветку для этапа guest access gate
```

Если изменения выполняются напрямую через GitHub connector, допустимы атомарные commits в `main`, но commit hash должен быть зафиксирован в отчёте.

## 5. Новые npm dependencies

Codex не имеет права добавлять новый npm-пакет без причины.

Перед добавлением пакета Codex должен проверить:

- есть ли уже аналог в проекте;
- можно ли решить задачу без нового пакета;
- зачем пакет нужен;
- дату последнего обновления;
- активность поддержки;
- размер и влияние на bundle;
- результат `npm audit`;
- пакет имеет не менее 1000 GitHub stars на момент добавления или официально рекомендован документацией платформы/фреймворка; для меньших или нишевых пакетов нужно краткое письменное обоснование;
- если пакет попадает в client bundle, оценить влияние на размер бандла через Next.js analyzer или другой доступный инструмент и указать вывод в отчёте;
- если пакет нужен только для dev tooling, зафиксировать, почему он не попадает в runtime/client bundle.

Запрещено импортировать библиотеку, которой нет в `package.json`.

Если новый пакет нужен, Codex должен сначала указать причину и только потом добавлять его.

## 6. API security and validation

Для каждого нового endpoint проводить мини threat model по STRIDE и фиксировать выводы в ADR, плане или отчёте:

```text
Spoofing
Tampering
Repudiation
Information disclosure
Denial of service
Elevation of privilege
```

Все API routes должны валидировать входящие данные до выполнения бизнес-логики.

Рекомендуемый подход:

- Zod или аналогичная schema validation;
- проверка `req.body`;
- проверка query params;
- проверка route params;
- контролируемые ошибки вместо raw exceptions.

Запрещено доверять frontend-блокировке.

Backend обязан проверять:

- user session или anonymous session;
- доступ пользователя или гостя к модели;
- принадлежность task пользователю или guest session;
- принадлежность response к task;
- валидность vote target;
- лимиты и rate limiting для публичных endpoints;
- исходящие данные через DTO whitelist: ответ API должен содержать только разрешённые поля;
- отсутствие секретов, служебных токенов, raw auth objects, stack traces и internal-only полей в response body.
- AI-generated output в API response, structured output, Judge Mode verdict и сохранённых `tasks` / `model_responses` считается Untrusted Input; правила безопасного рендера, sanitization и output encoding описаны в `25-production-excellence.md`, раздел `9.1 AI Output Sanitization`.

Стандартные error codes:

```text
AUTH_REQUIRED
# нет user session и нет valid anonymous session

MODEL_NOT_ALLOWED
# пользователь или гость не имеет доступа к модели

VALIDATION_ERROR
# неверное тело запроса или параметры

NOT_FOUND
# объект не найден или недоступен

INTERNAL_ERROR
# непредвиденная ошибка, без утечки деталей клиенту
```

Каждый server-side request должен иметь `request-id` или эквивалентный trace id. Логи API должны включать route, request id, controlled error code, status, duration и safe identity marker, если это безопасно.

## 7. DTO and response safety

API не должен возвращать сырые объекты БД, если в них есть лишние или внутренние поля.

Codex должен использовать DTO/mapping для ответов API.

DTO mapping должен быть явным: whitelist полей лучше blacklist. Допустимы ручные mappers или трансформеры (например, `class-transformer` / `plainToInstance`) только если dependency уже одобрена или добавляется по правилам раздела 5.

Перед commit проверить, что API response не содержит:

```text
password
secret
token
service_role
api_key
internal_notes
```

Нельзя случайно возвращать клиенту:

- secret keys;
- service role данные;
- внутренние токены;
- лишние поля auth;
- приватные поля пользователя;
- stack traces.

## 8. SQL and Supabase safety

Правила Supabase:

- любые DDL-изменения только через migration;
- не редактировать старые применённые migrations без отдельной причины;
- перед migration проверить текущую схему;
- перед `db push` запустить `supabase migration list`;
- после migration запустить `supabase db reset` на локальной базе;
- не выполнять destructive changes без подтверждения пользователя;
- не выполнять `supabase db reset` на production database.

Миграции должны быть идемпотентными, где это возможно: использовать `IF EXISTS`, `IF NOT EXISTS`, безопасные `DROP POLICY IF EXISTS`, additive changes и forward-compatible defaults.

### 8.1 Row Level Security (RLS) — обязательное требование

Каждая новая Supabase-таблица, которая хранит пользовательские, гостевые, сессионные или request-owned данные, обязана иметь Row Level Security в той же миграции, где создаётся таблица.

Обязательные требования:

- RLS должен быть включён в той же миграции:

```sql
ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;
```

- Для каждой таблицы должны быть явно описаны политики для всех разрешённых операций:
  - SELECT;
  - INSERT;
  - UPDATE;
  - DELETE.
- Для SELECT / UPDATE / DELETE политики должны использовать `USING`.
- Для INSERT / UPDATE политики должны использовать `WITH CHECK`, чтобы пользователь не мог создать или изменить строку с чужим `user_id`, `anonymous_session_id` или другим ownership-полем.
- Для строк, принадлежащих авторизованному пользователю, доступ должен ограничиваться через Supabase auth uid:

```sql
(select auth.uid()) = user_id
```

- Для гостевых строк доступ должен ограничиваться только через проверенный server-controlled guest/session identifier. Нельзя доверять guest/session id, который напрямую пришёл из непроверенного client payload.
- Если для гостевой сессии используется session setting, применять безопасный nullable cast pattern:

```sql
anonymous_session_id = nullif(current_setting('app.guest_id', true), '')::uuid
```

- Таблицы без пользовательских RLS-политик допускаются только для служебных случаев, если одновременно выполняются все условия:
  - таблица не доступна напрямую для anon/authenticated clients;
  - доступ выполняется только через доверенный server-side код;
  - используется `service_role` или другой явно привилегированный путь;
  - причина описана в ADR или комментарии к миграции;
  - таблица включена в schema/security review checklist.
- Индексы должны покрывать поля, которые используются в RLS-предикатах, особенно:
  - `user_id`;
  - `anonymous_session_id`;
  - `task_id`;
  - `session_id`;
  - `organization_id`;
  - `created_by`;
  - `owner_id`.
- Self-review каждой миграции обязан проверять:
  - RLS включён для каждой user-facing таблицы;
  - политики существуют для всех разрешённых операций;
  - INSERT и UPDATE не позволяют назначить строку другому пользователю;
  - guest access не позволяет читать или изменять данные другой гостевой сессии;
  - `service_role` используется только server-side и имеет обоснование;
  - поля из RLS-предикатов покрыты индексами;
  - `schema:check` и `docs:check` проходят после изменений.

Примеры безопасных политик:

```sql
CREATE POLICY "Users can view own tasks"
ON tasks
FOR SELECT
TO authenticated
USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can create own tasks"
ON tasks
FOR INSERT
TO authenticated
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own tasks"
ON tasks
FOR UPDATE
TO authenticated
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Guests can view own session tasks"
ON tasks
FOR SELECT
TO anon
USING (
  anonymous_session_id = nullif(current_setting('app.guest_id', true), '')::uuid
);
```

Примеры недопустимых миграций:

- создание user-facing таблицы без `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`;
- включение RLS без описания политик;
- добавление SELECT policy без INSERT / UPDATE `WITH CHECK`;
- использование anon-доступа с `USING (true)` для пользовательских или сессионных данных;
- использование `service_role` в client-side коде;
- использование RLS-предикатов по ownership-полям без индексов.

Запрещено:

- динамический SQL без валидации входных данных;
- массовое удаление данных без backup/подтверждения;
- удаление колонки/таблицы без проверки использования в коде и миграциях.

При создании сложных запросов (`JOIN`, подзапросы, aggregation, RLS-sensitive filters) предоставлять `EXPLAIN` / `EXPLAIN ANALYZE` план в описании commit/PR или объяснить, почему локально это невозможно.

Перед удалением колонки/таблицы Codex должен проверить:

```bash
git grep "имя_колонки_или_таблицы"
# найти использование в коде и документации

git log -p -- supabase/migrations
# проверить историю миграций
```

Перед применением миграции на production делать резервную копию или проверять Point-in-Time Recovery readiness, если возможно, и фиксировать backup/PITR evidence в задаче или release notes. Если PITR недоступен, явно указать риск и forward-fix strategy.

## 9. Backup and destructive operations

Перед опасными операциями Codex должен остановиться и запросить подтверждение пользователя.

Опасные операции:

- удаление таблицы;
- удаление колонки;
- массовое обновление данных;
- очистка таблиц;
- изменение auth/user ownership;
- reset базы с реальными данными;
- массовый рефакторинг больше 5 файлов.

Перед опасной операцией нужно подготовить rollback/backup plan.

Для локальной базы:

```bash
supabase db dump
# сделать дамп базы, если есть риск потери локальных данных
```

Для кода:

```bash
git checkout -b backup/date-description
# создать backup-ветку перед массовым рефакторингом
```

Для production-окружения перед опасной операцией создавать Point-in-Time Recovery backup через Supabase dashboard или проверять PITR recovery window, если план проекта это поддерживает. Backup/PITR evidence нужно фиксировать в задаче, PR или release notes.

## 10. Performance budget

Целевые production budgets:

```text
API p95 latency < 200ms
API p99 latency < 500ms
First JS bundle gzip < 150 KB
Lighthouse Performance >= 90
```

Если эти метрики невозможно измерить в текущей среде, Codex должен указать это как unverified и дать ближайший доступный proxy-сигнал: build output, bundle analyzer, route-level reasoning, EXPLAIN plan или local smoke latency.

После `npm run build` Codex должен смотреть, нет ли явных проблем с bundle или серверным кодом.

Если добавлен новый UI-пакет:

- обосновать необходимость;
- проверить влияние на bundle.

Если добавлен новый API endpoint:

- проверить, что простой запрос отвечает примерно до 500ms в нормальных условиях;
- проверить, нет ли лишних последовательных запросов к БД;
- проверить, нет ли N+1 pattern;
- выполнить профилирование с помощью `clinic`, `node --inspect`, route timing или другого доступного инструмента, если endpoint критичный или поведение производительности неочевидно;
- приложить краткую performance summary к отчёту.

Если добавлены Supabase-запросы:

- проверить индексы на частые `WHERE` поля;
- проверить индексы на `ORDER BY` поля;
- проверить JOIN/filter поля;
- не загружать все данные целиком для списков.

Для списков обязательны:

- `limit`;
- `offset` или cursor;
- максимальный лимит на backend.

## 11. Accessibility and UX

UI должен стремиться к WCAG 2.1 AA. Любое отклонение нужно объяснить как известный риск или debt.

Все новые интерактивные элементы должны быть доступны с клавиатуры.

Правила:

- кнопки работают через Enter/Space;
- модальные окна закрываются через Escape;
- формы имеют `label` + `htmlFor`;
- поля с ошибками имеют `aria-invalid`;
- ошибка формы связана через `aria-describedby`;
- иконки-кнопки имеют `aria-label`;
- изображения имеют `alt`;
- аватар пользователя имеет `alt` вида `Аватар пользователя {displayName}`;
- контрастность текста соответствует WCAG 2.1 AA и проверена инструментом или явно отмечена как unverified;
- фокус-индикаторы видимы и не отключены CSS;
- формы имеют field-level validation с понятными сообщениями об ошибках;
- loading/error/success состояния понятны пользователю;
- кнопки disabled во время отправки запроса;
- interface должен быть mobile-first.

## 12. Error handling and logging

Запрещено молча глотать ошибки.

Каждая функция, которая может упасть, должна:

- вернуть понятный controlled result;
- или бросить ошибку с контекстом;
- или залогировать ошибку на server-side с контекстом.

`console.log` в production-коде запрещён.

`console.error` допустим на server-side, если содержит контекст:

- endpoint/action;
- requestId, если есть;
- userId или anonymousSessionId, если безопасно;
- timestamp;
- error code.

Клиенту нельзя отдавать raw stack trace.

Логи production-ready сервисов должны быть структурированными JSON-логами или иметь совместимый формат для парсинга в log pipeline. Если `pino` или другой logger не установлен, не добавлять dependency автоматически; сначала оценить необходимость по разделу 5.

Для каждой ошибки определять тип:

```text
operational
# ожидаемая внешняя/пользовательская/инфраструктурная ошибка; возвращать controlled error, логировать с контекстом

programmer
# дефект кода или нарушенный invariant; логировать как error, исправлять в коде, не маскировать как пользовательскую ошибку без причины
```

## 13. Single Source of Truth

Не дублировать константы и типы.

Вынести в одно место:

- API error codes;
- model access levels;
- rate limit values;
- OpenRouter timeout/max tokens;
- localStorage keys;
- guest display name generation rules;
- pagination limits;
- API request/response types.

Рекомендуемые места:

```text
src/lib/constants.ts
# общие константы

src/types
# общие типы

src/lib/server
# server-only business logic
```

Запрещено:

- хардкодить один и тот же URL/лимит/ключ в нескольких файлах;
- дублировать интерфейсы API в разных компонентах;
- использовать magic values без объяснения.

Все конфигурационные переменные окружения должны быть типизированы и валидироваться при старте приложения или перед использованием через существующий env-check pipeline либо schema validation (например, Zod). Приложение не должно молча запускаться с невалидными critical env variables.

## 14. Tests and coverage context

Перед изменением Codex должен проверить, есть ли тесты для затрагиваемого модуля.

Если тесты есть:

- обновить их под новую логику;
- запустить `npm run test`, если команда есть.

Если тестов нет:

- новый код должен иметь целевое покрытие тестами не менее 90% для критичной логики;
- если тестового фреймворка нет, предложить настройку (например, Vitest + React Testing Library) и согласовать scope с пользователем;
- если тест не добавлен, объяснить причину и согласовать с пользователем;
- для docs/process-only изменений указать, что кодовые тесты не применимы, и заменить их `state:check`, `docs:check`, semantic sync dry-run и review ссылок.

## 15. Final checklist before commit

Перед commit Codex должен пройти чеклист:

```text
[ ] TypeScript чисто
[ ] ESLint чисто
[ ] Build проходит
[ ] Smoke tests проходят, если затронуты API
[ ] Supabase migrations проверены, если затронута БД
[ ] Happy path вручную проверен или описан
[ ] Edge case вручную проверен или описан
[ ] Документация обновлена, если нужно
[ ] Debug-код удалён
[ ] Нет секретов в изменениях
[ ] Нет лишних файлов в commit
[ ] Commit message по Conventional Commits
[ ] Все публичные функции задокументированы (JSDoc)
[ ] Новые переменные окружения добавлены в `.env.example` / `.env.local.example` и типизированы
[ ] Проведён self-review архитектуры (SOLID, нет God-объектов)
[ ] Проанализирована производительность (EXPLAIN, bundle, route latency или указано unverified)
[ ] Проведена проверка безопасности (угрозы, OWASP/STRIDE, DTO safety)
[ ] AI-generated output безопасно валидируется, кодируется и рендерится по `25-production-excellence.md`, раздел `9.1`, если применимо
[ ] Код соответствует стандартам доступности (a11y), если менялся UI
[ ] Сгенерирована или обновлена OpenAPI документация, если API менялось; если OpenAPI ещё нет, предложено её создание
[ ] Staged diff просмотрен вручную
[ ] `git diff --cached --check` чистый
[ ] Secret scan по staged diff не нашёл секреты
```

## 16. Stop Signal Rule

Codex обязан остановиться и спросить пользователя, если:

- после анализа вариантов всё ещё не понимает бизнес-логику;
- документация конфликтует с кодом;
- схема БД конфликтует с кодом;
- нужно удалить или изменить реальные данные;
- нужно добавить новый npm-пакет без очевидной необходимости;
- нужно изменить Vercel/Supabase secrets;
- задача требует затронуть больше 5 файлов;
- задача превращается в архитектурный рефакторинг;
- есть риск сломать production.

Codex не должен угадывать бизнес-логику и писать заглушки, которые выглядят как готовая функция.

Агент не должен останавливаться, если задача технически понятна, но требует длительного обдумывания; в этом случае нужно продолжать анализ и фиксировать подробный reasoning summary, альтернативы, риски и evidence.

При малейшей неясности бизнес-логики агент обязан предложить 2-3 варианта трактовки с плюсами/минусами и рекомендуемым вариантом, а не просто спросить «что делать?».

Перед остановкой агент должен предложить решение и его обоснование, демонстрируя, что он провёл анализ.
