# 30 - Data Retention Policy

## Статус

```text
Draft / MVP policy
# документ заменяет прежний placeholder; автоматические retention jobs ещё не реализованы
```

## Назначение

Этот документ фиксирует минимальные правила хранения, удаления и логирования данных проекта **Новая эпоха**.

Политика нужна, чтобы Prompt Arena, будущая история, guest mode, профили и audit logs развивались без накопления лишних пользовательских данных.

## Главные правила

1. Не хранить plaintext-секреты в базе данных, логах, markdown-файлах или frontend bundle. Persistent provider credentials допускаются только как encrypted ciphertext + KMS metadata по ADR-004.
2. Не логировать API keys, service role keys, Authorization headers и production env values.
3. Хранить только данные, которые нужны для продукта, аудита ошибок или безопасности.
4. Для guest data использовать ограниченный срок хранения.
5. Для account data дать пользователю будущий путь удаления аккаунта и связанных данных.

## Данные Prompt Arena

| Данные | Где хранятся | MVP retention |
|---|---|---|
| Задачи пользователя | `tasks` | Пока нужна история пользователя |
| Ответы моделей | `model_responses` | Пока нужна история пользователя |
| Голоса | `votes` | Пока нужна история и статистика |
| Ошибки model response | `model_responses.error_*` | Только для диагностики, затем можно очищать или агрегировать |
| Provider metadata | `raw_response` | Только безопасная metadata без секретов |

## Guest Data

Guest session data должна храниться ограниченно.

Рекомендуемый MVP-ориентир:

```text
30-90 дней
# точный срок определить перед public production deploy
```

Guest history должна быть удаляема вместе с anonymous session, когда появится полноценный guest/account flow.

## Account Data

Account history может храниться, пока существует аккаунт пользователя.

Для следующих этапов нужно добавить:

- удаление аккаунта;
- удаление или anonymization связанных `tasks`, `model_responses`, `votes`;
- экспорт пользовательской истории, если это потребуется продукту;
- понятное описание retention rules в пользовательской политике.

## Logs

Запрещено логировать:

- OpenRouter API key;
- Supabase service role key;
- Authorization headers;
- cookies/session tokens;
- production environment values;
- полные приватные секреты;
- debug dumps request headers.

Допустимо логировать:

- method;
- route path;
- status code;
- duration;
- controlled error code;
- timestamp.

## Deletion Jobs

Автоматические deletion/retention jobs не входят в первый Supabase MVP.

Перед публичным production deploy нужно определить:

- срок хранения guest sessions;
- срок хранения diagnostic errors;
- порядок hard delete vs anonymization;
- backup retention;
- кто имеет доступ к production data.

## v2.0 Analytics Tables Retention

| Таблица | MVP retention | Примечания |
|---|---|---|
| `usage_events` | 90 дней, затем агрегировать | Содержат `user_id` — PII; не хранить после необходимого срока |
| `team_runs` | Пока активен аккаунт | Удалять при account deletion; содержат финальный ответ модели |
| `team_run_steps` | Каскад от `team_runs` (ON DELETE CASCADE) | Удаляются автоматически |
| `code_runs` | 30 дней | Содержат код пользователя; ограниченный срок |
| `leaderboard_snapshots` | Постоянно | Агрегированные публичные данные, без PII |
| `artifacts` | Пока активен аккаунт | Удалять Storage объекты при удалении аккаунта |
| `model_price_history` | Постоянно | Публичная информация о ценах, без PII |
| `cleanup_log` | 180 дней | Аудит retention — удалять не ранее истечения retention window |

Deletion jobs для этих таблиц планируются в v2.1. До их реализации — ручная очистка через Supabase Dashboard по `cleanup_log` записям.

## Related Docs

- `27-environments.md` - разделение Local / Preview / Staging / Production.
- `29-database-ownership.md` - владение данными и каскадные удаления.

## Stage 3 provider credential retention

Детальный lifecycle: `49-openrouter-funding-byok-plan.md` и ADR-004.

### Plaintext provider keys

Retention: **0 persistent storage**.

Plaintext может существовать только в TLS request/server memory на время validation, encryption или inference.

### Persistent BYOK ciphertext

Хранится только пока пользователь явно держит OpenRouter connection активным.

При disconnect/account deletion:

- уничтожить encrypted secret/DEK согласно ADR-004;
- сохранить только safe fingerprint/status/audit metadata, если это требуется operational policy;
- raw key никогда не переносится в audit/history.

### Platform-managed credential

При отключении platform access или удалении аккаунта:

1. best-effort remote disable/revoke через OpenRouter Management API;
2. локальный credential переводится в revocation lifecycle;
3. encrypted secret crypto-shred;
4. safe remote key hash/status может временно храниться для orphan reconciliation.

### Usage and pricing

`usage_events` сохраняет provider usage/cost metadata по общему retention policy.
`model_price_history` может хранить исторические pricing snapshots дольше user data, потому что не содержит provider secrets или пользовательский prompt.
