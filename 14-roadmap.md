# 14 - Roadmap проекта

## Назначение файла

Этот файл является главным источником порядка разработки проекта **Новая эпоха**.

Если другие документы конфликтуют с этим roadmap, правильным считается этот файл.

Главное правило: **одна версия - один понятный рабочий результат**.

## Текущий статус

<!-- SYNC:CURRENT_PHASE_START -->
**Текущая фаза:** v1.3 - Judge Mode (stable)
<!-- SYNC:CURRENT_PHASE_END -->

<!-- SYNC:PROJECT_STATUS_START -->
**Статус проекта:** `stable`
<!-- SYNC:PROJECT_STATUS_END -->

<!-- SYNC:PROJECT_VERSION_START -->
**Текущая версия:** `v1.3.0`
<!-- SYNC:PROJECT_VERSION_END -->


```text
v0.7.0-alpha.1 - Code Arena Lite stabilization
# текущая рабочая ветка: v0.6/v0.7 функциональность есть в дереве, но этап не считается stable до полного verification gate
```

Сейчас уже есть:

- рабочий Next.js проект;
- Prompt Arena UI;
- `/api/models`;
- `/api/compare`;
- `/api/health`;
- `/api/vote`;
- `/api/guest`;
- `/api/code-models`;
- `/api/code-compare`;
- OpenRouter на backend;
- Supabase PostgreSQL migrations;
- `/api/models` читает Supabase catalog с hardcoded fallback;
- безопасная server-side allowlist моделей как fallback;
- валидация `prompt`, `modelIds`, `modeSlug`;
- исправленная обработка API-ошибок;
- базовый in-memory rate limit для `/api/compare`;
- server-only Supabase client;
- browser-side Supabase client только с publishable key;
- best-effort сохранение `tasks` и `model_responses`;
- сохранение Winner vote из основной Prompt Arena через `POST /api/vote`;
- profiles/grants migrations;
- синхронизированная история Supabase migrations;
- исправленная схема `votes` на `model_response_id` и `vote_type = 'best' | 'like' | 'dislike'`;
- smoke-check script `npm run smoke`;
- минимальный GitHub Actions CI;
- Access Gate, guest session через httpOnly cookie `na_guest`;
- Auth SSR, profile, avatar upload, email/password management;
- Code Arena Lite без запуска пользовательского кода;
- подготовленные governance metadata для model catalog без утверждения live-verification OpenRouter IDs.

Ближайший плановый UX-подэтап:

```text
v0.7.1 - Arena UX and Fair Voting
# streaming, blind voting, code diff, базовый share/copy и усиление защиты гостей
```

Следующий главный этап:

```text
v0.8 - History and Production Readiness
# история сравнений, публичные ссылки, критерии оценки, preview/production, observability и release gate
```

Детальные планы текущих направлений вынесены в файлы:

```text
20-auth-guest-profile-plan.md
# Auth, guest mode и профиль

17-code-arena-spec.md
# Code Arena Lite и будущий Runner

41-enterprise-readiness-roadmap.md
# план выхода на международный corporate-grade уровень
```

## Канонический порядок версий

| Версия | Название | Главный результат | Статус |
|---|---|---|---|
| `v0.1` | Project Documentation | Документация и структура проекта | Готово |
| `v0.2` | Next.js Base | Проект запускается локально | Готово |
| `v0.3` | UI MVP | Интерфейс Prompt Arena без реального AI | Готово |
| `v0.4` | OpenRouter Integration | Реальные AI-ответы через backend | Готово |
| `v0.4.1` | OpenRouter Integration Fix | Исправлена валидация, ошибки, документация | Готово |
| `v0.5` | Supabase Integration | Модели, задачи и ответы через Supabase | Готово |
| `v0.5.1` | Migration Sync | Репозиторий и remote Supabase migrations синхронизированы | Готово |
| `v0.5.2` | Health and Voting Foundation | `/api/health`, smoke-check, исправленная база votes | Готово |
| `v0.5.3` | Voting MVP Stabilization | Основная Prompt Arena сохраняет Winner vote через `/api/vote`, добавлен CI | Завершён |
| `v0.5.4` | Vote Security & Auth Foundation | Vote dedup RPC, user-aware rate limiting, security headers (CSP/HSTS), proxy/session refresh fix | Verify |
| `v0.6` | Auth, Guest Mode and Profile | Гости, аккаунты, профиль, аватар, email/password, ограничения моделей | Verify |
| `v0.7` | Code Arena Lite | Сравнение кодовых решений без запуска кода | Текущая alpha-стабилизация |
| `v0.7.1` | Arena UX and Fair Voting | Streaming, Blind Arena, Code Diff, быстрый share/copy и guest anti-abuse | Следующий UX-подэтап |
| `v0.8` | History and Production Readiness | История сравнений, публичные ссылки, критерии оценки, preview/production smoke, observability baseline | Завершён |
| `v0.9` | Stable Arena Hardening | Финальная стабилизация Prompt Arena + Code Arena Lite перед v1.0 | Завершён |
| `v1.0` | Stable Arena MVP | Первая стабильная публичная версия MVP | **Завершён** |
| `v1.1` | Enterprise Readiness Foundation | SLO, monitoring, incident process, privacy/compliance baseline, supply-chain checks | **В разработке** |
| `v1.2` | Multi Model Battle | Формальные бои моделей | Позже |
| `v1.3` | Judge Mode | Модель-судья оценивает ответы | Позже |
| `v1.4` | Leaderboard | Рейтинг моделей | **В разработке** |
| `v1.5` | Admin Panel and Limits | Управление моделями, лимитами и тарифами | **В разработке** |
| `v1.6` | Enterprise Governance and Billing | роли, аудит, лимиты, billing-ready governance | Позже |
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

