# 17 - Code Arena Spec

> active: Code Arena Lite завершён, текущий `v1.7` включает Code Arena Runner через внешний Piston runner для авторизованных пользователей. Собственный sandbox остаётся отдельным security-review направлением.

## Назначение файла

Этот файл описывает режим **Code Arena** для проекта **Новая эпоха**.

Code Arena нужен, чтобы сравнивать AI-модели по качеству программного кода, а не только по обычным текстовым ответам.

Режим должен помогать понять:

- какая модель лучше пишет код;
- какая модель лучше исправляет ошибки;
- какая модель лучше объясняет решение;
- какая модель лучше работает с конкретным стеком;
- какая модель безопаснее предлагает код;
- какая модель лучше проходит тесты в будущей Runner-версии.

## Каноническая связь с roadmap

Порядок разработки Code Arena должен соответствовать `14-roadmap.md`.

```text
v0.7 - Code Arena Lite
# сравнение кодовых ответов без запуска чужого кода

v1.7 - Code Arena Runner
# внешний runner, auth, rate limits и результаты запуска кода
```

Runner нельзя переносить раньше аккаунтов, лимитов, админ-контроля и security review.

```text
v0.6 - Accounts and Profiles
# появляются пользователи, guest mode, профиль и база для лимитов

v1.6 - Admin Panel and Limits
# появляются ограничения, контроль моделей и админ-настройки

v1.7 - Code Arena Runner
# только после подготовки безопасности
```

# Главный принцип

Code Arena нужно разделить на два этапа.

```text
Code Arena Lite
# первая версия без обязательного запуска кода

Code Arena Runner
# текущая alpha-версия с внешним runner; собственный sandbox/test-cases/results остаются отдельным расширением
```

## Почему нужно разделение

Запуск чужого кода - это отдельный технический и безопасностный риск.

Если сразу делать Code Arena Runner, проект резко усложняется:

```text
нужен sandbox;
# безопасное окружение запуска кода

нужны лимиты;
# timeout, CPU, RAM, размер вывода, количество запусков

нужно защищать секреты;
# код не должен видеть .env и ключи проекта

нужны дополнительные таблицы;
# code_test_cases и code_results

нужны feature flags;
# ENABLE_CODE_RUNNER

нужен audit log;
# кто запускал код, когда и с какими ограничениями

нужно больше тестирования;
# безопасность, стабильность, обработка ошибок
```

Поэтому правильная стратегия:

```text
сначала Code Arena Lite;
# быстро, безопасно, даёт пользу пользователю

потом Code Arena Runner.
# только после sandbox и ограничений
```

# Code Arena Lite

## Назначение

Code Arena Lite - первая версия режима для кодовых задач.

Она работает без запуска кода.

Пользователь получает ответы нескольких моделей, сравнивает их вручную и выбирает лучший вариант через голосование.

## Что делает пользователь

```text
Вводит кодовую задачу.
# что нужно написать, исправить, объяснить или улучшить

Выбирает язык.
# TypeScript, JavaScript, Python, SQL

Выбирает фреймворк или стек.
# Next.js, React, FastAPI, Express, Supabase

Выбирает 2-3 модели.
# только модели с supports_code = true

Получает ответы с кодом.
# решения моделей

Сравнивает ответы вручную.
# читает код, объяснения и структуру решения

Выбирает лучший ответ.
# vote как в Prompt Arena
```

## Что делает backend

```text
Проверяет prompt.
# задача обязательна

Проверяет language.
# язык обязателен

Проверяет framework.
# необязательный, но полезный контекст

Проверяет models.
# только allowlist и supports_code = true

Создаёт task.
# mode_slug = code-arena

Отправляет запросы в OpenRouter.
# получает кодовые ответы

Сохраняет model_responses.
# ответы моделей

Возвращает результат frontend.
# без запуска кода
```

## Что запрещено в Code Arena Lite

```text
runTests = true.
# запуск тестов запрещён до Runner

generateTests = true.
# генерация тестов отдельная будущая функция

выполнение кода на сервере.
# нельзя использовать eval, child_process или API route как runner

создание code_results.
# эта таблица нужна только для Runner
```

