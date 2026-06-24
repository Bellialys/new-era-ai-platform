# 36 - Document Sync Policy

## Назначение файла

Этот документ описывает **Project State Sync System** — внутреннюю систему
контроля состояния проекта **Новая эпоха** и синхронизации документации.

Цель системы — один надёжный **Single Source of Truth (SSOT)** для версии,
текущей фазы, активных задач и проверок, который защищает проект от
рассинхронизации между `README.md`, `14-roadmap.md`, `15-changelog.md`,
`package.json`, `AGENTS.md` и статусными документами.

Это инфраструктурная developer-фича. Она не добавляет продуктовых функций.

## Источники истины

| Уровень | Файл | Что хранит |
|---|---|---|
| Состояние проекта | `.project/state.json` | версия, фаза, статус, активные задачи, базовая ветка |
| Задачи | `.project/tasks/*.json` | по одной задаче на файл |
| Карта документов | `.project/document-map.json` | какие документы активны/синхронизируются/устарели |
| История | `.project/history.json` | архив завершённых задач (через `state:archive`) |
| Схемы | `.project/state.schema.json`, `.project/task.schema.json` | JSON Schema для валидации |

`.project/state.json` — **главный источник истины**. `package.json` `version`
обязан совпадать с `state.json` `currentVersion`. Markdown-документы являются
**частично синхронизируемыми**: внутри SYNC-маркеров содержимое генерируется,
снаружи — это ручной текст.

## Структура `.project/`

```text
.project/
  state.json            # общее состояние проекта (SSOT)
  state.schema.json     # JSON Schema для state.json
  task.schema.json      # JSON Schema для задач
  document-map.json     # карта активных/синхронизируемых/устаревших документов
  history.json          # архив завершённых задач
  tasks/                # по одному JSON-файлу на задачу (V053-01.json и т.д.)
  backups/              # локальные бэкапы перед docs:sync (в .gitignore)
```

`.project/state.json`, `.project/tasks/*` и остальные JSON **коммитятся** в git.
`.project/backups/` — локальный артефакт и в git не попадает.

## Формат задач

Каждая задача (`.project/tasks/<ID>.json`) содержит:

- `id` — формат `V<три цифры>-<две цифры>`, например `V053-01`;
- `title`;
- `status` — `planned | in_progress | verify | done | blocked | archived`;
- `priority` — `low | medium | high | critical`;
- `files` — затрагиваемые файлы;
- `checksRequired` — какие проверки обязательны;
- `checksPassed` — какие проверки реально прошли;
- `lastUpdated` — ISO date-time;
- `commitHash` — хэш коммита (или `null`, пока задача не закрыта);
- `transitions` — журнал переходов статусов (`from`, `to`, `at`, `note`);
- `archivedAt` — время архивации, если task-файл оставлен в статусе `archived`;
- `notes`.

### Definition of Done

Статус `done` разрешён только если выполнены оба условия:

1. `checksPassed` содержит **все** значения из `checksRequired`;
2. указан `commitHash`.

Это правило проверяется автоматически (`state:check` / `docs:check`) и при
переводе задачи через `state:task`. Подробности Definition of Done —
в `25-definition-of-done.md`.

## SYNC-маркеры

Скрипты синхронизации обновляют только содержимое **внутри** маркеров:

```markdown
<!-- SYNC:PROJECT_VERSION_START -->
generated content
<!-- SYNC:PROJECT_VERSION_END -->
```

Доступные маркеры: `PROJECT_VERSION`, `PROJECT_STATUS`, `CURRENT_PHASE`.

Правила:

- **запрещено** вручную редактировать текст внутри auto-sync блоков —
  он будет перезаписан при следующем `docs:sync`;
- ручной текст **вне** маркеров скрипты не трогают;
- если маркеров нет, `docs:sync` аккуратно добавит их в подходящее место,
  не удаляя существующий текст.

Какие документы какие маркеры содержат — задаётся в `document-map.json`
(`syncedDocuments[].requiredMarkers`).

## Команды

### Состояние проекта (`scripts/state/index.mjs`)

```bash
npm run state:context
# краткое состояние проекта и активные задачи

npm run state:check
# валидация state.json и всех task-файлов

npm run state:task -- <id> <status> [--check name] [--commit hash] [--note "..."]
# изменить статус задачи (с записью перехода)

npm run state:archive
# перенести завершённые (done) задачи в history.json

npm run state:version -- <x.y.z>
# синхронно обновить версию в state.json и package.json
```

Codex и разработчик **не редактируют** state/task JSON вручную, если задачу
можно решить через CLI.

### Документация (`scripts/sync/index.mjs`)

