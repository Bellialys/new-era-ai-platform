# CLAUDE.md

Этот файл читается Claude автоматически при открытии проекта.

## Проект

**Новая эпоха** — AI-платформа для сравнения нескольких AI-моделей по одному запросу (Prompt Arena).

Стек: **Next.js 16 / TypeScript / Tailwind CSS / Supabase / OpenRouter**

## Правила и документы

Перед любой работой читать обязательно:

1. **`AGENTS.md`** — текущий статус проекта, главные правила, архитектура.
2. **`24-codex-active-rule-set.md`** — полный индекс действующих правил и алгоритм работы.
3. **`14-roadmap.md`** — порядок этапов разработки (главный источник истины по версиям).

## Ключевые ограничения

- Не вызывать OpenRouter напрямую из frontend — только через backend route handlers.
- Не коммитить `.env.local` и секретные ключи.
- Code Arena Lite завершён; текущий v1.7 добавляет запуск кода только через внешний runner для авторизованных пользователей.
- Не запускать пользовательский код внутри server-side процесса приложения и не обходить auth/rate limit для `/api/code-run`.
- AI Team Mode не добавлять раньше v2.0; Image Arena не добавлять раньше v1.8 и без отдельного storage/safety review.

## Команды

```bash
npm run typecheck   # TypeScript
npm run lint        # ESLint
npm run build       # production-сборка
npm run smoke       # health/models smoke-check
npm run verify    # все четыре проверки последовательно
```

Выполнять `npm run verify` перед каждым коммитом (или все четыре по отдельности).

## Текущая фаза

`v1.0.0` — Stable Arena MVP (текущий стабильный релиз).
`v1.7.0-alpha.1` — текущий alpha-этап: Code Arena Runner.

Актуальная версия и активные задачи всегда в `.project/state.json`; порядок будущих этапов в `14-roadmap.md`.
