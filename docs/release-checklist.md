# Release Checklist — New Era AI Platform v2.0.0-alpha.1 (reviewed 2026-11-16)

## Перед каждым релизом

### Local
- [ ] `npm ci` и `npm audit --audit-level=high` завершились успешно (blocking high/critical gate).
- [ ] `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run state:check`, `npm run docs:check` пройдены.
- [ ] `npm run verify` дополнительно пройден; сам по себе он не заменяет полный test/security gate.
- [ ] Новые функции протестированы вручную в dev-режиме
- [ ] Секреты не попали в коммит (`git diff --staged | grep -i "sk-\|secret\|password"`)
- [ ] `.env.local` НЕ закоммичен

### Preview (Vercel Preview URL)
- [ ] Деплой на preview ветку прошёл успешно (Vercel: READY)
- [ ] Основной flow работает: ввод промпта → AI ответы → выбор победителя
- [ ] Code Arena: ввод задачи → ответы без выполнения кода
- [ ] История сохраняется и отображается
- [ ] Auth: вход, выход, регистрация
- [ ] Share ссылка открывается без авторизации
- [ ] Мобильный браузер: основные страницы читаемы

### Production
- [ ] `git push origin main` → Vercel build READY
- [ ] `node scripts/smoke-check.mjs --url https://new-era-ai-platform.vercel.app` → PASS
- [ ] `GET /api/health` возвращает HTTP 200 и `status: "ok"`; текущий endpoint **не** возвращает `supabase.reachable`.
- [ ] `GET /api/models` и `GET /api/code-models` возвращают HTTP 200; все публичные ID должны соответствовать активным/доступным записям Supabase.
- [ ] Отдельно проверить Supabase status, RLS, миграции и `model_health_runs` (API health сам по себе не доказывает доступность БД).
- [ ] Vercel Runtime Logs: нет новых ERROR/FATAL за 15 минут после деплоя

### После деплоя
- [ ] `.project/state.json` обновлён **только если менялась утверждённая версия/фаза**; иначе оставить текущие значения.
- [ ] `14-roadmap.md` SYNC маркеры синхронизированы
- [ ] Git tag создан для утверждённого versioned release (обычный docs merge не требует нового тега): `git tag -a vX.Y.Z -m "..." && git push origin vX.Y.Z`

## Lab05 миграция — исправлено 16.11.2026

Файл `20261109095503_lab05_saved_prompts.sql` восстановлен в `main` без повторного применения SQL к production. Контрольный исключительный случай Stage 3.2: `20260929022500_stage34_atomic_openrouter_activation.sql` существует локально, но не был применён в production (ждёт отдельного разрешения).

## Дополнительные release gates (16.11.2026)

- [ ] Убедиться, что remote migration `20261109095503_lab05_saved_prompts` подтверждена файлом в `main` (исправлено 16.11), и отдельно проверить неприменённый production gate `20260929022500_stage34_atomic_openrouter_activation` перед любыми миграциями.
- [ ] Для автосинхронизации моделей отдельно убедиться, что `public.model_health_runs` содержит настоящие `source=scheduled` / `status=succeeded`, а не только успешный build. Stage 10: две последовательные даты.
- [ ] Проверить, что LFM 2.5 2.6B действительно скрыта автоматически и старый UUID недоступен; до этого Stage 7 не закрывать.
- [ ] Убедиться, что GitHub nightly `models:verify -- --public-catalog` прошёл **после** изменения fallback (предыдущий failed run #43856492433 от 16.11 был до PR #145).

## Rollback trigger

Если после деплоя в течение 15 минут:
- Smoke check падает
- Vercel logs показывают ERROR rate > 5%
- Пользователь сообщает о поломке основного flow

→ Немедленный откат (см. `docs/runbook.md`)
