# 20 - Auth, Guest Mode and Profile Plan

## Назначение файла

Этот документ фиксирует этап **v0.6 - Auth, Guest Mode and Profile** для проекта **Новая эпоха**.

Главная цель этапа - сделать понятную систему доступа:

1. пользователь не может пользоваться функциями платформы как полностью неизвестный посетитель;
2. пользователь должен выбрать один из двух режимов: аккаунт или гостевая карточка;
3. гостевой режим разрешён, но только как управляемая anonymous session с ограничениями;
4. зарегистрированный пользователь получает профиль, историю, фото, email management и будущие расширенные возможности.

## Ключевое правило доступа

```text
Нельзя пользоваться Prompt Arena без user session или anonymous session.
# либо пользователь вошёл в аккаунт, либо нажал "Продолжить как гость" и получил карточку Анонимус #1234
```

Это означает:

- сайт можно открыть без входа;
- публичный лендинг, `/auth`, `/api/health` можно смотреть без входа;
- запуск сравнения моделей нельзя делать как пустой неизвестный пользователь;
- перед запуском Prompt Arena пользователь должен выбрать `Войти / Зарегистрироваться` или `Продолжить как гость`;
- гостевой режим создаёт реальную запись `anonymous_sessions` и получает `anonymousSessionId`;
- `/api/compare` должен принимать запрос только если есть `user_id` или валидный `anonymous_session_id`;
- без обоих вариантов backend должен возвращать `401 AUTH_REQUIRED`.

## Два режима пользователя

| Возможность | Гость | Аккаунт |
|---|---:|---:|
| Открыть сайт | Да | Да |
| Запустить Prompt Arena | Да, после создания guest session | Да |
| Использовать бесплатные модели | Да | Да |
| Использовать registered модели | Нет | Да |
| Использовать premium модели | Нет | Позже по тарифу |
| Постоянная история | Нет | Да |
| Временная история | Да | Да |
| Профиль | Только guest card | Полный профиль |
| Фото профиля | Нет | Да |
| Изменение имени/фамилии | Нет | Да |
| Изменение email | Нет | Да |
| Leaderboard | Ограниченно | Да |

## Access Gate UI

Перед использованием Prompt Arena показать блок выбора режима:

```text
Добро пожаловать в Новую эпоху
Сравнивайте ответы разных AI-моделей

[Войти]
[Создать аккаунт]
[Продолжить как гость]
```

После выбора гостевого режима показывать карточку:

```text
[А]
Анонимус #4827
Гость
Только бесплатные модели
```

Пока режим не выбран:

- поле prompt disabled;
- выбор моделей disabled;
- кнопка запуска disabled;
- текст подсказки: `Сначала войдите или продолжите как гость`.

## Гостевой режим

### Что должен делать гостевой режим

При нажатии `Продолжить как гость` система должна:

1. проверить localStorage на наличие `new-era-anonymous-session-id`;
2. если его нет - создать новую anonymous session через backend;
3. сгенерировать имя вида `Анонимус #4827`;
4. сгенерировать `avatarSeed` и `colorSeed`;
5. сохранить session id в localStorage;
6. показать guest card;
7. разрешить Prompt Arena только с бесплатными моделями.

### localStorage keys

```text
new-era-anonymous-session-id
# UUID гостевой сессии

new-era-anonymous-display-name
# Например: Анонимус #4827

new-era-anonymous-avatar-seed
# seed для аватара

new-era-anonymous-color-seed
# seed для цвета карточки
```

### Таблица anonymous_sessions

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

## Ограничение моделей для гостей

Гости должны использовать только бесплатные модели.

Для этого в таблицу `models` нужно добавить:

```sql
alter table public.models
  add column if not exists access_level text not null default 'anonymous';

alter table public.models
  add constraint models_access_level_check
  check (access_level in ('anonymous', 'registered', 'premium'));
```

Значения:

```text
anonymous
# доступно гостям и аккаунтам

registered
# доступно только вошедшим пользователям

premium
# будущий платный/расширенный доступ
```

Правила backend:

- `/api/models` для гостя отдаёт только `access_level = 'anonymous'`;
- `/api/models` для аккаунта отдаёт `anonymous` и `registered`;
- `/api/compare` повторно проверяет доступ на сервере;
- если гость вручную отправил закрытую модель - вернуть `403 MODEL_NOT_ALLOWED`.

## Регистрация и вход

Использовать Supabase Auth + `@supabase/ssr`.

Нужные страницы:

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

Нужные компоненты:

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

## Профиль пользователя

Страница `/profile` должна быть функциональной, а не просто выводом email.

Поля профиля:

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

Расширение `profiles`:

```sql
alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists avatar_url text,
  add column if not exists role text not null default 'user',
  add column if not exists plan text not null default 'free',
  add column if not exists updated_at timestamptz not null default now();
```

## Фото профиля

Фото хранить в Supabase Storage bucket:

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
- upload/update/delete только владельцу;
- `profiles.avatar_url` обновляется после загрузки.

## Изменение email

Email менять только через Supabase Auth.

Процесс:

1. пользователь вводит новый email;
2. backend вызывает Supabase Auth update email;
3. Supabase отправляет письмо подтверждения;
4. после подтверждения меняется email в Auth;
5. `profiles.email` синхронизируется с Auth.

## Этапы v0.6

### v0.6.1 - Access Gate and Guest Mode

Главный результат: нельзя использовать Prompt Arena без аккаунта или гостевой карточки.

Что сделать:

- добавить Access Gate UI;
- заблокировать prompt/model selection/start button до выбора режима;
- создать `anonymous_sessions` migration;
- добавить backend route создания guest session;
- добавить generator `Анонимус #1234`;
- сохранить guest id в localStorage;
- показать guest card в UI;
- `/api/compare` принимает только `user_id` или валидный `anonymous_session_id`;
- без user/guest возвращать `401 AUTH_REQUIRED`.

Оценка: 6-10 часов.

### v0.6.2 - Model Access Levels

Главный результат: гости используют только бесплатные модели.

Что сделать:

- добавить `models.access_level`;
- обновить seed моделей;
- `/api/models` фильтрует модели по режиму;
- `/api/compare` проверяет доступ на backend.

Оценка: 4-6 часов.

### v0.6.3 - Auth SSR

Главный результат: пользователь может зарегистрироваться, войти и выйти.

Что сделать:

- добавить `@supabase/ssr`;
- создать Supabase browser/server clients;
- добавить proxy/cookies session refresh;
- создать `/auth`;
- создать `/auth/callback`;
- добавить login/signup/logout.

Оценка: 6-10 часов.

### v0.6.4 - Profile MVP

Главный результат: пользователь может управлять профилем.

Что сделать:

- расширить `profiles`;
- сделать `/profile`;
- редактировать имя, фамилию, display name;
- показывать email, role, plan;
- добавить базовую статистику.

Оценка: 8-12 часов.

### v0.6.5 - Avatar Upload

Главный результат: пользователь может загрузить фото профиля.

Что сделать:

- создать bucket `avatars`;
- добавить Storage RLS policies;
- upload avatar;
- preview avatar;
- delete/update avatar;
- сохранить `profiles.avatar_url`.

Оценка: 6-10 часов.

### v0.6.6 - Email and Password Management

Главный результат: безопасное управление email и паролем.

Что сделать:

- change email через Supabase Auth;
- forgot password;
- update password;
- нейтральные сообщения безопасности.

Оценка: 5-8 часов.

### v0.6.7 - User-linked Arena

Главный результат: Prompt Arena понимает user/guest.

Что сделать:

- `/api/compare` определяет user или guest;
- для аккаунта сохраняет `tasks.user_id`;
- для гостя сохраняет `tasks.anonymous_session_id`;
- profile statistics считает tasks/responses/votes.

Оценка: 5-8 часов.

### v0.6.8 - Testing and Deployment

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

## Первый task для Codex

```text
Сделай v0.6.1 Access Gate and Guest Mode.

Требования:
1. Создать Supabase migration для таблицы anonymous_sessions.
2. Добавить backend route для создания/обновления guest session.
3. Добавить генератор гостя: Анонимус #1234, avatarSeed, colorSeed.
4. Сохранять anonymousSessionId в localStorage.
5. Добавить Access Gate UI: нельзя пользоваться Prompt Arena до входа или выбора гостевого режима.
6. Добавить гостевую карточку в интерфейс.
7. Передавать anonymousSessionId в /api/compare.
8. /api/compare должен возвращать 401 AUTH_REQUIRED, если нет user session и нет valid anonymousSessionId.
9. /api/compare должен сохранять tasks.anonymous_session_id для гостя.
10. Не добавлять регистрацию и Storage в этом шаге.
11. Не ломать текущий Prompt Arena и fallback моделей.
12. После изменений выполнить typecheck, lint, build.
```

## Критерий готовности v0.6.1

Готово, если:

- без входа и без гостевой карточки нельзя запустить Prompt Arena;
- при нажатии `Продолжить как гость` появляется карточка `Анонимус #xxxx`;
- карточка сохраняется после перезагрузки страницы;
- гость видит только бесплатные модели после v0.6.2;
- задача гостя сохраняется с `anonymous_session_id`;
- `/api/health` остаётся `ok`;
- `npm run typecheck`, `npm run lint`, `npm run build` проходят без ошибок.