# Request body для Code Arena Lite

```json
{
  "prompt": "Напиши Next.js API route для отправки запроса к OpenRouter",
  "mode": "code-arena",
  "language": "TypeScript",
  "framework": "Next.js",
  "versions": {
    "next": "15",
    "node": "22"
  },
  "models": [
    "model/example-balanced",
    "model/example-code"
  ],
  "runTests": false
}
```

## Поля Code Arena Lite

| Поле | Тип | Обязательное | Описание |
|---|---|---|---|
| `prompt` | string | Да | Кодовая задача пользователя |
| `mode` | string | Нет | Значение `code-arena` |
| `language` | string | Да | Язык программирования |
| `framework` | string/null | Нет | Фреймворк или стек |
| `versions` | object | Нет | Версии технологий |
| `models` | string[] | Да | Список выбранных моделей |
| `runTests` | boolean | Нет | В Lite всегда `false` |

# Response для Code Arena Lite

```json
{
  "success": true,
  "data": {
    "taskId": "00000000-0000-0000-0000-000000000000",
    "mode": "code-arena",
    "language": "TypeScript",
    "framework": "Next.js",
    "runTests": false,
    "responses": [
      {
        "responseId": "11111111-1111-1111-1111-111111111111",
        "modelKey": "model/example-code",
        "displayName": "Example Code Model",
        "status": "success",
        "responseText": "..."
      }
    ]
  }
}
```

# Code Arena Runner

## Назначение

Code Arena Runner - будущая продвинутая версия Code Arena.

Она добавляет объективную проверку кода:

```text
тесты;
# code_test_cases

запуск в sandbox;
# безопасное выполнение

результаты запуска;
# code_results

pass_rate;
# процент пройденных тестов

stdout и stderr;
# вывод и ошибки

runtime_ms;
# время выполнения

status.
# passed, failed, error, timeout
```

## Когда делать Runner

Runner начат в версии `v1.7`.

Перед Runner должны быть готовы:

```text
Stable Prompt Arena.
# основа проекта работает

Code Arena Lite.
# кодовый режим уже есть без запуска кода

Accounts and Profiles.
# есть пользовательская основа для истории и лимитов

Admin Panel and Limits.
# есть лимиты и управление доступом

feature flags.
# ENABLE_CODE_RUNNER

security review.
# запуск кода проверен отдельно

sandbox выбран.
# E2B, Judge0 или другой вариант

лимиты настроены.
# timeout, CPU, RAM, network, output size

таблицы добавлены.
# code_test_cases и code_results
```

# Request body для Code Arena Runner

```json
{
  "prompt": "Напиши функцию sum(a, b), которая возвращает сумму двух чисел",
  "mode": "code-arena",
  "language": "python",
  "framework": null,
  "versions": {},
  "models": [
    "model/example-code-1",
    "model/example-code-2"
  ],
  "generateTests": false,
  "runTests": true,
  "tests": [
    {
      "title": "positive numbers",
      "inputData": {
        "a": 2,
        "b": 3
      },
      "expectedOutput": 5,
      "testType": "unit"
    },
    {
      "title": "negative numbers",
      "inputData": {
        "a": -2,
        "b": -3
      },
      "expectedOutput": -5,
      "testType": "edge"
    }
  ]
}
```

## Response для Code Arena Runner

```json
{
  "success": true,
  "data": {
    "taskId": "00000000-0000-0000-0000-000000000000",
    "mode": "code-arena",
    "language": "python",
    "runTests": true,
    "responses": [],
    "testCases": [
      {
        "testCaseId": "11111111-1111-1111-1111-111111111111",
        "title": "positive numbers",
        "testType": "unit"
      }
    ],
    "codeResults": [
      {
        "responseId": "22222222-2222-2222-2222-222222222222",
        "status": "passed",
        "passedCount": 2,
        "failedCount": 0,
        "totalCount": 2,
        "passRate": 100,
        "runtimeMs": 120,
        "stdout": "",
        "stderr": ""
      }
    ]
  }
}
```

# Feature flags

## Переменные

```env
NEXT_PUBLIC_ENABLE_CODE_ARENA=false
# показывает или скрывает Code Arena в интерфейсе

ENABLE_CODE_RUNNER=false
# разрешает или запрещает запуск кода на backend
```

