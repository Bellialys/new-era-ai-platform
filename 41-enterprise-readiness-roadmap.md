# 41 - Enterprise Readiness Roadmap

## Назначение

Этот документ фиксирует путь проекта **Новая эпоха** к international corporate-grade уровню.

Главная идея: международный уровень достигается не количеством функций, а управляемостью продукта:

- понятный release process;
- безопасность by design;
- наблюдаемость production;
- контроль данных и privacy;
- устойчивые операции;
- supply-chain hygiene;
- AI safety и model governance;
- поддержка пользователей и enterprise-пилотов.

Этот документ не заменяет `14-roadmap.md`. Он задаёт критерии зрелости, которые нужно включать в этапы roadmap.

## Принципы

1. Сначала стабильный продукт, потом масштабирование.
2. Любая новая AI-функция должна иметь backend-only execution, лимиты и безопасный error contract.
3. Production не является playground.
4. Документация, код, migrations и project state должны меняться вместе.
5. Compliance readiness строится заранее, сертификация появляется позже.

## Уровни зрелости

| Уровень | Цель | Минимальный результат |
|---|---|---|
| L0 MVP | Функция работает локально/preview | typecheck, lint, build, docs:check |
| L1 Stable MVP | Пользовательский путь стабилен | smoke, QA checklist, rollback notes |
| L2 Production Ready | Можно безопасно пускать первых пользователей | observability, rate limits, env separation, incident process |
| L3 International Ready | Можно вести публичный международный beta/pilot | privacy docs, retention, SLO, support, abuse response |
| L4 Enterprise Ready | Можно обсуждать корпоративные пилоты | audit logs, RBAC, billing/governance, security review, vendor-risk pack |

## v1.1 Enterprise Readiness Foundation

Обязательные результаты:

- SLO baseline для `/`, `/arena`, `/code`, `/api/health`, `/api/models`, `/api/compare`, `/api/code-compare`;
- structured API logs с `requestId`, route, status, duration и safe error code;
- запрет на prompt body, cookies, Authorization headers и secrets в обычных логах;
- incident response template;
- rollback checklist для Vercel deployment и database forward-fix;
- dependency scanning и secret scanning в CI;
- SBOM generation или documented SBOM plan;
- prompt privacy notice: что отправляется AI provider, что хранится, что логируется;
- retention rules для guest sessions, prompts, responses, votes, avatars;
- production readiness checklist в PR/release process.

## v1.6 Enterprise Governance and Billing

Обязательные результаты:

- роли `user`, `admin`, будущие org roles;
- audit log для admin/model/limit changes;
- user/org usage limits;
- paid/premium model governance;
- billing-ready usage accounting;
- admin panel для model catalog и лимитов;
- экспорт основных operational reports;
- documented support workflow.

## Agent Operating Maturity

Качество AI-агентов является частью enterprise readiness. Агент должен оставлять проверяемый след решений, а не только итоговый patch.

| Уровень | Цель | Минимальный результат |
|---|---|---|
| L0 Local Edits | Агент корректно меняет файлы локально | staged diff review, no secrets, docs/code scope понятен |
| L1 Verified Work | Изменения проверены локально | `state:check`, `docs:check`, typecheck/lint/build где применимо |
| L2 Release-safe Workflow | Работа пригодна для preview/release | risk register, rollback/forward-fix note, smoke/schema checks где применимо |
| L3 Operational Evidence | Решение можно сопровождать | request-id/logging/performance/security notes, known unverified checks |
| L4 Enterprise Auditability | Решение можно показывать enterprise reviewer | ADR/decision log, threat model, compliance/privacy notes, CI/deploy evidence |

Agent report для сложных задач должен включать:

- research/best-practice references;
- analysis summary и альтернативы;
- implementation summary по файлам;
- test and verification matrix;
- security, privacy, performance и operations notes;
- commit hashes и CI/push status.

## Standards Alignment

Эти стандарты используются как ориентиры зрелости, а не как обязательная сертификация на ранних этапах:

- OWASP ASVS - application security controls;
- OWASP Top 10 for LLM Applications - AI-specific risks;
- NIST SSDF - secure software development lifecycle;
- SLSA - software supply chain maturity;
- ISO 27001 / SOC 2 readiness - organizational security controls;
- Google SRE practices - SLO, incident response, reliability engineering;
- GDPR / EU AI Act awareness - privacy, transparency, AI governance.

## Release Gate для International Beta

Перед публичным международным beta:

```bash
npm run env:check:full
npm run typecheck
npm run lint
npm run test
npm run test:env-check
npm run docs:check
npm run state:check
npm run build
npm run models:verify
npm run smoke
```

Дополнительно:

- live Supabase migration history сверена с локальными migration filenames;
- preview и production deployment проверены отдельно;
- production smoke проходит по правильному URL;
- rollback deployment id зафиксирован;
- последние изменения не содержат secrets;
- manual QA checklist пройден минимум на desktop и mobile;
- known risks записаны в changelog или release notes.

## Что не делать раньше времени

- Не обещать enterprise/SOC2/GDPR compliance до появления реальных процедур и evidence.
- Не добавлять Code Runner без sandbox, лимитов CPU/RAM/time, egress policy и security review.
- Не копировать production prompts в staging без sanitization.
- Не включать дорогие модели без лимитов и cost visibility.
- Не добавлять публичный leaderboard до owner/privacy rules и abuse controls.

## Документы, которые должны быть усилены

- `27-environments.md` - production/staging/preview separation.
- `30-data-retention-policy.md` - точные retention periods и deletion jobs.
- `33-feature-flags.md` - актуальные флаги или отказ от env-флагов в пользу constants.
- `34-manual-qa-checklist.md` - добавить Code Arena и enterprise beta gate.
- `40-project-health-check.md` - добавить security/supply-chain checks по мере появления.
