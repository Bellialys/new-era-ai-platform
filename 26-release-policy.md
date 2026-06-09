# 26. Release Policy - правило выпусков

## 1. Назначение документа

Этот документ описывает правила безопасного выпуска изменений в production для проекта **Новая эпоха**.

Цель документа - не допускать ситуацию, когда в production попадают непроверенные изменения, сломанная сборка, неработающий API, незавершённые функции, неправильные env-переменные или неподготовленные миграции базы данных.

Production должен обновляться только после прохождения обязательных проверок.

---

## 2. Главный принцип

Любой push или merge в `main` считается потенциальным production release.

Для проекта используется Vercel, поэтому production deploy может запускаться автоматически после изменений в production branch. Из-за этого ветка `main` должна всегда оставаться рабочей.

Главное правило:

**Нельзя отправлять в `main` код, который не прошёл проверки.**

---

## 3. Что считается release

Release - это любое изменение, которое попадает в production.

Release может включать:

* новую функцию;
* исправление ошибки;
* изменение API;
* изменение базы данных;
* изменение UI;
* изменение env-переменных;
* изменение логики OpenRouter;
* изменение логики Supabase;
* изменение настроек Vercel;
* изменение документации, если оно связано с рабочим процессом проекта.

Даже маленький commit в `main` считается потенциальным release.

---

## 4. Основные правила выпуска

Запрещено деплоить “кучей” непроверенные изменения.

Один release должен иметь понятную цель.

Правильный release:

* относится к одной функции, одному исправлению или одному этапу;
* имеет версию;
* проходит локальные проверки;
* проходит Preview Deployment;
* проходит smoke-тест на Preview URL;
* проходит production health check после deploy;
* проходит production smoke-тест после deploy;
* имеет release notes;
* имеет rollback plan.

---

## 5. Ветки проекта

Рекомендуемая схема веток:

* `main` - стабильная production branch;
* `feat/...` - ветки для новых функций;
* `fix/...` - ветки для исправления ошибок;
* `release/...` - ветки для подготовки выпуска;
* `docs/...` - ветки для документации.

Примеры:

```bash
git checkout -b feat/model-comparison
# Создать ветку для новой функции сравнения моделей

git checkout -b fix/api-health-error
# Создать ветку для исправления ошибки health endpoint

git checkout -b release/0.2.0-supabase
# Создать ветку для подготовки релиза версии 0.2.0
```

---

## 6. Branch Protection для main

Ветка `main` должна быть защищена.

Обязательные правила:

* `main` - единственная production branch;
* прямые push в `main` запрещены;
* изменения попадают в `main` только через Pull Request;
* Pull Request должен пройти проверки;
* минимум 1 approve перед merge;
* status checks должны быть успешными перед merge;
* force push в `main` запрещён;
* удаление ветки `main` запрещено.

Важно:

**Force push в `main` запрещён всегда.**

Запрещённая команда:

```bash
git push --force origin main
# Запрещено: force push может сломать историю main и production deploy
```

---

## 7. Версионирование

Каждый важный этап проекта должен иметь версию.

Формат:

```text
vMAJOR.MINOR.PATCH
```

Примеры:

* `v0.1.0` - первый рабочий MVP;
* `v0.2.0` - добавлена работа с Supabase;
* `v0.3.0` - добавлена история задач;
* `v0.4.0` - добавлен Leaderboard;
* `v1.0.0` - первая стабильная публичная версия.

Правила:

* `PATCH` - исправление ошибки без новой функции;
* `MINOR` - новая функция без поломки старой логики;
* `MAJOR` - крупное изменение архитектуры или несовместимое изменение.

Для MVP проекта чаще всего использовать версии `v0.x.x`.

---

## 8. Что нельзя выпускать в production

В production нельзя выпускать:

* незавершённые функции без feature flag;
* debug-код;
* временные `console.log`, если они не нужны для production диагностики;
* тестовые API-ключи;
* секреты в коде;
* `.env.local`;
* сломанный TypeScript;
* код, который не проходит lint;
* код, который не проходит build;
* изменения API без smoke-теста;
* изменения базы данных без проверки миграций;
* изменения UI без ручной проверки основной страницы;
* изменения env без проверки Vercel Environment Variables;
* изменения, которые ломают старую рабочую функцию проекта.

---

## 9. Preview Deployments

Каждый Pull Request должен получить Vercel Preview Deployment.

Preview Deployment нужен, чтобы проверить изменения до попадания в production.

На Preview URL нужно проверить:

* главную страницу;
* `/api/health`;
* `/api/models`;
* базовый сценарий MVP;
* работу Supabase, если затронута база данных;
* работу OpenRouter, если затронута AI-логика;
* отсутствие критических ошибок в Vercel Preview Logs.