## Правило

```text
Code Arena Lite
# может работать без ENABLE_CODE_RUNNER

Code Arena Runner
# работает только если ENABLE_CODE_RUNNER=true
```

Если backend получает `runTests=true`, но `ENABLE_CODE_RUNNER=false`, API должен вернуть ошибку.

```json
{
  "success": false,
  "error": {
    "code": "CODE_RUNNER_DISABLED",
    "message": "Запуск кода сейчас отключён."
  }
}
```

# API

## Endpoint

```text
POST /api/code-compare
# endpoint Code Arena
```

## Поведение endpoint

```text
runTests = false
# Code Arena Lite, только ответы моделей

runTests = true
# Code Arena Runner, ответы моделей + sandbox + code_results
```

## Валидация

```text
prompt required.
# кодовая задача обязательна

language required.
# язык обязателен

models min 2.
# сравнение имеет смысл

models max 3 в первой версии.
# контроль стоимости

models должны быть из allowlist.
# нельзя отправлять запросы в произвольные модели

models должны supports_code = true.
# только code-friendly модели

runTests = false в v0.7.
# Code Arena Lite без sandbox

runTests = true только при ENABLE_CODE_RUNNER = true.
# backend feature flag

tests проверять только при runTests = true.
# иначе они не нужны

generateTests = false до отдельной реализации.
# AI-тесты требуют отдельной проверки
```

# Связь с основной базой данных

Code Arena использует общий канон проекта:

```text
tasks
# главная задача

task_id
# внешний ключ в code_test_cases и code_results

model_responses
# ответы моделей с кодом

response_id
# связь code_results с ответом модели

votes
# пользователь выбирает лучший кодовый ответ
```

MVP-таблицы остаются прежними:

```text
models
# список доступных моделей

tasks
# задачи пользователей

model_responses
# ответы моделей

votes
# голоса за лучшие ответы
```

Дополнительные таблицы нужны только для Runner:

```text
code_test_cases
# тесты для кодовой задачи

code_results
# результаты запуска кода модели
```

# Таблица code_test_cases

## Назначение

Таблица `code_test_cases` хранит тесты, которые относятся к конкретной задаче Code Arena Runner.

В `v0.7 Code Arena Lite` эта таблица не обязательна.

## SQL

```sql
create table public.code_test_cases (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  title text not null,
  input_data jsonb not null default '{}'::jsonb,
  expected_output jsonb not null default '{}'::jsonb,
  test_type text not null default 'unit',
  is_generated boolean not null default false,
  created_at timestamptz not null default now(),

  constraint code_test_cases_test_type_check check (test_type in ('unit', 'integration', 'edge', 'security'))
);
```

# Таблица code_results

## Назначение

Таблица `code_results` хранит результат запуска кода конкретной модели в sandbox.

В `v0.7 Code Arena Lite` эта таблица не обязательна.

## SQL

```sql
create table public.code_results (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  response_id uuid not null references public.model_responses(id) on delete cascade,
  language text not null,
  status text not null default 'pending',
  passed_count integer not null default 0,
  failed_count integer not null default 0,
  total_count integer not null default 0,
  pass_rate numeric(5, 2) not null default 0,
  runtime_ms integer,
  stdout text,
  stderr text,
  error_message text,
  raw_results jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint code_results_status_check check (status in ('pending', 'running', 'passed', 'failed', 'error', 'timeout')),
  constraint code_results_counts_check check (
    passed_count >= 0
    and failed_count >= 0
    and total_count >= 0
    and pass_rate >= 0
    and pass_rate <= 100
  )
);
```

# Безопасность Code Arena Runner

## Главное правило

Код моделей нельзя запускать напрямую внутри Next.js API routes.

Запрещено:

```text
eval
# нельзя выполнять чужой JavaScript напрямую

new Function
# тоже небезопасное выполнение кода

child_process
# нельзя запускать команды пользователя на сервере

запуск кода внутри Next.js API route
# serverless-функция не является sandbox

доступ runner к .env проекта
# нельзя раскрывать секреты
```

## Требования к sandbox

