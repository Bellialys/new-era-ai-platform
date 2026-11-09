# New Era AI Platform — розслідування недоступності безкоштовних моделей

Дата: 09.11.2026. Робота із production-каталогом супроводжується GitHub PR; жодні production deploys не зливаються до перевірки.

## Фактичні знахідки

- Main: a21d938e2cc937ab5094a20becd8d44ab64c4fe4, production Vercel READY.
- GET /api/models: HTTP 200, 8 active/public free models до змін.
- Supabase model_responses за 90 днів: Google Gemma 4 26B/31B та Poolside Laguna S/XS інколи повертали RATE_LIMIT; Nemotron 3 Super мав 404 за жовтень. Це історичні, не сьогоднішні виклики.
- OpenRouter офіційно вказав expiration_date=2026-10-31 для poolside/laguna-s-2.1:free та poolside/laguna-xs-2.1:free; вони більше не мають бути доступними для вибору.
- Заміни: dots-studio/dots-3-note-preview:free (поточна coding/reasoning, пропозиція до 2026-12-31), xingchen-agi/xing4.0-29b-a4b:free (поточна engineering/agent).
- Обидва є :free, без ціни токенів, але підлягають квотам і умовам провайдерів. Нові моделі не гарантують 100% uptime.
- Vercel runtime logs за 30 хвилин не показали порівнянь AI; реальні сьогоднішні inference calls із user account не були здійснені під час інженерного аналізу.
- Перегляд секретів Vercel заборонений підключеній ролі (403) — ключі не читалися й не змінювалися.
- GitHub security issue #136 фіксує critical/high npm audit alerts (Next.js dependency) та CI continue-on-error. Відмінність: CI green не дорівнює security audit green.

## Безпека змін

Міграція тільки оновлює статуси моделей та додає 2 безкоштовні ідентифікатори. Не змінює history, votes або credentials. Середовище production не повинно запускати code release з критичними advisory до усунення issue #136.

## Тести та докази

- npm run typecheck, npm run lint, npm test, npm run build, npm run state:check, npm run docs:check у GitHub CI: перший PR CI #42603431496 PASS (typecheck, lint, unit tests, build, smoke); повторний CI останнього коміту перевірити перед merge.
- SQL валідація моделей (counts/key/status/role_tags) та повторний GET /api/models: PASS: Supabase міграція 20261109104843 застосована. Публічний GET /api/models повертає HTTP 200 і вісім моделей, включно з Dots3-Note та Xing4.0, без Laguna S/XS; SQL перевірка показує 0 active/public Laguna.
- Авторизований inference smoke для кожної з восьми моделей, streaming і code arena: не запущено, потрібна реальна сесія/ключ та контроль квот. Не маркувати як PASS.
- Оцінити privacy/retention політику кожного free endpoint перед передаванням чутливих запитів.
- Додати monitor і замінити Dots3-Note до закінчення free offer 31.12.2026.

## OpenRouter джерела

- https://openrouter.ai/poolside/laguna-s-2.1%3Afree
- https://openrouter.ai/api/v1/models
- https://openrouter.ai/dots-studio/dots-3-note-preview%3Afree
- https://openrouter.ai/xingchen-agi/xing4.0-29b-a4b%3Afree
- https://openrouter.ai/collections/free-models

## З'ясована причина зламаного GitHub Actions моніторингу

Нічний запуск #42471233106 від 08.11.2026 завершився з exit code 2, не дійшовши до live verification: секрет OPENROUTER_API_KEY у GitHub Actions відсутній (порожній env). Це **не** перевірка inference і **не** ознака непрацездатності Vercel production key. Увійти у GitHub repository Settings → Secrets and variables → Actions → New repository secret і безпечно додати OPENROUTER_API_KEY (ніколи не комітити і не надсилати у чат). Код не може отримати або зчитати секрет Vercel через GitHub.

## Репродукований ручний inference smoke

Для перевірки фактичних відповідей додано `npm run models:smoke:live -- --limit=2` (1–8 безкоштовних моделей із чинного fallback-каталогу, послідовне виконання, 3.5 с пауза, 30 с тайм-аут, <=384 output tokens). Вхідний запит фіксований і не містить даних користувача. Скрипт повертає лише модель/статус (OK, RATE_LIMIT, NOT_FOUND, TIMEOUT, NO_CREDITS, AUTH_ERROR, EMPTY_RESPONSE тощо), ніколи не друкує ключ або текст відповіді, не звертається до платних моделей і не змінює БД. Кожен live-виклик витрачає 1 одиницю безкоштовної квоти OpenRouter, включно з невдалими спробами.

`npm run test:models-verify` запускає також unit-тести smoketest helper без реальних мережевих викликів. **До надання секрету реальний inference smoke НЕ виконано**. Формальний звіт не має стверджувати 8/8 OK без мережевих результатів.

## Коди помилок у UI

У stream-compare введено безпечні повідомлення за кодами RATE_LIMIT/429, 404, TIMEOUT/NETWORK_ERROR, INSUFFICIENT_CREDITS, AUTH_ERROR, INVALID_RESPONSE. Раніше всі помилки мали однаковий generic UI message. Помилки не містять raw provider body, secrets або prompt text. Код у PR, поки що не в production.
