# Code Review Graph baseline

Дата измерения: 2026-07-27.

Этот документ фиксирует проверяемый baseline локальной интеграции
`code-review-graph` (CRG). Это snapshot, а не источник текущего project state.
Актуальные команды и эксплуатационные правила находятся в
[`code-review-graph.md`](code-review-graph.md).

## Среда и provenance

| Параметр | Фактическое значение |
|---|---|
| Repository | `Bellialys/new-era-ai-platform` |
| Ветка интеграции | `chore/code-review-graph-integration` |
| Исходный checkout SHA | `0dc2e3076bfc436d43b52ffa94fbe78081689385` |
| База ветки (`origin/main`) | `2ae9f47a5214dbfd851ddcc8726842055d817b73` |
| Платформа | Windows, PowerShell |
| Node.js | `v26.3.0` |
| npm | `11.16.0` |
| Python в CRG venv | `3.10.11` |
| Python launcher `py` | `3.14.6` |
| Codex | Windows Codex workspace; `codex-cli 0.144.4` доступен через `codex.cmd` |
| CRG | `2.3.7` |
| Локальное хранилище | `.code-review-graph/graph.db` |

Версия Node.js в измерительной среде выше объявленного в `package.json`
диапазона `>=24 <25`. Typecheck, lint, tests, build, docs/state checks и
локальный smoke прошли, но воспроизводимый проектный runtime остаётся
Node.js 24. `npm audit` отдельно сообщил пять high findings в существующем
dependency tree; они не вызваны CRG и не скрываются этим отчётом.

## Аудит репозитория до изменений

Команды выполнялись на чистой ветке, созданной непосредственно от
`origin/main`. Пользовательские изменения не переносились и не очищались.

| Метрика | Значение |
|---|---:|
| Git tracked files | 333 |
| TypeScript `.ts` | 98 |
| TSX `.tsx` | 59 |
| JavaScript `.js` | 0 |
| JavaScript `.mjs` | 17 |
| Тестовые файлы | 35 |
| Source-like files в baseline | 206 |
| Source-like bytes | 1,080,710 |
| Source-like lines | 26,529 |
| Eligible tracked text files | 317 |
| Eligible tracked text bytes | 2,804,677 |
| TS/TSX/MJS candidates | 174 |
| TS/TSX/MJS bytes | 1,011,739 |

Для source-size учитывались `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`,
`.css`, `.scss`, `.sql`, `.ps1`, `.sh`. Исключались `node_modules`, `.next`,
`coverage`, `build`, `dist`, `out`, `generated`, архивы и бинарные файлы.

Основные tracked-группы:

| Группа | Файлы |
|---|---:|
| `src/` | 155 |
| Корневые документы и конфигурация | 64 |
| `supabase/` | 30 |
| `docs/` | 24 |
| `.project/` | 24 |
| `archive/` | 16 |
| `scripts/` | 15 |

## Существующий workflow

- Git использует `core.hooksPath=.githooks`.
- `pre-commit` запускает `npm run precommit`.
- `post-commit` запускает
  `node scripts/git/sync-after-commit.mjs --hook`; существующая логика
  сохранена без изменений.
- Husky отсутствует.
- CI выполняет install, audit, typecheck, lint, tests, build, state/docs
  checks и smoke. CRG намеренно не добавлен в обязательный CI.
- `.project/state.json` и `.project/tasks/*.json` являются SSOT текущего
  состояния; `npm run state:check`, `npm run docs:check` и
  `node scripts/sync/index.mjs --dry-run` проверяют синхронизацию.
- Главные инструкции AI: `AGENTS.md`, `CLAUDE.md`,
  `24-codex-active-rule-set.md`, `23-codex-quality-rules.md` и
  `25-production-excellence.md`.

## Выбор и установка CRG

Проверены официальный GitHub repository, README, release `v2.3.7`, PyPI и
CLI установленной версии. Release опубликован 2026-07-18, пакет требует
Python `>=3.10`.

