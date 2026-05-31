# 11 - AI-модели проекта

## Назначение файла

Этот файл описывает стратегию выбора, подключения, проверки и контроля AI-моделей для проекта **Новая эпоха**.

Проект сравнивает ответы разных AI-моделей, поэтому модели нельзя подключать хаотично. Нужны allowlist, контроль стоимости, роли моделей и проверка актуальности OpenRouter model ID перед запуском.

Файл отвечает за:

- выбор моделей для первого MVP;
- разделение dev, MVP, code, judge и team моделей;
- правила хранения моделей в server config и Supabase;
- защиту от произвольного model ID с frontend;
- контроль расходов;
- поведение при ошибках моделей;
- подготовку к будущим режимам проекта.

---

## Главный источник порядка версий

Порядок подключения моделей должен соответствовать файлу:

```text
14-roadmap.md
# главный источник порядка разработки
```

Если этот файл конфликтует с `14-roadmap.md`, главным считается `14-roadmap.md`.

Краткий порядок:

```text
v0.4 - OpenRouter Integration
# первые реальные ответы моделей через server-side API

v0.5 - Supabase Integration
# хранение моделей в таблице models

v0.6 - Voting MVP
# пользователь выбирает лучший ответ

v0.9 - MVP Stabilization
# лимиты, ошибки, контроль расходов и стабильность

v1.0 - Stable Prompt Arena
# стабильный набор моделей для публичного MVP

v1.1 - Code Arena Lite
# кодовые модели без запуска кода

v1.3 - Judge Mode
# модель-судья для оценки ответов

v1.6 - Admin Panel and Limits
# управление моделями, стоимостью и доступом

v1.7 - Code Arena Runner
# запуск кода только после sandbox, лимитов и админ-контроля

v2.0 - AI Team Mode
# командная работа моделей с ролями
```

---

## Статус файла

```text
Статус: канонический файл по стратегии AI-моделей.
Дата ревизии: 2026-05-31.
Источник моделей: OpenRouter.
Главное правило: точные model ID всегда проверять перед production.
```

Этот файл фиксирует стратегию, а не вечный список моделей.

OpenRouter model ID и условия использования могут меняться. Модель может исчезнуть, стать платной, получить новый slug, поменять цену, временно не отвечать или изменить supported parameters. Поэтому перед реальным использованием нужно проверять актуальность через OpenRouter Models API.

---

# Главный принцип выбора моделей

Для MVP не нужно подключать все сильные и дорогие модели сразу.

Правильный порядок:

```text
1. Dev/free модели.
# дешёвая проверка интерфейса, API и ошибок

2. Cheap модели.
# основной слой раннего MVP

3. Balanced модели.
# нормальное качество для Prompt Arena

4. Strong модели.
# сложные задачи, код, архитектура, анализ

5. Judge модели.
# оценка ответов, не для первого MVP

6. Team Mode модели.
# роли, цепочки и командная работа, только после стабильной базы
```

Главная логика:

```text
Сначала управляемость.
# allowlist, лимиты, логи и возможность отключить модель

Потом качество.
# сильные модели добавляются после контроля стоимости

Потом сложные режимы.
# Judge Mode, Runner и Team Mode нельзя делать раньше MVP
```

---

# Минимум для первого MVP

Для первого рабочего Prompt Arena MVP достаточно 3 моделей.

```text
2 модели
# минимальное сравнение

3 модели
# нормальный Prompt Arena MVP

4+ модели
# пока не нужно, потому что растут стоимость, задержка и сложность UI
```

Первый MVP должен доказать, что пользователь может:

- ввести prompt;
- выбрать несколько моделей;
- получить несколько ответов;
- сравнить ответы рядом;
- проголосовать за лучший ответ;
- увидеть сохранённую историю.

---

# Источник актуального списка моделей

Актуальный список моделей нужно брать из OpenRouter Models API.

```text
GET https://openrouter.ai/api/v1/models
# официальный список моделей и их свойств
```

Проверка через терминал:

```bash
# Получить публичный список моделей OpenRouter
curl https://openrouter.ai/api/v1/models
```

Проверка с API key:

```bash
# Получить список моделей OpenRouter с авторизацией
curl https://openrouter.ai/api/v1/models \
  -H "Authorization: Bearer $OPENROUTER_API_KEY"
```

Проверка только текстовых моделей:

```bash
# Получить модели, которые возвращают текст
curl "https://openrouter.ai/api/v1/models?output_modalities=text" \
  -H "Authorization: Bearer $OPENROUTER_API_KEY"
```

Проверка моделей с tools/function calling:

```bash
# Найти модели с поддержкой tools
curl "https://openrouter.ai/api/v1/models?supported_parameters=tools" \
  -H "Authorization: Bearer $OPENROUTER_API_KEY"
```

Важно:

```text
OPENROUTER_API_KEY хранить только в .env.local и Vercel Environment Variables.
# нельзя вставлять ключ прямо в код или документацию
```

---

# Какие данные брать из Models API

Из OpenRouter Models API нужно брать не только `id`.

Важные поля:

```text
id
# технический model ID для API-запроса

canonical_slug
# постоянный slug модели, если он доступен

name
# отображаемое название модели

description
# описание возможностей модели

context_length
# максимальный контекст модели

pricing.prompt
# стоимость input токенов

pricing.completion
# стоимость output токенов

architecture.input_modalities
# поддерживаемый input: text, image, audio, file и другое

architecture.output_modalities
# поддерживаемый output: text, image, audio, embeddings и другое

supported_parameters
# temperature, max_tokens, tools, response_format, reasoning и другое

top_provider.context_length
# контекст у основного provider

top_provider.max_completion_tokens
# максимальная длина ответа у provider

created
# дата появления модели в каталоге

expiration_date
# дата окончания, если модель временная
```

Эти поля нужны для UI, лимитов, стоимости и защиты от неактуальных моделей.

---

# Главное правило по model ID

Нельзя позволять frontend отправлять произвольный OpenRouter model ID.

Правильная схема:

```text
Frontend показывает display_name.
# пользователь видит понятное название

Frontend отправляет model_key.
# технический ключ из allowlist

Backend проверяет model_key в allowlist.
# настоящая защита находится на сервере

Backend отправляет model_key в OpenRouter.
# OpenRouter API key остаётся только на backend

Backend сохраняет usage и стоимость.
# контроль расходов и статистики
```

Если `model_key` не найден в allowlist или модель выключена, запрос нужно отклонить.

---

# Хранение моделей по этапам

## Этап 1 - server config

На самом раннем этапе можно хранить список моделей в server-side конфиге.

```text
src/lib/config/models.ts
# временный allowlist моделей для первого MVP
```

Плюсы:

- быстрее начать разработку;
- проще отладить `/api/compare`;
- не нужна админка;
- не нужен seed в Supabase на самом первом шаге.

Минусы:

- для изменения модели нужен commit;
- неудобно включать и отключать модели;
- нельзя быстро менять порядок моделей;
- нельзя удобно смотреть ошибки и стоимость.

## Этап 2 - Supabase

После подключения Supabase список моделей должен жить в таблице `models`.

```text
models
# таблица разрешённых моделей
```

Это даёт:

- включение и отключение моделей без переписывания backend;
- сортировку моделей в UI;
- хранение price label;
- хранение role tags;
- подготовку к админке;
- историю проверок модели;
- контроль public/private моделей.

## Этап 3 - Admin Panel

После `v1.6` модели можно управлять через UI.

```text
/admin/models
# страница управления моделями
```

Админка должна позволять:

- включать модель;
- отключать модель;
- менять `price_label`;
- менять `role_tags`;
- менять `sort_order`;
- скрывать модель от обычных пользователей;
- видеть ошибки;
- видеть примерную стоимость;
- видеть дату последней проверки.

---

# Таблица models

Таблица `models` должна соответствовать файлу:

```text
08-database.md
# каноническая схема базы данных
```

Рекомендуемые поля:

```text
id
# uuid primary key

provider
# источник модели: openrouter

model_key
# OpenRouter model ID

display_name
# понятное название для UI

description
# краткое описание модели

context_length
# длина контекста

max_output_tokens
# лимит ответа внутри проекта

price_label
# free, cheap, balanced, expensive

role_tags
# prompt, code, judge, team, dev

input_price_per_million
# цена input за 1M токенов

output_price_per_million
# цена output за 1M токенов

supports_text
# поддержка text input/output

supports_image
# поддержка image input

supports_json
# поддержка structured output или response_format

supports_tools
# поддержка tools/function calling

is_active
# можно ли использовать модель

is_public
# показывать ли модель обычным пользователям

sort_order
# порядок в интерфейсе

last_checked_at
# дата последней проверки через OpenRouter

created_at
# дата добавления

updated_at
# дата изменения
```

Не использовать старые конфликтующие названия:

```text
is_enabled
# не использовать, заменить на is_active

display_order
# не использовать, заменить на sort_order

is_free + is_paid
# не использовать, заменить на price_label
```

---

# Категории моделей

## free

Free-модели полезны для разработки, проверки UI, проверки OpenRouter integration и демонстрации MVP.

Минусы:

- могут иметь очереди;
- могут быть нестабильны;
- могут временно пропадать;
- могут иметь более низкое качество;
- не подходят как единственная база для честного Leaderboard.

## cheap

Cheap-модели нужны для обычных вопросов, коротких задач, черновиков, массового сравнения и первого пользовательского MVP.

## balanced

Balanced-модели - основной класс для Prompt Arena. Они должны давать нормальное качество при разумной цене.

## expensive

Expensive-модели нужны для сложных задач, архитектуры, программирования, глубокого анализа, Judge Mode и качественного Leaderboard.

Их нельзя давать всем пользователям без лимитов.

---

# Роли моделей

В `role_tags` используются такие значения:

```text
prompt
# модель доступна в Prompt Arena

code
# модель подходит для Code Arena Lite

judge
# модель может оценивать ответы других моделей

team
# модель может использоваться в AI Team Mode

dev
# модель только для разработки и тестов
```

Одна модель может иметь несколько ролей.

---

# Рекомендуемая стратегия наборов

## Набор A - Dev Free Set

Нужен для локальной разработки и дешёвых тестов.

```text
Назначение: development.
# проверка UI, API, ошибок и сохранения в базу

Production: нет.
# free-модели нельзя делать обязательной базой публичного MVP
```

Возможные кандидаты:

| Роль | Model ID | Использование |
|---|---|---|
| Free fast | `deepseek/deepseek-v4-flash:free` | Быстрые dev-тесты |
| Free reasoning | `google/gemma-4-31b-it:free` | Reasoning, текст, мультиязычность |
| Free open | `meta-llama/llama-3.3-70b-instruct:free` | Open-модель для сравнения |

Перед использованием проверить через Models API.

## Набор B - MVP Candidate Set

Нужен для первого рабочего Prompt Arena MVP.

```text
Назначение: v0.4-v1.0.
# стабильное сравнение нескольких моделей

Количество: 3 модели.
# нормальный баланс качества, скорости и стоимости
```

Возможные кандидаты:

| Роль | Model ID | Использование |
|---|---|---|
| Fast cheap | `google/gemini-3.1-flash-lite` | Быстрая экономичная модель |
| Balanced reasoning | `qwen/qwen3.5-plus-20260420` | Анализ, текст, reasoning |
| Balanced cheap | `mistralai/mistral-small-2603` | Текст, reasoning, код |

Важно:

```text
Это candidate set, а не вечная гарантия.
# перед кодом и production все model ID проверить через OpenRouter Models API
```

## Набор C - Quality Set

Нужен после MVP, когда уже есть лимиты и логирование расходов.

```text
Назначение: v1.1+.
# сложные задачи, код, judge, качество

Production: только с лимитами.
# дорогие модели нельзя открывать без контроля
```

Возможные кандидаты:

| Роль | Model ID | Использование |
|---|---|---|
| Strong reasoning | `openai/gpt-5.4` | Сложные задачи и архитектура |
| Strong coding | `anthropic/claude-sonnet-4.6` | Код, review, agentic tasks |
| Strong fast | `google/gemini-3.5-flash` | Быстрый reasoning и код |
| Advanced judge | `openai/gpt-5.4-pro` | Дорогая оценка сложных задач |
| Premium judge | `anthropic/claude-opus-4.8` | Очень сильный судья, только позже |

Перед использованием проверить доступность, цену и лимиты.

---

# Каноническое решение для MVP

Для первого публичного MVP не нужно подключать много моделей.

Рекомендуемый подход:

```text
В development:
# использовать free/dev модели для дешёвой проверки

В MVP candidate:
# использовать 3 модели из cheap/balanced категории

В production:
# включить только те модели, которые прошли проверку через Models API
```

Минимальный MVP-набор:

```text
model_1
# быстрая cheap/balanced модель

model_2
# balanced reasoning модель

model_3
# cheap/balanced модель с хорошей мультиязычностью
```

Не привязывать проект намертво к одному списку. Лучше хранить модели в allowlist и иметь возможность быстро их заменить.

---

# Модели для Prompt Arena

Prompt Arena - основной режим MVP.

Модель должна:

- стабильно отвечать;
- быть не слишком дорогой;
- понимать русский и английский;
- хорошо следовать инструкциям;
- давать понятные ответы;
- поддерживать text input и text output;
- иметь нормальный context length;
- поддерживать базовые параметры `temperature` и `max_tokens`.

Не использовать в Prompt Arena MVP:

```text
Слишком дорогие frontier-модели.
# можно быстро потратить бюджет

Экспериментальные модели без стабильности.
# могут ломать пользовательский опыт

Случайные router aliases для рейтинга.
# сравнение будет нечестным, если под alias меняется реальная модель

Image/audio/video models.
# они не нужны для текстового Prompt Arena MVP
```

---

# Модели для Code Arena

Code Arena делится на два этапа.

## v1.1 - Code Arena Lite

Code Arena Lite - это сравнение ответов с кодом без запуска кода.

Это можно делать раньше Runner, потому что нет sandbox.

Модели должны хорошо работать с TypeScript, JavaScript, Next.js, React, API routes, Supabase, PostgreSQL, тестами, архитектурой и безопасностью.

Возможные кандидаты:

| Приоритет | Model ID | Комментарий |
|---|---|---|
| 1 | `anthropic/claude-sonnet-4.6` | Сильная модель для кода и review |
| 2 | `openai/gpt-5.4` | Сильная универсальная модель |
| 3 | `google/gemini-3.5-flash` | Быстрая модель для reasoning и кода |
| 4 | `qwen/qwen3.5-plus-20260420` | Сбалансированная модель для кода и анализа |
| 5 | `mistralai/mistral-medium-3-5` | Multi-step reasoning и coding |

Перед добавлением в Code Arena Lite проверить:

```text
supports_text = true
# модель работает с текстовыми задачами

role_tags содержит code
# модель разрешена для Code Arena

price_label не expensive для обычных пользователей
# дорогие модели только после лимитов
```

## v1.7 - Code Arena Runner

Code Arena Runner - это запуск кода и тестов в sandbox.

Этот режим нельзя делать в первом MVP.

Требуется:

- отдельный sandbox;
- лимиты времени;
- лимиты памяти;
- запрет сетевого доступа;
- изоляция процессов;
- логирование результата;
- защита от вредного кода;
- user limits;
- admin controls.

Правильный порядок:

```text
v1.1 - Code Arena Lite
# модели пишут код, но код не запускается

v1.5 - Accounts and Profiles
# пользователи и личные лимиты

v1.6 - Admin Panel and Limits
# управление доступом и стоимостью

v1.7 - Code Arena Runner
# безопасный запуск кода
```

---

# Модели для Judge Mode

Judge Mode не входит в первый MVP.

Модель-судья добавляет стоимость, может ошибаться и требует критериев оценки. Поэтому Judge Mode должен появиться только после стабильного Prompt Arena MVP.

Модель-судья должна:

- видеть исходную задачу;
- видеть все ответы;
- сравнивать по критериям;
- давать объяснение;
- возвращать structured output;
- не выбирать победителя случайно;
- быть сильнее большинства моделей-участников.

Хранить нужно отдельно:

```text
user_vote
# выбор пользователя

judge_vote
# выбор модели-судьи

judge_reason
# объяснение судьи

criteria_scores
# оценки по критериям, если используются

final_result
# итоговая агрегация, если она нужна
```

Правило:

```text
Judge Mode не должен заменять голос пользователя.
# лучше хранить user votes и judge evaluations отдельно
```

---

# Модели для AI Team Mode

AI Team Mode - поздний режим `v2.0`.

Он не должен мешать MVP.

Возможные роли:

| Роль | Задача |
|---|---|
| Planner | Разбивает задачу на шаги |
| Architect | Продумывает архитектуру |
| Developer | Пишет код или решение |
| Tester | Проверяет тесты и edge cases |
| Critic | Ищет слабые места |
| Security Reviewer | Проверяет безопасность |
| Editor | Оформляет итоговый ответ |
| Judge | Сравнивает и выбирает итог |

Team Mode сложный, потому что один запрос превращается в цепочку запросов, стоимость растёт быстро, нужна история шагов, остановка цепочки, лимиты, защита от бесконечного цикла и отдельный UI.

Правило:

```text
AI Team Mode только после v1.x.
# сначала стабильный Prompt Arena, потом сложные цепочки
```

---

# Модели, которые не включать в первый MVP

В первый MVP не включать:

```text
Дорогие premium-модели.
# высокий риск расходов

Judge-only модели.
# Judge Mode не входит в MVP

Image generation models.
# генерация изображений не входит в Prompt Arena MVP

Audio models.
# аудио не входит в первый MVP

Video models.
# видео не входит в первый MVP

Embedding models.
# embeddings понадобятся позже для поиска и памяти

Random router aliases для Leaderboard.
# рейтинг будет нечестным, если реальная модель меняется
```

---

# Правила расходов

## Ограничения для MVP

```text
max_models_per_request = 3
# максимум 3 модели за один запрос

min_models_per_request = 2
# сравнение должно иметь минимум 2 ответа

max_prompt_chars = 4000
# ограничение длины prompt

max_output_tokens = 800
# ограничение длины ответа модели

request_timeout_seconds = 60
# защита от зависших запросов

save_usage = true
# сохранять usage, если OpenRouter вернул данные
```

## Что логировать

Для каждого ответа модели сохранять:

```text
task_id
# к какой задаче относится ответ

model_key
# какая модель отвечала

provider
# какой provider обработал запрос, если доступно

status
# success, error, timeout

latency_ms
# скорость ответа

prompt_tokens
# input tokens

completion_tokens
# output tokens

total_tokens
# общий расход токенов

estimated_cost
# примерная стоимость

error_message
# текст ошибки, если запрос не удался

finish_reason
# почему модель закончила ответ, если доступно
```

---

# Поведение при ошибках моделей

## Частичная успешность

Если из 3 моделей ответили только 2, нельзя ронять весь запрос.

```text
Модель 1 - success.
# показать ответ

Модель 2 - success.
# показать ответ

Модель 3 - error.
# показать карточку ошибки без падения всей Arena
```

## 404 по модели

Если OpenRouter вернул 404 по model ID:

```text
1. Не повторять запрос бесконечно.
# защита от лишних расходов

2. Вернуть понятную ошибку.
# модель временно недоступна или устарел model ID

3. Записать ошибку в logs.
# потом исправить allowlist

4. Пометить модель как unavailable.
# когда появится Admin Panel
```

## Rate limit

Если OpenRouter вернул rate limit:

```text
1. Показать частичный результат.
# если другие модели ответили

2. Не делать много повторов подряд.
# защита от блокировки и расходов

3. Записать ошибку.
# нужно видеть перегрузку
```

## Timeout

Если модель не ответила вовремя:

```text
1. Остановить ожидание по timeout.
# пользователь не должен ждать бесконечно

2. Сохранить статус timeout.
# для статистики и диагностики

3. Показать остальные ответы.
# Arena должна работать частично
```

---

# Server config для первого MVP

На первом этапе можно использовать server-side config.

Пример:

```ts
export type AiModelRole = "prompt" | "code" | "judge" | "team" | "dev";

export type AiModelPriceLabel = "free" | "cheap" | "balanced" | "expensive";

export type AiModelConfig = {
  modelKey: string;
  displayName: string;
  provider: "openrouter";
  priceLabel: AiModelPriceLabel;
  roleTags: AiModelRole[];
  isActive: boolean;
  isPublic: boolean;
  maxOutputTokens: number;
  sortOrder: number;
};

export const MVP_MODELS: AiModelConfig[] = [
  {
    modelKey: "google/gemini-3.1-flash-lite",
    displayName: "Gemini Flash Lite",
    provider: "openrouter",
    priceLabel: "cheap",
    roleTags: ["prompt"],
    isActive: true,
    isPublic: true,
    maxOutputTokens: 800,
    sortOrder: 10,
  },
  {
    modelKey: "qwen/qwen3.5-plus-20260420",
    displayName: "Qwen Plus",
    provider: "openrouter",
    priceLabel: "balanced",
    roleTags: ["prompt", "code"],
    isActive: true,
    isPublic: true,
    maxOutputTokens: 800,
    sortOrder: 20,
  },
  {
    modelKey: "mistralai/mistral-small-2603",
    displayName: "Mistral Small",
    provider: "openrouter",
    priceLabel: "cheap",
    roleTags: ["prompt", "code"],
    isActive: true,
    isPublic: true,
    maxOutputTokens: 800,
    sortOrder: 30,
  },
];
```

Важно:

```text
Этот файл должен использоваться только на server-side.
# не хранить API key рядом с конфигом моделей

Перед production проверить все modelKey.
# candidate model ID могут измениться
```

---

# API для моделей

## GET /api/models

Возвращает только публичные и активные модели.

Frontend не должен сам знать весь внутренний список моделей.

Пример ответа:

```json
{
  "models": [
    {
      "modelKey": "google/gemini-3.1-flash-lite",
      "displayName": "Gemini Flash Lite",
      "provider": "openrouter",
      "priceLabel": "cheap",
      "roleTags": ["prompt"],
      "maxOutputTokens": 800
    }
  ]
}
```

Backend должен фильтровать:

```text
is_active = true
# модель включена

is_public = true
# модель доступна обычным пользователям

role_tags содержит нужный режим
# prompt, code, judge, team или dev
```

## POST /api/compare

Backend обязан проверять выбранные модели.

Проверки:

```text
prompt не пустой.
# нельзя отправлять пустой запрос

prompt не длиннее max_prompt_chars.
# контроль стоимости и нагрузки

models.length от 2 до 3.
# нормальная Prompt Arena

каждый model_key есть в allowlist.
# защита от подмены

каждая модель is_active = true.
# отключённые модели не используются

каждая модель имеет role_tags prompt.
# нельзя использовать judge/team модель в обычной Arena
```

---

# Параметры запросов к OpenRouter

Для MVP не нужно использовать сложные параметры.

Базовый вариант:

```json
{
  "model": "google/gemini-3.1-flash-lite",
  "messages": [
    {
      "role": "user",
      "content": "User prompt here"
    }
  ],
  "temperature": 0.7,
  "max_tokens": 800
}
```

Рекомендуемые параметры MVP:

```text
temperature = 0.7
# баланс креативности и стабильности

max_tokens = 800
# контроль длины ответа

stream = false
# проще для первого MVP
```

Streaming добавить позже.

---

# Правила честного сравнения

Для честной Arena нужно:

```text
Одинаковый prompt для всех моделей.
# иначе сравнение нечестное

Одинаковая системная инструкция.
# модели должны получать одинаковые правила

Одинаковый max_tokens.
# у всех одинаковое пространство для ответа

Одинаковый язык ответа.
# если пользователь пишет на русском, ответы тоже на русском

Одинаковый режим.
# Prompt Arena не должна смешиваться с Code Arena или Judge Mode
```

