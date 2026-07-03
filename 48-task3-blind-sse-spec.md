# 48. Спецификация: TASK-5 (health-диагностика лимитера) + TASK-3 (Blind Arena SSE)

**Дата ревизии:** 2026-07-03 · **База:** main после merge #31–#33 (348/348 тестов). Все ссылки на файлы, строки и схему сверены с фактическим кодом и продовой БД. Постоянные правила — в `CLAUDE.md` (Autonomous pipeline rules); эта спека их не отменяет, кроме явно оговорённого порядка деплоя миграции в TASK-3.

---

## TASK-5. `/api/health`: наблюдаемость бэкенда rate limiter

**Файл:** `src/app/api/health/route.ts` · **Сложность:** ~20 мин · **Зачем:** при отсутствии Upstash-переменных лимитер молча падает в in-memory (неэффективный между serverless-инстансами) — ни логов, ни сигнала. Диагностика должна показывать бэкенд.

### Шаги
1. В **авторизованной** ветке диагностики (после проверки `HEALTH_CHECK_SECRET`, рядом с `supabaseConfigured`/`openRouterConfigured`) добавить:
```ts
const upstashConfigured = Boolean(
  (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL) &&
    (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN)
);
const rateLimitBackend: "upstash" | "in-memory" = upstashConfigured ? "upstash" : "in-memory";
```
и включить `rateLimitBackend` в JSON авторизованного ответа. Алиасы `KV_*` обязательны — их использует Vercel-интеграция Upstash (см. `env-check.config.json`, строки 88–107).
2. Публичный (неавторизованный) ответ НЕ менять — остаётся `{ status: "ok" }`, внутреннее состояние наружу не течёт.
3. Тест (`route.test.ts` рядом, харнесс как у vote): без секрета поле отсутствует; с секретом и стабом env — `rateLimitBackend: "upstash"`; без env — `"in-memory"`.
4. `28-api-contracts.md`: поле в контракте авторизованного ответа `GET /api/health`. Строка в `15-changelog.md`.

---

## TASK-3. Blind Arena: серверный SSE-контракт со слотами

**Сложность:** высокая, 1–2 дня, один PR.

### ⚠️ Порядок деплоя (отступление от правила 5 — согласовано)
Код этой задачи читает и пишет колонку `tasks.is_blind`. Если смержить до появления колонки — прод падёт (insert/select по несуществующей колонке). Поэтому: **(1)** создай миграцию файлом в PR как обычно, НЕ применяя; **(2)** открой PR и остановись; **(3)** Claude (web) применит миграцию в прод (добавление колонки с default безопасно для текущего кода) и подтвердит; **(4)** только после подтверждения владелец мержит. Пометь это в body PR: `⚠️ MERGE ONLY AFTER: Claude (web) applies tasks.is_blind migration`.

### Проблема (все точки сверены с текущим main)
Blind-режим существует только на клиенте: `arena-results.tsx` прячет имена через `showBlind = blindMode && !winnerResponseId` и локальные `BLIND_LABELS`, но сервер шлёт реальные имена всегда. Утечки:
1. SSE `model_start` / `model_error`: `modelName`, `modelRole` (`stream-compare/route.ts`, функция `streamOneModel`, строки ~55–58, 88, 141, 157);
2. SSE `complete`: `modelName` в каждом элементе `finalResponses` (строки 301–315);
3. `GET /api/tasks/[taskId]`: `modelName: r.display_name ?? r.model_key` (строка ~80);
4. `GET /api/history/[taskId]`: отдаёт `HistoryDetail["responses"]` через `getHistoryTask` из `@/lib/server` — проверь тип `HistoryDetail` и хелпер (вероятно `src/lib/server/history.ts`): если в responses есть имя/ключ модели — гейтить так же, как п. 3.

Цель: в blind-запуске идентичность модели не покидает сервер, пока текущая identity не проголосовала по задаче.

### Зафиксированные решения (добавить как DEC-XXX в `16-decisions.md`)
- Флаг `blind?: boolean` в теле `POST /api/stream-compare`; новый `mode_slug` НЕ вводить (в `ALLOWED_MODE_SLUGS` остаются prompt-arena/code-arena).
- Персистентность: `tasks.is_blind boolean not null default false`.
- Слоты: сервер шаффлит выбранные модели (Fisher–Yates) и подписывает «Модель A/B/C…»; во все SSE-события в blind уходит слот. `responseId` (UUID из `model_responses`) не является утечкой — нужен для голосования.
- Раскрытие: массив `reveal` в ответе `POST /api/vote` для blind-задач; `GET /api/tasks/[taskId]` (и history, если применимо) маскирует имена до первого голоса identity.

### Шаги

**3.1. Миграция** `supabase/migrations/<timestamp>_tasks_is_blind.sql` (создать, НЕ применять — см. «Порядок деплоя»):
```sql
alter table public.tasks
  add column if not exists is_blind boolean not null default false;
```
`08-database.md` — тем же коммитом.

**3.2. Wire-дескриптор в `streamOneModel`** (`stream-compare/route.ts`). Добавить параметр `wire: { id: string; name: string; role: string | null }` и во ВСЕХ `sse(...)` внутри функции использовать только `wire.id/name/role` вместо `model.selectionId/name/role`. Вызов OpenRouter по `model.modelKey` не трогать.