В среде отсутствовали `uv`, `uvx` и `pipx`, поэтому использован третий
разрешённый вариант: отдельный ignored venv
`.tools/code-review-graph-venv/`. CRG не добавлен в `dependencies` или
`devDependencies`.

Фактическая установка выполнена pinned-командой
`python -m pip install "code-review-graph[communities]==2.3.7" tiktoken`
внутри этого venv. Обновление требует отдельной проверки нового release и
изменения pin; удаление выполняется через `codex mcp remove
code-review-graph`, затем удаление только локальных venv/graph directories.
Полные команды приведены в основном руководстве.

Установлено:

- `code-review-graph[communities]==2.3.7`;
- `tiktoken==0.13.0` для локальной верификации токенов;
- `igraph==1.0.0` как часть локального community post-processing.

Embedding-пакеты не устанавливались, `embed` не запускался, число embeddings
равно нулю.

## Первое построение

Команда: `npm run graph:build`.

| Метрика первого полного build | Значение |
|---|---:|
| Время | 15.410 s |
| Рассмотрено parseable files | 208 |
| Сохранено File nodes | 206 |
| Nodes | 1,320 |
| Edges | 13,043 |
| Functions | 563 |
| Classes | 22 |
| Tests | 529 |
| Imports | 572 |
| Calls | 8,012 |
| Communities | 54 |
| Flows | 72 |
| SQLite size | 16,175,104 bytes |

Node kinds: 206 File, 563 Function, 529 Test, 22 Class.

Edge kinds: 8,012 `CALLS`, 3,313 `TESTED_BY`, 1,124 `CONTAINS`,
572 `IMPORTS_FROM`, 22 `REFERENCES`.

Languages: bash, PowerShell, JavaScript (включая MJS), TypeScript, TSX, SQL.

Парсер не сообщил ошибок исходного кода. Два tracked YAML-файла
(`.github/dependabot.yml` и `.github/workflows/ci.yml`) были рассмотрены, но
не дали structural nodes. Это ограничение формата, а не ошибка проекта.

После инкрементального добавления трёх tooling-скриптов status стал:
209 files, 1,328 nodes, 13,107 edges. Инкрементальный update занял 5.848 s,
обновил 6 Git-visible файлов и добавил 8 nodes/65 edges без full rebuild.
Новый symbol `runCodeReviewGraph` подтверждён через `file_summary`.

## MCP-проверка

Официальный installer запущен с `--no-hooks --no-skills --no-instructions`.
`codex mcp get code-review-graph` подтверждает enabled stdio server с
repository-local Python и cwd. Прямой MCP handshake вернул 30 tools, а
`list_graph_stats_tool` вернул 209 files, 1,328 nodes, 13,107 edges и ноль
embeddings.

Текущая Codex session была открыта до изменения user config и не подхватила
server динамически. Для встроенного graph call необходим restart/new session;
это единственное непроверенное внутри текущего диалога действие.

## Структурные проверки

### A. Архитектура

CRG выделил 54 communities. Крупные группы соответствуют Arena UI, Team UI,
server request helpers, sync tooling, model handling, task handling,
validation, voting и image compare. Сравнение с `src/app`, `src/lib`,
`scripts`, `supabase` и тестами подтверждает полезную общую карту.

### B. Team Mode

Для `src/app/api/team-run/route.ts::POST` CRG нашёл внутренние вызовы в
`team-mode`, `arena-persistence`, `auth`, `openrouter`, `rate-limit` и
`utils`, а также route/helper tests. Чтение кода подтвердило auth-only gate,
лимит 3/10 min, четыре роли, model allowlist, OpenRouter и best-effort
persistence.

Граф не восстановил строковую связь
`team-run-form.tsx -> fetch("/api/team-run")`. Он также не показал
`src/lib/server/models.ts` в измеренном наборе запросов, хотя route импортирует
`ALLOWED_MODELS`.

### C. Авторизация