Если Preview Deployment не работает - merge в `main` запрещён.

---

## 10. Deployment Protection

Если проект публичный или preview URL нельзя показывать всем, для Preview Deployments рекомендуется включить защиту доступа.

Для MVP рекомендуется:

* Vercel Authentication для preview;
* не публиковать preview URL в открытых местах;
* не хранить секреты в frontend-коде;
* проверять, что preview использует правильные env-переменные.

Дополнительные варианты для будущего:

* Password Protection;
* Trusted IPs;
* отдельная staging-среда;
* отдельные preview env-переменные.

Примечание:

Некоторые advanced-возможности Vercel могут зависеть от тарифного плана, поэтому для MVP они не являются обязательными.

---

## 11. Environment Variables

Перед release нужно проверить env-переменные.

Обязательные правила:

* секреты не хранятся в коде;
* `.env.local` не попадает в Git;
* production env добавлены в Vercel;
* preview env добавлены в Vercel, если они нужны для Preview Deployment;
* названия env-переменных совпадают в коде, локально и в Vercel;
* service role key не используется в browser/client коде;
* publishable/anon key можно использовать только там, где это безопасно.

Перед merge в `main` нужно проверить, требует ли изменение новых env-переменных.

Если требует - документация должна быть обновлена до release.

---

## 12. Проверки перед Pull Request

Перед созданием Pull Request разработчик должен выполнить локальные проверки.

```bash
git status
# Проверить изменённые файлы и убедиться, что секреты не попадут в commit

npm run typecheck
# Проверить TypeScript-ошибки

npm run lint
# Проверить lint-ошибки

npm run build
# Проверить production build

npm run smoke
# Запустить локальный smoke-тест проекта
```

Если какой-то команды ещё нет в проекте, её нужно добавить или прямо указать в отчёте:

```text
Проверка не запускалась: команда пока не настроена в package.json.
```

---

## 13. Health check

В проекте должен быть endpoint:

```text
/api/health
```

Минимальная задача `/api/health`:

* вернуть успешный ответ, если приложение работает;
* не раскрывать секреты;
* показать базовую готовность сервера;
* проверить Supabase, если база данных уже подключена;
* проверить наличие нужных env-переменных без вывода их значений.

Локальная проверка:

```bash
npm run dev
# Запустить проект локально

curl http://localhost:3000/api/health
# Проверить health endpoint локально
```

Ожидаемый результат:

```json
{
  "status": "ok"
}
```

Формат ответа может быть расширен, но он не должен раскрывать секретные данные.

---

## 14. Smoke-тесты

Smoke-тест - это минимальная проверка, что приложение не сломано после изменений.

Smoke-тест должен проверять минимум:

* главная страница открывается;
* `/api/health` отвечает успешно;
* `/api/models` отвечает успешно;
* базовый сценарий MVP не падает;
* ошибки OpenRouter обрабатываются корректно;
* Supabase не падает, если затронута база данных.

Для production smoke-тест должен уметь принимать production URL.

Пример:

```bash
npm run smoke -- --base-url=https://your-production-url.vercel.app
# Запустить smoke-тест на production URL
```

Если такой возможности ещё нет, её нужно добавить в smoke-скрипт.

---

## 15. Проверки перед merge в main

Перед merge в `main` обязательно проверить:

* задача соответствует документации;
* Definition of Done выполнен;
* TypeScript проходит;
* lint проходит;
* build проходит;
* smoke проходит локально;
* Preview Deployment успешен;
* `/api/health` работает на Preview URL;
* smoke проходит на Preview URL;
* миграции проверены, если затронута база данных;
* env-переменные описаны, если они нужны;
* документация обновлена;
* release notes подготовлены;
* rollback plan понятен.

Если хотя бы один обязательный пункт не выполнен - merge в `main` запрещён.

---

## 16. Production Deploy

Production deploy выполняется после merge в `main`.

Правила:

* `main` должен быть рабочим до merge;
* Vercel deploy должен завершиться успешно;
* после deploy обязательно проверить production URL;
* после deploy обязательно проверить `/api/health`;
* после deploy обязательно запустить smoke на production URL;
* после deploy обязательно проверить Vercel Logs.

Пример проверки:

```bash
curl https://your-production-url.vercel.app/api/health
# Проверить health endpoint на production

npm run smoke -- --base-url=https://your-production-url.vercel.app
# Запустить smoke-тест на production URL
```

---

## 17. Post-Deploy Verification

После production deploy нужно проверить:

* главная страница открывается;
* нет ошибки `Application error`;
* `/api/health` возвращает успешный ответ;
* `/api/models` возвращает список моделей;
* базовая отправка задачи работает;
* ответы моделей сохраняются или корректно отображаются;
* Supabase подключён;
* OpenRouter ключ работает или ошибка отображается корректно;
* в Vercel Logs нет критических ошибок;
* в браузере нет явных ошибок UI;
* release notes обновлены.

Минимальное время наблюдения после production deploy:

```text
10-15 минут
```

В течение этого времени нужно проверить, нет ли критических ошибок 500 и жалоб на неработающий сайт.

---

## 18. Если production сломан

Если production сломан, нельзя добавлять новые функции поверх сломанного состояния.

Порядок действий:

1. Остановить выпуск новых изменений.
2. Проверить Vercel Logs.
3. Проверить `/api/health`.
4. Выполнить Vercel Instant Rollback до последнего стабильного production deployment.
5. Проверить production URL после rollback.
6. Проверить `/api/health` после rollback.
7. Запустить smoke-тест на production URL после rollback.
8. После восстановления production отдельно сделать fix commit или git revert.
9. Обновить release notes или changelog.
10. Создать incident note / post-mortem в течение 24 часов.

Главное правило:

**Сначала восстановить production, потом спокойно разбирать причину.**

---

## 19. Vercel Instant Rollback

Если ошибка появилась после deploy, сначала использовать Vercel rollback.

Порядок через Vercel Dashboard:

1. Открыть проект в Vercel.
2. Перейти в Deployments.
3. Найти последний стабильный production deployment.
4. Выполнить Instant Rollback или Promote to Production для стабильного deployment, если такой вариант доступен.
5. Проверить production URL.
6. Проверить `/api/health`.
7. Запустить production smoke-тест.

Преимущество rollback:

* быстро восстанавливает production;
* не требует срочно переписывать код;
* позволяет отдельно разобраться с причиной ошибки;
* уменьшает простой сайта.

---

## 20. Git revert

Если rollback через Vercel UI невозможен или нужно закрепить исправление в истории Git, использовать `git revert`.

Правильный порядок:

```bash
git log --oneline
# Найти commit, который сломал production

git checkout -b fix/revert-broken-release
# Создать отдельную ветку для отката

git revert COMMIT_HASH
# Создать обратный commit, который отменяет проблемные изменения

npm run typecheck
# Проверить TypeScript после revert

npm run lint
# Проверить lint после revert

npm run build
# Проверить build после revert

npm run smoke
# Проверить smoke после revert

git push origin fix/revert-broken-release
# Отправить ветку с revert в GitHub
```

После этого создать Pull Request и замержить его в `main` после проверок.

Запрещено:

```bash
git push --force origin main
# Запрещено: нельзя переписывать историю production branch
```

---

## 21. Incident note / post-mortem

Если production был сломан, нужно создать incident note / post-mortem в течение 24 часов.

Минимальный шаблон:

```markdown
## Incident - YYYY-MM-DD HH:mm

### Что произошло
Краткое описание проблемы.

### Что сломалось
Какая часть production не работала.

### Причина
Что стало причиной ошибки.

### Как восстановили
Rollback, revert commit или fix commit.

### Сколько длился инцидент
Примерное время от обнаружения до восстановления.

### Что добавить в проверки
Какой тест, smoke-check или правило нужно добавить, чтобы ошибка не повторилась.

### Ответственный
Кто разбирал инцидент.
```

---

## 22. Release Notes

Каждый production release должен иметь release notes.

Обязательные поля:

* версия release;
* дата и время deploy;
* ответственный за release;
* ссылка на Vercel deployment;
* что изменилось;
* какие проверки выполнены;
* известные риски;
* rollback plan.

Минимальный шаблон:

```markdown
## Release v0.2.0 - YYYY-MM-DD HH:mm

### Ответственный
Bellial / Codex / другой ответственный

### Vercel Deployment
https://vercel.com/...

### Added
* Добавлено ...

### Changed
* Изменено ...

### Fixed
* Исправлено ...

### Checks
* TypeScript: passed
* Lint: passed
* Build: passed
* Local smoke: passed
* Preview health: passed
* Preview smoke: passed
* Production health: passed
* Production smoke: passed

### Risks
* Нет известных рисков.

### Rollback plan
* Vercel Instant Rollback до предыдущего стабильного production deployment.
* Если нужно - git revert проблемного commit.
```

---

## 23. Где фиксировать release notes

Для MVP release notes фиксируются в:

```text
15-changelog.md
```

Дополнительно можно использовать:

* GitHub Releases;
* описание Pull Request;
* отдельный файл release notes;
* внутренний канал команды, если команда появится.

Для MVP обязательно обновлять `15-changelog.md` при каждом production release.

---

