# 23 - Deep Documentation Audit

## Назначение файла

Этот файл фиксирует историческую углублённую проверку документации проекта **Новая эпоха**, выполненную после этапов `v0.2 - Next.js Base` и `v0.3 - Static UI MVP`.

Важно:

```text
Этот файл описывает проблемы, найденные на момент deep-audit.
# часть проблем уже закрыта последующими правками

Актуальное состояние смотри в 24-documentation-sync-report.md и 26-code-fix-report.md.
# они отражают текущее состояние после исправлений
```

Проверка была нужна перед переходом к:

```text
v0.4 - OpenRouter Integration
# реальные ответы моделей через backend
```

---

# 1. Что проверялось

Проверялись:

- `README.md`;
- `02-project-plan.md`;
- `03-tools-and-sites.md`;
- `04-mvp-scope.md`;
- `05-user-roles.md`;
- `06-project-modes.md`;
- `08-database.md`;
- `09-api-structure.md`;
- `12-security-and-env.md`;
- `13-deployment.md`;
- `15-changelog.md`;
- `16-decisions.md`;
- `17-code-arena-spec.md`;
- `18-team-mode-spec.md`.

---

# 2. Что было найдено на момент deep-audit

На момент проверки были найдены такие расхождения:

```text
02-project-plan.md использовал старую нумерацию версий.
# v0.0 конфликтовал с 14-roadmap.md

06-project-modes.md использовал старые mode slug-и с подчёркиванием.
# нужно было перейти на kebab-case

06-project-modes.md смешивал TypeScript и database naming.
# TypeScript/API должны быть camelCase, база snake_case

09-api-structure.md использовал snake_case в JSON API.
# нужно было перейти на camelCase

09-api-structure.md использовал prompt_arena вместо prompt-arena.
# нужен единый slug

09-api-structure.md конфликтовал с 08-database.md по vote_type.
# best не входил в разрешённые значения базы

09-api-structure.md разрешал максимум 4 модели.
# MVP-лимит должен быть 3

04-mvp-scope.md использовал лимит prompt 4000.
# env/database использовали 8000

Нужно было разделить UI-vote и saved-vote.
# v0.3 локальный выбор, v0.6 сохранённый голос

15-changelog.md содержал устаревшие Known Issues.
# код уже был создан частично

16-decisions.md требовал docs/.
# документация фактически лежала в корне

12-security-and-env.md не совпадал с .env.example.
# нужно было уточнить текущий env-набор
```

---

# 3. Что было исправлено после deep-audit

После deep-audit были выполнены синхронизации:

```text
02-project-plan.md синхронизирован с 14-roadmap.md.
# старый порядок версий убран

04-mvp-scope.md приведён к MAX_PROMPT_LENGTH=8000.
# лимит совпадает с env, базой и UI

06-project-modes.md переведён на kebab-case slug-и.
# prompt-arena, code-arena, multi-model-battle

09-api-structure.md приведён к camelCase API JSON.
# modelIds, taskId, responseId, modeSlug

vote_type: best убран из API.
# backend записывает vote_type = user

15-changelog.md обновлён.
# старые Known Issues удалены или перенесены

16-decisions.md больше не требует обязательную папку docs/.
# документация закреплена в корне репозитория

12-security-and-env.md обновлён.
# правила окружения и .env.example согласованы
```

После дополнительного аудита кода также исправлено:

```text
ArenaApiResponse и ArenaResponseView разделены.
# API и UI больше не смешиваются

Mock-ответы используют answerText.
# совпадает с 09-api-structure.md

modelRole добавляется на клиенте по modelId.
# не дублируется в API-like response

MAX_PROMPT_LENGTH=8000 применён в UI.
# textarea и validateForm используют лимит

Старые responses сбрасываются при изменении prompt или моделей.
# UI не показывает устаревшие данные

ResponseCard показывает answerText или errorMessage.
# success/error отображаются корректно
```

---

# 4. Актуальные документы после исправлений

Актуальное состояние теперь смотреть здесь:

```text
README.md
# текущее состояние репозитория

00-readme.md
# главный вход в документацию проекта

15-changelog.md
# актуальная история изменений и Known Issues

24-documentation-sync-report.md
# итог синхронизации документации

26-code-fix-report.md
# отчёт исправлений кода
```

---

# 5. Что остаётся актуальным

После всех правок актуальными остаются только следующие шаги:

```text
Создать package-lock.json локально через npm install.
# lock-файл нельзя безопасно угадать вручную

Прогнать локальные проверки после pull.
# npm run typecheck, npm run lint, npm run build

Начать v0.4 backend integration после зелёной проверки.
# подключить /api/models и /api/compare
```

---

# 6. Итог

Deep-audit был полезен как список исходных проблем перед синхронизацией.

Он больше не является текущим списком нерешённых задач.

Текущий статус:

```text
Документация синхронизирована.
# старые противоречия закрыты

Кодовые расхождения Prompt Arena закрыты.
# см. 26-code-fix-report.md

Перед v0.4 нужна локальная проверка.
# package-lock.json, typecheck, lint, build
```
