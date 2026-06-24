# SLO Baseline — New Era AI Platform v1.1

## Целевые показатели доступности

| Маршрут | Цель доступности | p95 latency | Примечание |
|---|---|---|---|
| `GET /` | 99.9% | < 500 ms | Static / SSR |
| `GET /arena` | 99.9% | < 500 ms | Static / SSR |
| `GET /code` | 99.9% | < 500 ms | Static / SSR |
| `GET /api/health` | 99.9% | < 300 ms | Включает Supabase ping |
| `GET /api/models` | 99.5% | < 800 ms | Supabase catalog + fallback |
| `POST /api/compare` | 98% | < 45 s | Зависит от OpenRouter latency |
| `POST /api/stream-compare` | 98% | TTFB < 3 s | Streaming: считается по Time-To-First-Byte |
| `POST /api/code-compare` | 98% | < 45 s | Зависит от OpenRouter latency |
| `POST /api/vote` | 99% | < 2 s | Supabase write |
| `GET /api/history` | 99% | < 2 s | Supabase read |

## Мониторинг

- Health check: `GET /api/health` — возвращает `{ status: "ok" }` при полной готовности
- Smoke check: `npm run smoke` — проверяет `/api/health` и `/api/models` из CI и вручную
- Production logs: Vercel Runtime Logs (только errors/warnings)
- Алерты: не настроены на v1.1; запланированы для v1.2

## Деградация и fallback

- Supabase недоступен → `/api/models` переключается на hardcoded fallback (16 моделей)
- OpenRouter недоступен → API возвращает 503 с понятным сообщением пользователю
- Rate limit превышен → 429 с заголовком `Retry-After`

## Плановые downtime

Плановых технических окон нет на v1.1. Vercel rolling deployments обеспечивают zero-downtime деплой.
