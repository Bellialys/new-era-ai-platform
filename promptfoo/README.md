# Promptfoo evals

Этот каталог содержит два уровня автоматической проверки New Era AI Platform через Promptfoo 0.123.0.

## Уровень 1 — прямой baseline моделей

`promptfooconfig.yaml` отправляет одинаковые тесты напрямую в OpenRouter и сравнивает две бесплатные модели из fallback-каталога проекта:

- `openai/gpt-oss-120b:free`;
- `meta-llama/llama-3.3-70b-instruct:free`.

Полный baseline выполняет 3 теста для каждой модели, то есть 6 LLM-запросов.

```powershell
# OPENROUTER_API_KEY берётся из локального .env.local
npm run eval:promptfoo
```

## Уровень 2 — полный путь New Era AI Platform

`platform-eval.yaml` использует `providers/new-era-compare-provider.mjs` и обращается уже не к OpenRouter напрямую, а к реальному backend проекта.

Путь успешного E2E-теста:

```text
Promptfoo
  -> POST /api/guest
  -> GET /api/models
  -> POST /api/compare
  -> server-side model resolution
  -> OpenRouter adapter
  -> persistence best-effort
  -> API response assertions
```

Провайдер не хранит и не передаёт `OPENROUTER_API_KEY`. Ключ нужен только локальному Next.js серверу, который сам загружает `.env.local`.

### Что проверяет platform suite

1. Успешный guest flow: создаётся guest-session, читается текущий model catalog, выбираются первые 2 доступные модели и выполняется настоящий `/api/compare`.
2. Prompt короче минимальной длины возвращает `400 VALIDATION_ERROR`.
3. Неизвестный `modeSlug` возвращает `400 INVALID_MODE`.
4. Запрос без user/guest session возвращает `401 AUTH_REQUIRED`.
5. Неизвестные model selections возвращают `403 MODEL_NOT_ALLOWED`.

Только первый тест доходит до OpenRouter и обычно создаёт 2 LLM-запроса. Остальные проверки должны завершаться на backend validation/auth/model-resolution до вызова модели.

### Локальный запуск

В первом терминале:

```powershell
# Запустить New Era AI Platform. Next.js сам загрузит .env.local.
npm run dev
```

Во втором терминале:

```powershell
# Проверить настоящий локальный backend через Promptfoo.
npm run eval:promptfoo:platform

# Открыть локальный viewer с историей результатов.
npm run eval:promptfoo:view
```

По умолчанию platform suite работает только с `http://127.0.0.1:3000`.

Если dev-server работает на другом локальном адресе:

```powershell
$env:PROMPTFOO_TARGET_URL="http://127.0.0.1:3001"
npm run eval:promptfoo:platform
```

Remote targets намеренно заблокированы по умолчанию, чтобы случайно не создать guest-сессии, записи БД или реальные AI-запросы в production. Для осознанного remote-теста нужно одновременно задать target и явный флаг:

```powershell
$env:PROMPTFOO_TARGET_URL="https://example.com"
$env:PROMPTFOO_ALLOW_REMOTE_TARGET="1"
npm run eval:promptfoo:platform
```

Использовать remote mode только для специально выбранного deployment.

## Rate limiting

Platform suite проходит через существующий rate limiter `/api/guest`, `/api/models` и `/api/compare`, но намеренно не пытается исчерпать лимит множеством запросов. Boundary/load-тест на `429 RATE_LIMIT` нужно делать отдельным изолированным этапом, чтобы не создавать лишнюю нагрузку и не расходовать AI-квоту.

## Хранение и приватность

`sharing: false` отключает публикацию eval-результатов через Promptfoo sharing.

Promptfoo хранит локальную историю/cache в пользовательском каталоге `~/.promptfoo` (`%USERPROFILE%\.promptfoo` в Windows), а не в репозитории проекта.

Не добавлять в Git:

- `.env.local`;
- API-ключи и токены;
- guest-cookie;
- экспортированные eval-результаты с чувствительными данными;
- Promptfoo database/cache.

Remote provider metadata не содержит guest-cookie или OpenRouter key.

## Почему Promptfoo не добавлен в dependencies

Promptfoo запускается через зафиксированную команду `npx --yes promptfoo@0.123.0`. Поэтому он не попадает в production/runtime/client bundle и не изменяет `package-lock.json`.

Проект использует Node.js 24, а Promptfoo 0.123.0 требует Node.js `>=22.22.0`.

## Следующие этапы

После локального подтверждения обоих eval-слоёв можно отдельно добавить:

- regression datasets для Prompt Arena и Code Arena;
- Judge Mode как model-graded assertion;
- red-team security suite;
- изолированный rate-limit boundary test;
- GitHub Actions eval gate с отдельным secret policy;
- сохранение агрегированных eval-метрик в отдельное хранилище/Leaderboard без утечки prompts и секретов.