Готово:

- создать таблицы `models`, `tasks`, `model_responses`;
- добавить `profiles`, RLS policies и auth trigger;
- заполнить `models` curated free OpenRouter set;
- добавить server-side Supabase client;
- добавить browser-side Supabase client только с publishable key;
- `/api/models` читает активные публичные модели из Supabase;
- если Supabase catalog недоступен, `/api/models` использует hardcoded fallback;
- в Supabase mode `modelIds` равны UUID из `models.id`;
- backend получает `models.model_key` и вызывает OpenRouter;
- `/api/compare` создаёт запись в `tasks`;
- `/api/compare` сохраняет ответы в `model_responses`;
- ответ `/api/compare` возвращает `taskId` или `null`, если persistence недоступен.

## v0.5.1 - Migration Sync

Цель: привести remote Supabase и GitHub migrations к одному состоянию.

Готово:

- восстановлены отсутствующие timestamp migrations;
- удалены устаревшие `0007` и `0008` миграции;
- `prompt_text` окончательно заменён на `task_text`;
- `08-database.md` синхронизирован с фактическим состоянием базы.

## v0.5.2 - Health and Voting Foundation

Цель: добавить диагностику production и подготовить базу под будущее голосование.

Готово:

- добавлен `/api/health`;
- добавлен `scripts/smoke-check.mjs`;
- добавлен `npm run smoke`;
- исправлена структура `votes`;
- `src/lib/server/votes.ts` переведён на `model_response_id` и `best`;
- добавлена миграция `20260609095422_align_votes_indexes.sql`;
- старые широкие индексы votes удалены;
- новые индексы разделяют `best` и `like/dislike` reactions.

## v0.5.3 - Voting MVP Stabilization

Цель: закрыть текущий MVP-этап без запуска v0.6.

Готово:

- основная `/arena` сохраняет Winner vote через `POST /api/vote`;
- `/arena-voting` больше не содержит отдельную копию бизнес-логики;
- UI показывает состояние сохранения, успех и ошибку Winner vote;
- кнопка Winner отключена, если сравнение не сохранено в Supabase и голос нельзя записать в БД;
- `README.md`, `AGENTS.md`, `15-changelog.md` и package metadata синхронизированы на `v0.5.3`;
- добавлен минимальный GitHub Actions CI;
- model catalog зафиксирован как Supabase-first с hardcoded fallback;
- governance metadata для моделей подготовлены через `raw_metadata`;
- OpenRouter model IDs оставлены с явным TODO на live-verification перед public deploy.

## v0.6 - Auth, Guest Mode and Profile

Цель: сделать пользователей и гостевой режим фундаментом дальнейшего проекта.

Подробное ТЗ: `20-auth-guest-profile-plan.md`.

### v0.6.1 - Guest Mode

Главный результат: при нажатии на гостевой режим автоматически создаётся карточка вида `Анонимус #4827`.

Что сделать:

- создать таблицу `anonymous_sessions`;
- добавить генератор `Анонимус #1234`;
- добавить `avatarSeed` и `colorSeed`;
- хранить guest display info в `localStorage`;
- показывать guest card в UI;
- не передавать guest id в `/api/compare`; backend использует httpOnly cookie `na_guest`;
- сохранять `tasks.anonymous_session_id`.

### v0.6.2 - Model Access Levels

Главный результат: гости используют только бесплатные модели.

Что сделать:

- добавить `models.access_level`;
- значения: `anonymous`, `registered`, `premium`;
- `/api/models` фильтрует модели по user/guest режиму;
- `/api/compare` повторно проверяет доступ на backend;
- при нарушении возвращать `403 MODEL_NOT_ALLOWED`.

### v0.6.3 - Auth SSR

Главный результат: пользователь может зарегистрироваться, войти и выйти.

Что сделать:

- добавить `@supabase/ssr`;
- создать Supabase browser/server clients;
- добавить proxy/cookies session refresh;
- создать `/auth`;
- создать `/auth/callback`;
- добавить login/signup/logout.

### v0.6.4 - Profile MVP

Главный результат: функциональная страница `/profile`.

Что сделать:

- расширить `profiles`;
- добавить `first_name`, `last_name`, `display_name`, `avatar_url`, `role`, `plan`;
- редактировать имя, фамилию и отображаемое имя;
- показывать email, роль, план и дату регистрации;
- добавить базовую статистику.

### v0.6.5 - Avatar Upload

Главный результат: пользователь может загрузить фото профиля.

Что сделать:

- создать Supabase Storage bucket `avatars`;
- добавить Storage RLS policies;
- разрешить upload/update/delete только владельцу;
- сохранить `profiles.avatar_url`.

### v0.6.6 - Email and Password Management

Главный результат: пользователь может менять email и пароль безопасным способом.

Что сделать:

- change email через Supabase Auth;
- forgot password;
- update password;
- нейтральные сообщения безопасности.

### v0.6.7 - User-linked Arena

Главный результат: Prompt Arena понимает user/guest.

Что сделать:

- `/api/compare` определяет user или guest;
- для аккаунта сохраняет `tasks.user_id`;
- для гостя сохраняет `tasks.anonymous_session_id`;
- профиль показывает статистику по задачам, ответам и голосам.

### v0.6.8 - Testing and Deployment

Главный результат: Auth/Guest/Profile не ломают текущий production.

Команды:

```bash
npm run typecheck
# проверить TypeScript

npm run lint
# проверить ESLint

npm run build
# проверить production build

npm run smoke
# проверить /api/health и /api/models

supabase db reset
# проверить чистый локальный клон миграций

supabase db push
# проверить remote sync
```

## v0.7 - Code Arena Lite

Цель: добавить кодовый режим без запуска пользовательского кода.

Что уже должно быть в alpha:

- страница `/code`;
- `GET /api/code-models`;
- `POST /api/code-compare`;
- выбор языка и framework context;
- сравнение 2-3 code-capable моделей через backend/OpenRouter;
- сохранение запуска как `tasks.mode_slug = 'code-arena'`;
- Winner vote через общий `/api/vote`;
- запрет на `eval`, `child_process`, sandbox/test runner и любое выполнение пользовательского кода.

Критерий выхода из alpha:

```bash
npm run typecheck
npm run lint
npm run build
npm run docs:check
npm run smoke
```

Если затронута БД:

```bash
npm run env:check:migrations
npm run schema:check
supabase migration list
```

## v0.7.1 - Arena UX and Fair Voting

Цель: резко снизить трение в Arena-режимах и начать собирать более честные данные о качестве моделей без преждевременного запуска Judge Mode, Leaderboard или Code Runner.

Что сделать:

- добавить live streaming ответов для Prompt Arena и Code Arena Lite, чтобы ответы 2-3 моделей появлялись параллельно по мере генерации;
- добавить Blind Arena: до голосования пользователь видит ответы как `Модель A`, `Модель B`, `Модель C`, а реальные названия раскрываются после выбора;
- перемешивать порядок ответов перед показом, сохраняя корректную связь с `model_responses` и `/api/vote`;
- добавить кнопку copy для каждого ответа и быстрый share action для сохранённого сравнения;
- добавить Code Diff для Code Arena Lite: syntax highlighting и side-by-side diff без выполнения кода;
- усилить guest anti-abuse: лимиты для гостей, ограничение длины prompt/code task, понятное предложение регистрации после лимита;
- подготовить дизайн точного кэширования одинаковых запросов по ключу `mode + prompt + models + access level`, без semantic cache на этом этапе.

Критерии готовности:

```bash
npm run typecheck
npm run lint
npm run build
npm run docs:check
npm run smoke
```

Если затронута БД:

```bash
npm run env:check:migrations
npm run schema:check
supabase migration list
```

Границы этапа:

- не добавлять запуск пользовательского кода;
- не добавлять Code Arena Runner;
- не добавлять официальный Judge Mode;
- не добавлять глобальный Leaderboard или Elo-рейтинг;
- не добавлять Batch Testing, мультимодальные загрузки или RAG;
- не добавлять новые дорогие модели без лимитов и cost visibility.

