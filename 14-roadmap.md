# 14 - Roadmap проекта

## Назначение файла

Этот файл является главным источником порядка разработки проекта **Новая эпоха**.

Если другие документы конфликтуют с этим roadmap, правильным считается этот файл.

Главное правило: **одна версия - один понятный рабочий результат**.

## Текущий статус

<!-- SYNC:CURRENT_PHASE_START -->
**Текущая фаза:** v2.0 - AI Team Mode
<!-- SYNC:CURRENT_PHASE_END -->

<!-- SYNC:PROJECT_STATUS_START -->
**Статус проекта:** `in_development`
<!-- SYNC:PROJECT_STATUS_END -->

<!-- SYNC:PROJECT_VERSION_START -->
**Текущая версия:** `v2.0.0-alpha.1`
<!-- SYNC:PROJECT_VERSION_END -->


```text
v2.0.0-alpha.1 - AI Team Mode
# текущая рабочая ветка: AI Team Mode; 4 роли (Planner → Researcher → Critic → Finalizer) за feature flag
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
- `/api/judge`;
- `/api/code-run`;
- `/api/admin/audit`;
- `/api/admin/usage`;
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
- Judge Mode и сохранение `tasks.judge_verdict`;
- Leaderboard;
- admin routes для audit/usage/model/user management;
- Code Arena Runner через внешний Piston runner для авторизованных пользователей;
- подготовленные governance metadata для model catalog без утверждения live-verification OpenRouter IDs;
- AI Team Mode: `POST /api/team-run` (auth gate, rate 3/10 min, 4 роли) + страница `/team` за feature flag; current runtime persistence: `tasks` + `model_responses`;
- Image Arena backend: `POST /api/image-compare` alpha (auth only, Supabase Storage with degraded provider-URL fallback);
- DB v2 Foundation: 8 таблиц аналитики и истории (`usage_events`, `team_runs`, `team_run_steps`, `code_runs`, `leaderboard_snapshots`, `artifacts`, `model_price_history`, `cleanup_log`); миграция создана, не применена; runtime writes to `usage_events` and `team_runs`/`team_run_steps` are planned for v2.1.

Текущий release-gate для v2.0:

```text
v2.0.0-alpha.1 - AI Team Mode
# AI Team Mode в alpha за feature flag NEXT_PUBLIC_ENABLE_TEAM_MODE ✅
# DB v2 Foundation файл создан; применить в Supabase Dashboard перед stable
# Upstash Redis требует настройки в Vercel перед stable release
# Перевод в stable только после full smoke-test на production окружении
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
| `v0.7` | Code Arena Lite | Сравнение кодовых решений без запуска кода | Завершён |
| `v0.7.1` | Arena UX and Fair Voting | Streaming, Blind Arena, Code Diff, быстрый share/copy и guest anti-abuse | Завершён |
| `v0.8` | History and Production Readiness | История сравнений, публичные ссылки, критерии оценки, preview/production smoke, observability baseline | Завершён |
| `v0.9` | Stable Arena Hardening | Финальная стабилизация Prompt Arena + Code Arena Lite перед v1.0 | Завершён |
| `v1.0` | Stable Arena MVP | Первая стабильная публичная версия MVP | **Завершён** |
| `v1.1` | Enterprise Readiness Foundation | SLO, monitoring, incident process, privacy/compliance baseline, supply-chain checks | Завершён |
| `v1.2` | Multi Model Battle | Формальные бои моделей | Завершён |
| `v1.3` | Judge Mode | Модель-судья оценивает ответы | Завершён |
| `v1.4` | Leaderboard | Рейтинг моделей | Завершён |
| `v1.5` | Admin Panel and Limits | Управление моделями, лимитами и тарифами | Завершён |
| `v1.6` | Enterprise Governance and Billing | роли, аудит, лимиты, billing-ready governance | Завершён |
| `v1.7` | Code Arena Runner | Запуск кода через внешний runner для авторизованных пользователей | Завершён |
| `v1.8` | Image Arena MVP | Сравнение изображений от image-моделей | Завершён |
| `v2.0` | AI Team Mode | Командная работа нескольких AI-моделей | **В разработке** |

## Future Roadmap Drafts

Версии после v2.0 пока не являются активным release scope. Их рабочие draft-документы вынесены из корня проекта в `docs/roadmap-drafts/`, чтобы `14-roadmap.md` оставался каноническим порядком этапов, а будущие планы не выглядели как утверждённые задачи.

| Draft | Тема | Статус |
|---|---|---|
| `docs/roadmap-drafts/v2.1-draft.md` | Telemetry & Analytics Foundation | Draft |
| `docs/roadmap-drafts/v2.2-draft.md` | Cost Management & Admin Dashboard | Draft |
| `docs/roadmap-drafts/v2.3-draft.md` | Monetization & Stripe Billing | Draft |
| `docs/roadmap-drafts/v2.4-draft.md` | Advanced Billing & Platform Reliability | Draft |
| `docs/roadmap-drafts/v2.5-draft.md` | Developer API & Platform Openness | Draft |
| `docs/roadmap-drafts/v2.6-draft.md` | Enterprise & Team Collaboration | Draft |
| `docs/roadmap-drafts/v2.7-draft.md` | SSO & Identity Management | Draft |
| `docs/roadmap-drafts/v2.8-draft.md` | Compliance, Observability & Platform Maturity | Draft |
| `docs/roadmap-drafts/v3.0-draft.md` | Global Platform & Data Residency | Draft |
| `docs/roadmap-drafts/v3.1-draft.md` | Platform Ecosystem & Advanced Scale | Draft |
| `docs/roadmap-drafts/project-vision-draft.md` | Long-term platform vision | Draft |

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

Цель: создать проект, который запускается локально без ошибок, с инфраструктурой качества и фундаментом для масштабирования.

Готово:

**Стек:**
- Next.js 16 (App Router — не Pages Router)
- React 19, TypeScript strict mode
- ESLint с Next.js preset
- Tailwind CSS v4
- Базовая структура `src/app/` (layout, page, globals.css)
- Главная страница с минимальным UI

**Архитектурные решения:**
- App Router (не Pages Router) — выбран сразу; все server components, route handlers и middleware строятся на нём
- `src/` директория — весь код внутри `src/`, не в корне
- Структура: `src/app/` · `src/components/` · `src/features/` · `src/lib/` · `src/types/` · `src/config/`

