# 31 - Image Arena / Visual Arena Spec

> **Alpha в v2.0.0-alpha.1.** Backend route `POST /api/image-compare` и Image Arena UI реализованы только для авторизованных пользователей. Provider output принимается как base64, проходит raster/MIME/size validation и должен быть успешно загружен в Supabase Storage. Raw provider URL fallback отсутствует.

## Назначение файла

Этот документ описывает текущий alpha-контракт **Image Arena / Visual Arena** для проекта **Новая эпоха** и границы будущей persistence/safety работы.

Важно:

```text
Image Arena реализована как auth-only alpha в v2.0.0-alpha.1.
# основной стабильный продукт остаётся Prompt Arena
```

Dedicated Image Arena persistence, production paid-generation smoke и полный safety/storage review остаются release gates.

## Цель режима

Image Arena позволяет сравнить изображения, которые разные image-capable модели создают по одной визуальной идее пользователя.

Главная ценность:

```text
Одна визуальная идея -> несколько image-моделей -> несколько изображений -> сравнение -> выбор лучшего результата.
```

Режим должен помогать пользователю понять, какая image-модель лучше подходит для конкретного визуального запроса.

## Пользовательский сценарий

1. Авторизованный пользователь открывает Image Arena UI.
2. Вводит одну визуальную идею.
3. Выбирает 1-3 модели с `image` output capability.
4. Нажимает кнопку генерации.
5. Frontend отправляет запрос только в backend route.
6. Backend валидирует идею, модели, лимиты и доступ.
7. Backend вызывает image-capable модели через OpenRouter.
8. Backend получает provider base64, декодирует его и принимает только проверенный PNG/JPEG/WebP до 5 MiB.
9. Проверенные raster bytes загружаются напрямую в Supabase Storage.
10. Если генерация или upload одной модели не удались, её controlled error не отменяет результаты других моделей.
11. Metadata и storage path сохраняются в Supabase PostgreSQL после выделенной Image Arena persistence-задачи.
12. UI показывает сетку сохранённых изображений и позволяет выбрать лучший результат локально.

## Будущие таблицы и Storage

Файлы изображений должны храниться в Supabase Storage. Если Storage client недоступен, backend возвращает fail-fast `503 IMAGE_STORAGE_UNAVAILABLE` до платных provider calls. Если уже после генерации не удался upload отдельного результата, эта модель возвращается с `imageUrl: null`; provider URL/base64 не являются fallback и не раскрываются клиенту.

PostgreSQL должен хранить только metadata:

- `id`;
- `task_id`;
- `model_id`;
- `status`;
- `storage_bucket`;
- `storage_path`;
- `prompt_text`;
- `width`;
- `height`;
- `mime_type`;
- `error_code`;
- `error_message`;
- `created_at`.

Возможные будущие таблицы:

```text
image_generations
# специализированная таблица для Image Arena

artifacts
# более общий вариант для файлов разных режимов
```

Для первого Image Arena MVP предпочтительнее `image_generations`, если нужен простой и понятный scope. `artifacts` можно выбрать позже, если появятся разные типы файлов.

## API

Alpha routes (реализованы в v2.0.0-alpha.1):

```text
GET /api/image-models
# возвращает registered-only catalog с учётом текущей identity

POST /api/image-compare
# запускает Image Arena; доступен только авторизованным пользователям
```

> `[future]` Исходная спецификация описывала `POST /api/image-arena/generate`. В реализации используется `POST /api/image-compare`. Публичный маршрут `/api/image-arena/generate` не создан.

Пример request body:

```json
{
  "prompt": "Футуристический город на рассвете в стиле кинематографичной иллюстрации",
  "modelIds": [
    "openai/gpt-image-1-mini",
    "google/gemini-3.1-flash-lite-image"
  ]
}
```

Пример response body:

