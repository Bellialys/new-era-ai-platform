# Check result - New Era AI Platform

Дата проверки: 08.06.2026

## Что уже сделано в Supabase

Проект Supabase найден и активен.

Project name: Bellialys's Project  
Project ref: jbeecpbcsnowcaygteoj  
Region: eu-west-1  
Database: PostgreSQL 17

## Проверенные таблицы

В схеме public сейчас есть таблицы:

- models
- tasks
- model_responses
- profiles
- votes

## Исправления базы данных

Применена миграция:

20260608041610_align_mvp_tasks_and_votes

Что изменено:

1. В таблицу tasks добавлено поле task_text.
2. Старое поле prompt_text оставлено временно для обратной совместимости.
3. Добавлен триггер синхронизации task_text и prompt_text.
4. Ограничение mode_slug расширено под режимы проекта:
   - prompt-arena
   - code-arena
   - multi-model-battle
   - ai-team-mode
   - judge-mode
   - leaderboard
5. Создана таблица votes.
6. votes связана с tasks через task_id.
7. votes связана с model_responses через model_response_id.
8. Для votes включён RLS.
9. Добавлена policy для service_role.
10. Добавлены индексы для task_id, model_response_id, user_id.
11. Добавлены уникальные ограничения, чтобы один пользователь или одна anonymous session не голосовали несколько раз за один task и vote_type.

## Важное замечание по коду

В документации проекта основное поле должно быть task_text.

Но в существующей базе уже было поле prompt_text, и в таблице были данные. Поэтому prompt_text нельзя было просто удалить без риска сломать старый код.

Правильный следующий шаг:

- постепенно перевести код проекта с prompt_text на task_text;
- после проверки локально и на Vercel можно будет удалить prompt_text отдельной миграцией.

## Environment Variables для Vercel

В Vercel должны быть добавлены переменные:

NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
OPENROUTER_API_KEY

Важно:

- NEXT_PUBLIC_SUPABASE_URL можно использовать на клиенте;
- NEXT_PUBLIC_SUPABASE_ANON_KEY можно использовать на клиенте;
- SUPABASE_SERVICE_ROLE_KEY нельзя использовать на клиенте;
- OPENROUTER_API_KEY нельзя использовать на клиенте;
- секреты нельзя вставлять в код;
- локально секреты должны храниться только в .env.local;
- на Vercel секреты должны храниться только в Environment Variables.

## Команды для проверки локально

npm install # установить зависимости проекта
npm run dev # запустить проект локально
npm run build # проверить сборку перед деплоем

git status # проверить изменённые файлы
git add . # добавить изменения в индекс Git
git commit -m "Prepare MVP integration with Supabase and Vercel" # сохранить важный этап проекта
git push # отправить изменения в GitHub

## Что ещё нужно проверить в GitHub

1. .env.local не должен попасть в репозиторий.
2. .gitignore должен содержать:
   - .env.local
   - node_modules
   - .next
3. В коде не должно быть реальных API-ключей.
4. После проверки нужно сделать commit и push.

## Что ещё нужно проверить в Vercel

1. Проект подключён к правильному GitHub-репозиторию.
2. Environment Variables заполнены.
3. Production build проходит без ошибок.
4. API routes работают после деплоя.
5. Ответы OpenRouter не раскрывают секретные ключи в ошибках.
6. service role key используется только на сервере.

## MVP-сценарий для финальной проверки

1. Пользователь вводит задачу.
2. Пользователь выбирает режим.
3. Система отправляет задачу нескольким AI-моделям через OpenRouter.
4. Ответы сохраняются в Supabase.
5. Ответы отображаются на странице.
6. Пользователь сравнивает ответы.
7. Пользователь голосует за лучший ответ.
8. Голос сохраняется в таблицу votes.