**DX и качество кода:**
- Prettier + `eslint-config-prettier` + `prettier-plugin-tailwindcss`
- Import sorting plugin (`@ianvs/prettier-plugin-sort-imports`)
- Husky + `lint-staged` — pre-commit: lint + typecheck только изменённых файлов
- `cn()` утилита — `clsx` + `tailwind-merge` в `src/lib/utils.ts`

**Конфигурация:**
- `next.config.ts` (TypeScript, не .js)
- Type-safe валидация переменных окружения — `@t3-oss/env-nextjs` + zod (`src/lib/env.ts`)
- `.env.example` с комментариями для всех переменных
- `.nvmrc` + `engines` в `package.json` (Node.js 24 LTS)
- `NEXT_TELEMETRY_DISABLED=1` в CI и production
- `poweredByHeader: false`
- Security headers в `next.config.ts`: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security`
- Локальные шрифты через `next/font` (не внешние запросы к Google Fonts — GDPR)

**TypeScript:**
- Path aliases: `@/*` → `./src/*`, `@/lib/*`, `@/components/*`, `@/types/*`
- `noUncheckedIndexedAccess: true` в `tsconfig.json`

**App Router completeness:**
- `app/error.tsx` — runtime ошибки без падения приложения
- `app/global-error.tsx` — ошибки в root layout
- `app/not-found.tsx` — кастомная 404
- `app/loading.tsx` — Suspense skeleton

**Заглушки под будущие интеграции:**
- `src/middleware.ts` — пустой middleware с комментариями (регионы, сессии, rate limiting)
- `src/lib/flags.ts` — feature flags stub (`getFlag(key): boolean` → возвращает `false`)
- `src/lib/api/error-handler.ts` — унифицированный формат ошибок `{ error: { code, message, trace_id } }`

**Логирование:**
- `pino` — JSON-формат, `trace_id`, `level`, `timestamp`
- `console.log` запрещён в `src/lib/` и `src/features/`

**Тестирование:**
- Vitest + React Testing Library — `vitest.config.ts`, `setupTests.ts`, 1 unit-тест
- Playwright — `playwright.config.ts`, 1 smoke-тест (главная страница загружается без ошибок)

**CI/CD:**
- `.github/workflows/ci.yml`: `npm ci` → `typecheck` → `lint` → `build` → `test`
- Блокировка мёржа в `main` при падении любого шага

**Границы этапа:**
- Нет API routes
- Нет Supabase (→ v0.5)
- Нет OpenRouter (→ v0.4)
- Нет аутентификации (→ v0.6)
- Нет Sentry (→ v1.1)
- Нет pnpm миграции (отдельное решение)

**Критерии готовности:**

```bash
npm run dev           # запускается без ошибок
npm run typecheck     # TypeScript без ошибок
npm run lint          # ESLint без ошибок
npm run build         # production build без ошибок
npm run test          # Vitest проходит
npm run test:e2e      # Playwright smoke проходит
```

## v0.3 - UI MVP

Цель: интерактивный UI Prompt Arena без реальных AI-вызовов. Все ответы — моковые, с симуляцией стриминга. Закладываем UX-паттерны и архитектурные границы для v0.4+.

Готово:

**Архитектура Next.js:**
- `/arena/page.tsx` — React Server Component (RSC); интерактивные части — Client Components (`'use client'`)
- Типы `Model` и `ResponseData` в `src/types/arena.ts` — единый источник истины для v0.4 и далее
- Хук `useModelSelection` — валидация 2–3 моделей, добавление/удаление
- Хук `useWinnerSelection` — одиночный выбор с отменой
- Проп `anonymous: boolean` у `ResponseCard` — задел на Blind Arena (v0.7.1)

**Компоненты (`src/components/arena/`):**
- `PromptInput` — textarea с авто-ресайзом, счётчик символов (жёлтый >90%, красный 100%)
- `ModelSelector` — чекбоксы с цветовыми метками (dot); визуальный фидбек при выборе 2–3 моделей
- `ResponseCard` — анонимное имя («Модель А»), dot той же метки что в селекторе, latency-заглушка
- `StreamingText` — посимвольное появление текста (20–50мс задержка); задел на SSE в v0.4
- `WinnerBadge` — маркер выбора победителя
- Скелетоны анатомически точные: блок под имя, несколько строк под текст, метрики

**UX и функциональность:**
- Автосохранение черновика prompt в `localStorage` (восстановление после перезагрузки)
- Кнопка «Сравнить» — disabled пока prompt невалиден или выбрано < 2 моделей; `Cmd/Ctrl+Enter` как hotkey
- Горячие клавиши: `1`/`2`/`3` — выбор победителя, `Esc` — сброс выбора
- Кнопка «Новое сравнение» — полный сброс состояния без перезагрузки страницы
- `react-markdown` для рендера мок-ответов (код, таблицы, списки)
- Мок-ответы трёх длин (короткий / средний / длинный) — проверка вёрстки при разном контенте
- Состояния UI: empty · loading (анатомические скелетоны) · streaming · success · error (inline, без alert/toast)

**Адаптивность:**
- Desktop: CSS Grid `repeat(auto-fit, minmax(280px, 1fr))` — 2 или 3 колонки по числу моделей
- Mobile (320px+): вертикальный стек; touch targets минимум 44×44px

**Accessibility (a11y):**
- `aria-live="polite"` на область результатов — скринридеры объявляют об изменениях
- `role="radiogroup"` + `role="radio"` + `aria-checked` для выбора победителя
- Focus management: после завершения мок-генерации фокус переходит на область результатов
- Поддержка полной навигации с клавиатуры (Tab, Enter, Space, стрелки)

**Тестирование:**
- Unit-тесты (`useModelSelection`, `useWinnerSelection`): граничные случаи — нельзя < 2, > 3 моделей; отмена выбора победителя; сброс
- RTL-компонентные тесты: disabled кнопка при невалидном состоянии, появление скелетонов, выбор победителя, inline ошибка

**Границы этапа:**
- Нет реальных AI-вызовов и SSE (→ v0.4)
- Нет сохранения голосов и истории в БД (→ v0.5)
- Нет аутентификации (→ v0.6)
- Нет URL-сериализации состояния (→ v0.8)
- Нет framer-motion (CSS transitions достаточно)

**Критерии готовности:**

```bash
npm run typecheck && npm run lint && npm run build
npm run test          # unit + RTL
npm run test:e2e      # Playwright: /arena открывается, форма интерактивна, мок-ответы появляются
```

## v0.4 - OpenRouter Integration

Цель: реальные AI-ответы через backend с мультиплексированным SSE-стримингом, перехватом метаданных и production-grade обработкой ошибок.

Готово:

**Backend (`src/lib/server/openrouter.ts`):**
- `GET /api/models` — список из server-side allowlist; без проксирования полного каталога OpenRouter; `Cache-Control: public, max-age=600`
- `POST /api/compare` — валидация `prompt` (min/max), `modelIds` (2–3, против allowlist), `modeSlug` (enum); параллельные вызовы через `Promise.allSettled` (для partial failures)
- **JSON Envelope SSE** — каждый чанк: `{ modelId, type: 'delta'|'done'|'error', content?, usage? }`; `: ping` каждые 15 сек для keep-alive; без `EventSource` (не поддерживает POST) — `fetch` + `ReadableStream` на клиенте
- **Stream Interceptor** — backend читает стрим OpenRouter, пересылает чанки клиенту, перехватывает финальный системный чанк с `usage` (prompt/completion tokens), вызывает `trackUsageEvent(traceData)` → в v2.1 заменится вставкой в БД
- **Partial Failure** — если одна модель вернула ошибку, SSE отправляет `{ type: 'error' }` только для её `modelId`; остальные продолжают стрим
- `AbortController` с timeout 45s на каждый запрос к OpenRouter
- `OPENROUTER_API_KEY` — только server-side env, не в `NEXT_PUBLIC_`
- `OPENROUTER_MAX_TOKENS` — константа

**Безопасность:**
- `sanitizePrompt()` — обрезка до `OPENROUTER_MAX_CHARS`, базовая защита от System Prompt Override
- Валидация ответа OpenRouter: принимать только `choices[0].delta.content`; отбрасывать `tool_calls` и прочие поля
- XSS protection — backend отдаёт сырой Markdown; `rehype-sanitize` при рендере на клиенте (не на backend)

**Rate Limiting:**
- **Upstash Redis** (не in-memory — in-memory не работает в Vercel Serverless)
- Ответы содержат `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `Retry-After`
- 429 возвращает JSON: `{ error: { code: 'RATE_LIMITED', message, reset_at } }`

**Error taxonomy:**
- `VALIDATION_ERROR` — невалидный prompt/modelIds/modeSlug
- `MODEL_NOT_ALLOWED` — модель не в allowlist
- `PROVIDER_ERROR` — ошибка от OpenRouter API
- `TIMEOUT` — OpenRouter не ответил за timeout
- `RATE_LIMITED` — лимит запросов превышен
- `INTERNAL_ERROR` — всё остальное (без stack trace в ответе)
- `createApiError(code, message)` — единая фабрика ошибок

**Логирование и трейсинг:**
- `X-Request-ID` — генерируется на клиенте, проходит через сервер, возвращается в ответе
- JSON-логи: `trace_id`, `model`, `prompt_length`, `status`, `latency_ms`, `ttft_ms`, `error_code`
- `trackUsageEvent(traceData)` — заглушка, логирует в stdout; в v2.1 — вставка в `usage_events`

**UI:**
- `StreamingText` (из v0.3) подключается к реальному SSE через `fetch` + `ReadableStream`
- Stream Router на клиенте распределяет JSON Envelope чанки по `ResponseCard` на основе `modelId`
- TTFT (Time to First Token) фиксируется и отображается в `ResponseCard` для каждой модели
- `AbortController` на клиенте — отмена при unmount или новом сабмите

**Тестирование:**
- Интеграционные тесты с `msw`: успешный стрим, partial failure, 429, timeout, отмена клиентом
- E2E: реальный вызов `/api/compare` в staging с проверкой SSE-чанков

**Границы этапа:**
- Нет сохранения в БД — `trackUsageEvent` только логирует в stdout (→ v0.5)
- Нет user-aware rate limiting — лимит по IP (→ v0.6)
- Нет Judge Mode, Leaderboard (→ v1.3, v1.4)
- Нет canary token в промптах (→ v1.1)
- Нет раздельных лимитов по стоимости модели (→ v2.3)

**Критерии готовности:**

```bash
npm run typecheck && npm run lint && npm run build
npm run test          # unit + интеграционные (msw)
npm run smoke         # /api/health + /api/models + /api/compare реальный вызов
```

## v0.4.1 - OpenRouter Integration Stabilization

Цель: устранить edge-cases стриминга, оптимизировать UI при генерации и предотвратить утечки ресурсов после первого production-запуска v0.4. Новая функциональность не добавляется.

Готово:

**Backend — управление ресурсами:**
- **Zombie Streams Prevention** — `AbortSignal` из Next.js Route Handler явно пробрасывается во `fetch` к OpenRouter; при закрытии вкладки пользователем серверный запрос к LLM прерывается немедленно, предотвращая фоновое списание токенов и зависание Vercel Serverless функций до timeout
- **Malformed Chunk Handling** — клиентский Stream Router обёрнут в `try/catch`; при получении битого JSON-чанка от провайдера стрим не падает — невалидный пакет пропускается с записью в лог
- Корневые дубликаты server-файлов удалены (файлы вне `src/` конфликтовали со сборкой)

**UI/UX — стриминг:**
- **Smart Auto-Scroll** — авто-скролл карточки работает только если пользователь находится внизу контейнера; при ручном скролле вверх для чтения авто-скролл отключается и не «выдёргивает» экран при новых токенах
- **Markdown Flickering** — буферизация чанков перед передачей в `react-markdown`; устранена DOM-перерисовка при высокочастотных обновлениях стрима
- `latencyMs = 0` корректно отображается в `ResponseCard` (был UI-баг при нулевой задержке)

**UX — сообщения об ошибках:**
- Понятные тексты для каждого error code: `RATE_LIMITED` → «Слишком много запросов, попробуйте через N секунд», `TIMEOUT` → «Ответ не получен за 45 секунд — попробуйте сократить промпт», `MODEL_NOT_ALLOWED` → «Выбранная модель сейчас недоступна»

**Логирование:**
- Маскировка prompt в логах: первые 100 символов + SHA-256 hash остального; полный текст промпта не попадает в stdout

**Тестирование:**
- Unit-тесты: `sanitizePrompt` (обрезка, маркеры), `createApiError` (статус-коды и тела для всех кодов таксономии), `validateModelIds` (allowlist, пустой массив, дубликаты), TTFT расчёт (граничный случай = 0)
- RTL-тесты `StreamingText`: рендер чанков по мере получения, partial response при обрыве соединения, кнопка «Отмена» вызывает `AbortController.abort()`

**Документация:**
- `14-roadmap.md` и JSDoc-комментарии синхронизированы с реальной имплементацией JSON Envelopes и Error Taxonomy

**Границы этапа:**
- Только исправления, оптимизации и cleanup; новые фичи не добавляются
- Memory leak стресс-тест (→ v1.1)
- JSDoc / zod-openapi схемы (→ v2.5)
- Скелетон при загрузке GET /api/models (→ v0.5, когда модели из БД)

## v0.5 - Supabase Integration

Цель: подключение PostgreSQL через Supabase — модели из БД, сохранение задач и ответов, схема готова к истории (v0.8) и аналитике (v2.1).

Готово:

**Схема БД (`supabase/migrations/`):**
- `models` — `id (UUID)`, `model_key`, `name`, `provider`, `access_level`, `is_active`, `created_at`
- `tasks` — `id`, `user_id (NULL до v0.6)`, `anonymous_session_id`, `mode_slug`, `prompt`, `status`, `created_at`
  - `status` жизненный цикл: `pending → streaming → completed | failed`
  - `mode_slug` — VARCHAR с CHECK constraint (enum допустимых режимов)
- `model_responses` — `task_id`, `model_id`, `response_text`, `ttft_ms`, `latency_ms`, `prompt_tokens`, `completion_tokens`, `error_code`, `cost_estimate_usd NUMERIC(10,6) DEFAULT 0`, `created_at`
- `profiles` — расширение `auth.users`: `display_name`, `plan`, `role`, `created_at`
- Индексы (первая миграция): `idx_tasks_user_id`, `idx_tasks_anon_session`, `idx_tasks_created_at_desc`, `idx_model_responses_task_id`

**Клиенты и Connection Pooling:**
- `src/lib/server/supabase.ts` — `SERVICE_ROLE_KEY` + **Supavisor (порт 6543, Transaction Pooling)**; `import 'server-only'` запрещает импорт в браузер; без пулера Vercel Serverless исчерпает лимит соединений PostgreSQL
- `src/lib/client/supabase.ts` — `ANON_KEY` + `NEXT_PUBLIC_SUPABASE_URL`; без секретов

**RLS (Row Level Security):**
- `models`: SELECT публичный; INSERT/UPDATE/DELETE только `service_role`
- `tasks`, `model_responses`: в v0.5 криптографический RLS через `auth.uid()` **недоступен** (Auth в v0.6); защита анонимных задач обеспечивается на уровне API (httpOnly cookie с `anonymous_session_id`); строгий DB-level RLS включается в v0.6
- `profiles`: SELECT/UPDATE только своего (`auth.uid()`)

**API:**
- `GET /api/models` — читает активные модели из Supabase с фильтрацией по `access_level`; анонимам возвращаются только модели с `access_level = 'anonymous'`; при недоступности БД → hardcoded fallback без 500 ошибки
- `POST /api/compare` — после завершения SSE-стрима best-effort INSERT в `tasks` + `model_responses`; при ошибке вставки: лог в stderr с `ERROR` уровнем + `trace_id` (для будущего восстановления); возвращает `taskId` или `null`
- `trackUsageEvent()` из v0.4 — реализован как вставка `prompt_tokens`, `completion_tokens`, `error_code` в `model_responses`

**Миграции и seeding:**
- Timestamp-файлы в `supabase/migrations/`; `supabase db push` для dev; `supabase migration list` для верификации
- `supabase/seed.sql` — заполняет `models` curated free OpenRouter set с `access_level: 'anonymous'` при `supabase start`

**Типизация:**
- `supabase gen types typescript --linked > src/lib/database.types.ts` после миграции
- Все обращения к клиенту используют сгенерированные типы

**Тестирование:**
- SQL-скрипты для проверки RLS: аноним не читает чужие задачи; INSERT в `models` от `anon` падает
- Интеграционные тесты: `GET /api/models` из БД + fallback при недоступности; `POST /api/compare` создаёт `tasks` + `model_responses`
- `supabase start` для локальной среды в CI

**Границы этапа:**
- Нет Auth и криптографического RLS для `user_id` (→ v0.6)
- Нет Supabase Anonymous Auth (→ v0.6)
- Нет UI истории (→ v0.8)
- Нет применённой runtime-записи в `usage_events` (→ v2.1; DB v2 Foundation migration file exists but is not applied yet)
- Нет in-memory кэша fallback для моделей (→ v0.8)

## v0.5.1 - Migration Sync & Schema Hardening

Цель: устранение schema drift между remote Supabase и GitHub, восстановление целостности истории миграций и семантическая адаптация схемы под мультимодальность.

Готово:

**Механика миграций:**
- **`supabase migration repair`** — устаревшие миграции `0007` и `0008` исключены из истории `supabase_migrations.schema_migrations` через официальный CLI, без ручного SQL-вмешательства в системные таблицы
- Восстановлены отсутствующие timestamp-миграции для синхронизации remote-окружения с локальным состоянием

**Семантическое переименование:**
- **`prompt_text` → `task_text`** во всех таблицах и коде: `prompt_text` семантически ограничивало поле Prompt Arena; `task_text` точнее отражает мультимодальную природу платформы (Code Arena, Image Arena, Agent Team Mode)
- Пересозданы все RLS-политики, триггеры и представления, ссылавшиеся на старое имя колонки — `RENAME COLUMN` в PostgreSQL не обновляет зависимые объекты автоматически, что может привести к молчаливым блокировкам доступа

**Синхронизация кодовой базы:**
- Регенерированы TypeScript-типы Supabase (`supabase gen types typescript`) после изменения схемы
- `08-database.md` синхронизирован с фактическим состоянием миграций и новым неймингом

**Процессное правило (предотвращение повторения):**
- Зафиксирован запрет DDL-изменений (таблицы, колонки, индексы) через Supabase Dashboard UI; все изменения только через Supabase CLI + Git; исключение — локальный `supabase start`

**Границы этапа:** только инфраструктурный hotfix и cleanup; новые фичи не добавляются

## v0.5.2 - Health and Voting Foundation

Цель: production-диагностика с shallow/deep health checks и защищённая схема голосования перед внедрением UI в v0.5.3.

Готово:

**Health Check:**
- `GET /api/health` (shallow) — мгновенный `200 OK` без внешних вызовов; используется для liveness probes
- `GET /api/health/deep` (readiness) — полная проверка Supabase (`SELECT 1`), OpenRouter reachability, Upstash Redis; кэшируется 30 сек; возвращает structured JSON:
  ```json
  { "status": "healthy|degraded|unhealthy", "version": "v0.5.2",
    "environment": "production", "commitSha": "...",
    "checks": { "supabase": { "status": "ok", "latency_ms": 45 }, ... } }
  ```
- `SELECT 1 FROM models LIMIT 1` в deep check выявляет проблемы с миграциями и RLS-блокировками
- `503` если хотя бы один критический сервис недоступен; `degraded` если Redis недоступен, но core работает

**Smoke Check (`scripts/smoke-check.mjs` + `npm run smoke`):**
- Детализированный вывод: HTTP-статус + время каждого шага
- Последовательность: `/api/health` → `/api/models` (≥1 модель присутствует) → тест создания task → тест голосования → проверка double voting protection (повторный голос → unique error)
- CI шаг после деплоя: `npm run smoke`; провал блокирует pipeline

**Схема `votes` — защита от накруток:**
- Голос привязан к `model_response_id` (ответ модели), не к `task_id` — пользователь голосует за конкретный ответ
- `vote_type` enum: `'best' | 'like' | 'dislike'`; `best` — одиночный выбор победителя, `like/dislike` — реакции
- `task_id` денормализован в `votes` (взят из `model_responses.task_id`) — убирает лишний JOIN в аналитике и Leaderboard
- `REFERENCES model_responses(id)` — внешний ключ; мусорные голоса за несуществующие ответы невозможны
- `revoked_at TIMESTAMPTZ` — soft delete для undo функциональности
- `ip_address INET`, `user_agent TEXT` — forensic data для расследования бот-атак
- `fingerprint_hash TEXT` — хэш IP + User-Agent для анонимной дедупликации до появления Auth (v0.6)

**Double Voting Prevention (Unique Constraints):**
```sql
-- Один победитель от одного источника
CREATE UNIQUE INDEX idx_votes_unique_best
  ON votes (model_response_id, COALESCE(user_id::text, fingerprint_hash))
  WHERE vote_type = 'best' AND revoked_at IS NULL;

-- Одна реакция от одного источника
CREATE UNIQUE INDEX idx_votes_unique_reaction
  ON votes (model_response_id, COALESCE(user_id::text, fingerprint_hash), vote_type)
  WHERE vote_type IN ('like', 'dislike') AND revoked_at IS NULL;
```

**Индексы (задел на Leaderboard v1.4):**
- `idx_votes_best` — частичный, только `vote_type = 'best'`
- `idx_votes_reactions` — для `like/dislike`
- `idx_votes_leaderboard` — `(model_response_id, vote_type, created_at DESC) WHERE revoked_at IS NULL`
- `idx_votes_fingerprint` — `(fingerprint_hash, created_at DESC) WHERE user_id IS NULL`

**Тестирование:**
- Unit-тесты health endpoint (msw): 200 при всех ok, 503 при падении Supabase, degraded при недоступности Redis
- Интеграционные тесты votes: вставка, повторная вставка (unique constraint error), голос за несуществующий ответ (FK error)

**Границы этапа:**
- Нет UI голосования и `/api/vote` endpoint (→ v0.5.3)
- Нет криптографического auth; анонимная дедупликация через `fingerprint_hash` (→ v0.6)
- Нет temporal constraints (голосовать ≤7 дней) — нужна `platform_settings` таблица (→ v0.8)
- Нет Leaderboard и ELO расчёта (→ v1.4)
- Нет Prometheus метрик votes (→ v2.8)

## v0.5.3 - Voting MVP Stabilization

Цель: закрыть текущий MVP-этап без запуска v0.6. Устранить критическую уязвимость «Несколько победителей», добавить безопасную архитектуру голосования, Optimistic UI с rollback и надёжные тесты.

### Критическое: «Один победитель на задачу»

Уязвимость в v0.5.2: индекс `(model_response_id, COALESCE(user_id, fingerprint_hash)) WHERE vote_type = 'best' AND revoked_at IS NULL` не предотвращает ситуацию, когда пользователь выбирает победителем Модель A, а затем Модель B в той же задаче — обе записи имеют разные `model_response_id`, обе проходят проверку.

**Исправление:**

```sql
-- Уникальный индекс на уровне ЗАДАЧИ (не model_response)
CREATE UNIQUE INDEX idx_one_best_per_task
  ON votes (task_id, COALESCE(user_id, fingerprint_hash))
  WHERE vote_type = 'best' AND revoked_at IS NULL;
```

**Атомарная смена победителя** — в одной транзакции:

```sql
BEGIN;
  -- 1. Атомарно отзываем предыдущий best голос (безопасно при race condition)
  UPDATE votes
     SET revoked_at = now()
   WHERE task_id = $task_id
     AND COALESCE(user_id, fingerprint_hash) = COALESCE($user_id, $fp_hash)
     AND vote_type = 'best'
     AND revoked_at IS NULL;

  -- 2. Вставляем новый голос
  INSERT INTO votes (task_id, model_response_id, user_id, fingerprint_hash, vote_type)
  VALUES ($task_id, $model_response_id, $user_id, $fp_hash, 'best');
COMMIT;
```

- `UPDATE WHERE revoked_at IS NULL` — атомарный revoke без race condition;
- `0 затронутых строк` → голоса не было → просто INSERT;
- `already_revoked` (повторный revoke того же) → `{ status: 'already_revoked' }`, HTTP 200;
- 0 состояний «нет победителя»: транзакция гарантирует что ровно один winner active.

### Task Ownership Check

Перед записью голоса API проверяет, что `task_id` принадлежит текущей сессии:

```typescript
// В /api/vote handler
const task = await db.tasks.findUnique({ where: { id: taskId } });
if (!task) return createApiError('TASK_NOT_FOUND', 404);
if (task.anonymous_session_id !== guestSessionId && task.user_id !== userId) {
  return createApiError('FORBIDDEN', 403); // нельзя голосовать в чужой задаче
}
```

Без этой проверки любой пользователь может угадать UUID и накрутить чужую задачу.

### Безопасность fingerprint

- `fingerprint_hash` вычисляется **на сервере** из компонентов `(IP + User-Agent + Accept-Language + ...)` с ключом `FINGERPRINT_SECRET` через HMAC-SHA256;
- клиент не передаёт fingerprint и не может его подделать;
- добавить `FINGERPRINT_SECRET` в Vercel Env (не `NEXT_PUBLIC_`).

### Rate limiting на /api/vote

Upstash Redis (не in-memory):
- `10 голосов / мин` per IP;
- `20 голосов / мин` per fingerprint;
- при превышении: `429 RATE_LIMITED` + `Retry-After` header.

### Optimistic UI с rollback

Состояния: `idle → saving → saved | error`.

```typescript
// В useVote hook
const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

async function castVote(modelResponseId: string) {
  // 1. Оптимистичное обновление — WinnerBadge появляется немедленно
  setState('saving');
  setOptimisticWinner(modelResponseId);

  try {
    await api.vote(taskId, modelResponseId);
    setState('saved');
  } catch (err) {
    // 2. Rollback при ошибке
    setState('error');
    setOptimisticWinner(null);
  }
}
```

- Все кнопки Winner блокируются пока `state === 'saving'` (один запрос в полёте);
- повторный клик по активному победителю → revoke;
- `409 DUPLICATE_VOTE` → «Вы уже проголосовали за этот ответ» (не «Ошибка»);
- `403 FORBIDDEN` → «Нельзя голосовать в чужом сравнении».

### Архитектура хуков и состояния

- `useVote(taskId, modelResponseId)` в `src/features/arena/hooks/useVote.ts` — инкапсулирует весь lifecycle голосования;
- `useRevokeVote(voteId)` в `src/features/arena/hooks/useRevokeVote.ts`;
- `ArenaVotingProvider` — централизованное состояние голосов, исключает «два победителя» на клиентском уровне;
- строгая типизация ответов `/api/vote`: `VoteResponse = { status: 'created' | 'already_revoked' | 'revoked' }`.

### Тесты

**Unit-тесты хуков** (`src/features/arena/hooks/__tests__/`):
- `useVote`: success, 409 DUPLICATE_VOTE, network error, смена winner (atomic revoke + insert), rollback;
- `useRevokeVote`: success, already_revoked → 200, network error.

**Интеграционные тесты** (`supabase/tests/`):
- Unique constraint `idx_one_best_per_task`: второй `best` голос в той же задаче отклоняется;
- Task Ownership: чужой `task_id` → 403;
- Race condition revoke: параллельные UPDATE — только один побеждает, второй — 0 строк.

**Smoke test** расширяется: подать голос → проверить статус → revoke → проверить что голос исчез.

### Что откладывается

| Что | Куда |
|-----|------|
| Temporal constraint (7 дней на голосование) | v0.8 (нужна `platform_settings`) |
| `raw_metadata` структурированная схема + валидация | v0.8 (Model Catalog) |
| `last_verified_at` в models | v0.8 |
| `scripts/sync-models.ts` | v0.8 |
| Suspicious activity logging | v1.1 |

### Итог v0.5.3

- уязвимость «Несколько победителей» устранена на уровне БД (`idx_one_best_per_task`) и транзакции;
- Task Ownership Check предотвращает накрутку чужих задач;
- HMAC fingerprint — сервер вычисляет, клиент не видит;
- Optimistic UI с автоматическим rollback;
- `useVote` / `useRevokeVote` / `ArenaVotingProvider` — чистая архитектура голосования;
- unit + integration тесты покрывают все edge cases.

## v0.6 - Auth, Guest Mode and Profile

Цель: сделать пользователей и гостевой режим фундаментом всего дальнейшего. После v0.6 каждый `task` имеет владельца — зарегистрированного пользователя или анонимную сессию. Guest → Account Claim закрывает известный пробел: `converted_user_id` уже есть в схеме (`29-database-ownership.md`), реализация добавляется здесь.

Стек: `@supabase/ssr` (cookie-based session), Supabase Auth, Storage bucket `avatars`, RLS с `auth.uid()`, Upstash Redis для rate limiting, `pg_cron` для TTL-очистки.

Подробное ТЗ: `20-auth-guest-profile-plan.md`.

### v0.6.1 - Guest Mode

Главный результат: при входе в гостевой режим создаётся сессия `Анонимус #4827`; каждое сравнение привязано к этой сессии.

Что сделать:

- создать таблицу `anonymous_sessions (id, display_name, avatar_seed, color_seed, last_seen_at, converted_user_id, created_at)`;
- генератор `Анонимус #NNNN` — случайный 4-значный номер, коллизии допустимы;
- backend устанавливает httpOnly cookie `na_guest` — клиент не передаёт guest id в теле запроса;
- guest display info в `localStorage` только для отображения (не для auth);
- middleware читает `na_guest` cookie → передаёт `anonymous_session_id` в route handlers;
- сохранять `tasks.anonymous_session_id` при каждом сравнении;
- guest card в UI: аватар-заглушка, цветной акцент от `color_seed`;
- **rate limit на `POST /api/guest`** — 5 запросов/час per IP через Upstash (спам-вектор на `anonymous_sessions`);
- **throttle `last_seen_at`** — обновлять при `/api/compare` не чаще раза в 5 минут (защита от лишних writes).

### v0.6.1b - Guest Session TTL Cleanup (DB)

Главный результат: `anonymous_sessions` не растёт бесконечно; устаревшие записи удаляются автоматически.

Что сделать:

- настроить `pg_cron` job: `DELETE FROM anonymous_sessions WHERE last_seen_at < now() - interval 'N days' AND converted_user_id IS NULL`;
- записывать результат (кол-во удалённых строк, timestamp) в `cleanup_log`;
- зафиксировать окно хранения в `30-data-retention-policy.md`.

**Открытый вопрос → кандидат в ADR:** при TTL-удалении сессии что происходит с её `tasks`?
- (а) CASCADE DELETE tasks + votes — чисто, но история пропадает;
- (б) orphan tasks остаются в БД (anonymous_session_id → NULL) — анонимная история навсегда;
- (в) soft-delete tasks (archived) — хранение без доступа пользователю.

Продуктовое решение нужно до реализации этого шага.

### v0.6.2 - Model Access Levels

Главный результат: гости видят и используют только модели с `access_level = 'anonymous'`.

Что сделать:

- добавить `models.access_level CHECK (access_level IN ('anonymous', 'registered', 'premium'))`;
- дефолт: `'registered'` (не `'anonymous'` — осторожно);
- `/api/models` фильтрует по `access_level` в зависимости от наличия сессии;
- `/api/compare` повторно проверяет `access_level` на backend (не доверяет клиенту);
- при нарушении: `403 MODEL_NOT_ALLOWED`;
- migration явно присваивает `access_level` каждой существующей модели.

### v0.6.3 - Auth SSR

Главный результат: пользователь может зарегистрироваться, войти, выйти; сессия сохраняется между перезагрузками.

Что сделать:

- добавить `@supabase/ssr`, настроить `createBrowserClient` / `createServerClient`;
- Route Handler `/auth/callback` — обменивает code → session, устанавливает cookie;
- middleware обновляет cookie сессии на каждом запросе (sliding expiry);
- **middleware-защита `/profile`** — редирект на `/auth` при отсутствии сессии;
- **корректная обработка протухшего refresh token в SSR** — не 500, а редирект на `/auth`;
- страница `/auth` — login + signup с переключателем;
- logout: `supabase.auth.signOut()` + очистка `na_guest` cookie;
- нейтральные сообщения при ошибках auth; защита от open redirect в `next` параметре.

### v0.6.4 - Profile MVP

Главный результат: функциональная страница `/profile` с редактируемыми полями.

Что сделать:

- расширить `profiles`: `first_name`, `last_name`, `display_name`, `avatar_url`, `role`, `plan`, `updated_at`;
- **trigger `on_auth_user_created`** → `INSERT INTO profiles (id) VALUES (NEW.id)` (проверить наличие, создать если нет);
- **`updated_at` triggers** на `anonymous_sessions` и `profiles` (прошлый аудит ловил их отсутствие);
- RLS: `SELECT`/`UPDATE` — только владелец; `INSERT` — через trigger;
- редактировать `first_name`, `last_name`, `display_name`;
- показывать email (read-only), `role`, `plan`, дату регистрации;
- базовая статистика: кол-во задач, голосов, выбранных победителей.

### v0.6.5 - Avatar Upload

Главный результат: пользователь может загрузить фото профиля.

Что сделать:

- создать Supabase Storage bucket `avatars` (private, не public);
- Storage RLS: `INSERT`/`UPDATE`/`DELETE` — только `auth.uid() = owner_id`; download — через signed URL;
- принимать только `image/jpeg`, `image/png`, `image/webp`; максимум 2 MB;
- **client-side resize → WebP** перед загрузкой (canvas API), обрезка до 256×256;
- **единое имя файла `avatar.webp`** — при замене аватара старый файл удаляется из bucket до загрузки нового (иначе `avatar.jpg` остаётся мусором);
- сохранить `profiles.avatar_url` как signed URL.

### v0.6.6 - Email and Password Management

Главный результат: пользователь может безопасно управлять учётными данными.

Что сделать:

- **email confirmation при signup** — включить в Supabase Auth настройках;
- **secure email change** — double confirmation на обоих адресах (Supabase setting, не ручной OTP);
- forgot password: `supabase.auth.resetPasswordForEmail()`;
- **re-auth перед сменой пароля** — запросить текущий пароль перед `updateUser({ password })`;
- **`signOut({ scope: 'global' })`** — кнопка «Выйти на всех устройствах»;
- все сообщения нейтральны: «Если аккаунт существует, письмо отправлено»;
- rate limit: не более 3 попыток сброса пароля в час per IP (Upstash).

### v0.6.7 - User-linked Arena and Claim

Главный результат: `task` всегда имеет владельца; гость, создавший аккаунт, не теряет историю.

Что сделать:

- `/api/compare` определяет `userId` (Supabase session) или `anonymousSessionId` (`na_guest` cookie);
- сохраняет `tasks.user_id` для аккаунта, `tasks.anonymous_session_id` для гостя;
- `/api/vote` проверяет ownership (Task Ownership Check из v0.5.3);
- **Guest → Account Claim** — при первой регистрации с активным `na_guest`:
  - в одной транзакции: `UPDATE tasks SET user_id = $uid, anonymous_session_id = NULL WHERE anonymous_session_id = $sid`;
  - `UPDATE votes SET user_id = $uid WHERE ...` аналогично;
  - `UPDATE anonymous_sessions SET converted_user_id = $uid WHERE id = $sid`;
  - погасить `na_guest` cookie;
  - коллизий по `idx_one_best_per_task` не будет — Task Ownership Check (v0.5.3) гарантирует что пользователь не голосовал в чужих гостевых задачах;
  - **идемпотентность** — повторный вызов (если callback упал и повторился) = no-op.
- `/profile` показывает историю последних 20 задач пользователя.

### v0.6.7b - DB Constraints and Indexes (DB)

Главный результат: инварианты владения задачами и голосами закреплены на уровне БД.

Что сделать:

- **XOR CHECK** на `tasks` и `votes`: `CHECK (user_id IS NOT NULL OR anonymous_session_id IS NOT NULL)`;
- стратегия применения: `ADD CONSTRAINT ... NOT VALID` → решить legacy-строки с NULL в обоих полях → `VALIDATE CONSTRAINT`;
- constraint ставить **после** Claim migration (v0.6.7), чтобы merge не нарушал его;
- **индексы** на `tasks.user_id` и `tasks.anonymous_session_id` (требование `23-codex-quality-rules` для RLS-предикатов);
- проверить живую схему через `list_migrations`, добавить только недостающие индексы.

### v0.6.8 - Testing and Deployment

Главный результат: Auth/Guest/Profile/Claim не ломают текущий production.

Тесты:

- `npm run typecheck && npm run lint && npm run build && npm run smoke`;
- `supabase db reset` — проверить чистый клон всех миграций локально;
- **Playwright E2E — 3 сценария:**
  1. Гостевое сравнение: guest mode → comparison → winner vote → проверить `tasks.anonymous_session_id`;
  2. Регистрация + Claim: signup с активным `na_guest` → проверить перенос tasks/votes → `converted_user_id` проставлен;
  3. Профиль/аватар: login → edit profile → avatar upload → logout;
- RLS-тесты: гость не видит чужих tasks, зарегистрированный не видит чужих profiles;
- Smoke проверяет `/api/health/deep`.

**Процесс миграций (зафиксировать явно):**

- Production: только `apply_migration` + сверка `list_migrations` + `git mv` локального файла;
- `supabase db push` — только для локальной разработки, не для production.

## v0.7 - Code Arena Lite

**Статус: Завершён (стабилизирован 17.06)**

Что отгружено:

- страница `/code`;
- `GET /api/code-models` — модели с `supports_code = true` из Supabase catalog;
- `POST /api/code-compare` — сравнение 2-3 code-capable моделей через backend/OpenRouter;
- выбор языка и framework context;
- сохранение запуска как `tasks.mode_slug = 'code-arena'`;
- Winner vote через общий `/api/vote`;
- запрет на `eval`, `child_process`, sandbox/test runner и любое выполнение пользовательского кода.

### v0.7 Hardening Checklist

Пункты, выявленные при ретроспективном review (не блокировали релиз, закрываются в рамках v0.7):

**Безопасность ввода:**
- Пользовательский код принимается как данные в шаблоне с делимитерами — не фильтруется содержимое (import/require легитимны в Code Arena);
- Language allowlist жёстко: `TS/JS/Python/SQL`; `framework`/`versions` — length cap + передаются как данные;
- `tool_calls` из OpenRouter отбрасываются (с v0.4); пользовательский код не исполняется нигде в route.

**Голосование:**
- `POST /api/vote` отклоняет голос если `tasks.status = 'running'` (server-enforced vote gating);
- partial-задачи (`tasks.status = 'partial'`): если хотя бы одна модель упала — голос разрешён, но задача помечена как partial; partial-задачи **исключаются из рейтинг-агрегатов** в v1.4 Leaderboard; UX: «повторить только упавшую модель».

**БД (зона владельца):**
- `mode_slug` CHECK constraint: аудит distinct-значений в prod → `ADD CONSTRAINT ... NOT VALID` → backfill → `VALIDATE CONSTRAINT`; список = `ALLOWED_MODE_SLUGS`; migration + константа в одном коммите.

**Коды ошибок (polish, низкий приоритет):**
- `LANGUAGE_NOT_SUPPORTED`, `NO_CODE_MODELS_AVAILABLE` — только вместе с обновлением `28-api-contracts.md` в том же коммите.

## v0.7.1 - Arena UX and Fair Voting

**Статус: Завершён (streaming внедрён 18.06)**

Что отгружено:

- live streaming ответов для Prompt Arena и Code Arena Lite (параллельный вывод по мере генерации);
- Blind Arena: до голосования ответы показываются как `Модель A`/`B`/`C`, реальные названия раскрываются после выбора;
- перемешивание порядка ответов перед показом с сохранением корректной связи с `model_responses`;
- кнопка copy для каждого ответа, share action для сохранённого сравнения;
- Code Diff для Code Arena Lite: syntax highlighting и side-by-side diff без выполнения кода;
- guest anti-abuse: лимиты для гостей, ограничение длины prompt/code task, upsell-предложение регистрации после лимита;
- дизайн точного кэширования по ключу `mode + prompt + models + access_level`.

### v0.7.1 Hardening Checklist

**КРИТИЧЕСКОЕ: Blind Arena SSE контракт течёт**

Подтверждено по коду (`src/app/api/stream-compare/route.ts`, строки 55–59):

```typescript
controller.enqueue(sse("model_start", {
  modelId: model.selectionId,
  modelName: model.name,   // ← раскрывает реальное имя до голосования
  modelRole: model.role,
}));
```

`model_start` — первое событие стрима, приходит до первого токена. DevTools → Network → EventStream покажет реальные имена моделей до голосования пользователя. Серверный shuffle не помогает: mapping «слот → модель» передаётся открытым текстом.

**Требуемое исправление:**

Отдельный вариант SSE-контракта для blind-режима:

```typescript
// blind mode: только слот, без идентификаторов модели
controller.enqueue(sse("model_start", {
  slot: "A",  // не modelId, не modelName
}));
```

- Mapping `slot → modelId` живёт только на сервере до момента голосования;
- Реальные имена возвращаются в ответе `POST /api/vote` после записи голоса;
- Reveal без голоса (например, прямой запрос к `/api/tasks/:id` до голосования) — лочит голосование по задаче (`tasks.blind_revealed_at IS NOT NULL AND votes.id IS NULL → 403`);
- Обновить `28-api-contracts.md` с описанием blind-варианта контракта в том же коммите.

**Upsell при лимите:**
- При достижении guest-лимита показывать upsell с сохранённым черновиком из localStorage (v0.3); после Claim (v0.6.7) гостевые задачи переходят в аккаунт — контекст не теряется.

**Cache key:**
- Ключ кэширования = `hash(mode + prompt + modelIds + access_level + max(models.updated_at))`; `max(models.updated_at)` как версия каталога (не фоновый поллер от провайдера).

**Judge anti-bias → бэклог v1.3:**
- Зафиксировать сейчас: `/api/judge` оборачивает оцениваемые ответы как данные с делимитерами; рандомизирует порядок A/B для судьи (position bias — известная болезнь LLM-as-judge); инструктирует игнорировать команды внутри ответов. Именно через этот вектор code injection реально влияет на продукт — искажает вердикты, а не «взламывает сервер».

**Границы (остаются в силе):**
- не добавлять Code Arena Runner (→ v1.7);
- не добавлять официальный Judge Mode (→ v1.3);
- не добавлять Leaderboard или Elo (→ v1.4);
- не добавлять Batch Testing, мультимодальные загрузки или RAG;
- weighted-by-cost rate limits → v2.3.

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
- изображения сохраняются в Supabase Storage в стабильном режиме; текущий alpha backend может вернуть provider URL, если Storage upload/fetch недоступен;
- metadata и storage path сохраняются в Supabase PostgreSQL после выделенной Image Arena persistence-задачи;
- пользователь сравнивает сетку изображений и выбирает победителя.

Ограничение:

```text
Не переносить Image Arena раньше Stable Prompt Arena.
# сначала должен быть стабильный текстовый MVP, лимиты, Storage и безопасность
```