```json
{
  "taskId": "generated-uuid",
  "results": [
    {
      "modelId": "openai/gpt-image-1-mini",
      "modelName": "GPT Image 1 Mini",
      "imageUrl": "https://storage.example/images/arena-images/generated-uuid/openai-gpt-image-1-mini.png"
    },
    {
      "modelId": "google/gemini-3.1-flash-lite-image",
      "modelName": "Gemini 3.1 Flash Lite Image",
      "imageUrl": null,
      "error": "Controlled per-model error"
    }
  ]
}
```

### Registered Image catalog

| Provider model ID | Display name | Access |
|---|---|---|
| `openai/gpt-image-1-mini` | GPT Image 1 Mini | `registered` |
| `google/gemini-3.1-flash-lite-image` | Gemini 3.1 Flash Lite Image | `registered` |
| `black-forest-labs/flux.2-klein-4b` | FLUX.2 Klein 4B | `registered` |

### Provider contract

Backend отправляет отдельный запрос каждой выбранной модели:

```text
POST https://openrouter.ai/api/v1/images
Authorization: Bearer <server-only OPENROUTER_API_KEY>
Content-Type: application/json
```

```json
{
  "model": "openai/gpt-image-1-mini",
  "prompt": "Validated user prompt",
  "n": 1,
  "aspect_ratio": "1:1"
}
```

Это общий portable body для выбранной тройки. `resolution` и `output_format` не отправляются глобально: capability-наборы моделей различаются и проверяются scheduled discovery.

Успешный provider response должен содержать `data[0].b64_json`; `media_type` опционален. Backend декодирует base64, определяет формат по сигнатуре, сверяет объявленный MIME и принимает только `image/png`, `image/jpeg` или `image/webp` размером не более 5 MiB. SVG и неизвестные форматы отклоняются.

Правила API:

- frontend не вызывает OpenRouter напрямую;
- backend принимает `prompt` длиной до 1000 символов и 1–3 model IDs из typed allowlist;
- backend разрешает только три registered-only модели из текущего Image catalog;
- route применяет rate limit и ограничивает один запрос максимум тремя моделями; отдельный monetary budget guard пока не реализован;
- response не должен содержать secret keys;
- response возвращает stored URL/metadata, а не provider base64 или raw provider URL;
- ошибка отдельной модели сохраняет partial results других моделей;
- scheduled/manual `models:verify` ежедневно в `03:17 UTC` проверяет наличие Image IDs, output modality `image` и advertised parameters `aspect_ratio`/`n` через OpenRouter discovery; только live-step получает Actions secret `OPENROUTER_API_KEY`. Pull request CI запускает mock `test:models-verify` без provider secret.

## Риски и ограничения

Основные риски:

- высокая стоимость генерации изображений;
- быстрый расход бюджета при 2-3 моделях;
- большие файлы в Storage;
- необходимость safety/moderation правил;
- риск раскрытия ключей при прямом frontend-вызове provider API;
- необходимость очистки старых файлов;
- необходимость лимитов на пользователя, IP и период времени.

Обязательные ограничения перед реализацией:

```text
Stable Prompt Arena готова.
# prerequisite выполнен

Supabase Storage готов.
# изображения нельзя хранить в PostgreSQL

Storage upload обязателен для успешного результата.
# raw provider URL/base64 никогда не возвращаются клиенту

Лимиты генераций готовы.
# иначе режим может быстро стать дорогим

Model capabilities готовы.
# нужны модели с image output capability

Safety controls готовы.
# визуальная генерация требует отдельной политики безопасности
```

## Что не делать сейчас

Не добавлять в текущий код:

- route `/api/image-arena/generate`;
- новые обязательные таблицы для текущего MVP;
- Storage buckets как обязательную часть Prompt Arena;
- paid generation smoke без явного budget approval;
- provider-specific request options как общие для всех моделей без capability discovery;
- raw provider URL/base64 fallback.

Backend `POST /api/image-compare` существует как auth-only alpha (v2.0.0-alpha.1). Dedicated persistence, подтверждённый production Storage policy и полный safety review — follow-up задачи.
