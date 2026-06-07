# 11 - AI Models

## Назначение файла

Этот файл описывает стратегию выбора и подключения AI-моделей в проекте **Новая эпоха**.

Текущий статус:

```text
v0.5.0
# модели подключаются через OpenRouter, Supabase catalog и server-side fallback allowlist
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

## Текущие модели v0.5

Каталог моделей берётся из `public.models`, если Supabase настроен и таблица доступна.

Fallback список находится в `src/lib/server/models.ts` и содержит curated free OpenRouter text/chat models.

Начало fallback списка:

| ID | Название | Роль |
|---|---|---|
| `openai/gpt-oss-120b:free` | GPT-OSS 120B | Сильная general-модель |
| `meta-llama/llama-3.3-70b-instruct:free` | Llama 3.3 70B | Сбалансированный instruct |
| `qwen/qwen3-next-80b-a3b-instruct:free` | Qwen3 Next 80B | Сбалансированный instruct |
| `google/gemma-4-31b-it:free` | Gemma 4 31B | Открытая general-модель |

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
# например openai/gpt-oss-120b:free
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

На этапе стабилизации `v0.5` нужно применять миграции Supabase и держать `public.models` синхронизированной с curated fallback list.

Hardcoded allowlist остаётся безопасным fallback, а не основным источником production-каталога.

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
