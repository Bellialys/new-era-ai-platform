# 19a - Next.js Project Setup

## Назначение файла

Этот файл описывает, как правильно добавить реальный Next.js проект в уже созданный GitHub репозиторий `new-era-ai-platform`.

Документация проекта хранится в корне репозитория в файлах `00-readme.md` - `28-documentation-audit-fresh.md`.

Папка `docs/` не используется как обязательная структура проекта. Документацию не нужно переносить в `docs/`, потому что по принятому решению проекта markdown-файлы остаются в корне.

Главный источник порядка разработки: `14-roadmap.md`.

Статус файла: историческая инструкция для этапа `v0.2 - Next.js Project Base`. Если этот файл конфликтует с более поздними решениями, правильными считаются `14-roadmap.md`, `16-decisions.md` и свежие audit-файлы.

Текущий этап:

```text
v0.2 - Next.js Project Base
```

---

## Цель этапа v0.2

На этом этапе нужно получить рабочую базу проекта:

- Next.js;
- TypeScript;
- App Router;
- Tailwind CSS;
- ESLint;
- папка `src`;
- локальный запуск через `npm run dev`;
- первый технический commit после создания базы.

На этом этапе ещё не подключаются:

- OpenRouter API;
- Supabase;
- авторизация;
- голосование;
- история запросов;
- Code Arena;
- AI Team Mode;
- Code Runner.

---

## Правильная структура после подготовки

Перед созданием Next.js проекта структура должна быть такой:

```text
new-era-ai-platform/
├─ 00-readme.md
├─ 01-idea.md
├─ 02-project-plan.md
├─ 03-tools-and-sites.md
├─ 04-mvp-scope.md
├─ 05-user-roles.md
├─ 06-project-modes.md
├─ 07-architecture.md
├─ 08-database.md
├─ 09-api-structure.md
├─ 10-ui-pages.md
├─ 11-ai-models.md
├─ 12-security-and-env.md
├─ 13-deployment.md
├─ 14-roadmap.md
├─ 15-changelog.md
├─ 16-decisions.md
├─ 17-code-arena-spec.md
├─ 18-team-mode-spec.md
└─ README.md
```

После создания Next.js проекта структура дополнится файлами и папками:

```text
new-era-ai-platform/
├─ 00-readme.md
├─ 01-idea.md
├─ ...
├─ 28-documentation-audit-fresh.md
├─ public/
├─ src/
│  └─ app/
├─ .gitignore
├─ eslint.config.mjs
├─ next.config.ts
├─ package.json
├─ package-lock.json
├─ postcss.config.mjs
├─ README.md
└─ tsconfig.json
```

---

## Шаг 1 - открыть проект в VS Code

Открыть папку репозитория в Visual Studio Code.

Через GitHub Desktop:

```text
Repository -> Open in Visual Studio Code
```

Или через PowerShell:

```powershell
cd D:\Projects\new-era-ai-platform
# Переходит в папку проекта

code .
# Открывает текущую папку в Visual Studio Code
```

---

## Шаг 2 - открыть терминал VS Code

В VS Code открыть терминал:

```text
Терминал -> Новый терминал
```

Или сочетанием клавиш:

```text
Ctrl + `
```

---

## Шаг 3 - проверить документацию в корне

Документацию переносить не нужно. Она должна оставаться в корне репозитория.

Проверка через PowerShell:

```powershell
Get-ChildItem *.md
# Показывает markdown-файлы документации в корне проекта
```

Команду `Move-Item` для переноса документации в `docs/` не использовать.

Важно: файл `README.md` можно оставить в корне. Это стандартный файл GitHub. Позже его можно заменить нормальным кратким README проекта.

---

## Шаг 4 - создать Next.js проект в текущей папке

Выполнить команду:

```powershell
npx create-next-app@latest .
# Создаёт Next.js проект прямо в текущей папке репозитория
```

Если появится предупреждение, что папка не пустая, это нормально. Главное, чтобы в корне не было конфликтующих файлов, кроме `README.md` и markdown-документации проекта.

---

## Шаг 5 - ответы на вопросы create-next-app

При создании проекта выбрать такие параметры:

```text
Would you like to use TypeScript? -> Yes
Would you like to use ESLint? -> Yes
Would you like to use Tailwind CSS? -> Yes
Would you like your code inside a src/ directory? -> Yes
Would you like to use App Router? -> Yes
Would you like to use Turbopack? -> Yes
Would you like to customize the import alias? -> No
```

Если CLI предложит использовать стандартный import alias `@/*`, оставить значение по умолчанию.

---

## Шаг 6 - проверить локальный запуск

После установки зависимостей выполнить:

```powershell
npm run dev
# Запускает локальный сервер разработки Next.js
```

Открыть в браузере:

```text
http://localhost:3000
```

Ожидаемый результат:

```text
Открывается стартовая страница Next.js без ошибок.
```

Если сервер нужно остановить:

```text
Ctrl + C
```

---

## Шаг 7 - проверить состояние Git

После успешного запуска выполнить:

```powershell
git status
# Показывает новые и изменённые файлы проекта
```

Ожидаемо появятся новые файлы Next.js:

```text
package.json
package-lock.json
next.config.ts
tsconfig.json
src/
public/
```

Также документационные markdown-файлы должны остаться в корне репозитория.

---

## Шаг 8 - сделать commit

Если проект запускается без ошибок, выполнить:

```powershell
git add .
# Добавляет все новые и изменённые файлы в Git

git commit -m "Initialize Next.js project base"
# Фиксирует базовую структуру Next.js проекта

git push
# Отправляет изменения на GitHub
```

---

## Проверка готовности v0.2

Этап `v0.2 - Next.js Project Base` считается готовым, если:

- репозиторий открыт в VS Code;
- документация лежит в корне репозитория;
- Next.js создан в корне проекта;
- используется TypeScript;
- используется Tailwind CSS;
- используется App Router;
- есть папка `src/app`;
- команда `npm run dev` работает;
- сайт открывается на `http://localhost:3000`;
- изменения сохранены через Git commit;
- commit отправлен на GitHub.

---

## Что нельзя делать на этом этапе

На этапе `v0.2` нельзя подключать:

- OpenRouter API;
- Supabase;
- реальные AI-запросы;
- авторизацию;
- админ-панель;
- Code Arena Runner;
- AI Team Mode;
- платёжные функции;
- сложные лимиты пользователей.

Эти функции добавляются позже по `14-roadmap.md`.

---

## Следующий этап

После завершения `v0.2` следующий этап:

```text
v0.3 - UI MVP
```

На этапе `v0.3` нужно создать первый интерфейс Prompt Arena без реальных AI-запросов:

- поле ввода задачи;
- выбор моделей;
- кнопка запуска сравнения;
- mock-ответы моделей;
- карточки ответов;
- простая страница результата.
