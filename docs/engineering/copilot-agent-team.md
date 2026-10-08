# VS Code Copilot Agent Team — инженерная иерархия

## Назначение и границы

Эта конфигурация координирует **разработку репозитория** `New Era AI Platform` в VS Code. Она **не является** пользовательским продуктовым режимом AI Team Mode. Контроль качества и итоговая приёмка остаются за человеком — владельцем репозитория. ChatGPT помогает сформировать ТЗ и проверить пакет результатов; он не заменяет обязательное одобрение владельца на merge.

Профили:

| Путь | Роль | Разрешённые инструменты |
| --- | --- | --- |
| `.github/agents/coordinator.agent.md` | Coordinator, подзадачи и отчёт | `read`, `search`, `agent`, `todo` |
| `.github/agents/architect.agent.md` | Architect, только проектирование | `read`, `search` |
| `.github/agents/developer.agent.md` | Developer, изменения и проверки | `read`, `search`, `edit`, `execute` |
| `.github/agents/security.agent.md` | Security, только аудит | `read`, `search`, `web` |

`Coordinator` вызывает только `Architect`, `Developer`, `Security` через встроенный инструмент `agent` и поле `agents`. Worker-профили скрыты из обычного списка агентов (`user-invocable: false`), но допускают вызов подагентом. `agents: []` запрещает worker-агентам создавать собственных подагентов. `disable-model-invocation: true` у Coordinator не запрещает ручной выбор Coordinator в списке агентов. Все имена чувствительны к регистру.

`handoffs` — **кнопки ручного переключения агентов**, а не механизм автоматического делегирования. Для этой команды используем `agent` + `agents`, а не `handoffs`.

## Рабочий цикл

1. Пользователь/ChatGPT формирует scope, ограничения и критерии приёмки.
2. Coordinator сверяет `PROJECT-CONTEXT.md`, `AGENTS.md`, `24-codex-active-rule-set.md`, `23-codex-quality-rules.md`, `.project/state.json`, активную задачу и текущий `main`.
3. Architect и Security независимо анализируют исходный код/изменение (без записи).
4. Coordinator выдаёт Developer ограниченное ТЗ с планом тестов.
5. Developer изменяет код в feature-ветке и выполняет локальные проверки. Security повторно аудирует diff.
6. Если Security находит проблемы, Coordinator возвращает конкретную работу Developer; цикл повторяется.
7. Developer готовит commit и PR; GitHub CI проверяет изменения. Не считать CI пройденным по тексту ответа модели.
8. Coordinator возвращает владельцу пакет: изменения, фактические тесты, найденные риски, commit/PR, остаток работ. **Только человек** принимает решение о merge; ни один агент не делает merge автоматически.

## Реальные границы безопасности

Файлы `.agent.md` ограничивают штатный набор инструментов, **но не являются полноценной границей безопасности против злонамеренного агента**: Developer имеет `execute` и может попытаться выполнить Git/GitHub/cloud команды, если токены и разрешения это позволяют. Текст «запрещено» сам по себе не блокирует действие.

Обязательные настройки с проверкой владельцем:

1. В GitHub Settings → Branches или Rules → Rulesets для `main`: запретить direct pushes, force-push и deletion; требовать PR, обязательные CI/status checks, разрешение review threads и одобрение другого уполномоченного участника там, где это возможно; применить правила к администраторам / запретить bypass.
2. Не давать AI/CI технических полномочий на merge, изменение rulesets, secrets или production. GitHub Actions: минимальные `GITHUB_TOKEN` permissions, избегать write permissions на PR из недоверенных веток; защищённые environments и approval для production. В репозитории одного владельца GitHub review-rule может потребовать отдельного уполномоченного reviewer — не предполагать, что сам автор может одобрить собственный PR.
3. В VS Code выбрать **Manual permissions**. Не использовать Allow all, Autopilot и глобальное auto-approval. Выключить terminal auto-approval для задач с повышенным риском; каждую write/network/destructive-команду подтверждать отдельно. При наличии поддержки использовать sandbox/worktree или изолированный контейнер. Не утверждать, что команда заблокирована только потому, что терминал требует подтверждения.
4. Разделить Preview и Production credentials; предоставить локальным агентам только read-only/тестовые доступы. Никогда не помещать действительные ключи в промпты, вывод диагностики, Git или файлы профилей. Запретить доступ agents к production секретам на уровне ОС/сервисных аккаунтов.
5. Сохранять текущий Stage 3.2 fail-closed gate. Не включать persistence пользовательских OpenRouter credentials, пока не подтверждён live AWS/Vercel KMS/OIDC и environment-isolation gate. Не выполнять ad-hoc production SQL/DDL.
6. Минимизировать push/CI/Vercel deployment churn; объединять связанные изменения в один проверенный PR (см. issue #100).

> Состояние перед внедрением профилей: `main` показывал `protected: true` и status checks `Typecheck, lint, test, build, docs, smoke` и `Vercel`. Полные branch-protection settings недоступны через текущее подключение GitHub (403), поэтому наличие именно reviewer/merge/bypass-запретов **не подтверждено**. GitHub rulesets были пусты. Проверить и при необходимости усилить настройки вручную.

## Проверка делегирования в VS Code

1. Обновить VS Code и GitHub Copilot до версии с поддержкой workspace custom agents/subagents. Открыть корень проекта, довериться workspace **только если** это собственный репозиторий.
2. Выбрать Session Target/harness с поддержкой этих профилей; выбрать в Chat агент `Coordinator`.
3. Отправить безопасный read-only тест:

   `Проведи только read-only аудит /api/compare: вызови Architect для карты потока и Security для анализа trust boundaries; не вызывай Developer, ничего не изменяй. Верни отдельные отчёты каждого подагента с путями файлов.`

4. Проверить историю инструментов: Coordinator действительно вызвал **оба** именованных подагента, отчёты независимы; Security не вызывал `edit`/`execute`, рабочее дерево не изменилось. Если делегирования нет — конфигурацию **не считать успешно протестированной**.
5. Второй тест проводить только в отдельной ветке с согласованной безвредной задачей; проверять что Developer пишет тесты, Security анализирует diff, а merge не производится.

Для лабораторной `OOP-Lab4` профили надо скопировать/подключить в **отдельный репозиторий лабораторной**; наличие этого файла в New Era само по себе не устанавливает агентов в другой workspace. Использовать сначала read-only анализ структуры классов и обработки некорректного ввода, затем небольшой обратимый тестовый change в feature-ветке.

## Отчёт Coordinator перед приёмкой

- ТЗ и scope, результаты Architect + Security (до и после).
- Изменённые пути, commit SHA, URL PR.
- Реальные результаты сборки/тестов/CI с явно обозначенными `PASS`/`FAIL`/`NOT RUN`.
- Список угроз по критичности и статусу исправления.
- Отдельный перечень незавершённых работ и заключение `READY FOR HUMAN REVIEW` или `BLOCKED`.
- Не утверждать, что мердж/деплой выполнен, пока это не подтверждено сервисом.

## Официальная документация

- VS Code custom agents: https://code.visualstudio.com/docs/agent-customization/custom-agents
- VS Code subagents: https://code.visualstudio.com/docs/agents/run/subagents
- VS Code approval/sandboxing: https://code.visualstudio.com/docs/agents/run/approvals
- GitHub protected branches: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches
