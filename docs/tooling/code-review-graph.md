# Code Review Graph: локальная интеграция

Версия документа: 2026-07-27. Проверенная версия CRG: `2.3.7`.

## 1. Назначение

`code-review-graph` (CRG) создаёт постоянный локальный SQLite-граф исходного
кода. Codex и другие AI-агенты используют его как первый навигационный слой
для архитектуры, callers/callees, impact radius и связанных тестов.

Измерения именно этого репозитория находятся в
[`code-review-graph-baseline.md`](code-review-graph-baseline.md).

## 2. Что CRG решает

- структурная карта до чтения большого числа файлов;
- поиск прямых и транзитивных связей;
- оценка blast radius и affected tests;
- communities и flows для архитектурного обзора;
- инкрементальное обновление после изменений;
- MCP tools для Codex.

## 3. Что CRG не решает

CRG не заменяет TypeScript compiler, ESLint, Vitest, production build,
runtime smoke или ручное чтение изменяемого кода. Он не подтверждает
динамическое поведение, авторизацию, RLS, SQL semantics или framework
conventions.

## 4. Архитектура интеграции

```text
tracked source
  -> local CRG CLI
  -> .code-review-graph/graph.db (ignored)
  -> stdio MCP in user Codex config (machine-local)
  -> graph-first AI navigation
```

`package.json` содержит только Node.js wrappers. Python-пакет не входит в
npm dependency graph. Git hooks, CI и Vercel build от CRG не зависят.

## 5. Локальность и приватность

Базовый parse/graph/postprocess выполняется локально. Embeddings не нужны,
не установлены и не активированы. Не запускай `code-review-graph embed` и не
настраивай cloud embedding provider без прямого разрешения владельца.

## 6. Требования

- Windows PowerShell;
- Python `>=3.10`;
- Node.js 24 по `package.json`;
- Git repository;
- Codex CLI для MCP-регистрации.

Проверка:

```powershell
python --version
py --list
node --version
npm.cmd --version
codex.cmd --version
```

## 7. Установка на Windows PowerShell

В этой среде `uv` и `pipx` отсутствовали, поэтому использован isolated venv:

```powershell
python -m venv .tools\code-review-graph-venv
.\.tools\code-review-graph-venv\Scripts\python.exe -m pip install --upgrade pip
.\.tools\code-review-graph-venv\Scripts\python.exe -m pip install "code-review-graph[communities]==2.3.7" "tiktoken==0.13.0"
```

Окружение игнорируется Git. Глобальный/system Python не изменяется.

Если `python` не указывает на Python 3.10+, используй доступную версию
launcher, например `py -3.10 -m venv ...`, после проверки `py --list`.

## 8. Установка через uv

Если `uv` доступен, предпочтительна isolated tool installation:

```powershell
uv tool install "code-review-graph[communities]==2.3.7"
code-review-graph --version
```

После такой установки wrappers найдут binary через `PATH`. Для нестандартного
пути задай локальную переменную процесса `CRG_BINARY`.

## 9. Альтернатива через pipx

```powershell
pipx install "code-review-graph[communities]==2.3.7"
code-review-graph --version
```

Не используй глобальный `pip install`, пока isolated варианты доступны.

## 10. Проверка версии

```powershell
npm.cmd run graph:doctor
.\.tools\code-review-graph-venv\Scripts\code-review-graph.exe --version
```

Ожидается `code-review-graph 2.3.7`.

## 11. Первое построение графа

```powershell
npm.cmd run graph:build
```

Команда запускает официальный `build` из корня repository. База создаётся в
`.code-review-graph\graph.db`; исходный код внешним сервисам не отправляется.

## 12. Проверка status

```powershell
npm.cmd run graph:status
npm.cmd run graph:doctor
```

Doctor read-only: он проверяет binary, version output, storage, JSON status и
ненулевые nodes/edges. Он никогда не запускает build.

Exit codes doctor:

| Код | Значение |
|---:|---|
| 0 | status успешен |
| 2 | CRG отсутствует или binary не запускается |
| 3 | graph storage не создан |
| 4 | граф или storage пуст |
| 5 | status повреждён, не читается или вернул invalid JSON |

## 13. MCP-подключение к Codex

Installer предварительно проверен в `--dry-run`. Чтобы не менять
`.githooks`, skills и agent instructions, используй ограниченный режим:

```powershell
$repoPath = (Get-Location).Path
.\.tools\code-review-graph-venv\Scripts\code-review-graph.exe install --platform codex --no-hooks --no-skills --no-instructions --repo $repoPath
codex.cmd mcp get code-review-graph
codex.cmd mcp list
```

Installer записывает machine-specific absolute Python path и repository cwd
в пользовательский `%USERPROFILE%\.codex\config.toml`. Этот файл не
коммитится. Не создавай tracked `.mcp.json` с локальным абсолютным путём.

Перед installer сделай резервную копию существующего user config:

```powershell
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupDir = Join-Path $env:USERPROFILE ".codex\backups\crg-$stamp"
New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
$configPath = Join-Path $env:USERPROFILE ".codex\config.toml"
if (Test-Path -LiteralPath $configPath) {
  Copy-Item -LiteralPath $configPath -Destination $backupDir
}
```

## 14. Перезапуск Codex

Codex загружает новый MCP server при старте session. После install полностью
перезапусти Codex или создай новую session в этом repository. Уже открытый
диалог может не увидеть новые tools динамически.

## 15. Проверка MCP tools

В CRG 2.3.7 проверены 30 tools:

```text
build_or_update_graph_tool
run_postprocess_tool
get_minimal_context_tool
get_impact_radius_tool
query_graph_tool
get_review_context_tool
semantic_search_nodes_tool
embed_graph_tool
list_graph_stats_tool
get_docs_section_tool
find_large_functions_tool
list_flows_tool
get_flow_tool
get_affected_flows_tool
list_communities_tool
get_community_tool
get_architecture_overview_tool
detect_changes_tool
refactor_tool
apply_refactor_tool
generate_wiki_tool
get_wiki_page_tool
get_hub_nodes_tool
get_bridge_nodes_tool
get_knowledge_gaps_tool
get_surprising_connections_tool
get_suggested_questions_tool
traverse_graph_tool
list_repos_tool
cross_repo_search_tool
```

Минимальная MCP-проверка: вызови `list_graph_stats_tool`. Ожидаются ненулевые
`total_nodes`, `total_edges`, `files_count` и `embeddings_count: 0`.

## 16. Ручное обновление

```powershell
npm.cmd run graph:update
npm.cmd run graph:verify
```

`graph:update` выполняет incremental update. `graph:verify` read-only
запускает `detect-changes --brief --verify`; локальный `tiktoken` проверяет
оценку контекста.

Новые untracked files CRG может не увидеть. Сначала сделай их Git-visible
обычным `git add`, затем повтори update. Не создавай искусственный commit.

## 17. Автоматическое обновление

Минимально рискованный вариант — opt-in watch mode:

```powershell
npm.cmd run graph:watch
```

Процесс работает только в локальной terminal session. Останови `Ctrl+C`.
Installer hooks не включены: существующие `.githooks/pre-commit` и
`.githooks/post-commit` не изменялись, commit не блокируется CRG и тяжёлый
full rebuild не запускается автоматически.

## 18. npm wrapper-команды

| Команда | Назначение |
|---|---|
| `npm run graph:build` | полный initial build |
| `npm run graph:update` | incremental update |
| `npm run graph:status` | status |
| `npm run graph:changes` | read-only `detect-changes --brief` |
| `npm run graph:verify` | read-only changes + verified token estimate |
| `npm run graph:watch` | opt-in watch |
| `npm run graph:doctor` | read-only diagnostics |

Wrapper использует `spawnSync`, `shell: false`, literal arguments, inherited
stdio и корректный child exit code. На Windows сначала ищется repository-local
venv, затем `PATH`.

## 19. Типовые запросы

- «Покажи callers/callees `src/app/api/team-run/route.ts::POST`».
- «Какие tests связаны с `resolveRequestIdentity`?»
- «Какие modules импортируют `src/lib/server/supabase.ts`?»
- «Покажи communities и coupling hotspots».
- «Каков impact radius изменения `rate-limit.ts`?»

Начинай с minimal detail. Standard detail запрашивай только для выбранного
symbol или community.

## 20. Использование для code review

1. `detect_changes_tool` или `npm run graph:changes`.
2. `get_review_context_tool` с конкретными changed files.
3. Проверить risk, impacted symbols и tests.
4. Прочитать diff и изменённый source.
5. Выполнить обычные project checks.

## 21. Impact analysis

Перед multi-file change вызови `get_impact_radius_tool` с явным списком
файлов и небольшим `max_depth`. Не принимай 2-hop список как точный scope:
высокосвязанные helpers дают широкий transitive radius.

## 22. Поиск тестов

Используй `query_graph_tool` с `tests_for`, затем проверь найденные test files
через source search. В baseline Team Mode transitive query вернул 64 tests из
пяти файлов, тогда как direct route callers находились в одном route test.

## 23. Измерение токенов

Для реального diff:

```powershell
npm.cmd run graph:verify
```

Для сравнительного benchmark считай полный source context и фактический MCP
JSON одним tokenizer (`cl100k_base`). Не выдавай встроенный estimated percent
за измеренный результат. Baseline этого repository: `-104.3%`, `47.4%` и
`88.3%` экономии для single-file, medium и architecture сценариев.

## 24. Ограничения TypeScript и Next.js

- строковый `fetch("/api/...")` не образует надёжный call edge;
- App Router route export и proxy conventions требуют ручной проверки;
- path aliases, dynamic imports и callbacks могут давать пропуски;
- transitive `TESTED_BY` может быть шире практического scope;
- TypeScript types и overload resolution подтверждает только compiler;
- CRG не доказывает cache/revalidation или runtime behaviour.

## 25. Ограничения небольшого repository

