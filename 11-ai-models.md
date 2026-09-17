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

Публичный recovery-каталог повторно проверен 2026-09-17 и содержит 8 моделей. При выборе учитываются не только наличие slug в discovery API, но и назначение endpoint, текущая пригодность для публичного Arena-сценария и provider data policy.

| ID | Название | Роль |
|---|---|---|
| `google/gemma-4-26b-a4b-it:free` | Gemma 4 26B A4B | Основная general-модель; Prompt Arena / Team default / Judge fallback |
| `google/gemma-4-31b-it:free` | Gemma 4 31B | General/reasoning; Judge primary |
| `nvidia/nemotron-3.5-lightning:free` | Nemotron 3.5 Lightning | Fast / agentic / long-context |
| `nvidia/nemotron-3-super-120b-a12b:free` | Nemotron 3 Super | Reasoning, experimental; не default из-за нестабильности free endpoint |
| `cohere/north-mini-code:free` | North Mini Code | Coding / agentic |
| `poolside/laguna-s-2.1:free` | Laguna S 2.1 | Coding / strong |
| `poolside/laguna-xs-2.1:free` | Laguna XS 2.1 | Coding / fast |
| `liquid/lfm-2.5-2.6b:free` | LFM 2.5 2.6B | Fast / extraction / RAG |

В fallback-режиме `supportsCode = true` только у North Mini Code, Laguna S 2.1 и Laguna XS 2.1; тот же набор закреплён `coding` role tags в recovery migration, поэтому `/api/code-models` не расходится между DB и local catalog.

Модели `z-ai/glm-5.2:free`, `thinkingmachines/inkling:free`, `thinkingmachines/inkling-small:free`, `nvidia/nemotron-3-ultra-550b-a55b:free` и `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free` не входят в текущий anonymous fallback. Причины различаются: специальные условия использования, provider data policy, текущая нестабильность free endpoint или узкая multimodal-специализация. Исторические DB rows не удаляются и могут оставаться `inactive` для сохранения ссылочной целостности.

Эти модели находятся в файле:

```text
src/lib/server/models.ts
# server-side allowlist моделей
```

Runtime defaults:

```text
TEAM_DEFAULT_MODEL_ID = google/gemma-4-26b-a4b-it:free
JUDGE_PRIMARY_MODEL_ID = google/gemma-4-31b-it:free
JUDGE_FALLBACK_MODEL_ID = google/gemma-4-26b-a4b-it:free
```

Forward-only migration `20260824193629_recover_openrouter_model_catalog.sql` деактивирует, но не удаляет, старые OpenRouter text rows и upsert-ит тот же curated set. Перед refresh 2026-09-17 подтверждено, что эта migration отсутствует в production migration history, поэтому pending-файл можно безопасно скорректировать до первого применения. Production Supabase остаётся отдельным owner/reviewer gate.

В `raw_metadata` recovery migration дополнительно фиксирует:

- `supports_text`;
- `supports_code`;
- `supports_image_input`;
- `supports_image_generation`;
- `verification_status`;
- `openrouter_verified_at`;
- `data_policy`;
- `recommended_surface`.

Free endpoint не означает отсутствие privacy/data-policy ограничений. Модели с provider logging/training policy должны использоваться только для данных, допустимых соответствующими условиями провайдера; конфиденциальные данные нельзя считать безопасными для отправки только потому, что модель бесплатная.

## Текущие Image-модели v2.0

Image Arena использует отдельный registered-only каталог из `src/lib/arena/image-models.ts`:

| ID | Название | Доступ |
|---|---|---|
| `openai/gpt-image-1-mini` | GPT Image 1 Mini | `registered` |
| `google/gemini-3.1-flash-lite-image` | Gemini 3.1 Flash Lite Image | `registered` |
| `black-forest-labs/flux.2-klein-4b` | FLUX.2 Klein 4B | `registered` |

Backend вызывает OpenRouter `POST /api/v1/images` с общим для этой тройки body `model`, `prompt`, `n: 1`, `aspect_ratio: "1:1"`. Провайдер возвращает `data[].b64_json` и опциональный `media_type`; backend принимает только PNG/JPEG/WebP до 5 MiB и загружает проверенные байты прямо в Supabase Storage. Raw provider URL и base64 не возвращаются клиенту.

`npm run models:verify` проверяет text-каталог, Team default, обе Judge-модели и Image-каталог через live discovery. Text-каталог должен содержать минимум `MODEL_MIN_SELECT` уникальных непустых IDs с output modality `text`, а Judge primary и fallback обязаны различаться. Для Image-моделей обязательны output modality `image` и provider parameters `aspect_ratio`/`n`. Scheduled workflow запускает verifier tests и fail-closed live-проверку ежедневно в `03:17 UTC` и вручную; secret `OPENROUTER_API_KEY` передаётся только live-step. Pull request CI выполняет только mock-команду `npm run test:models-verify` и не получает provider secret.

Promptfoo дополняет discovery verification реальным inference-контрактом. Direct baseline проверяет живые ответы выбранных моделей, а platform E2E проверяет полный flow приложения через `/api/guest`, `/api/models` и `/api/compare`. Discovery presence сама по себе не считается доказательством стабильного inference endpoint.

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
# например google/gemma-4-26b-a4b-it:free
```

## Критерии добавления новой модели

Перед добавлением модели проверить:

- модель доступна в OpenRouter;
- конкретный endpoint/slugs подходит по цене и условиям;
- модель достаточно стабильна;
- provider data policy совместим с целевой поверхностью продукта;
- модель не дублирует уже выбранную роль;
- модель не ломает лимит 2-3 моделей в Prompt Arena;
- модель добавлена только на backend в allowlist или в Supabase;
- модель включена в `models:verify`, если используется как Team/Judge/Image default или участник каталога;
- для production-критичных моделей выполнен хотя бы один реальный inference smoke/eval, а не только discovery check.

## Что не делать сейчас

Не добавлять:

- десятки моделей сразу;
- платные дорогие модели без лимитов;
- пользовательский ввод model key;
- автоматический выбор всех доступных моделей OpenRouter;
- прозрачный model fallback в Arena/Leaderboard, если фактический ответ может прийти от другой модели без фиксации реального model ID.

## Следующий шаг

Применить pending recovery migration к production Supabase только после прохождения полного PR gate и owner/reviewer approval. После применения проверить production `/api/models`, `/api/code-models`, Team/Judge defaults и Promptfoo platform E2E.

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

Текстовый Supabase catalog хранит текущие capability-флаги и governance metadata в `raw_metadata`; Image Arena использует отдельный typed registered-only каталог до выделенной image-model persistence-задачи.