**3.3. Хендлер POST** (`stream-compare/route.ts`):
- В `interface StreamCompareRequest` (строка 171) добавить `blind?: unknown`; в деструктуризацию (строка 224) — `blind`; валидация: `const isBlind = blind === true;` (любое иное значение = false, без ошибки).
- После `resolveSelectedModels` (строка 248):
```ts
const orderedModels = isBlind ? fisherYatesShuffle([...selectedModels]) : selectedModels;
const wireFor = (m: (typeof orderedModels)[number], i: number) =>
  isBlind
    ? { id: `slot-${String.fromCharCode(97 + i)}`, name: `Модель ${String.fromCharCode(65 + i)}`, role: null }
    : { id: m.selectionId, name: m.name, role: m.role };
```
`fisherYatesShuffle` — в `src/lib/server/utils.ts` + unit-тест (та же длина, тот же мультисет).
- Стриминг и `persistItems` (строка 267) строить по `orderedModels`; в `streamOneModel` передавать `wireFor(model, i)`; **`persistItems` оставляют реальные данные** — БД и лидерборд честные.
- В вызов `saveArenaRun` (строка ~291) добавить `isBlind`.
- `finalResponses` (строки 301–315): при `isBlind` заменить `modelId`/`modelName` на wire-значения слота, сохранив реальный `id` ответа из `responseIdsByModelId`. Поле `modelKey`, если присутствует, тоже слотировать/убирать.

**3.4. `saveArenaRun`** (`src/lib/server/arena-persistence.ts`, строка 48): input сейчас `{ prompt, modeSlug, modelKeys, responses, settings, owner }` — добавить `isBlind?: boolean` в `SaveArenaRunInput` и писать в колонку `tasks.is_blind` в insert задачи.

**3.5. Раскрытие в `POST /api/vote`.** В `src/lib/server/votes.ts` добавить:
```ts
export async function getBlindReveal(taskId: string) {
  // select is_blind from tasks where id = :taskId → если false/нет строки → null
  // select id, display_name, model_key from model_responses where task_id = :taskId
  // → [{ responseId, modelName: display_name ?? model_key, modelKey: model_key }]
}
```
Точные имена колонок сверить с select'ом в `tasks/[taskId]/route.ts` (строки ~41–80). В vote route после успешного `saveBestVote`: `const reveal = await getBlindReveal(taskId);` и `...(reveal ? { reveal } : {})` в JSON.

**3.6. Гейт боковых дверей.**
- `GET /api/tasks/[taskId]`: если `task.is_blind` и у текущей identity нет голоса по задаче (`select 1 from votes where task_id = :id and (user_id = :uid or anonymous_session_id = :anon) limit 1`) → каждому response выдать `modelName: "Модель A/B/…"` по детерминированному порядку (сортировка по `created_at` ответа; зафиксировать комментарием) и не отдавать `model_key`. Иначе — текущее поведение.
- `GET /api/history/[taskId]` / `getHistoryTask`: тот же гейт, если responses содержат идентичность модели (см. «Проблема», п. 4).
- Прочие места `display_name` в `src/app/api/**` (admin/*, stats, profile, guest) — агрегаты и админка, к blind-задачам не привязаны, НЕ трогать.

**3.7. Клиент.**
- `prompt-arena.tsx` (состояние `blindMode`, ~строка 215): слать `blind: blindMode` в теле stream-compare.
- Раскрытие уже реализовано через `winnerResponseId` в `arena-results.tsx` — сохранить UX, но источником реальных имён после голоса сделать `reveal` из ответа `/api/vote` (маппинг `responseId → modelName`), т.к. локальных реальных имён в blind больше не будет. Локальные `BLIND_LABELS` заменить/согласовать с серверными слот-именами из SSE.
- `judge-panel.tsx` blind-aware — проверить, что до голоса не рендерит реальные имена (их и не будет в данных).
- Убедиться грепом, что реальный `modelName` нигде в компонентах не логируется до голоса.

### Тесты
- **Золотой:** route-тест stream-compare с `blind: true` — собрать все SSE-чанки; assert: ни в одном событии нет ни одной строки из реальных `model.name`/`model_key`; слоты идут A, B, C…; `complete.responses[].id` — реальные UUID.
- Регресс: `blind: false` (и отсутствие поля) — события содержат реальные имена.
- `fisherYatesShuffle` unit.
- vote route: blind-задача → ответ содержит `reveal` с реальными именами; обычная → поля нет.
- tasks/[taskId]: blind без голоса → маскировано; после голоса → реально. Аналогично history, если гейтится.

### Документация (тем же PR)
`28-api-contracts.md`: `blind` в запросе stream-compare, слот-семантика SSE, `reveal` в ответе vote, условная маскировка tasks/history. `08-database.md`: `tasks.is_blind`. `16-decisions.md`: DEC-XXX. `15-changelog.md`: строка.

### Явные границы
Не вводить новый mode_slug; не менять персист ответов и лидерборд; Code Arena blind — вне скоупа (отдельной задачей); прочие `display_name`-роуты не трогать.
