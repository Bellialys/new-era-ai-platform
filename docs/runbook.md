# Runbook — New Era AI Platform v2.0.0-alpha.1 (reviewed 2026-11-16)

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

- Dashboard: https://supabase.com/dashboard/project/jbeecpbcsnowcaygteoj
- Логи: Database → Logs
- HTTP health: `GET /api/health` → `{"status":"ok"}` (это **не** независимая проверка Supabase).
- Supabase read-only: посмотреть `public.models` и `public.model_health_runs`, сравнить активные UUID с `GET /api/models`, проверить миграции, RLS и Security Advisor.
- 16.11.2026: в production 8 активных публичных бесплатных моделей (3 coding); `model_health_runs` ещё не имела записей. Отдельно контролировать Stage 7 и Stage 10.

## Проверка OpenRouter

- Dashboard: https://openrouter.ai/activity
- Если OpenRouter недоступен: пользователи видят ошибку "Не удалось получить ответы"
- Действие: ждать восстановления, статус — https://status.openrouter.ai

## Секреты и переменные окружения

Production runtime secrets хранятся в Vercel Environment Variables; локальные — только в `.env.local`, GitHub Actions secrets — в GitHub, AWS/KMS — в предназначенных защищённых настройках. Никогда не переносить их в коммиты, отчёты или публичные логи.
Никогда не коммитить в git. Список нужных переменных: `.env.example`.

## Автопроверка моделей

- `vercel.json` настраивает `GET /api/cron/model-health` ежедневно на `03:17 UTC` (в ноябре — 05:17 Киев).
- В таблице `public.model_health_runs` проверить `run_date`, `source`, `status`, `finished_at`; две последовательные даты `scheduled/succeeded` нужны для Stage 10.
- LFM 2.5 2.6B остаётся отдельным Stage 7 gate: только автоматическая quarantine + отсутствие модели в селекторах и отклонение старого UUID доказывают завершение.
- Проверка `models:verify` в GitHub Actions — другая задача, она проверяет provider catalog, но **не** подменяет production cron.

## Git emergency rollback

```bash
git log --oneline -10        # найти хороший коммит
git revert HEAD              # откатить последний коммит
git push origin main         # триггерит новый деплой
```
