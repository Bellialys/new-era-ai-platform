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
- Code Arena Lite разрешён только как v0.7-режим без запуска пользовательского кода.
- Не добавлять Code Arena Runner раньше v1.7 и без sandbox/security review.
- Не добавлять Judge Mode раньше v1.3, Leaderboard раньше v1.4, AI Team Mode раньше v2.0.

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

`v0.9.0-alpha.1` — Stable Arena Hardening (шаблоны, аналитика, anti-abuse).
`v1.0` — следующий этап: Stable Arena MVP.

Актуальная версия и активные задачи всегда в `.project/state.json`; порядок будущих этапов в `14-roadmap.md`.