```bash
npm run docs:sync -- --dry-run
# показать, какие файлы изменятся, без записи на диск

npm run docs:sync
# синхронизировать документацию из state.json (с backup перед записью)

npm run docs:check
# проверить отсутствие рассинхронизации (exit 1 при проблеме)

npm run docs:restore
# откатить последний backup из .project/backups/
```

### Общая проверка

```bash
npm run verify
# typecheck + lint + build + docs:check
```

`smoke` не входит в `verify`, потому что требует запущенного сервера
(`/api/health`, `/api/models`). Его запускают отдельно или в CI с поднятым
сервером.

## Что проверяет `docs:check`

- валидность `.project/state.json` по схеме;
- валидность всех `.project/tasks/*.json` по схеме и Definition of Done;
- совпадение `package.json` `version` и `state.json` `currentVersion`;
- наличие нужных SYNC-маркеров в `README.md`, `14-roadmap.md`, `15-changelog.md`
  (и других синхронизируемых документах);
- что активные документы из `document-map.json` существуют;
- что устаревшие `*-addendum.md`, `README-status-*.md`, `*-override.md` и
  явно помеченные deprecated-документы перенесены в `archive/`, а не лежат в корне;
- при любом рассинхроне завершает работу с `process.exit(1)`.

## Backup и restore

Перед каждой реальной записью `docs:sync` создаёт backup в
`.project/backups/<timestamp>/` и обновляет указатель `latest.txt`.

`npm run docs:restore` восстанавливает файлы из последнего backup. Это быстрый
откат, если синхронизация что-то изменила нежелательно. `.project/backups/`
не коммитится, поэтому для долгого хранения полагаемся на git-историю.

## Порядок работы Codex

1. `npm run state:context` — понять текущее состояние и активные задачи.
2. Взять задачу из `.project/tasks/` и перевести её в работу:
   `npm run state:task -- <id> in_progress`.
3. Делать изменения только по этой задаче.
4. Прогнать проверки и отметить пройденные:
   `npm run state:task -- <id> verify --check typecheck` (и т.д.).
5. Сделать commit рабочего результата.
6. Закрыть задачу только после Definition of Done:
   `npm run state:task -- <id> done --commit <hash>`.
7. При смене версии — `npm run state:version -- <x.y.z>`, затем `npm run docs:sync`.
8. Перед commit/PR — `npm run verify`.

## AI-agent documentation changes

Если меняются правила работы агентов, quality gates, Definition of Done или production standards, Codex должен проверять не только SYNC-маркеры, но и смысловую согласованность:

- `AGENTS.md`;
- `CLAUDE.md`;
- `23-codex-quality-rules.md`;
- `24-codex-active-rule-set.md`;
- `25-definition-of-done.md`;
- `25-production-excellence.md`;
- `36-document-sync-policy.md`;
- `.project/state.json`;
- `14-roadmap.md`.

Правила:

- auto-sync блоки нельзя редактировать вручную, если их можно обновить через `docs:sync`;
- если задача затрагивает больше 5 файлов, сначала нужен Stop Signal и подтверждённый план;
- docs-only изменения всё равно требуют self-review, staged diff review, secret scan, `state:check` и `docs:check`;
- если active task id отсутствует и пользователь просит только docs/process update, не создавать task/state churn без отдельной необходимости;
- документация должна фиксировать не только “что делать”, но и “как отчитываться”: reasoning summary, decision log, checks, blocked/unverified items и commit hashes.

Рекомендуемый docs/process verification flow:

```bash
npm run state:check
npm run docs:check
node scripts/sync/index.mjs --dry-run
git diff --cached --check
```

## Активные и устаревшие документы

- **Активные** документы перечислены в `document-map.json` (`activeDocuments`).
- **Синхронизируемые** документы и их маркеры — в `syncedDocuments`.
- **Устаревшие**: `*-addendum.md`, `README-status-*.md`, `*-override.md` и
  `22-codex-action-backlog.md` — должны находиться в `archive/`.

`22-codex-action-backlog.md` перенесён в `archive/` и заменён этой системой;
его активные задачи теперь живут в `.project/tasks/*.json`.

## Pre-commit (рекомендация)

Husky в проекте пока не установлен. Чтобы не усложнять, pre-commit hook сейчас
не добавляется. Когда потребуется автоматическая защита перед commit, подключить
Husky и добавить hook:

```bash
npx husky init
echo "npm run docs:check" > .husky/pre-commit
```

До этого роль автоматической защиты выполняет GitHub Actions CI
(`.github/workflows/ci.yml`), который запускает `docs:check` на каждый push и PR.

## Безопасность

Система не читает и не изменяет `.env`, `.env.local`, `.env.production` или любые
файлы с секретами. `.env.local` находится в `.gitignore`. Скрипты не требуют
секретов и работают офлайн, поэтому безопасны для CI без `.env.local`.
