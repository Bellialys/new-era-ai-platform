# 22 - Codex Action Backlog

## Назначение файла

Этот файл является накопительным списком задач для Codex.

Пользователь пока не выполняет команды Codex сразу. Все будущие действия, которые нужно будет дать Codex одним большим запросом, фиксируются здесь.

Когда пользователь скажет, что готов запускать Codex, из этого файла нужно собрать один большой последовательный prompt для автоматического выполнения.

## Статус

```text
Статус: backlog
# задачи записаны, но пока не выполнены пользователем в Codex
```

## Главные правила для Codex

1. Не начинать весь большой проект сразу.
2. Двигаться маленькими рабочими этапами.
3. После каждого этапа проверять, не сломался ли текущий функционал.
4. Не вставлять секретные ключи в код.
5. Секреты использовать только из `.env.local` и Vercel Environment Variables.
6. Все команды объяснять комментариями через `#`.
7. Перед изменением БД проверять migration status.
8. После важных изменений делать Git commit.
9. Не удалять рабочий fallback моделей.
10. Не ломать `/api/health`, `/api/models`, `/api/compare`.

## Текущий фундамент проекта

Перед началом задач Codex должен учитывать:

- проект Next.js уже работает;
- Vercel production уже поднимался со статусом `READY`;
- `/api/health` уже показывал `status: ok`;
- Supabase подключён;
- OpenRouter key в production настроен;
- таблицы `models`, `tasks`, `model_responses`, `profiles`, `votes` уже существуют;
- `task_text` является каноническим полем, `prompt_text` больше не используется;
- `votes` использует `model_response_id` и `vote_type = best | like | dislike`;
- старые миграции `0007` и `0008` удалены;
- актуальная документация по auth/guest/profile находится в `20-auth-guest-profile-plan.md`;
- правило блокировки доступа записано в `21-access-gate-policy.md`.

## Обязательная подготовка перед работой

Codex должен начать с проверки текущего состояния.

```bash
git pull
# подтянуть последние изменения из GitHub

supabase migration list
# проверить local vs remote историю миграций

npm install
# установить зависимости, если нужно

npm run typecheck
# проверить TypeScript до изменений

npm run lint
# проверить ESLint до изменений

npm run build
# проверить production build до изменений

npm run smoke
# проверить /api/health и /api/models, если доступен базовый URL
```

Если `supabase migration list` показывает расхождение, сначала остановиться и сообщить пользователю.

## Backlog task 1 - проверить миграции на чистой локальной базе

### Цель

Убедиться, что чистый клон проекта может поднять Supabase schema с нуля.

### Команды

```bash
supabase db reset
# прогнать все миграции с нуля на локальной базе

supabase migration list
# убедиться, что локальная история совпадает с remote

supabase db push
# убедиться, что remote не требует лишних миграций
```

### Критерий готовности

- `supabase db reset` проходит без ошибок;
- `supabase db push` не пытается применить удалённые старые `0007/0008`;
- remote и local migrations совпадают.

## Backlog task 2 - v0.6.1 Access Gate and Guest Mode

### Документы-источники

- `20-auth-guest-profile-plan.md`;
- `21-access-gate-policy.md`;
- `14-roadmap.md`.

### Цель

Нельзя использовать Prompt Arena без аккаунта или гостевой карточки.

Пользователь должен выбрать:

1. войти/зарегистрироваться;
2. продолжить как гость.

### Требования

1. Создать Supabase migration для таблицы `anonymous_sessions`.
2. Добавить backend route для создания/обновления guest session.
3. Добавить генератор гостя:
   - `Анонимус #1234`;
   - `avatarSeed`;
   - `colorSeed`.
4. Сохранять anonymous session в localStorage:
   - `new-era-anonymous-session-id`;
   - `new-era-anonymous-display-name`;
   - `new-era-anonymous-avatar-seed`;
   - `new-era-anonymous-color-seed`.
5. Добавить Access Gate UI.
6. Заблокировать Prompt Arena до входа или выбора гостевого режима.
7. Добавить guest card в интерфейс.
8. Передавать `anonymousSessionId` в `/api/compare`.
9. `/api/compare` должен возвращать `401 AUTH_REQUIRED`, если нет user session и нет валидного `anonymousSessionId`.
10. `/api/compare` должен сохранять `tasks.anonymous_session_id` для гостя.
11. Не добавлять регистрацию в этом шаге.
12. Не добавлять Storage в этом шаге.
13. Не ломать текущий Prompt Arena и fallback моделей.

### UI Access Gate

Текст блока:

```text
Чтобы начать сравнение моделей, войдите в аккаунт или продолжите как гость.

[Войти]
[Создать аккаунт]
[Продолжить как гость]
```

Пока режим не выбран:

- prompt textarea disabled;
- model selection disabled;
- submit button disabled;
- API-запрос `/api/compare` не должен запускаться.

### Критерий готовности

- без входа и без гостевой карточки нельзя отправить prompt;
- при нажатии `Продолжить как гость` появляется карточка `Анонимус #xxxx`;
- карточка сохраняется после перезагрузки;
- `anonymousSessionId` передаётся в `/api/compare`;
- задача гостя сохраняется с `anonymous_session_id`;
- `npm run typecheck`, `npm run lint`, `npm run build` проходят.

## Backlog task 3 - v0.6.2 Model Access Levels

### Цель

Гости должны использовать только бесплатные модели.

### Требования

1. Добавить поле `models.access_level`.
2. Значения:
   - `anonymous`;
   - `registered`;
   - `premium`.
3. Добавить DB check constraint.
4. Обновить seed/каталог моделей.
5. `/api/models` должен фильтровать модели по режиму:
   - guest: только `anonymous`;
   - account: `anonymous` + `registered`;
   - premium: позже.
