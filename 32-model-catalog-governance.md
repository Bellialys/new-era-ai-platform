# 32. Model Catalog Governance - правила управления каталогом AI-моделей

Версия: v1.0  
Статус: рабочий стандарт проекта  
Проект: New Era AI Platform

---

## 1. Назначение

Этот документ фиксирует правила добавления, изменения, отключения и контроля AI-моделей в проекте.

Проект построен вокруг сравнения AI-моделей, поэтому каталог моделей должен быть управляемым, а не хаотичным списком. Каждая модель должна иметь понятный ключ, провайдера, статус, стоимость, лимиты, возможности, правила доступа, fallback и заметки по качеству.

---

## 2. Главное правило

Любая модель должна быть зарегистрирована в каталоге до использования в проекте.

Если модели нет в каталоге, приложение должно считать её недоступной.

Каталог моделей является единым источником правды для:

- Prompt Arena;
- Code Arena;
- Multi Model Battle;
- AI Team Mode;
- Judge Mode;
- Leaderboard;
- API;
- UI выбора моделей;
- OpenRouter-интеграции;
- будущих локальных моделей через LM Studio или Ollama.

---

## 3. Где хранить каталог

Для MVP основной каталог должен храниться в Supabase PostgreSQL в таблице `models`.

Frontend не должен хранить собственный список моделей в компонентах. Frontend должен получать доступные модели через backend endpoint.

Рекомендуемый endpoint:

`GET /api/models`

Endpoint должен возвращать только модели, доступные текущему пользователю.

---

## 3.1. MVP status v0.5.3

`32-model-catalog-governance.md` описывает целевой стандарт зрелого каталога моделей.

Текущая MVP-схема меньше и использует:

- `model_key`;
- `provider`;
- `display_name`;
- `description`;
- `price_label`;
- `is_active`;
- `is_public`;
- `role_tags`;
- `context_length`;
- `max_output_tokens`;
- `raw_metadata`.

Не нужно добавлять все governance-поля в таблицу сразу. В `v0.5.3` подготовительные значения для будущего governance хранятся в `raw_metadata`:

- `pricing_type`;
- `status`;
- `supports_text`;
- `supports_code`;
- `supports_image_input`;
- `supports_image_generation`;
- `verification_status`.

Важно: в этом репозитории нет OpenRouter API key, поэтому model IDs не считаются live-verified в рамках `v0.5.3`. Перед public deploy нужно отдельно проверить ключи через OpenRouter `/api/v1/models` и обновить `verification_status`.

---

## 4. Обязательные поля модели

| Поле | Обязательно | Назначение |
|---|---:|---|
| `model_key` | Да | Точный ключ модели для API или OpenRouter |
| `provider` | Да | Провайдер или gateway |
| `display_name` | Да | Название для UI |
| `model_family` | Желательно | Семейство модели |
| `model_version` | Желательно | Версия или snapshot модели |
| `description` | Желательно | Короткое описание |
| `pricing_type` | Да | `free` или `paid` |
| `access_level` | Да | Кто может использовать модель |
| `status` | Да | Жизненный цикл модели |
| `max_output_tokens` | Да | Максимальный ответ модели внутри проекта |
| `context_window` | Желательно | Общий контекст input + output |
| `supports_text` | Да | Поддержка текстовых задач |
| `supports_code` | Да | Поддержка Code Arena |
| `supports_image_input` | Да | Анализ изображений на входе |
| `supports_image_generation` | Желательно | Генерация изображений |
| `supports_streaming` | Желательно | Потоковый ответ |
| `supports_json_mode` | Желательно | JSON/structured output |
| `supports_function_calling` | Желательно | Tool/function calling |
| `fallback_available` | Да | Можно ли использовать как fallback |
| `fallback_model_key` | Желательно | Модель-замена |
| `quality_notes` | Да | Заметки по качеству |
| `known_limitations` | Желательно | Известные слабости |
| `recommended_for` | Желательно | Для каких задач подходит |
| `not_recommended_for` | Желательно | Для каких задач не подходит |
| `judge_allowed` | Желательно | Разрешена для Judge Mode |
| `leaderboard_allowed` | Желательно | Разрешена для Leaderboard |
| `created_at` | Да | Дата создания записи |
| `updated_at` | Да | Дата последнего обновления |

---

## 5. Правило для model_key

`model_key` - это технический идентификатор модели.

Для OpenRouter нужно сохранять ключ в том виде, в котором он используется в API.

Примеры:

- `qwen/qwen3-next-80b-a3b-instruct:free`
- `google/gemma-4-31b-it:free`
- `nvidia/nemotron-3-ultra-550b-a55b:free`
- `openai/gpt-4o-mini`
- `anthropic/claude-3-5-sonnet`

