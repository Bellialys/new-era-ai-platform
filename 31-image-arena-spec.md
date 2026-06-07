# 31 - Image Arena / Visual Arena Spec

## Назначение файла

Этот документ описывает будущий режим **Image Arena / Visual Arena** для проекта **Новая эпоха**.

Важно:

```text
Image Arena не входит в первый MVP.
# сейчас основной MVP остаётся Prompt Arena
```

Этот файл фиксирует идею и границы будущего режима, но не является задачей на текущую реализацию.

## Цель режима

Image Arena позволяет сравнить изображения, которые разные image-capable модели создают по одной визуальной идее пользователя.

Главная ценность:

```text
Одна визуальная идея -> несколько image-моделей -> несколько изображений -> сравнение -> выбор лучшего результата.
```

Режим должен помогать пользователю понять, какая image-модель лучше подходит для конкретного визуального запроса.

## Пользовательский сценарий

1. Пользователь открывает будущую страницу `/image-arena`.
2. Вводит одну визуальную идею.
3. Выбирает 2-3 модели с `image` output capability.
4. Нажимает кнопку генерации.
5. Frontend отправляет запрос только в backend route.
6. Backend валидирует идею, модели, лимиты и доступ.
7. Backend вызывает image-capable модели через OpenRouter.
8. Изображения сохраняются в Supabase Storage.
9. Metadata и storage path сохраняются в Supabase PostgreSQL.
10. UI показывает сетку изображений.
11. Пользователь выбирает лучший результат.

## Будущие таблицы и Storage

Файлы изображений должны храниться в Supabase Storage.

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

## Будущий API

Будущий route:

```text
POST /api/image-arena/generate
# не входит в текущий MVP
```

Пример request body:

```json
{
  "idea": "Футуристический город на рассвете в стиле кинематографичной иллюстрации",
  "modelIds": ["uuid-image-model-1", "uuid-image-model-2"],
  "modeSlug": "image-arena"
}
```

Пример response body:

```json
{
  "status": "success",
  "taskId": "uuid-task-id",
  "images": [
    {
      "id": "uuid-image-generation-id",
      "modelId": "uuid-image-model-1",
      "status": "success",
      "storagePath": "image-arena/task-id/model-id.png"
    }
  ]
}
```

Правила API:

- frontend не вызывает OpenRouter напрямую;
- backend проверяет `modeSlug = image-arena`;
- backend разрешает только модели с `image` output capability;
- route применяет rate limit и cost limit;
- response не должен содержать secret keys;
- response возвращает metadata и storage path, а не provider secret data.

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
# Image Arena не должна идти раньше основного MVP

Supabase Storage готов.
# изображения нельзя хранить в PostgreSQL

Лимиты генераций готовы.
# иначе режим может быстро стать дорогим

Model capabilities готовы.
# нужны модели с image output capability

Safety controls готовы.
# визуальная генерация требует отдельной политики безопасности
```

## Что не делать сейчас

Не добавлять в текущий код:

- страницу `/image-arena`;
- route `/api/image-arena/generate`;
- вызовы image-моделей;
- новые обязательные таблицы для текущего MVP;
- Storage buckets как обязательную часть Prompt Arena;
- UI для генерации изображений.

Сейчас Image Arena существует только как будущая спецификация и roadmap-этап `v1.8`.
