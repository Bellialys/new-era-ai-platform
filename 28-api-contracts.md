# 28 - API Contracts

## Статус

```text
Draft / MVP contract
# документ заменяет прежний placeholder и фиксирует текущий backend-only API контракт
```

## Назначение

Этот документ описывает публичные backend endpoints проекта **Новая эпоха**.

Главное правило:

```text
Frontend вызывает только backend route handlers.
# OpenRouter, Supabase service role и другие секретные интеграции не вызываются напрямую из frontend
```

## Общие правила API

- Ответы API должны быть JSON.
- Ошибки должны возвращаться через безопасный формат `createErrorResponse`.
- Секреты, API keys, service role keys и Authorization headers нельзя логировать.
- `model_key` провайдера не должен быть доверенным значением из frontend.
- Backend повторно валидирует `prompt`, `modelIds`, `modeSlug` и выбранные модели.

## `GET /api/models`

Возвращает модели, доступные для Prompt Arena.

Основной режим:

```text
Supabase models catalog -> public model id -> frontend
```

Fallback режим:

```text
server-side allowlist -> frontend
```

Минимальный ответ:

```json
{
  "status": "success",
  "models": [
    {
      "id": "model-selection-id",
      "name": "Model display name",
      "provider": "openrouter",
      "role": "general"
    }
  ]
}
```

## `POST /api/compare`

Запускает Prompt Arena comparison через backend.

Минимальный запрос:

```json
{
  "prompt": "Сравни Next.js и Nuxt для MVP",
  "modelIds": ["model-selection-id-1", "model-selection-id-2"],
  "modeSlug": "prompt-arena"
}
```

Правила:

- `prompt` должен пройти ограничения длины MVP;
- `modelIds` должен содержать 2-3 модели;
- `modeSlug` сейчас должен быть `prompt-arena`;
- backend резолвит model selection id в server-only `model_key`;
- сохранение `tasks` и `model_responses` выполняется best-effort.

Минимальный ответ:

```json
{
  "status": "success",
  "taskId": "saved-task-uuid-or-null",
  "responses": [
    {
      "id": "response-uuid-or-generated-id",
      "modelId": "model-selection-id-1",
      "modelName": "Model display name",
      "status": "success",
      "answerText": "Ответ модели",
      "latencyMs": 1234
    }
  ]
}
```

## `POST /api/vote`

Сохраняет выбор лучшего ответа, когда voting включён и persistence доступен.

Минимальный запрос:

```json
{
  "taskId": "task-uuid",
  "responseId": "model-response-uuid",
  "voteType": "best",
  "anonymousSessionId": "anonymous-session-id"
}
```

Правила:

- `taskId` и `responseId` должны быть UUID;
- `responseId` должен принадлежать указанному `taskId`;
- выбирать можно только response со статусом `success`;
- голос должен принадлежать authenticated user или guest через `anonymousSessionId`;
- актуальная схема БД использует `votes.model_response_id` и `vote_type = 'best'`;
- старое значение `winner` может поддерживаться только как compatibility alias на backend.

Минимальный ответ:

```json
{
  "status": "success",
  "voteId": "vote-uuid",
  "taskId": "task-uuid",
  "responseId": "model-response-uuid",
  "voteType": "best"
}
```

## Related Docs

- `09-api-structure.md` - подробная структура API.
- `12-security-and-env.md` - правила безопасности API и env.
