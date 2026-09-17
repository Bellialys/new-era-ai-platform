# Promptfoo baseline evals

Этот каталог добавляет первый изолированный слой автоматической оценки LLM для New Era AI Platform.

## Что проверяется

- одна и та же задача отправляется нескольким моделям через OpenRouter;
- проверяются базовые требования к содержанию и формату ответа;
- результаты можно сравнивать в CLI и в локальном Promptfoo viewer;
- production API, Supabase и пользовательские данные на этом этапе не изменяются.

Текущий baseline использует две бесплатные модели из fallback-каталога проекта:

- `openai/gpt-oss-120b:free`;
- `meta-llama/llama-3.3-70b-instruct:free`.

Конфигурация выполняет 3 теста для каждой модели, то есть 6 LLM-запросов за полный запуск.

## Требования

Проект уже использует Node.js 24, что совместимо с Promptfoo 0.123.0.

`OPENROUTER_API_KEY` должен находиться только в локальном `.env.local`. Ключ не хранится в `promptfooconfig.yaml` и не должен попадать в Git.

## Запуск

```powershell
# Запустить baseline eval через Promptfoo 0.123.0 и загрузить OPENROUTER_API_KEY из .env.local
npm run eval:promptfoo

# Открыть локальный viewer с историей результатов
npm run eval:promptfoo:view
```

Promptfoo запускается через зафиксированную версию `npx --yes promptfoo@0.123.0`. На этом этапе пакет не добавляется в runtime или client bundle и не меняет `package-lock.json`.

## Хранение и приватность

`sharing: false` отключает публикацию результатов через Promptfoo sharing.

По умолчанию Promptfoo хранит локальную историю и cache в пользовательском каталоге `~/.promptfoo` (`%USERPROFILE%\.promptfoo` в Windows), а не в репозитории проекта.

Не добавлять API-ключи, `.env.local`, экспортированные результаты с чувствительными данными или Promptfoo database/cache в Git.

## Следующий этап

После стабильного baseline можно отдельно подключить Promptfoo к реальному локальному `/api/compare` через HTTP/custom provider. Это позволит тестировать уже не только модели напрямую, но и полный путь New Era AI Platform: auth, model catalog, backend OpenRouter adapter, validation, persistence и rate limiting.

CI/CD и red-team проверки добавлять отдельным этапом после локального подтверждения baseline, чтобы не смешивать базовую интеграцию с GitHub Secrets и security scanning.
