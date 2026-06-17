# 33. Feature Flags Policy

> policy: Документ фиксирует принципы управления функциями. Текущие Arena-режимы могут управляться константами и backend checks; env-флаги добавляются только там, где нужен runtime rollout/rollback между окружениями.

## 1. Назначение документа

Feature Flags - это правила управления включением и выключением функций проекта без удаления кода.

Главная цель - безопасно добавлять новые возможности в проект, тестировать их в preview/staging и быстро отключать при ошибках.

Feature Flags нужны, чтобы:

- заливать код заранее, но не показывать функцию пользователям;
- тестировать новые функции отдельно;
- быстро отключать проблемную функцию без срочного удаления кода;
- уменьшить риск поломки production;
- постепенно включать сложные режимы проекта.

---

## 2. Основное правило

Новая крупная функция не должна сразу включаться в production по умолчанию.

Если функция может повлиять на пользователей, базу данных, оплату, лимиты, историю, авторизацию или AI-запросы, для нее должен быть отдельный feature flag.

---

## 3. Примеры feature flags

Исторический пример флагов раннего MVP:

```env
NEXT_PUBLIC_ENABLE_GUEST_MODE=false
NEXT_PUBLIC_ENABLE_AUTH=false
NEXT_PUBLIC_ENABLE_VOTING=true
NEXT_PUBLIC_ENABLE_HISTORY=false
```

Не считать этот пример актуальным списком обязательных env variables. Актуальные переменные окружения определяются `env-check.config.json`, `.env.local.example`, `docs/37-env-check-policy.md` и `12-security-and-env.md`.

Дополнительные флаги для будущих режимов:

```env
NEXT_PUBLIC_ENABLE_PROMPT_ARENA=true
NEXT_PUBLIC_ENABLE_CODE_ARENA=false
NEXT_PUBLIC_ENABLE_MULTI_MODEL_BATTLE=false
NEXT_PUBLIC_ENABLE_AI_TEAM_MODE=false
NEXT_PUBLIC_ENABLE_JUDGE_MODE=false
NEXT_PUBLIC_ENABLE_LEADERBOARD=false
```

Флаги для AI-функций:

```env
ENABLE_OPENROUTER_REQUESTS=true
ENABLE_MODEL_FALLBACK=true
ENABLE_IMAGE_GENERATION=false
ENABLE_CODE_EXECUTION=false
```

---

## 4. Правило NEXT_PUBLIC

Флаги с префиксом `NEXT_PUBLIC_` доступны на клиенте, то есть в браузере.

Их можно использовать для UI:

- показать или скрыть кнопку;
- показать или скрыть страницу;
- включить или выключить раздел интерфейса;
- скрыть режим, который еще не готов.

Пример:

```env
NEXT_PUBLIC_ENABLE_VOTING=false
```

Такой флаг можно использовать для скрытия кнопок голосования в интерфейсе.

---

## 5. Серверные флаги

Флаги без `NEXT_PUBLIC_` должны использоваться только на сервере.

Они подходят для функций, которые нельзя доверять браузеру:

- отправка запросов к AI-моделям;
- fallback между моделями;
- выполнение кода;
- работа с платными API;
- доступ к административным операциям;
- запись в базу данных.

Пример:

```env
ENABLE_OPENROUTER_REQUESTS=true
ENABLE_CODE_EXECUTION=false
```

Важно: клиентский флаг не является защитой безопасности. Если функция опасная, ее нужно дополнительно проверять на сервере.

---

## 6. Что нельзя хранить в feature flags

В feature flags нельзя хранить:

- API-ключи;
- токены доступа;
- пароли;
- service role ключ Supabase;
- private keys;
- секретные URL;
- данные пользователей.

Feature flags отвечают только за включение или выключение функций.

Секреты должны храниться только в:

- `.env.local`;
- Vercel Environment Variables;
- защищенных переменных окружения.

---