На trivial single-file wrapper graph payload оказался больше самого файла.
CRG следует пропускать, когда путь и scope очевидны. При medium/architecture
scope экономия уже измеримо положительна, но graph не является обязательным
ритуалом перед каждым чтением.

## 26. Troubleshooting

`CRG is not installed`:

```powershell
Get-Command code-review-graph -ErrorAction SilentlyContinue
Test-Path .tools\code-review-graph-venv\Scripts\code-review-graph.exe
```

`Graph is not built`: запусти `npm run graph:build`.

Пустой/повреждённый graph: сначала сохрани diagnostic output. Затем удали
только `.code-review-graph` и выполни новый build; не удаляй repository.

MCP медленный на Windows: используй прямой `.exe`, `PYTHONUTF8=1` и не
оборачивай server через `cmd /c`. При необходимости работай CLI wrappers до
исправления MCP.

## 27. Полное удаление

Сначала удалить MCP registration:

```powershell
codex.cmd mcp remove code-review-graph
```

Затем из корня repository удалить только известные local artifacts:

```powershell
$venv = (Resolve-Path -LiteralPath ".tools\code-review-graph-venv").Path
$graph = (Resolve-Path -LiteralPath ".code-review-graph").Path
Remove-Item -LiteralPath $venv -Recurse -Force
Remove-Item -LiteralPath $graph -Recurse -Force
```

Tracked wrappers/docs удаляются обычным отдельным Git change, если владелец
решит полностью отказаться от интеграции.

## 28. Восстановление MCP-конфигурации

Предпочтительный rollback — `codex mcp remove`, потому что он удаляет только
named server. Для полного восстановления скопируй сохранённый `config.toml`
из `%USERPROFILE%\.codex\backups\crg-<timestamp>\` обратно только после
сравнения diff и при закрытом Codex.

## 29. Отключение hook

CRG hook не установлен. В `.githooks` нечего отключать или откатывать.
Если кто-то позже запустит installer без `--no-hooks`, сначала сравни
`.githooks/pre-commit` с Git и удали только добавленный CRG block вручную,
сохранив `npm run precommit`.

## 30. Где хранится локальная база

Основная база: `.code-review-graph\graph.db`.

Registry/MCP configuration находится в user-local Codex config, а installer
backup — в `%USERPROFILE%\.codex\backups\`. Никакой из этих absolute paths не
записывается в tracked repository files.

## 31. Что не коммитить

- `.code-review-graph/` и SQLite sidecars;
- `.tools/code-review-graph-venv/`;
- `.crg/`, `*.crg.db`;
- logs, dumps, embedding caches;
- user Codex config и machine-specific MCP state;
- secret/env files.

`.code-review-graphignore`, напротив, является общей tracked policy.

## 32. Обновление CRG

1. Проверить новый release, README, Python requirement и Windows issues.
2. Обновить pinned version в isolated environment.
3. Обновить `CODE_REVIEW_GRAPH_VERSION` в wrapper и этот документ.
4. Выполнить `--version`, full backup, `graph:update`, `graph:doctor`.
5. Повторить MCP tool list и три benchmark-сценария.

Для текущего venv:

```powershell
.\.tools\code-review-graph-venv\Scripts\python.exe -m pip install --upgrade "code-review-graph[communities]==2.3.7"
```

Не обновляй на непроверенную latest версию в CI.

## 33. Проверка свежести графа

```powershell
npm.cmd run graph:status
npm.cmd run graph:changes
git status --short
```

Сравни `Built at commit` с текущим `git rev-parse HEAD`. При Git-visible
изменениях выполни `npm run graph:update`. После commit обнови граф ещё раз,
чтобы metadata SHA соответствовал новому HEAD.

## 34. Acceptance criteria

- CRG version проверена и isolated;
- status возвращает ненулевые nodes/edges;
- база ignored и embeddings равны нулю;
- MCP server виден через `codex mcp list`;
- новая Codex session видит 30 tools и выполняет `list_graph_stats_tool`;
- graph-first используется только для структурных/multi-file задач;
- hooks, CI, build и deploy не зависят от CRG;
- incremental update и doctor проходят;
- token benefit измерен, а пропуски документированы;
- rollback проверяем и не затрагивает source или production.

## CI-решение

CRG не добавлен в GitHub Actions. Для текущего repository manual workflow не
даёт достаточной пользы: graph database не коммитится, установка Python
увеличивает время CI, а отсутствие локального code-intelligence tool не
должно блокировать merge или deployment. Решение можно пересмотреть при
появлении отдельного non-blocking architecture audit.

## Источники версии

- официальный repository:
  `https://github.com/tirth8205/code-review-graph`;
- release:
  `https://github.com/tirth8205/code-review-graph/releases/tag/v2.3.7`;
- PyPI:
  `https://pypi.org/project/code-review-graph/2.3.7/`.

На 2026-07-27 [открытая Windows MCP performance
issue](https://github.com/tirth8205/code-review-graph/issues/262) остаётся
основанием проверять CLI fallback и не делать MCP обязательным блокером
workflow.