Позже можно добавить:

```text
Blind voting.
# скрывать названия моделей до голосования

Task categories.
# отдельно считать код, текст, анализ, учебные задачи

Judge explanation.
# сохранять объяснение модели-судьи отдельно от user vote
```

---

# Leaderboard и модели

Leaderboard нельзя строить сразу на случайных данных.

Для честного Leaderboard нужно учитывать:

- mode_slug;
- model_key;
- количество задач;
- количество побед;
- win rate;
- среднюю оценку;
- категорию задачи;
- дату;
- пользовательские голоса;
- judge оценки отдельно от user votes;
- количество ошибок модели;
- среднюю задержку ответа;
- стоимость.

В первом MVP Leaderboard не нужен.

Сначала достаточно сохранять `votes`, чтобы потом построить рейтинг.

---

# Нельзя делать

```text
Нельзя показывать все модели OpenRouter пользователю.
# пользователь может выбрать дорогую модель и потратить бюджет

Нельзя доверять model_key с frontend.
# backend обязан проверять allowlist

Нельзя хранить OpenRouter API key в frontend.
# ключ будет украден

Нельзя использовать дорогие модели без лимитов.
# высокий риск расходов

Нельзя строить рейтинг только на free-моделях.
# free endpoints нестабильны

Нельзя запускать Code Runner без sandbox.
# риск безопасности

Нельзя считать OpenRouter model ID вечными.
# нужно периодически проверять актуальность

Нельзя смешивать dev-модели и production-модели.
# development может быть нестабильным, production должен быть контролируемым
```

---

# Проверка моделей перед релизом

Перед релизом нужно выполнить проверку.

```bash
# Получить список моделей OpenRouter перед релизом
curl https://openrouter.ai/api/v1/models \
  -H "Authorization: Bearer $OPENROUTER_API_KEY"
```

Если установлен `jq`, можно проверить конкретный model ID:

```bash
# Проверить, существует ли конкретная модель в OpenRouter
curl -s https://openrouter.ai/api/v1/models \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  | jq '.data[] | select(.id == "google/gemini-3.1-flash-lite") | {id, name, context_length, pricing, supported_parameters}'
```

Проверить нужно:

```text
1. Все MVP model ID существуют.
# иначе /api/compare будет падать

2. Все модели поддерживают text output.
# Prompt Arena работает с текстом

3. Цены не стали слишком высокими.
# контроль бюджета

4. Context length подходит под проект.
# защита от ошибок на длинных prompt

5. Модель поддерживает нужные параметры.
# temperature, max_tokens, response_format, tools при необходимости

6. Free-модели не используются как обязательные production-модели.
# защита от нестабильности

7. Дорогие модели скрыты от обычных пользователей.
# is_public = false или доступ только через лимиты
```

---

# Git-фиксация изменений

После замены файла выполнить:

```bash
# Проверить статус файлов в Git
git status
```

```bash
# Добавить обновлённый файл с моделями
git add 11-ai-models.md
```

```bash
# Зафиксировать изменения в документации моделей
git commit -m "Update AI models strategy"
```

---

# Итоговое решение

Для проекта **Новая эпоха** использовать такую стратегию:

```text
Первый dev-этап:
# free/dev модели для дешёвой проверки интерфейса и API

Первый рабочий MVP:
# 3 управляемые модели cheap/balanced категории

После MVP:
# добавить strong модели для качества и Code Arena Lite

Judge Mode:
# использовать сильную модель-судью только после лимитов

Code Arena Runner:
# запускать только после sandbox, аккаунтов, лимитов и админ-контроля

AI Team Mode:
# запускать только после стабильной архитектуры и контроля стоимости
```

Главный вывод:

```text
Не подключать все модели сразу.
# это усложнит проект и увеличит расходы

Начать с 3 управляемых моделей.
# этого достаточно для Prompt Arena MVP

Все model ID проверять через OpenRouter Models API перед production.
# это защита от устаревших slug, 404 и неожиданных расходов
```