## v0.8 - History and Production Readiness

Цель: дать пользователю открыть прошлые сравнения, делиться результатами и подготовить проект к контролируемому production-пути.

Что сделать:

- создать страницу истории;
- создать `/api/history`;
- создать `/api/history/[taskId]`;
- показывать task, responses, vote;
- добавить публичные read-only ссылки на сохранённые сравнения с owner/privacy rules;
- добавить Open Graph preview для публичных батлов: prompt preview, режим, модели после раскрытия и счётчик голосов;
- добавить многокритериальную оценку ответов без официального Leaderboard: точность, полнота, краткость, следование инструкции, качество кода и безопасность кода;
- добавить фильтры истории по дате, режиму, моделям и ключевым словам;
- реализовать точное кэширование одинаковых запросов только после privacy/retention решения и с явным cache hit marker;
- проверить Vercel env;
- проверить production build;
- проверить реальные OpenRouter calls;
- проверить Supabase connection;
- проверить регистрацию, guest mode, profile и Code Arena Lite;
- добавить request id в API errors/logs;
- закрепить preview/production smoke procedure.

Что оставить позже:

- semantic caching через `pgvector`;
- Batch Testing через CSV;
- мультимодальные загрузки PDF/CSV/картинок/аудио;
- private arenas и RAG;
- официальный Judge Mode и глобальный Leaderboard.

## v0.9 - Stable Arena Hardening

Цель: стабилизировать Prompt Arena и Code Arena Lite перед `v1.0`, улучшить повторное использование и подготовить продукт к публичному MVP.

Что сделать:

- добавить Prompt Library с сохранёнными шаблонами и переменными вида `{{table_name}}`;
- добавить сценарии использования: деловое письмо, объяснение концепции, код-ревью, SQL, React/Next.js задача;
- добавить предварительный расчёт стоимости и токенов для выбранных моделей, если данные модели позволяют это сделать безопасно и понятно;
- добавить персональную аналитику пользователя по истории: какие модели чаще выигрывают у него в разных категориях;
- подготовить спецификацию Consensus Mode, где отдельная модель собирает лучший финальный ответ из 2-3 результатов, но включать реализацию только после лимитов, cost visibility и отдельного user confirmation;
- довести mobile UX, loading/error/success states и accessibility до release-ready состояния.

Границы этапа:

- персональная аналитика не является публичным Leaderboard;
- Consensus Mode не является Judge Mode и не должен подменять официальную оценку моделей;
- любые новые платные/дорогие вызовы требуют лимитов, cost preview и server-side enforcement.

## v1.0 - Stable Arena MVP

Цель: первая стабильная публичная версия проекта.

Критерии:

- пользователь вводит задачу;
- выбирает 2-3 модели;
- получает реальные ответы;
- выбирает победителя;
- данные сохраняются;
- история работает;
- streaming, blind voting, copy/share и Code Diff работают без регрессий;
- публичные ссылки не раскрывают приватные данные;
- guest mode работает;
- регистрация работает;
- профиль работает;
- Code Arena Lite работает без запуска кода;
- проект опубликован и проверен через production smoke;
- секреты не попали в GitHub.

## v1.1 - Enterprise Readiness Foundation

Цель: подготовить проект к международному corporate-grade уровню без преждевременного усложнения продукта.

Что сделать:

- SLO/SLA baseline для `/`, `/arena`, `/code`, `/api/health`, `/api/models`;
- structured logs с request id без секретов и без prompt body в обычных логах;
- incident response и rollback procedure;
- dependency/security scanning, secret scanning, SBOM и lockfile policy;
- privacy/retention baseline для prompt data, guest data и account data;
- AI safety baseline по provider errors, abuse limits, prompt privacy и model governance;
- policy для semantic caching через `pgvector`: когда можно переиспользовать ответ, как показывать cache hit и как не смешивать приватные данные;
- release checklist для Local -> Preview -> Staging -> Production;
- documented support process для пользователей и enterprise-пилотов.

Ориентиры качества:

```text
OWASP ASVS, OWASP LLM Top 10, NIST SSDF, SLSA, ISO 27001/SOC 2 readiness, Google SRE practices, GDPR/EU AI Act awareness
# это рамки для контроля зрелости, не требование сертификации на v1.1
```

## После v1.0

Только после стабильной Prompt Arena можно двигаться к:

- Enterprise Readiness Foundation;
- Multi Model Battle;
- Judge Mode;
- Leaderboard;
- Admin Panel and Limits;
- Code Arena Runner;
- Image Arena MVP;
- AI Team Mode.

## Image Arena MVP

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