`resolveRequestIdentity` имеет callers в защищённых route handlers и 12
связанных auth tests. Исходный код подтвердил Supabase `getUser`, fallback
guest-cookie и отсутствие доверия к `userId` из body. Next.js `proxy.ts` и
`updateSession()` требуют ручной проверки из-за framework conventions.

### D. Supabase

Граф нашёл browser client, SSR proxy client, service-role client и 34 callers
`getSupabaseServerClient`. При этом `tests_for` для service client вернул
ноль, хотя косвенные route tests используют mocks. SQL migrations
индексируются, но table-to-route data-flow нельзя считать достоверным.

### E. Detect changes и blast radius

`npm run graph:verify` на реальном integration diff показал changed symbols,
risk и test gaps. Для staged tooling-изменений CRG сообщил 5 changed
functions, risk `0.40` и 5 test gaps. Это сигнал review, а не обязательство
добавлять unit tests к тонкому process wrapper.

### F. Incremental update

До staging новые Git-untracked scripts не попали в граф. После обычного
`git add` incremental update обработал их без full rebuild. Это важное
эксплуатационное ограничение Git-aware режима: новый файл должен быть виден
Git до update.

## Проверенная экономия контекста

Токены обеих сторон посчитаны локальным `tiktoken` с `cl100k_base`.
Graph context — полный JSON payload фактически выполненных MCP queries, а не
рекламная оценка CRG. Full context:

- для single-file — весь один файл;
- для medium — 15 вручную подтверждённых Team Mode и helper/test файлов;
- для architecture — содержимое всех 209 файлов текущего графа.

| Сценарий | Полный контекст | CRG-контекст | Сохранено | Экономия | Точность | Вывод |
|---|---:|---:|---:|---:|---|---|
| Простое однофайловое изменение | 186 | 380 | -194 | -104.3% | P 100%, R 100%; 1 релевантный, 0 FP, 0 miss | CRG дороже прямого чтения; не использовать |
| Среднее изменение route/helper/test | 28,957 | 15,239 | 13,718 | 47.4% | P 100%, R 93.3%; 14 релевантных, 0 FP, 1 miss | Полезен как первая карта; вручную добавить `models.ts` |
| Архитектурный вопрос Team Mode | 255,962 | 29,851 | 226,111 | 88.3% | P 100%, R 82.4%; 14 релевантных, 0 FP, 3 miss | Сильно сокращает стартовый контекст, но не заменяет source review |

Время запросов: 0.123 s, 0.454 s и 1.143 s соответственно. В architecture
сценарии пропущены `src/app/team/page.tsx`, `src/lib/server/models.ts` и
миграция `20260628031516_database_v2_foundation.sql`.

Компактный `get_minimal_context_tool` не использовался как финальная метрика:
в этой рабочей копии он ориентировался на текущий Git diff и возвращал
слишком короткую сводку, недостаточную для анализа указанной задачи.

## Итог baseline

CRG полезен для архитектурных и связанных многофайловых задач уже при текущем
размере репозитория. Для trivial single-file задач он увеличивает контекст.
Для TypeScript/Next.js остаются значимые false negatives на строковых route
links, framework conventions, SQL/runtime data-flow и отдельных imports.
Поэтому выбран режим graph-first для структурных вопросов и
direct-file-first для очевидных локальных изменений.

## Проверки проекта после интеграции

| Проверка | Результат |
|---|---|
| `npm run typecheck` | passed |
| `npm run lint` | passed после добавления local CRG directories в ESLint ignores |
| `npm test` | 34 files, 390 tests passed |
| `npm run state:check` | passed |
| `npm run docs:check` | passed |
| sync dry-run | no files written |
| `npm run verify` | passed, включая production build 48 routes |
| local production smoke | passed: health `ok`, models `16`; catalog использовал documented fallback после timeout |
| `npm audit` | failed: 5 high findings в существующих npm dependencies |

`npm ci` не запускался: `node_modules` уже существовал, а lock-файл не
изменялся. CRG не входит в npm dependencies и production build.
