# 26 - Definition of Done

## Назначение

Этот документ фиксирует минимальные условия, при которых этап проекта можно считать завершённым.

## Базовое правило

Задача не считается готовой, если код написан, но не проверен.

Для production-grade задач готовность означает не только прохождение команд, но и наличие evidence: какие проверки выполнены, что осталось unverified, какие риски приняты и какой rollback/forward-fix path доступен.

## Definition of Done для любого этапа

Перед завершением этапа должно быть выполнено:

- код написан и связан с текущей архитектурой;
- TypeScript проходит без ошибок;
- lint проходит без ошибок;
- production build проходит;
- smoke-check проходит, если затронуты API, routing, Supabase или OpenRouter;
- миграции проверены, если затронута база данных;
- документация обновлена;
- нет временного debug-кода;
- секреты не добавлены в репозиторий;
- commit создан с понятным сообщением;
- краткий отчёт написан.

## Definition of Done по типам изменений

### Docs / process changes

- `state:check` проходит.
- `docs:check` проходит.
- Semantic sync dry-run (`node scripts/sync/index.mjs --dry-run`) не показывает неожиданный drift.
- Нет конфликтов между `AGENTS.md`, `CLAUDE.md`, `23-codex-quality-rules.md`, `24-codex-active-rule-set.md`, `25-production-excellence.md`, `36-document-sync-policy.md` и `.project/state.json`.
- В отчёте указано, что кодовые тесты не применимы, если менялась только документация.

### Code changes

- TypeScript, ESLint и build проходят.
- Тесты обновлены или причина отсутствия тестов явно согласована.
- Публичные функции и публичные интерфейсы документированы.
- Нет необоснованного `any`.
- Self-review архитектуры выполнен: нет God-объектов, ненужного дублирования и скрытых side effects.

### API changes

- Обновлены API docs и, если OpenAPI уже существует, OpenAPI specification.
- Валидация входа и DTO whitelist выхода описаны и реализованы.
- Auth/guest/admin requirements и error codes задокументированы.
- Rate limit и request-id/logging impact оценены.
- STRIDE/threat-model summary зафиксирован.

### Supabase / database changes

- Миграции идемпотентны, насколько возможно.
- Local vs remote migration history сверена или явно помечена как blocked.
- `schema:check` выполнен, если доступны `SUPABASE_DB_URL` и `SUPABASE_ACCESS_TOKEN`.
- Для сложных запросов есть `EXPLAIN` evidence или причина, почему проверка заблокирована.
- Для production-risk изменений указан backup/PITR/forward-fix plan.

### UI changes

- Проверены keyboard access, labels, focus indicators и loading/error/success states.
- A11y target — WCAG 2.1 AA; отклонения записаны как risk/debt.
- Mobile layout и основные viewport states проверены или явно отмечены как unverified.

## Evidence в итоговом отчёте

Итоговый отчёт должен содержать:

- список изменённых файлов;
- commit hash или hashes;
- какие проверки прошли;
- какие проверки заблокированы и почему;
- security/privacy/performance notes, если применимо;
- known risks и следующие улучшения.

## Команды проверки

```bash
npm run typecheck
# проверяет TypeScript без сборки

npm run lint
# проверяет ESLint

npm run build
# проверяет production-сборку

npm run smoke
# проверяет smoke-сценарий проекта

npm run state:check
# проверяет project state и task-файлы

npm run docs:check
# проверяет синхронизацию документации

node scripts/sync/index.mjs --dry-run
# semantic docs drift check

npm audit --audit-level=moderate
# проверяет зависимости на moderate+ уязвимости
```
