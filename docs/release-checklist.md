# Release Checklist — New Era AI Platform v1.1

## Перед каждым релизом

### Local
- [ ] `npm run verify` прошёл без ошибок (typecheck, lint, build, docs:check)
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
- [ ] `GET /api/health` возвращает `status: "ok"` и `supabase.reachable: true`
- [ ] Vercel Runtime Logs: нет новых ERROR/FATAL за 15 минут после деплоя

### После деплоя
- [ ] `.project/state.json` обновлён до новой версии
- [ ] `14-roadmap.md` SYNC маркеры синхронизированы
- [ ] Git tag создан: `git tag -a vX.Y.Z -m "..." && git push origin vX.Y.Z`

## Rollback trigger

Если после деплоя в течение 15 минут:
- Smoke check падает
- Vercel logs показывают ERROR rate > 5%
- Пользователь сообщает о поломке основного flow

→ Немедленный откат (см. `docs/runbook.md`)
