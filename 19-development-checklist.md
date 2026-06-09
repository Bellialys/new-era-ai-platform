# 19 - Development Checklist

## Назначение файла

Этот файл показывает, что уже готово и что делать дальше.

Главный источник статуса и порядка этапов: `14-roadmap.md`.

## Текущий статус

```text
v0.5.2 - Supabase, migrations and health stabilization
# текущий стабильный фундамент проекта
```

Следующий этап:

```text
v0.6 - Auth, Guest Mode and Profile
# подробный план: 20-auth-guest-profile-plan.md
```

## Готово

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
- [x] Smoke-check script `npm run smoke`.
- [x] `package-lock.json`.

## Не готово

- [ ] Полный Auth/Guest/Profile этап `v0.6`.
- [ ] Стабильный пользовательский Voting MVP `v0.7`.
- [ ] Страница истории `v0.8`.
- [ ] Production deploy stabilization `v0.9`.
- [ ] Stable Prompt Arena `v1.0`.

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
```

## Следующий практический фокус

Работать по `20-auth-guest-profile-plan.md` и не начинать Code Arena Runner, Judge Mode, Leaderboard или AI Team Mode до стабильной Prompt Arena.