6. `/api/compare` должен повторно проверять доступ на backend.
7. Если guest отправляет закрытую модель, вернуть `403 MODEL_NOT_ALLOWED`.

### Критерий готовности

- гость не видит registered/premium модели;
- гость не может вызвать закрытую модель вручную через API;
- текущие бесплатные модели продолжают работать.

## Backlog task 4 - v0.6.3 Auth SSR

### Цель

Добавить регистрацию и вход через Supabase Auth.

### Требования

1. Установить `@supabase/ssr`.
2. Создать Supabase browser client.
3. Создать Supabase server client.
4. Добавить proxy/cookies session refresh.
5. Создать страницу `/auth`.
6. Создать `/auth/callback`.
7. Реализовать login/signup/logout.
8. Добавить email/password auth.
9. Позже добавить Google/GitHub OAuth.

### Страницы

```text
/auth
# вход и регистрация

/auth/callback
# callback после OAuth/email confirmation
```

### Критерий готовности

- пользователь может зарегистрироваться;
- пользователь может войти;
- пользователь может выйти;
- session корректно работает после перезагрузки;
- `/api/health` остаётся ok.

## Backlog task 5 - v0.6.4 Profile MVP

### Цель

Создать функциональную страницу профиля.

### Требования

1. Расширить `profiles`:
   - `first_name`;
   - `last_name`;
   - `display_name`;
   - `avatar_url`;
   - `role`;
   - `plan`;
   - `updated_at`.
2. Создать `/profile`.
3. Показывать:
   - фото/аватар;
   - имя;
   - фамилию;
   - display name;
   - email;
   - plan;
   - role;
   - дату регистрации.
4. Разрешить менять:
   - имя;
   - фамилию;
   - display name.
5. Добавить базовую статистику:
   - tasks count;
   - responses count;
   - votes count.

### Критерий готовности

- вошедший пользователь видит свой профиль;
- может изменить имя/фамилию/display name;
- чужие профили недоступны.

## Backlog task 6 - v0.6.5 Avatar Upload

### Цель

Добавить загрузку фото профиля.

### Требования

1. Создать Supabase Storage bucket `avatars`.
2. Добавить Storage RLS policies.
3. Разрешить upload/update/delete только владельцу.
4. Ограничить форматы:
   - JPG;
   - PNG;
   - WEBP.
5. Ограничить размер до 2 MB.
6. Сохранять `profiles.avatar_url`.
7. Добавить preview и удаление фото.

### Критерий готовности

- пользователь может загрузить фото;
- фото отображается в профиле;
- пользователь не может менять чужой avatar.

## Backlog task 7 - v0.6.6 Email and Password Management

### Цель

Безопасно управлять email и паролем.

### Требования

1. Change email через Supabase Auth.
2. Email confirmation для нового email.
3. Forgot password.
4. Update password.
5. Нейтральные сообщения безопасности:
   - не раскрывать, существует email или нет;
   - не показывать точную причину ошибки входа.

### Критерий готовности

- пользователь может запросить восстановление пароля;
- пользователь может сменить пароль;
- пользователь может запросить смену email;
- `profiles.email` синхронизируется после изменения Auth email.

## Backlog task 8 - v0.6.7 User-linked Arena

### Цель

Связать Prompt Arena с пользователем или guest session.

### Требования

1. `/api/compare` определяет user или guest.
2. Для аккаунта сохраняет `tasks.user_id`.
3. Для гостя сохраняет `tasks.anonymous_session_id`.
4. Profile statistics считает tasks/responses/votes.
5. Подготовить будущую историю пользователя.

### Критерий готовности

- задачи аккаунта привязаны к `user_id`;
- задачи гостя привязаны к `anonymous_session_id`;
- profile statistics показывает реальные данные.

## Backlog task 9 - v0.7 Voting MVP

### Цель

После auth/guest foundation сделать сохранение выбора победителя.

### Требования

1. Создать `/api/vote`.
2. Принимать:
   - `taskId`;
   - `modelResponseId`;
   - `voteType`.
3. Поддержать `voteType = best`.
4. Не давать голосовать за error response.
5. Не давать голосовать за response из чужого task.
6. Для user сохранять vote по `user_id`.
7. Для guest сохранять vote по `anonymous_session_id`.
8. Подключить кнопку `Выбрать победителем` в UI к backend.

### Критерий готовности

- выбор победителя сохраняется в `votes`;
- после перезагрузки выбранный победитель отображается;
- нельзя выбрать error response.

## Backlog task 10 - финальная проверка после всех задач

### Команды

```bash
npm run typecheck
# проверить TypeScript

npm run lint
# проверить ESLint

npm run build
# проверить production build

npm run smoke
# проверить health/models

supabase migration list
# проверить миграции

supabase db reset
# проверить чистую локальную БД

supabase db push
# проверить remote sync
```

### Production smoke

```bash
SMOKE_BASE_URL=https://new-era-ai-platform.vercel.app npm run smoke
# проверить production /api/health и /api/models
```

## Как использовать этот файл позже

Когда пользователь скажет, что готов запускать Codex:

1. открыть этот файл;
2. собрать из него один большой prompt;
3. попросить Codex выполнять задачи последовательно;
4. после каждого этапа делать проверку и commit;
5. не переходить к следующему этапу, если текущий этап сломан.

## Последний крупный prompt для Codex должен начинаться так

```text
Работай строго по файлу 22-codex-action-backlog.md.
Выполняй задачи последовательно.
Не перепрыгивай этапы.
После каждого этапа запускай проверки.
После каждого рабочего результата делай commit.
Не вставляй секреты в код.
Если миграции расходятся, остановись и сообщи.
```
