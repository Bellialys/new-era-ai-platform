# 19 - Development Checklist

## Назначение файла

Этот файл показывает практический checklist разработки. Порядок этапов не дублируется здесь вручную: главным источником остаётся `14-roadmap.md`, а текущая версия и фаза берутся из `.project/state.json`.

Главный источник статуса и порядка этапов: `14-roadmap.md`.

## Текущий статус

```text
v1.7.0-alpha.1 - Code Arena Runner
# текущий alpha-этап: внешний runner доступен авторизованным пользователям; release gate ещё должен быть закрыт перед stable sign-off
```

Следующий этап:

```text
v1.8 - Image Arena MVP
# только после storage/safety/release review
```

## Базово готово

- [x] Project documentation.
- [x] Next.js base.
- [x] TypeScript.
- [x] ESLint.
- [x] Tailwind CSS.
- [x] Главная страница `/`.
- [x] Страница `/arena`.
- [x] `GET /api/models`.
- [x] `POST /api/compare`.
- [x] `GET /api/health`.
- [x] Server-side OpenRouter integration.
- [x] Server-side model allowlist fallback.
- [x] Supabase model catalog.
- [x] Server-side Supabase client.
- [x] Browser-side Supabase client only with publishable key.
- [x] Supabase migrations for `models`, `tasks`, `model_responses`, `profiles`.
- [x] Синхронизированная история Supabase migrations.
- [x] Best-effort сохранение task в `/api/compare`.
- [x] Best-effort сохранение model responses в `/api/compare`.
- [x] Возврат `taskId` из `/api/compare`, если persistence доступен.
- [x] Исправленная схема `votes` на `model_response_id` и `vote_type = best | like | dislike`.
- [x] Основная Prompt Arena сохраняет Winner vote через `/api/vote`.
- [x] UI показывает saving/success/error для Winner vote.
- [x] Smoke-check script `npm run smoke`.
- [x] Минимальный GitHub Actions CI.
- [x] `package-lock.json`.
- [x] Auth/Guest/Profile foundation.
- [x] History foundation.
- [x] Code Arena Lite.
- [x] Judge Mode.
- [x] Leaderboard.
- [x] Admin audit/usage routes.
- [x] Code Arena Runner через внешний runner для авторизованных пользователей.

## Текущий release-gate фокус

- [ ] Подтвердить `npm run verify`.
- [ ] Подтвердить `state:check` и `docs:check`.
- [ ] Подтвердить schema/migration checks, если доступны Supabase env.
- [ ] Подтвердить live smoke external runner/admin routes на целевом окружении.
- [ ] Зафиксировать blocked/unverified checks в отчёте.

## Проверка перед каждым commit

```bash
npm run typecheck
# проверяет TypeScript

npm run lint
# проверяет ESLint

npm run build
# проверяет production-сборку

npm run smoke
# проверяет /api/health и /api/models

npm run state:check
# проверяет project state и task-файлы

npm run docs:check
# проверяет документацию и sync markers

npm audit --audit-level=moderate
# проверяет зависимости
```

## Checklist для docs/process задач

- [ ] Прочитать `AGENTS.md`, `24-codex-active-rule-set.md`, `23-codex-quality-rules.md`, `CLAUDE.md`.
- [ ] Если меняется больше 5 файлов — дать Stop Signal и дождаться подтверждения.
- [ ] Сформулировать plan self-review: scope, риски, альтернативы, affected docs.
- [ ] Не редактировать auto-sync блоки вручную без необходимости.
- [ ] Проверить смысловую согласованность `AGENTS`, `CLAUDE`, `23`, `24`, `25-definition-of-done`, `25-production-excellence`, `36`.
- [ ] Перед commit выполнить staged diff review, `git diff --cached --check`, secret scan, `state:check`, `docs:check`.
- [ ] Commit message — Conventional Commit на английском.
- [ ] В отчёте указать commit hash, проверки, blocked/unverified items.

## Следующий практический фокус

Закрывать release gate текущего `v1.7 - Code Arena Runner`, не начинать `v1.8 - Image Arena MVP` без отдельного storage/safety/release review и не начинать AI Team Mode раньше `v2.0`.
