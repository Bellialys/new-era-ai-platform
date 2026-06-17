# 24 - Codex Active Rule Set

## Назначение файла

Этот файл фиксирует, какие документы являются действующими правилами для Codex.

Перед началом любой работы Codex должен прочитать эти документы и учитывать их как обязательные инструкции проекта.

## Статус

```text
Status: active
# этот файл является индексом действующих правил Codex
```

## Обязательные документы перед работой Codex

Codex должен прочитать:

1. `14-roadmap.md`
   - главный порядок разработки проекта;
   - определяет порядок будущих этапов.

2. `20-auth-guest-profile-plan.md`
   - план регистрации, гостевого режима и профиля;
   - определяет v0.6 Auth, Guest Mode and Profile.

3. `21-access-gate-policy.md`
   - правило блокировки использования Prompt Arena без аккаунта или гостевой карточки;
   - определяет `AUTH_REQUIRED` и guest access.

4. `.project/state.json`
   - текущая версия, текущая фаза и состояние проекта;
   - список активных task ids.

5. `.project/tasks/*.json`
   - канонический список задач Codex;
   - статусы, проверки и commit hash выполненных задач.

6. `23-codex-quality-rules.md`
   - активные правила качества кода;
   - self-review, документация, security, performance, accessibility, API validation, Git workflow.

## Иерархия правил

Если документы конфликтуют:

1. Безопасность и защита данных имеют приоритет.
2. `.project/state.json` и `.project/tasks/*.json` определяют текущую версию, текущую фазу и список задач для выполнения.
3. `14-roadmap.md` определяет порядок этапов.
4. `21-access-gate-policy.md` определяет обязательные правила доступа.
5. `23-codex-quality-rules.md` определяет качество реализации.
6. Старые документы нельзя считать выше новых, если они конфликтуют с этим индексом.

## Главный алгоритм Codex

Codex должен работать по схеме:

```text
Анализ -> План -> Self-Review плана -> Изменения -> Self-Review кода -> Проверки -> Security/Performance check -> Исправление ошибок -> Документация -> Commit -> Push/Verify -> Отчёт
```

## Минимальный чек перед началом работы

```bash
git pull
# подтянуть последние изменения

supabase migration list
# проверить local vs remote migrations

npm run typecheck
# проверить TypeScript до изменений

npm run lint
# проверить ESLint до изменений

npm run build
# проверить production build до изменений
```

## Минимальный чек перед завершением этапа

```bash
npm run typecheck
# проверить TypeScript

npm run lint
# проверить ESLint

npm run build
# проверить production build
```

Если затронуты API:

```bash
npm run smoke
# проверить health/models
```

Если затронута БД:

```bash
supabase migration list
# проверить миграции

supabase db reset
# проверить чистую локальную базу

supabase db push
# проверить remote sync
```

## Stop Signal

Codex обязан остановиться и спросить пользователя, если:

- миграции local и remote расходятся;
- есть риск потери данных;
- нужно удалить таблицу или колонку;
- задача затрагивает больше 5 файлов;
- нужно добавить новый npm-пакет без очевидной необходимости;
- нужно менять Vercel/Supabase secrets;
- документация конфликтует с текущей схемой БД;
- бизнес-логика непонятна.