Sandbox должен:

```text
не видеть .env;
# защита секретов

не видеть OPENROUTER_API_KEY;
# защита бюджета

не видеть SUPABASE_SERVICE_ROLE_KEY;
# защита базы

иметь timeout;
# защита от бесконечных циклов

иметь memory limit;
# защита инфраструктуры

иметь CPU limit;
# защита инфраструктуры

запрещать сеть по умолчанию;
# no network

ограничивать размер stdout и stderr;
# защита от огромного вывода

очищаться после запуска;
# нет состояния между задачами

логировать результат запуска;
# audit и отладка

не иметь доступа к файлам проекта.
# код модели не должен читать исходники и секреты
```

## Возможные варианты sandbox

```text
E2B
# sandbox для выполнения кода

Judge0
# внешний сервис code execution

WebContainers
# ограниченный браузерный вариант

собственный isolated runner
# только позже, сложнее и опаснее
```

Конкретный выбор собственного sandbox нужно оформить отдельным решением в `16-decisions.md`, если проект выходит за пределы внешнего runner.

# UI Code Arena

## Страница

```text
/code
# страница Code Arena
```

## Компоненты Lite

```text
CodeArenaHeader
# название режима

ProgrammingContextForm
# язык, фреймворк, версии

CodePromptForm
# кодовая задача

ModelSelector
# только supports_code

CodeResponsesGrid
# ответы моделей

ModelCodeResponseCard
# карточка кодового ответа

VoteButton
# выбор лучшего решения
```

## Компоненты Runner

```text
CodeTestCasesPanel
# список тестов

CodeRunOptions
# runTests и generateTests

CodeRunResultsPanel
# результаты запуска

PassRateBadge
# процент успешных тестов

StdoutStderrBlock
# вывод и ошибки
```

# Критерии оценки кода

```text
Корректность.
# решает ли код задачу

Запускаемость.
# можно ли выполнить код

Читаемость.
# понятная структура

Безопасность.
# нет ли опасных решений

Совместимость.
# подходит ли под стек

Простота.
# нет ли лишнего усложнения

Объяснение.
# понятно ли модель объяснила решение

Результаты тестов.
# только для Code Arena Runner
```

# Порядок реализации

## Этап 1 - v0.7 Code Arena Lite

```text
Страница /code.
# UI режима

Форма кодовой задачи.
# prompt, language, framework, versions

Выбор code-friendly моделей.
# supports_code = true

POST /api/code-compare.
# runTests = false

Сохранение task и model_responses.
# mode_slug = code-arena

Голосование.
# votes
```

## Этап 2 - подготовка к Runner после v1.6

```text
Добавить feature flags.
# ENABLE_CODE_RUNNER

Добавить таблицы.
# code_test_cases и code_results

Выбрать sandbox.
# E2B, Judge0 или другой вариант

Добавить security review.
# запуск чужого кода

Добавить лимиты.
# timeout, CPU, RAM, output size, run count

Добавить админ-контроль.
# кто может включать runner и какие модели доступны
```

## Этап 3 - v1.7 Code Arena Runner

```text
Принимать tests.
# тесты пользователя

Опционально generateTests.
# будущая AI-генерация тестов

Запускать код через внешний runner для авторизованных пользователей.
# runTests = true

Сохранять code_results.
# pass_rate, stdout, stderr

Показывать результаты в UI.
# CodeRunResultsPanel
```

# Что не входит в первую версию Code Arena

В `v0.7 Code Arena Lite` не входит:

```text
запуск кода;
# нет sandbox

автоматическая генерация тестов;
# отдельная будущая функция

оценка pass_rate;
# только для Runner

поддержка пользовательских файлов;
# усложняет безопасность

поддержка контейнеров пользователя;
# слишком рано для проекта

соревнования по hidden tests.
# это отдельный уровень сложности
```

# Итог

Code Arena должна развиваться постепенно.

Правильная стратегия:

```text
Сначала Code Arena Lite.
# быстро и безопасно

Потом Code Arena Runner.
# после sandbox, лимитов и security review
```

Главное правило:

```text
Код моделей нельзя запускать без sandbox.
# безопасность важнее скорости
```