## 7. Именование feature flags

Название флага должно быть понятным и стабильным.

Формат:

```env
NEXT_PUBLIC_ENABLE_FEATURE_NAME=true
ENABLE_SERVER_FEATURE_NAME=false
```

Правила:

- использовать только UPPERCASE;
- использовать префикс `ENABLE_`;
- для клиентских флагов использовать `NEXT_PUBLIC_ENABLE_`;
- название должно отражать конкретную функцию;
- не использовать короткие непонятные названия.

Хорошо:

```env
NEXT_PUBLIC_ENABLE_GUEST_MODE=true
NEXT_PUBLIC_ENABLE_VOTING=false
ENABLE_MODEL_FALLBACK=true
```

Плохо:

```env
FLAG=true
TEST_MODE=true
NEW_FEATURE=true
MODE_1=true
```

---

## 8. Значения по умолчанию

Для production по умолчанию нужно использовать осторожные значения.

Новая функция:

```env
false
```

Стабильная MVP-функция:

```env
true
```

Если значение флага отсутствует, код должен использовать безопасное значение по умолчанию.

Например:

- для новой функции - выключено;
- для экспериментальной функции - выключено;
- для потенциально дорогой функции - выключено;
- для функции с записью в БД - выключено до проверки миграций.

---

## 9. Где хранить feature flags

Для runtime rollout/rollback между окружениями:

```env
.env.local
```

В Vercel:

```text
Project Settings -> Environment Variables
```

Для compile-time или roadmap-gated функций:

```text
src/lib/arena/constants.ts
# допустимо для функций, которые не должны переключаться без нового deploy
```

Для разных окружений значения могут отличаться:

- Development - можно включать больше функций;
- Preview - можно тестировать новые функции;
- Production - включать только проверенные функции.

---

## 10. Feature flags по окружениям

Пример логики:

### Development

```env
NEXT_PUBLIC_ENABLE_GUEST_MODE=false
NEXT_PUBLIC_ENABLE_AUTH=false
NEXT_PUBLIC_ENABLE_VOTING=true
NEXT_PUBLIC_ENABLE_HISTORY=false
```

### Preview

```env
NEXT_PUBLIC_ENABLE_GUEST_MODE=false
NEXT_PUBLIC_ENABLE_AUTH=false
NEXT_PUBLIC_ENABLE_VOTING=true
NEXT_PUBLIC_ENABLE_HISTORY=false
```

### Production

```env
NEXT_PUBLIC_ENABLE_GUEST_MODE=false
NEXT_PUBLIC_ENABLE_AUTH=false
NEXT_PUBLIC_ENABLE_VOTING=true
NEXT_PUBLIC_ENABLE_HISTORY=false
```

Для v0.7 Code Arena Lite текущий обязательный guardrail - backend-проверки и запрет Runner. Если позже понадобится скрывать `/code` в production без удаления кода, добавить явный флаг и описать его в env policy.

---

## 11. Правило для UI

Если функция выключена через feature flag, интерфейс не должен показывать пользователю активные элементы этой функции.

Например, если выключено:

```env
NEXT_PUBLIC_ENABLE_VOTING=false
```

Тогда UI должен скрыть:

- кнопки голосования;
- блок рейтинга;
- действия `/api/vote` на клиенте;
- подсказки, что голосование доступно.

---

## 12. Правило для API

Даже если кнопка скрыта на клиенте, API должен отдельно проверять серверный доступ.

Если функция выключена, API должен вернуть контролируемую ошибку:

```json
{
  "error": "Feature disabled"
}
```

Нельзя полагаться только на скрытие кнопки в интерфейсе.

---

## 13. Rollback через feature flags

Если после деплоя функция ломает production, сначала нужно отключить feature flag.

Порядок действий:

1. Отключить флаг в Vercel Environment Variables.
2. Перезапустить deployment, если это требуется.
3. Проверить, что функция больше не доступна пользователю.
4. Проверить, что старые рабочие функции не сломались.
5. Создать issue или задачу на исправление.
6. После исправления снова включить флаг в preview.
7. Только после проверки включать в production.

---

## 14. Правило для Codex

Codex не должен включать новую крупную функцию в production без явного указания.

Если Codex добавляет новую функцию, он должен:

- добавить feature flag;
- указать значение по умолчанию;
- обновить `.env.example`, если такой файл используется;
- проверить, что выключенная функция не ломает интерфейс;
- проверить, что API корректно отвечает при выключенной функции;
- обновить документацию;
- указать в отчете, какой флаг был добавлен.

---

## 15. Когда feature flag обязателен

Feature flag обязателен для:

- нового режима проекта;
- авторизации;
- guest mode;
- голосования;
- истории запросов;
- leaderboard;
- judge mode;
- AI Team Mode;
- Code Arena;
- выполнения кода;
- генерации изображений;
- платных AI-моделей;
- fallback-логики;
- функций, которые пишут данные в БД;
- функций, которые могут увеличить стоимость API.

---

## 16. Когда feature flag не обязателен

Feature flag обычно не нужен для:

- исправления текста;
- изменения цвета;
- мелкой правки верстки;
- исправления typo;
- добавления документации;
- безопасного рефакторинга без изменения поведения.

Но если даже маленькая правка может повлиять на production, лучше добавить флаг.

---

## 17. Минимальный список флагов для MVP

Пример возможного списка для будущего runtime rollout:

```env
NEXT_PUBLIC_ENABLE_GUEST_MODE=false
NEXT_PUBLIC_ENABLE_AUTH=false
NEXT_PUBLIC_ENABLE_VOTING=true
NEXT_PUBLIC_ENABLE_HISTORY=false
NEXT_PUBLIC_ENABLE_PROMPT_ARENA=true
NEXT_PUBLIC_ENABLE_CODE_ARENA=false
NEXT_PUBLIC_ENABLE_MULTI_MODEL_BATTLE=false
NEXT_PUBLIC_ENABLE_AI_TEAM_MODE=false
NEXT_PUBLIC_ENABLE_JUDGE_MODE=false
NEXT_PUBLIC_ENABLE_LEADERBOARD=false

ENABLE_OPENROUTER_REQUESTS=true
ENABLE_MODEL_FALLBACK=true
ENABLE_IMAGE_GENERATION=false
ENABLE_CODE_EXECUTION=false
```

Этот список не является текущим обязательным `.env` контрактом. Перед добавлением любого флага нужно обновить `env-check.config.json`, `.env.local.example` и документацию окружений.

---

## 18. Definition of Done для feature flags

Функция считается правильно подключенной к feature flags, если:

- флаг добавлен в документацию;
- флаг добавлен в `.env.example`, если файл используется;
- значение по умолчанию безопасное;
- UI скрывает выключенную функцию;
- API блокирует выключенную функцию;
- production не включает экспериментальную функцию случайно;
- preview может включить функцию для тестирования;
- rollback возможен без удаления кода;
- Codex указал в отчете, какие флаги были добавлены или изменены.

---

## 19. Важное правило

Feature flags не заменяют безопасность.

Они помогают управлять функциями, но не должны быть единственной защитой.

Для важных действий все равно нужны:

- проверка авторизации;
- проверка прав доступа;
- RLS в Supabase;
- серверная валидация;
- лимиты запросов;
- защита секретов;
- логирование ошибок без утечки приватных данных.

---

## 20. Итог

Feature Flags Policy нужна, чтобы проект развивался поэтапно и безопасно.

Главный принцип:

Код можно добавить заранее, но включать функцию для пользователей нужно только после проверки.

Это особенно важно для проекта сравнения AI-моделей, потому что новые режимы, модели, голосование, история и leaderboard могут влиять на стоимость, базу данных, безопасность и стабильность production.