Правила:

- `model_key` должен быть уникальным;
- `model_key` нельзя менять без проверки базы данных;
- `model_key` должен сохраняться в `model_responses`;
- если провайдер выпустил новую версию, лучше добавить новую запись, а не молча менять старую;
- если точная версия неизвестна, это нужно указать в `model_version` или `quality_notes`.

---

## 6. Access level

Разрешённые значения для MVP:

| Access level | Значение |
|---|---|
| `guest` | Можно использовать без аккаунта |
| `user` | Только зарегистрированный пользователь |
| `premium` | Только платный или расширенный доступ |
| `admin` | Только владелец или админ проекта |
| `system` | Только внутренние задачи системы |

Правила:

- гостям доступны только безопасные и дешёвые модели;
- платные модели не должны быть доступны гостям без лимитов;
- Judge Mode и Leaderboard могут использовать более качественные модели, но только через отдельное разрешение;
- access level проверяется на backend, а не только в UI.

---

## 7. Lifecycle states

Для MVP используются такие статусы:

| Status | Значение |
|---|---|
| `preview` | Внутреннее тестирование |
| `beta` | Ограниченный доступ |
| `active` | Готова к production |
| `deprecated` | Устаревает и будет отключена |
| `inactive` | Отключена, но история сохраняется |

Правила:

- новая модель сначала получает `preview` или `beta`;
- только проверенная модель получает `active`;
- устаревшая модель получает `deprecated`;
- отключенная модель получает `inactive`;
- старые ответы не удаляются только из-за отключения модели.

---

## 8. Pricing и лимиты

Минимальные поля стоимости:

| Поле | Значение |
|---|---|
| `pricing_type` | `free` или `paid` |
| `input_price_per_1m_tokens` | цена входных токенов, если известна |
| `output_price_per_1m_tokens` | цена выходных токенов, если известна |
| `currency` | обычно `USD` |
| `daily_usage_limit` | дневной лимит, если нужен |

Правила:

- paid-модели нельзя случайно включать для гостей;
- paid-модели должны иметь ограничения;
- если цена неизвестна, это нужно явно указать;
- free-модель тоже может иметь ограничения по rate limit;
- позже UI должен показывать примерную стоимость сравнения до запуска.

---

## 9. Capabilities

Capabilities определяют, где модель можно использовать.

Правила:

- Code Arena использует только модели с `supports_code = true`;
- image input задачи используют только модели с `supports_image_input = true`;
- генерация изображений использует только модели с `supports_image_generation = true`;
- JSON-режим использует только модели с `supports_json_mode = true`;
- если возможность неизвестна, лучше указать `false`, чем делать рискованное предположение.

---

## 10. Fallback strategy

Fallback должен быть предсказуемым.

Минимальные поля:

| Поле | Назначение |
|---|---|
| `fallback_available` | Можно ли использовать модель как замену |
| `fallback_model_key` | Какая модель заменяет текущую модель |
| `fallback_reason` | error, timeout или rate_limit |
| `fallback_requires_same_capability` | Требовать совпадение возможностей |

Правила:

- fallback должен быть `active`;
- fallback должен поддерживать тот же тип задачи;
- fallback для Code Arena должен поддерживать code;
- fallback для image input должен поддерживать image input;
- fallback для guest-задачи не должен внезапно использовать дорогую paid-модель;
- факт fallback нужно сохранять в metadata ответа или логах.

---

## 11. Правила добавления новой модели

Перед добавлением модели нужно проверить:

- модель реально доступна у провайдера;
- `model_key` указан точно;
- provider выбран правильно;
- display name понятен пользователю;
- pricing type известен;
- access level определён;
- status установлен корректно;
- token limits заданы;
- capabilities заданы честно;
- fallback-логика определена;
- quality notes заполнены;
- модель протестирована хотя бы одним простым prompt;
- изменение не ломает `/api/models` и режимы проекта.

Нельзя добавлять модель только потому, что она появилась в списке провайдера.

---

## 12. Минимальный smoke-тест модели

Перед переводом модели в `active` нужно проверить:

- обычный текстовый prompt;
- ошибку при пустом prompt;
- максимальный допустимый output limit;
- корректную обработку ошибки API;
- корректное сохранение `model_key` в ответе;
- корректное отображение модели в UI.

Если модель заявлена как code-модель, дополнительно проверить простую задачу по коду.

Если модель заявлена как image input модель, дополнительно проверить простой image prompt.

Если модель заявлена как JSON-mode модель, дополнительно проверить структурированный ответ.

---

## 13. Judge Mode и Leaderboard

Judge Mode и Leaderboard требуют более строгого контроля.

Для Judge Mode модель должна иметь:

