# Copilot harness — альтернативная иерархия агентов

**Статус (16.11.2026):** подготовлена конфигурация и автоматические проверки YAML/frontmatter. **Реальная работа подагентов в VS Code ещё НЕ проверена**. Этот документ не разрешает merge, deploy, запуск миграций или изменение учётных данных.

## Почему нужна отдельная конфигурация

VS Code Local harness, на который рассчитаны прежние `architect.agent.md`, `coordinator.agent.md`, `developer.agent.md`, `security.agent.md` (`target: vscode`), объявлен устаревшим; его удаление запланировано на февраль 2027. Для Copilot необходим `target: github-copilot`, а делегирование работает через нативный `task`/subagent механизм с доступным alias `agent`. Local-свойство `agents: [Architect, Developer, Security]` **не поддерживается** в Copilot и не переносится автоматически.

Источники:
- [VS Code custom-agent file reference](https://code.visualstudio.com/docs/agents/reference/custom-agent-file-reference)
- [VS Code subagents by harness](https://code.visualstudio.com/docs/agents/run/subagents)
- [GitHub Copilot CLI custom agents](https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/create-custom-agents-for-cli)

Не путать с пользовательской функциональностью сайта **AI Team Mode**.

## Профили и инструменты

| Путь | Включённые инструменты | Назначение |
| --- | --- | --- |
| `.github/agents/copilot-coordinator.agent.md` | `read, search, agent, todo` | Оркестрация и итоговый отчёт; без прав записи |
| `.github/agents/copilot-architect.agent.md` | `read, search` | Архитектура, только чтение |
| `.github/agents/copilot-security.agent.md` | `read, search, web` | Независимый аудит, только чтение и публичные источники |
| `.github/agents/copilot-developer.agent.md` | `read, search, edit, execute` | Только одобренные изменения в feature-ветке |

Все четыре профиля используют `target: github-copilot`. Coordinator — видим в picker, workers скрыты из обычного выбора (`user-invocable: false`) и доступны для делегирования. Coordinator не может выступать как чужой подагент. У workers нет `agent` в списке инструментов и нет разрешённого рекурсивного делегирования.

**Критическое отличие от Local:** в Copilot нет жёсткого allowlist на конкретные имена worker-агентов через `agents`. Фраза «вызывай только Copilot Architect/Security/Developer» внутри Coordinator — **инструкция, а не технический запрет**. Более того, `tools` в файле агента нельзя считать независимым sandbox или защитой production: реальные разрешения зависят от runtime, ОС, выданных токенов и подтверждения инструментов. Строгое ограничение достигается комбинацией реальной проверки tool invocations, VS Code Manual permissions, изолированных учётных данных и GitHub branch protection.

## Read-only приёмка Copilot (в VS Code)

1. Получить ветку с этими файлами в локальном VS Code; обновить VS Code и GitHub Copilot, выбрать в новом чате **Copilot harness** (не Local). Открыть корень проверяемого репозитория. Включить **Manual permissions**, не включать auto-approve/Allow all/Autopilot.
2. В агентах выбрать **Copilot Coordinator**. Отправить:

   > Проведи исключительно read-only аудит `src/app/api/compare/route.ts`. Вызови настоящих Copilot Architect и Copilot Security как двух независимых подагентов нативным механизмом Copilot. Architect составляет карту потока данных, Security проверяет trust boundaries. Не вызывай Developer, не выполняй команд, не редактируй файлы. Верни отдельные результаты с путями файлов и отметь, какие делегирования действительно состоялись.

3. В **Agents window** проверить *две разные* subagent-сессии, их **точные названия**, инструменты и полученные ответы. Если runtime назначил другие роли, пропустил вызов или вернул текст без фактического делегирования — **FAIL/BLOCKED**.
4. Проверить, что ни Coordinator, ни Architect/Security не вызывали `edit`, `execute` или сторонний write-capable MCP; локальный `git status` совпадает с исходным. Проверку `git status` выполняет сам владелец, а не запрещённый read-only агент.
5. Только после отдельного разрешения пользователя — второй тест на временной ветке с одной безвредной правкой: Coordinator даёт scope, Copilot Developer пишет тест/правку, Copilot Security отдельно анализирует diff. Проверить Manual confirmations и отсутствие push/merge/deploy.
6. Проверить GitHub Settings → Rulesets/Branches: обязательные PR/CI, отсутствие direct push/force push/delete, review requirements и bypass. Подключение GitHub ранее возвращало HTTP 403 на подробную branch protection и пустой список rulesets; **это не является подтверждением** надёжной настройки.
7. Зафиксировать точную версию VS Code, Copilot, harness, скриншоты/текст отдельных subagent-сессий, изменённые файлы и `git status`, тесты PASS/FAIL/NOT RUN. Только после этого рассматривать готовность PR #133. Запись результата — [issue #158](https://github.com/Bellialys/new-era-ai-platform/issues/158).

## Автоматические проверки

`src/lib/server/copilot-agent-profile.test.ts` проверяет явный `target`, набор инструментов, видимость и допустимые метаданные Copilot, а также сохранение прежних Local-профилей. CI выполняет **статическую** проверку файлов. Он не может выполнить нативный `task` в редакторе и не подтверждает реальное разграничение полномочий.

**Release gates:** PR #133 и зависимый PR #134 оставлять Draft до успешной ручной приёмки и отдельного контролируемого релиза квот. Не включать production миграции, AWS/KMS/OIDC, секреты или биллинг ради тестирования агентов.
