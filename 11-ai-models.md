# 11 - AI Models

## Назначение файла

Этот файл описывает стратегию выбора и подключения AI-моделей в проекте **Новая эпоха**.

Текущий статус:

```text
v2.0.0-alpha.1
# модели подключаются через OpenRouter, Supabase catalog и server-side fallback allowlist
# 14-roadmap.md остаётся главным источником текущего статуса
```

## Главный принцип

Пользователь не должен вводить произвольный ID модели.

Правильная схема текущей версии:

```text
Frontend загружает модели через GET /api/models.
# пользователь видит только разрешённые модели

Frontend отправляет selected modelIds в POST /api/compare.
# в Supabase mode это models.id UUID, в fallback mode - hardcoded OpenRouter key

Backend повторно проверяет modelIds.
# настоящая защита находится на сервере

Backend резолвит selectionId в OpenRouter model_key.
# provider key остаётся server-side

Backend вызывает OpenRouter.
# API-ключ не попадает в браузер
```

## Текущие text-модели v2.0

Каталог моделей берётся из `public.models`, если Supabase настроен и таблица доступна.

Fallback список находится в `src/lib/server/models.ts` и содержит curated free OpenRouter text/chat model keys.

Локальный recovery-каталог проверен по OpenRouter discovery 2026-08-24 и содержит 13 моделей:

| ID | Название | Роль |
|---|---|---|
| `z-ai/glm-5.2:free` | GLM 5.2 | General, reasoning, agentic |
| `thinkingmachines/inkling:free` | Inkling | General, reasoning, multimodal |
| `thinkingmachines/inkling-small:free` | Inkling Small | Быстрая reasoning-модель |
| `nvidia/nemotron-3.5-lightning:free` | Nemotron 3.5 Lightning | Быстрая agentic-модель с длинным контекстом |
| `nvidia/nemotron-3-ultra-550b-a55b:free` | Nemotron 3 Ultra | Reasoning; Judge primary |
| `nvidia/nemotron-3-super-120b-a12b:free` | Nemotron 3 Super | Reasoning/agentic; Team default и Judge fallback |
| `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free` | Nemotron 3 Nano Omni | Multimodal reasoning |
| `google/gemma-4-31b-it:free` | Gemma 4 31B | Открытая general-модель |
| `google/gemma-4-26b-a4b-it:free` | Gemma 4 26B A4B | Быстрая открытая general-модель |
| `poolside/laguna-s-2.1:free` | Laguna S 2.1 | Coding/agentic |
| `poolside/laguna-xs-2.1:free` | Laguna XS 2.1 | Быстрая coding/agentic |
| `cohere/north-mini-code:free` | North Mini Code | Компактная coding/agentic |
| `liquid/lfm-2.5-2.6b:free` | LFM 2.5 2.6B | Компактная general/reasoning |

В fallback-режиме `supportsCode = true` только у Laguna S 2.1, Laguna XS 2.1 и North Mini Code; тот же набор закреплён `coding` role tags в recovery migration, поэтому `/api/code-models` не расходится между DB и local catalog.

Эти модели находятся в файле:

```text
src/lib/server/models.ts
# server-side allowlist моделей
```

Forward-only migration `20260824193629_recover_openrouter_model_catalog.sql` деактивирует, но не удаляет, старые OpenRouter rows и upsert-ит тот же curated set. Её применение к production Supabase остаётся отдельным owner/reviewer gate.

## Текущие Image-модели v2.0

Image Arena использует отдельный registered-only каталог из `src/lib/arena/image-models.ts`:

| ID | Название | Доступ |
|---|---|---|
| `openai/gpt-image-1-mini` | GPT Image 1 Mini | `registered` |
| `google/gemini-3.1-flash-lite-image` | Gemini 3.1 Flash Lite Image | `registered` |
| `black-forest-labs/flux.2-klein-4b` | FLUX.2 Klein 4B | `registered` |

