# 20 - Auth, Guest Mode and Profile Plan

## Назначение файла

Этот документ фиксирует следующий большой функциональный этап проекта **Новая эпоха**: регистрацию, гостевой режим и полноценную страницу профиля.

Документ нужен, чтобы Codex и разработчик понимали, на что опираться при дальнейшей разработке, и не смешивали регистрацию, голосование, историю и платные лимиты в хаотичный один шаг.

Главное правило: сначала делаем рабочий маленький фундамент, потом расширяем.

## Версия этапа

```text
v0.6 - Auth, Guest Mode and Profile
# пользователи, гостевой режим, профиль и ограничения доступа к моделям
```

## Главная идея

В проекте должны быть два режима использования:

1. **Гостевой режим** - пользователь может попробовать платформу без регистрации, но только с бесплатными моделями и ограниченными возможностями.
2. **Аккаунт пользователя** - пользователь может войти, иметь профиль, фото, имя, фамилию, email, историю сравнений, сохранение голосов и будущие лимиты/тарифы.

Гостевой режим не должен быть просто пустым состоянием. При выборе гостевого режима система должна автоматически создавать временную карточку пользователя, например:

```text
Анонимус #4827
Гостевой режим
Доступ: бесплатные модели
История: временная
```

## Гостевой режим

### Что должен видеть гость

В шапке или панели пользователя должна отображаться компактная карточка:

```text
[аватар]
Анонимус #4827
Гость
Только бесплатные модели
```

Аватар можно сделать без загрузки изображения:

- первая буква `A`;
- случайный цвет;
- avatarSeed;
- colorSeed.

### Что доступно гостю

| Возможность | Статус |
|---|---|
| Запустить Prompt Arena | Да |
| Получить ответы моделей | Да |
| Использовать бесплатные модели | Да |
| Использовать registered/premium модели | Нет |
| Сохранить task через anonymous_session_id | Да |
| Выбрать победителя локально | Да |
| Сохранить постоянную историю | Нет |
| Загрузить фото | Нет |
| Изменить email | Нет |
| Участвовать в будущем Leaderboard как полноценный пользователь | Нет |

### Техническая логика гостя

Нужно создать таблицу:

```sql
create table public.anonymous_sessions (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  avatar_seed text not null,
  color_seed text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  converted_user_id uuid references auth.users(id) on delete set null
);
```

На клиенте нужно хранить:

```text
new-era-anonymous-session-id
# UUID гостевой сессии

new-era-anonymous-display-name
# Например: Анонимус #4827
```

Если localStorage пустой:

1. Сгенерировать гостя.
2. Создать `anonymous_sessions` запись через backend route.
3. Сохранить `anonymousSessionId` в localStorage.
4. Передавать `anonymousSessionId` в `/api/compare`.

## Ограничение моделей для гостей

Анонимный режим должен использовать только бесплатные модели.

Ограничение должно быть не только в UI, но и на backend.

### Изменение таблицы `models`

Добавить поле:

```sql
alter table public.models
  add column if not exists access_level text not null default 'anonymous';
```

Допустимые значения:

```text
anonymous
# доступно всем, включая гостей

registered
# доступно только вошедшим пользователям

premium
# будущий платный/расширенный доступ
```

Добавить check constraint:

```sql
alter table public.models
  add constraint models_access_level_check
  check (access_level in ('anonymous', 'registered', 'premium'));
```

### Backend-правило

В `/api/models`:

- если пользователь гость - отдавать только `access_level = 'anonymous'`;
- если пользователь авторизован - отдавать `anonymous` и `registered`;
- `premium` оставить на будущие тарифы.

В `/api/compare`:

- повторно проверить доступ к выбранным моделям;
- если гость отправил registered/premium модель - вернуть `403 MODEL_NOT_ALLOWED`;
- нельзя полагаться только на frontend-фильтрацию.

## Регистрация и вход

### Рекомендуемый стек

Использовать Supabase Auth + `@supabase/ssr`, потому что проект уже использует Supabase и Next.js App Router.

Нужно добавить:

```bash
npm install @supabase/ssr
# официальный SSR-helper для Supabase Auth в Next.js
```

### Страницы

```text
/auth
# вход и регистрация

/auth/callback
# callback после OAuth/email confirmation

/auth/reset-password
# запрос восстановления пароля

/auth/update-password
# установка нового пароля

/profile
# профиль пользователя
```

### Компоненты

```text
src/components/auth/auth-card.tsx
# общая карточка входа/регистрации

src/components/auth/login-form.tsx
# форма входа

src/components/auth/signup-form.tsx
# форма регистрации

src/components/auth/oauth-buttons.tsx
# кнопки Google/GitHub

src/components/auth/user-menu.tsx
# меню пользователя в шапке
```

### Поля регистрации

Минимальный вариант:

- имя;
- email;
- пароль;
- повтор пароля;
- checkbox согласия с условиями.

Позже можно добавить:

- фамилия;
- отображаемое имя;
- OAuth Google;
- OAuth GitHub.

## Профиль пользователя

Страница `/profile` должна быть полноценной функциональной страницей, а не просто выводом email.

### Верхняя карточка

```text
[Фото профиля]
Имя Фамилия
email@example.com
План: Free
Дата регистрации: 09.06.2026
```

Кнопки:

```text
Изменить фото
Редактировать профиль
Выйти
```

### Блок личных данных

Редактируемые поля:

- имя;
- фамилия;
- отображаемое имя;
- email через подтверждение;
- фото профиля.

Нередактируемые поля:

- user id;
- роль;
- тариф;
- дата регистрации.

### Таблица `profiles`

Расширить `profiles`:

```sql
alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists avatar_url text,
  add column if not exists role text not null default 'user',
  add column if not exists plan text not null default 'free',
  add column if not exists updated_at timestamptz not null default now();
```

Рекомендуемые поля:

| Поле | Назначение |
|---|---|
| `id` | UUID пользователя из `auth.users` |
| `email` | копия email для отображения |
| `first_name` | имя |
| `last_name` | фамилия |
| `display_name` | публичное имя |
| `avatar_url` | ссылка на фото |
| `role` | user/admin |
| `plan` | free/premium/future |
| `created_at` | дата создания |
| `updated_at` | дата обновления |

## Фото профиля

Фото профиля хранить в Supabase Storage.

Bucket:

```text
avatars
# bucket для фото пользователей
```

Путь файла:

```text
avatars/{user_id}/avatar.webp
```

Ограничения:

- JPG, PNG, WEBP;
- максимум 2 MB;
- лучше квадрат 1:1;
- upload/update/delete только владельцу;
- public read можно разрешить, если аватары публичные.

## Изменение email

Email нельзя менять только в `profiles.email`.

Правильный процесс:

1. Пользователь вводит новый email.
2. Backend вызывает Supabase Auth update email.
3. Supabase отправляет подтверждение.
4. После подтверждения меняется email в Auth.
5. `profiles.email` синхронизируется с Auth.

В UI показывать нейтральный статус:

```text
Письмо подтверждения отправлено на новый email.
```

## Привязка задач к пользователю

После Auth нужно изменить `/api/compare`:

- если пользователь вошёл - сохранять `tasks.user_id`;
- если пользователь гость - сохранять `tasks.anonymous_session_id`;
- `anonymous_session_id` оставить для гостевого режима.

На будущее можно сделать перенос гостевой истории в аккаунт:

```text
anonymous_sessions.converted_user_id = auth.users.id
# гость зарегистрировался, историю можно связать с аккаунтом
```

Но в v0.6.1 перенос истории не делать.

## Этапы реализации

### v0.6.1 - Guest Mode

Цель: сделать гостевую карточку и anonymous session.

Что сделать:

- создать миграцию `anonymous_sessions`;
- добавить generator `Анонимус #1234`;
- сохранять guest id в localStorage;
- добавить guest card в UI;
- передавать `anonymousSessionId` в `/api/compare`;
- не ломать текущий Prompt Arena.

Оценка: 5-8 часов.

### v0.6.2 - Model Access Levels

Цель: ограничить модели для гостей.

Что сделать:

- добавить `models.access_level`;
- обновить seed моделей;
- `/api/models` фильтрует модели по режиму;
- `/api/compare` проверяет доступ на backend;
- вернуть `403 MODEL_NOT_ALLOWED`, если гость выбирает закрытую модель.

Оценка: 4-6 часов.

### v0.6.3 - Auth SSR

Цель: добавить регистрацию и вход.

Что сделать:

- добавить `@supabase/ssr`;
- создать browser/server clients;
- добавить proxy/cookies session refresh;
- `/auth` login/signup;
- `/auth/callback`;
- logout.

Оценка: 6-10 часов.

### v0.6.4 - Profile MVP

Цель: сделать функциональную страницу профиля.

Что сделать:

- расширить `profiles`;
- сделать `/profile`;
- редактировать имя, фамилию, display name;
- показывать email, role, plan;
- сделать basic profile statistics.

Оценка: 8-12 часов.

### v0.6.5 - Avatar Upload

Цель: фото профиля.

Что сделать:

- создать bucket `avatars`;
- добавить RLS Storage policies;
- upload avatar;
- preview avatar;
- delete/update avatar;
- сохранить `profiles.avatar_url`.

Оценка: 6-10 часов.

### v0.6.6 - Email and Password Management

Цель: управлять email и паролем.

Что сделать:

- change email через Supabase Auth;
- forgot password;
- update password;
- нейтральные сообщения безопасности.

Оценка: 5-8 часов.

### v0.6.7 - User-linked Arena

Цель: связать Prompt Arena с пользователем.

Что сделать:

- `/api/compare` определяет user/guest;
- `tasks.user_id` для аккаунтов;
- `tasks.anonymous_session_id` для гостей;
- profile statistics считает tasks/responses/votes.

Оценка: 5-8 часов.

### v0.6.8 - Testing and Deployment

Цель: проверить, что всё работает.

Команды:

```bash
npm run typecheck
# проверить TypeScript

npm run lint
# проверить ESLint

npm run build
# проверить production build

npm run smoke
# проверить /api/health и /api/models

supabase db reset
# проверить чистый локальный клон миграций

supabase db push
# проверить remote sync
```

Оценка: 6-8 часов.

## Оценка времени

| Этап | Время |
|---|---:|
| Guest Mode | 5-8 часов |
| Model Access Levels | 4-6 часов |
| Auth SSR | 6-10 часов |
| Profile MVP | 8-12 часов |
| Avatar Upload | 6-10 часов |
| Email/Password Management | 5-8 часов |
| User-linked Arena | 5-8 часов |
| Testing and Deployment | 6-8 часов |

Минимально: 45 часов.

Качественно: 55-70 часов.

## Что не делать в первом шаге

В `v0.6.1` не делать:

- полноценную регистрацию;
- Google/GitHub OAuth;
- Storage avatars;
- перенос гостевой истории;
- тарифы;
- платежи;
- Leaderboard.

## Первый task для Codex

```text
Сделай v0.6.1 Guest Mode.

Требования:
1. Создать Supabase migration для таблицы anonymous_sessions.
2. Добавить генератор гостя: Анонимус #1234, avatarSeed, colorSeed.
3. Сохранять anonymousSessionId в localStorage.
4. Добавить гостевую карточку в интерфейс.
5. Передавать anonymousSessionId в /api/compare.
6. /api/compare должен сохранять tasks.anonymous_session_id для гостя.
7. Не ломать текущий Prompt Arena.
8. Не добавлять регистрацию и Storage в этом шаге.
9. После изменений выполнить typecheck, lint, build.
```

## Критерий готовности v0.6.1

Готово, если:

- гость получает карточку `Анонимус #xxxx`;
- карточка сохраняется после перезагрузки страницы;
- задача сохраняется с `anonymous_session_id`;
- `/api/health` остаётся `ok`;
- `npm run typecheck`, `npm run lint`, `npm run build` проходят без ошибок.
