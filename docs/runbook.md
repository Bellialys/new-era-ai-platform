# Runbook — New Era AI Platform v1.1

## Быстрые команды

```bash
# Smoke check production
node scripts/smoke-check.mjs --url https://new-era-ai-platform.vercel.app --json

# Full verify (local)
npm run verify

# Check Vercel deployments
# → Vercel Dashboard → new-era-ai-platform → Deployments
```

## Инциденты: классификация

| Уровень | Признак | Первое действие |
|---|---|---|
| P0 | Сайт недоступен, smoke fail | Откат деплоя (см. ниже) |
| P1 | API возвращает 5xx > 5% запросов | Проверить Vercel Runtime Logs |
| P2 | Отдельная фича сломана | Создать issue, hotfix |
| P3 | Визуальный баг, UX | Создать issue, плановый fix |

## Откат деплоя (Rollback)

1. Открыть [Vercel Dashboard](https://vercel.com/bellial-s-projects/new-era-ai-platform)
2. Вкладка **Deployments**
3. Найти последний стабильный деплой (колонка **Ready**)
4. Нажать **⋯ → Promote to Production**
5. Подтвердить
6. Проверить smoke: `node scripts/smoke-check.mjs --url https://new-era-ai-platform.vercel.app`

Если деплой откатился, немедленно:
- Создать issue с описанием причины
- Зафиксировать revert-коммит в main

## Проверка Supabase

- Dashboard: https://supabase.com/dashboard/project/[project-id]
- Логи: Database → Logs
- API health: `GET /api/health` → поле `services.supabase.reachable`

## Проверка OpenRouter

- Dashboard: https://openrouter.ai/activity
- Если OpenRouter недоступен: пользователи видят ошибку "Не удалось получить ответы"
- Действие: ждать восстановления, статус — https://status.openrouter.ai

## Секреты и переменные окружения

Все секреты хранятся **только** в Vercel Environment Variables (Settings → Environment Variables).
Никогда не коммитить в git. Список нужных переменных: `.env.example`.

## Git emergency rollback

```bash
git log --oneline -10        # найти хороший коммит
git revert HEAD              # откатить последний коммит
git push origin main         # триггерит новый деплой
```
