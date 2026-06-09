# 30 - Project Audit Report

Дата: 2026-06-07

## Цель аудита

Проверить проект **Новая эпоха** по файлам, исправить реальные проблемы и зафиксировать текущую стадию проекта.

Главный источник порядка разработки: `14-roadmap.md`.

---

# Проверенные области

## Код приложения

Проверены:

- `src/app`;
- `src/app/api`;
- `src/components/arena`;
- `src/lib/arena`;
- `src/lib/server`;
- `src/types`;
- `supabase/migrations`.

Результат:

- корневые устаревшие server-дубликаты удалены;
- API routes и server utilities приведены к зелёной TypeScript-сборке;
- Prompt Arena UI сохранён без изменения сценария пользователя;
- Supabase-заготовка оставлена как groundwork для v0.5.

## Конфигурация

Проверены:

- `package.json`;
- `package-lock.json`;
- `tsconfig.json`;
- `next.config.ts`;
- `eslint.config.mjs`;
- `.env.example`.

Результат:

- `.env.example` синхронизирован с server-side настройками;
- зависимости не менялись в ходе этого аудита;
- TypeScript включает весь проект, поэтому корневые `.ts`-дубликаты действительно ломали проверку.

## Документация

Проверены living-документы:

- `AGENTS.md`;
- `04-mvp-scope.md`;
- `12-security-and-env.md`;
- `14-roadmap.md`;
- `15-changelog.md`;
- `28-action-plan.md`.

Исторические audit/report файлы не переписывались как источник истины, если они описывают прошлое состояние проекта.

---

# Исправления

## Сборка и структура

- Удалены корневые файлы `index.ts`, `models.ts`, `openrouter.ts`, `utils.ts`.
- Истинный server layer теперь расположен только в `src/lib/server`.
- `ArenaModel` сведён к единому типу в `src/types/arena.ts`.

## API и безопасность

- Добавлен базовый in-memory rate limit для `POST /api/compare`.
- `modeSlug` валидируется через общий allowlist.
- Общий error path в `/api/compare` теперь уважает `ApiError.statusCode`.
- OpenRouter non-JSON response обрабатывается безопасно.
- `OPENROUTER_MAX_TOKENS` вынесен в constants и `.env.example`.
- OpenRouter usage сохраняется в `model_responses` при настроенном Supabase.

## UI

- Старые compare-запросы отменяются через `AbortController`.
- `latencyMs = 0` теперь отображается корректно.

## Документация

- `14-roadmap.md` обновлён под фактическое состояние.
- `04-mvp-scope.md` обновлён по текущему v0.4.1 и v0.5 groundwork.
- `12-security-and-env.md` обновлён по rate limit.
- `28-action-plan.md` отмечает уже выполненные пункты и следующий порядок работ.
- `15-changelog.md` получил запись о полном аудите.

---

# Проверки

Выполнено:

```bash
npm.cmd run typecheck
# passed

npm.cmd run lint
# passed

npm.cmd run build
# passed
```

Production build результат:

```text
/              static
/arena         static
/api/models    dynamic
/api/compare   dynamic
```

---

# Текущая стадия проекта

Текущая стадия:

```text
v0.4.1 - OpenRouter Integration Fix / Audit Stabilized
```

Проект ещё не является полноценным `v0.5`, потому что:

- `/api/models` пока читает hardcoded allowlist;
- frontend пока отправляет OpenRouter `model_key`, а не Supabase `models.id` UUID;
- Supabase migration нужно применить в реальном проекте Supabase;
- env для Supabase нужно заполнить локально и в Vercel.

Но часть v0.5 уже подготовлена:

- dependency `@supabase/supabase-js` есть;
- server-only Supabase client есть;
- миграция `0001_prompt_arena_mvp.sql` есть;
- `/api/compare` умеет сохранять `tasks` и `model_responses`, если Supabase настроен.

---

# Следующие шаги

1. Завершить v0.5 Supabase flow: `/api/models` из БД, `modelIds` как UUID, OpenRouter `model_key` только server-side.
2. Применить Supabase migration и заполнить env.
3. Добавить `POST /api/vote` для сохранения победителя.
4. Добавить History MVP.
5. Заменить in-memory rate limit на production-ready лимит перед публичным deploy.