Backend вызывает OpenRouter `POST /api/v1/images` с общим для этой тройки body `model`, `prompt`, `n: 1`, `aspect_ratio: "1:1"`. Провайдер возвращает `data[].b64_json` и опциональный `media_type`; backend принимает только PNG/JPEG/WebP до 5 MiB и загружает проверенные байты прямо в Supabase Storage. Raw provider URL и base64 не возвращаются клиенту.

`npm run models:verify` проверяет text-каталог, Team default, обе Judge-модели и Image-каталог через live discovery. Text-каталог должен содержать минимум `MODEL_MIN_SELECT` уникальных непустых IDs с output modality `text`, а Judge primary и fallback обязаны различаться. Для Image-моделей обязательны output modality `image` и provider parameters `aspect_ratio`/`n`. Scheduled workflow запускает verifier tests и fail-closed live-проверку ежедневно в `03:17 UTC` и вручную; secret `OPENROUTER_API_KEY` передаётся только live-step. Pull request CI выполняет только mock-команду `npm run test:models-verify` и не получает provider secret.

## Почему нужен allowlist

Allowlist защищает проект от:

- случайного выбора дорогой модели;
- подстановки произвольного OpenRouter model key;
- расходов из-за неподконтрольных моделей;
- рассинхронизации frontend и backend;
- доступа к моделям, которые не должны быть активны.

## Важное правило для каталога

В Supabase mode поле `id` модели равно `models.id`.

В fallback mode поле `id` модели временно равно OpenRouter model key из hardcoded allowlist.

В production-архитектуре нужно держать разделение:

```text
models.id
# публичный UUID модели внутри проекта

models.model_key
# технический OpenRouter ID, только для backend

models.display_name
# название модели в интерфейсе
```

То есть frontend в основном режиме должен отправлять:

```json
{
  "modelIds": ["uuid-from-models-table"]
}
```

А backend должен сам находить:

```text
models.model_key
# например nvidia/nemotron-3-super-120b-a12b:free
```

## Критерии добавления новой модели

Перед добавлением модели проверить:

- модель доступна в OpenRouter;
- модель подходит по цене;
- модель достаточно стабильна;
- модель не дублирует уже выбранную роль;
- модель не ломает лимит 2-3 моделей в Prompt Arena;
- модель добавлена только на backend в allowlist или в Supabase;
- модель включена в `models:verify`, если используется как Team/Judge/Image default или участник каталога.

## Что не делать сейчас

Не добавлять:

- десятки моделей сразу;
- платные дорогие модели без лимитов;
- пользовательский ввод model key;
- автоматический выбор всех доступных моделей OpenRouter;
- Leaderboard до сохранения результатов в базу.

## Следующий шаг

Применить pending recovery migration к production Supabase через owner/reviewer gate и добавить `OPENROUTER_API_KEY` в GitHub Actions secrets, чтобы ежедневная проверка стала operational.

Hardcoded allowlist остаётся безопасным fallback, а не основным источником production-каталога.

---

## Model capabilities

Capabilities фиксируются в catalog metadata и проверяются provider discovery там, где от них зависит runtime. Это позволяет выбирать модели для разных режимов без раскрытия provider keys на frontend.

Базовые capabilities:

| Capability | Назначение |
|---|---|
| `text` | Генерация текстовых ответов для Prompt Arena |
| `image` | Генерация изображений для Image Arena / Visual Arena |
| `vision` | Анализ входных изображений |
| `code` | Помощь с программированием для Code Arena |
| `judge` | Оценка ответов или результатов |

Правило:

```text
Image Arena использует только модели с image output capability.
# text-only модели нельзя показывать как участников визуальной генерации
```

Текстовый Supabase catalog хранит текущие capability-флаги в `raw_metadata`; Image Arena использует отдельный typed registered-only каталог до выделенной image-model persistence-задачи.
