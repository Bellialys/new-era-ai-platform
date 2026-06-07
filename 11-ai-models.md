# 11 - AI Models

## Назначение файла

Этот файл описывает стратегию выбора и подключения AI-моделей в проекте **Новая эпоха**.

Текущий статус:

```text
v0.4.1
# модели подключаются через OpenRouter и server-side allowlist
```

## Главный принцип

Пользователь не должен вводить произвольный ID модели.

Правильная схема текущей версии:

```text
Frontend загружает модели через GET /api/models.
# пользователь видит только разрешённые модели

Frontend отправляет selected modelIds в POST /api/compare.
# в v0.4.1 это OpenRouter model keys из allowlist

Backend повторно проверяет modelIds.
# настоящая защита находится на сервере

Backend вызывает OpenRouter.
# API-ключ не попадает в браузер
```

## Текущие модели v0.4.1

| ID | Название | Роль |
|---|---|---|
| `google/gemini-flash-1.5` | Gemini Flash 1.5 | Быстрый и точный |
| `mistralai/mistral-small-3.1-24b-instruct` | Mistral Small 3.1 | Сбалансированный анализ |
| `meta-llama/llama-3.1-8b-instruct` | Llama 3.1 8B | Открытая модель |

Эти модели находятся в файле:

```text
src/lib/server/models.ts
# server-side allowlist моделей
```

## Почему нужен allowlist

Allowlist защищает проект от:

- случайного выбора дорогой модели;
- подстановки произвольного OpenRouter model key;
- расходов из-за неподконтрольных моделей;
- рассинхронизации frontend и backend;
- доступа к моделям, которые не должны быть активны.

## Важное правило для v0.5

В `v0.4.1` поле `id` модели временно равно OpenRouter model key.

После подключения Supabase нужно разделить:

```text
models.id
# публичный UUID модели внутри проекта

models.model_key
# технический OpenRouter ID, только для backend

models.display_name
# название модели в интерфейсе
```

То есть frontend должен отправлять:

```json
{
  "modelIds": ["uuid-from-models-table"]
}
```

А backend должен сам находить:

```text
models.model_key
# например google/gemini-flash-1.5
```

## Критерии добавления новой модели

Перед добавлением модели проверить:

- модель доступна в OpenRouter;
- модель подходит по цене;
- модель достаточно стабильна;
- модель не дублирует уже выбранную роль;
- модель не ломает лимит 2-3 моделей в Prompt Arena;
- модель добавлена только на backend в allowlist или в Supabase.

## Что не делать сейчас

Не добавлять:

- десятки моделей сразу;
- платные дорогие модели без лимитов;
- пользовательский ввод model key;
- автоматический выбор всех доступных моделей OpenRouter;
- Leaderboard до сохранения результатов в базу.

## Следующий шаг

На этапе `v0.5` перенести список моделей из `src/lib/server/models.ts` в таблицу `models` Supabase.

До этого текущий allowlist можно оставить как безопасное MVP-решение.

---

## Будущие model capabilities

После перехода на Supabase модели должны иметь явные capabilities. Это позволит выбирать модели для разных режимов без раскрытия provider keys на frontend.

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

В будущем capabilities можно хранить в `models.capabilities` как `text[]` или `jsonb`, но это не является обязательным изменением для текущего MVP.