## 24. Миграции базы данных

Если release затрагивает Supabase PostgreSQL, нужно отдельно проверить миграции.

Правила:

* миграции должны быть проверены до production deploy;
* миграции должны быть по возможности обратно совместимыми;
* сначала накатывается безопасная миграция, потом деплоится код;
* откат кода не должен ломать новую схему базы данных;
* destructive migration запрещена без отдельного плана;
* перед изменением важных таблиц нужен backup или понятный rollback plan.

Нельзя удалять таблицы, колонки или данные без отдельного подтверждения и документации.

---

## 25. Feature Flags

Крупные функции можно мержить в `main` только если они безопасно выключены для пользователей.

Для MVP можно использовать простые feature flags через env-переменные.

Пример:

```text
NEXT_PUBLIC_ENABLE_LEADERBOARD=false
```

Правила:

* недоделанная функция должна быть выключена по умолчанию;
* включение функции должно быть контролируемым;
* если функция ломается, её можно выключить без нового deploy;
* feature flag не должен раскрывать секреты;
* после завершения функции старый feature flag нужно удалить.

Advanced-варианты на будущее:

* PostHog Feature Flags;
* LaunchDarkly;
* Vercel Edge Config.

---

## 26. Monitoring

Для MVP обязательно:

* проверять Vercel Logs после deploy;
* проверять `/api/health` после deploy;
* запускать production smoke после deploy;
* смотреть ошибки 500;
* проверять базовый пользовательский сценарий вручную.

Для следующих этапов рекомендуется добавить:

* Vercel Web Analytics;
* Vercel Speed Insights;
* Sentry для runtime errors;
* алерты по ошибкам 500;
* уведомления о deploy и rollback.

---

## 27. CI/CD улучшения на будущее

Для MVP достаточно Vercel auto-deploy из `main` при условии, что `main` защищён через Branch Protection.

Позже можно добавить более строгую схему:

* GitHub Actions запускает typecheck, lint, build и smoke;
* Vercel создаёт Preview Deployment для каждого PR;
* smoke-тест запускается на Preview URL;
* merge блокируется, если smoke падает;
* production deploy выполняется только после успешных проверок;
* GitHub Releases генерируют release notes.

Advanced-вариант:

```bash
vercel --prod
# Запустить production deploy через Vercel CLI только после прохождения CI
```

Этот вариант можно внедрить позже, когда MVP уже стабильно работает.

---

## 28. Release Gate

Production release разрешён только если выполнены условия:

* задача завершена;
* Definition of Done выполнен;
* нет секретов в коде;
* `.env.local` не попал в Git;
* TypeScript passed;
* lint passed;
* build passed;
* local smoke passed;
* Preview Deployment passed;
* Preview health passed;
* Preview smoke passed;
* production deploy passed;
* production health passed;
* production smoke passed;
* Vercel Logs проверены;
* release notes written;
* rollback plan exists.

Если хотя бы один обязательный пункт не выполнен - production release запрещён.

---

## 29. Правило для Codex

Codex не имеет права считать release завершённым, пока не выполнены обязательные проверки.

В конце работы Codex должен предоставить отчёт:

* что изменено;
* какие файлы изменены;
* какие команды проверки выполнены;
* результат TypeScript;
* результат lint;
* результат build;
* результат smoke;
* проверялся ли `/api/health`;
* проверялся ли Preview URL;
* проверялся ли production URL;
* требуется ли обновление env в Vercel;
* требуется ли миграция Supabase;
* создан ли commit;
* обновлены ли release notes;
* есть ли rollback plan;
* какие риски остались.

Если Codex не запускал проверку, он обязан прямо написать:

```text
Проверка не запускалась.
```

Запрещено писать “готово”, если проверки не выполнены.

---

## 30. Минимальный чек-лист для MVP release

Перед merge в `main`:

* Git status проверен;
* секреты не попали в код;
* `.env.local` не попал в commit;
* TypeScript проходит;
* lint проходит;
* build проходит;
* smoke проходит локально;
* Preview Deployment работает;
* `/api/health` работает на Preview URL;
* smoke проходит на Preview URL;
* документация обновлена;
* release notes подготовлены;
* rollback plan есть.

После deploy в production:

* Vercel deploy завершился успешно;
* production URL открывается;
* `/api/health` работает на production;
* `npm run smoke` прошёл на production URL;
* Vercel Logs проверены;
* release notes обновлены;
* в случае ошибки известен rollback path.

---

## 31. Итоговое правило

`main` должен всегда оставаться рабочим.

Production важнее скорости разработки.

Нельзя выпускать изменения, которые не прошли проверки.

Если production сломан - сначала rollback, потом расследование и исправление.
