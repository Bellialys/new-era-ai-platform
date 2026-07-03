# CLAUDE.md

Этот файл читается Claude автоматически при открытии проекта.

## Режим работы

- **Не экономить токены на сложных задачах.** Ответы должны быть развёрнутыми, с анализом, обоснованиями, альтернативами, рисками и проверяемыми выводами.
- Для планирования, архитектурных решений и code review давать подробный reasoning summary: предпосылки, варианты, почему выбран текущий подход, какие риски приняты и какие проверки подтверждают результат.
- При сложной задаче разбивать работу на подзадачи, выполнять последовательно и фиксировать отчёты по этапам: анализ, план, реализация, тестирование, self-review.
- Уровень качества: все изменения должны соответствовать production-grade — полная типизация, отказоустойчивость, документирование, тестирование, security/privacy review, rollback awareness.
- Если задача технически понятна, но требует длительного анализа, агент продолжает работу и фиксирует ход решений в отчёте; техническая сложность сама по себе не является причиной остановки.

## Проект

**Новая эпоха** — AI-платформа для сравнения нескольких AI-моделей по одному запросу (Prompt Arena).

Стек: **Next.js 16 / TypeScript / Tailwind CSS / Supabase / OpenRouter**

## Правила и документы

Стартовый минимум перед любой работой:

1. **`AGENTS.md`** — текущий статус проекта, главные правила, архитектура.
2. **`24-codex-active-rule-set.md`** — полный индекс действующих правил и алгоритм работы.
3. **`23-codex-quality-rules.md`** — стандарты качества и чек-листы; обязателен к полному прочтению, не просто ссылка.
4. **`.project/state.json`** — текущая версия, фаза, статус и активные задачи.
5. **`14-roadmap.md`** — порядок этапов разработки (главный источник истины по версиям).
6. **`36-document-sync-policy.md`** — правила синхронизации документации и project state.
7. **`25-production-excellence.md`** — дополнительные production-grade стандарты проекта.

Полный обязательный список документов находится в `24-codex-active-rule-set.md`,
раздел **«Обязательные документы перед работой Codex»**.

## Ключевые ограничения

- Не вызывать OpenRouter напрямую из frontend — только через backend route handlers.
- Любой AI-generated output считать Untrusted Input; безопасный рендер, sanitization и запрет исполнения описаны в `25-production-excellence.md`, раздел `9.1 AI Output Sanitization`.
- Не коммитить `.env.local` и секретные ключи.
- Для Next.js App Router data fetching, mutations и UI state применять cache/revalidation policy из `23-codex-quality-rules.md`, раздел `17`.
- Code Arena Runner выполняет пользовательский код только через внешний runner для авторизованных пользователей.
- Для `/api/code-run` не запускать пользовательский код внутри server-side процесса приложения; не обходить auth/rate limit и требования `25-production-excellence.md`, раздел `6.1 Code Runner Isolation Requirements`.
- AI Team Mode работает за `NEXT_PUBLIC_ENABLE_TEAM_MODE` и backend gate `ENABLE_TEAM_MODE`; Image Arena требует auth, storage и safety controls.

## Команды

```bash
npm run typecheck   # TypeScript
npm run lint        # ESLint
npm run build       # production-сборка
npm run smoke       # health/models smoke-check
npm run verify    # все четыре проверки последовательно
npm run state:check # project state и task-файлы
npm run docs:check  # синхронизация документации
```

В PowerShell на этой машине можно использовать `npm.cmd`, если `npm.ps1` блокируется политикой выполнения.

Выполнять `npm run verify` перед каждым коммитом (или все четыре по отдельности). Для docs/process изменений дополнительно выполнять `npm run state:check` и `npm run docs:check`.

## Текущая фаза

Актуальная версия, текущая фаза, стабильный релиз и активные задачи всегда
зафиксированы в `.project/state.json` и `AGENTS.md`. Порядок будущих этапов
находится в `14-roadmap.md`.

## Autonomous pipeline rules

Обязательны для каждой агентской сессии без исключений (источник: `47-kickoff-pipeline.md`):

1. **Свежая база:** `git fetch origin && git checkout main && git pull`; каждая задача — новая ветка `fix/task-<N>-<короткое-имя>` от актуального main.
2. **Никогда не пушить в main:** результат каждой задачи — Pull Request через `gh pr create`; в body — номер задачи, изменённые файлы, вывод проверок.
3. **DoD:** `npm run typecheck && npm run lint && npm run test` зелёный локально до открытия PR; падающие тесты чинить, не открывать PR с оговорками.
4. **Документация в том же коммите:** API → `28-api-contracts.md`; БД → `08-database.md`; каждая задача → строка в `15-changelog.md`.
5. **Миграции НЕ применять:** создать SQL-файл в `supabase/migrations/` с timestamp, в body PR — `⚠️ MIGRATION PENDING — применяет Claude (web) через Supabase MCP после merge`.
6. **Секреты:** не создавать `.env*` (кроме `.env.example`), не вписывать ключи в код, тесты и документацию.
7. **Границы задач буквально:** замечания вне скоупа — отдельным списком в body PR, не в коде.
8. **Стиль ошибок:** `ApiError` + `createErrorResponse` (`{status, errorCode, message}`), `logApiRequest` на каждом выходе, 429 всегда с `Retry-After`; эталон: `src/app/api/vote/route.ts`.