- стабильное качество рассуждений;
- понятные quality notes;
- контролируемую стоимость;
- `judge_allowed = true`.

Для Leaderboard модель должна иметь:

- стабильную версию или понятный snapshot;
- хорошую воспроизводимость;
- `leaderboard_allowed = true`.

Правила:

- случайные free-модели не должны использоваться для официального Leaderboard;
- если Judge-модель изменилась, это нужно фиксировать;
- результаты Leaderboard должны сохранять `judge_model_key`.

---

## 14. Deprecation policy

Модели нельзя отключать хаотично.

Рекомендуемый процесс:

| Этап | Действие |
|---|---|
| D-30 | Пометить модель как `deprecated` |
| D-14 | Убрать из выбора для новых задач, если есть замена |
| D-0 | Перевести в `inactive` |
| После отключения | Старые ответы сохранить для истории |

Для MVP допускается ручной процесс без email-уведомлений.

Если модель сломалась аварийно, её можно сразу перевести в `inactive`, но причину нужно записать.

---

## 15. API rules

`GET /api/models` должен:

- возвращать только разрешённые модели;
- учитывать `status`;
- учитывать `access_level`;
- учитывать capabilities;
- не показывать inactive-модели обычным пользователям.

`/api/compare` должен:

- валидировать каждый `model_key` по каталогу;
- запрещать inactive-модели;
- запрещать модели выше access level пользователя;
- сохранять фактически использованный `model_key`;
- сохранять информацию о fallback, если он был применён.

---

## 16. Database recommendation

Рекомендуемая таблица:

`models`

Рекомендуемые важные поля:

- `id`;
- `model_key`;
- `provider`;
- `display_name`;
- `model_family`;
- `model_version`;
- `pricing_type`;
- `access_level`;
- `status`;
- `max_output_tokens`;
- `context_window`;
- `supports_text`;
- `supports_code`;
- `supports_image_input`;
- `supports_image_generation`;
- `supports_streaming`;
- `supports_json_mode`;
- `supports_function_calling`;
- `fallback_available`;
- `fallback_model_key`;
- `quality_notes`;
- `known_limitations`;
- `recommended_for`;
- `not_recommended_for`;
- `judge_allowed`;
- `leaderboard_allowed`;
- `created_at`;
- `updated_at`.

`model_responses` должны сохранять `model_key`, чтобы старые сравнения оставались понятными.

---

## 17. Связь с другими документами

Эта политика связана с:

- `28-api-contracts.md` - API должен валидировать модели по каталогу;
- `29-database-ownership-policy.md` - `models` является общим справочником;
- `30-data-retention-policy.md` - usage-логи не должны храниться бесконечно;
- `26-definition-of-done.md` - добавление модели не считается готовым без проверки;
- `12-security-and-env.md` - ключи провайдеров не хранятся в каталоге.

---

## 18. Rules for Codex

Codex не имеет права:

- добавлять модель без записи в каталоге;
- выдумывать несуществующий `model_key`;
- хардкодить модели в UI;
- менять `model_key`, если он уже используется в БД;
- удалять inactive/deprecated модели, если есть исторические ответы;
- давать paid-модели guest-пользователям без лимитов;
- ставить fallback на модель с другими capabilities;
- менять pricing без обновления документации;
- добавлять новые поля модели без обновления документации и схемы БД;
- считать модель production-ready без минимального теста.

Если Codex не может проверить модель, он обязан написать это в отчёте.

---

## 19. Forbidden patterns

Запрещено:

- `gpt4` вместо точного model key;
- `best-model` вместо технического ключа;
- `supports_code = true` без проверки;
- paid fallback для guest без лимита;
- удаление inactive модели из истории;
- список моделей в React-компоненте;
- смена модели без changelog.

---

## 20. Future improvements

Не внедрять всё сразу в MVP. Позже можно добавить:

- JSON Schema для валидации записей;
- CI-проверку каталога;
- golden prompts;
- internal benchmark score;
- community rating;
- p50/p95/p99 latency;
- success rate за 7/30 дней;
- provider health score;
- cost estimation перед запуском сравнения;
- admin dashboard;
- canary rollout;
- A/B testing;
- отдельную таблицу `model_usage_logs`;
- отдельную таблицу `model_benchmarks`;
- отдельную таблицу `model_changelog`.

Эти улучшения полезны, но не должны блокировать простой рабочий MVP.

---

## 21. Final rule

Каталог моделей - это основа продукта.

Каждая модель должна быть:

- зарегистрирована;
- проверена;
- ограничена;
- описана;
- доступна только нужным пользователям;
- безопасна по стоимости;
- связана с fallback-правилами;
- сохранена в истории сравнений.

Ни одна модель не должна использоваться в проекте без управляемой записи в каталоге.
