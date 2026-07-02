# 43 - Web Dev Skills Roadmap

## Purpose

Fix the web-development skills and technologies New Era AI Platform needs now, later, or not at all. The goal is to keep developers and coding agents focused on the current production stack, avoid stack drift, and prevent proposals that replace proven project choices without an explicit architecture decision.

This roadmap is a docs-only companion to the active production stabilization work. It does not pause or replace the current MVP/release-gate plan.

## Current Project Stack

Project stack baseline:

- Next.js App Router
- React
- TypeScript
- Supabase PostgreSQL
- RLS policies
- Vercel
- OpenRouter
- Backend API route handlers
- Zod validation - P1 target gap; current code uses project schema checks and validation helpers until this is adopted
- Project schema validation and env-check pipeline
- GitHub PR workflow
- CI checks
- Automated tests
- Security hardening

Current validation note: this repository currently uses `env-check.config.json`, `scripts/check-env.mjs`, project JSON schemas, and typed validation helpers. `zod` is not present in `package.json`, so Zod validation is tracked below as a P1 required gap rather than confirmed current usage.

## Skill Matrix

Status values are limited to `in use`, `required gap`, `planned`, and `not adopted`.

| Skill | Phase | Priority | Project Area | Why It Matters | Status |
|---|---|---|---|---|---|
| HTML semantics | 1 | P1 | `src/app`, `src/components` | Accessible pages, forms, headings, landmarks, and predictable browser behavior | in use |
| CSS | 1 | P1 | Tailwind CSS, `src/app/globals.css`, components | Production UI styling and responsive layout implementation | in use |
| Responsive design | 1 | P1 | `src/app`, `src/components` | The arena, auth, admin, and history flows must work on mobile and desktop | in use |
| DOM basics | 1 | P1 | Client components and browser events | Required for forms, focus, event handling, and debugging client behavior | in use |
| Accessibility basics | 1 | P1 | Forms, buttons, navigation, result cards | Labels, real buttons, keyboard focus, and minimal ARIA prevent core UX regressions | required gap |
| TypeScript | 2 | P1 | Whole app, `src`, scripts, tests | Maintains API contracts, DTO safety, and refactor safety | in use |
| React components | 2 | P1 | `src/components`, `src/app` | Main UI composition model for arenas, auth, history, and admin screens | in use |
| Next.js App Router | 2 | P1 | `src/app`, `src/app/api` | Production routing, server rendering, API route handlers, and deployment model | in use |
| Client/server components | 2 | P1 | `src/app`, client components | Keeps server-only logic server-side and client interactivity scoped | in use |
| async/await | 3 | P1 | API routes, server libs, tests | Required for provider calls, Supabase operations, and route handlers | in use |
| fetch | 3 | P1 | OpenRouter integration, smoke checks, Upstash REST | Core HTTP client for backend integrations and verification scripts | in use |
| HTTP/HTTPS | 3 | P1 | API contracts, Vercel, OpenRouter, Supabase | Required to reason about backend routes, auth boundaries, and provider failures | in use |
| Status codes 200/400/401/403/404/429/500 | 3 | P1 | `src/app/api`, `28-api-contracts.md` | Clear error contracts for validation, auth, access, rate limits, and failures | in use |
| REST-style API routes | 3 | P1 | `src/app/api/*/route.ts` | Keeps frontend calls behind backend validation, auth, and server-side secrets | in use |
| PostgreSQL | 4 | P1 | Supabase database, migrations, schema checks | Primary relational data model for tasks, responses, votes, profiles, audit, and analytics | in use |
| Supabase client | 4 | P1 | `src/lib/supabase.ts`, `src/lib/server/supabase.ts` | Browser session access and server-side persistence/integration helpers | in use |
| RLS policies | 4 | P1 | Supabase migrations and policies | User data isolation and service-role boundary safety | in use |
| Authentication/Authorization | 5 | P1 | Supabase Auth, proxy/session, API guards | Protects user identity, guest access, admin routes, and Team Mode | in use |
| Zod validation | 5 | P1 | API DTO validation target | The project needs schema-first request/response validation, but Zod is not currently installed | required gap |
| Env variables via `src/env.mjs` or centralized env-check | 5 | P1 | `env-check.config.json`, `scripts/check-env.mjs`, future env module | Prevents invalid env state and blocks unsafe public secrets | required gap |
| Secrets hygiene | 5 | P1 | `.env*`, Vercel env, server-only libs | Prevents service keys and provider tokens from reaching frontend, logs, or docs | in use |
| Rate limiting | 5 | P1 | `src/lib/server/rate-limit.ts`, expensive API routes | Protects OpenRouter, Team Mode, admin, and guest flows from abuse and cost spikes | required gap |
| Automated tests | 6 | P1 | Vitest, server libs, route tests | Protects API contracts, auth/rate-limit behavior, and core business logic | in use |
| Playwright UI/e2e | 6 | P2 | Future UI regression suite | Needed for golden-path browser coverage across arena, history, auth, and Team Mode | planned |
| Git | 7 | P1 | Repository workflow | Required for scoped diffs, branch hygiene, and release evidence | in use |
| GitHub PR workflow | 7 | P1 | GitHub Actions, PR review | Keeps changes reviewable and tied to CI evidence | in use |
| npm | 7 | P1 | `package.json`, scripts, lockfile | Standard task runner and dependency lock for local and CI verification | in use |
| VS Code | 7 | P1 | Developer workflow | Primary editor workflow for TypeScript, docs, and repo navigation | in use |
| Chrome DevTools | 7 | P1 | Browser debugging | Required for UI, network, accessibility, and performance debugging | in use |
| Vercel deployment | 7 | P1 | Preview and Production deploys | Production platform for Next.js runtime, envs, and release smoke | in use |
| Postman/manual API testing | future | P2 | Manual API QA | Useful for route contracts and auth/error checks outside browser UI | planned |
| Advanced SQL indexes | future | P2 | Supabase migrations, query plans | Needed as data volume grows and RLS-sensitive queries get heavier | planned |
| Query optimization | future | P2 | Server data access, Supabase | Reduces latency, provider cost risk, and database load | planned |
| SEO basics | future | P2 | `sitemap.ts`, `robots.ts`, metadata | Keeps public pages discoverable without changing app architecture | required gap |
| Observability/logging | future | P2 | Request IDs, logs, health checks, Vercel | Needed for production debugging, incident response, and SLO evidence | required gap |
| Redis/Upstash production rate limit | future | P2 | V200-02, Vercel env, `rate-limit.ts` | Required to share limits across serverless instances in production | required gap |
| Performance optimization | future | P2 | UI bundle, API latency, DB queries | Needed before scale, larger feature surfaces, and wider production traffic | required gap |
| CSP nonce-based hardening | future | P2 | Security headers, Next.js config | Reduces XSS blast radius beyond baseline static CSP headers | planned |
| Accessibility full audit | future | P2 | UI flows, screen reader pass, ARIA review | Needed to move beyond basics and catch real assistive-tech regressions | required gap |
| Vue | excluded | P3 | - | Replacing React would create stack drift and rewrite risk | not adopted |
| Angular | excluded | P3 | - | Replacing React would create stack drift and rewrite risk | not adopted |
| PHP | excluded | P3 | - | Not part of the current Next.js/TypeScript runtime | not adopted |
| Ruby | excluded | P3 | - | Not part of the current Next.js/TypeScript runtime | not adopted |
| Java | excluded | P3 | - | Not part of the current Next.js/TypeScript runtime | not adopted |
| MySQL | excluded | P3 | Prompt examples only; not project DB | Supabase PostgreSQL is the project database | not adopted |
| MongoDB | excluded | P3 | - | The project is relational and Supabase/PostgreSQL based | not adopted |
| Netlify | excluded | P3 | - | Vercel is the current deployment platform | not adopted |
| jQuery | excluded | P3 | - | React owns UI state and DOM updates | not adopted |
| Bootstrap | excluded | P3 | - | Tailwind CSS is the current styling system unless explicitly replaced | not adopted |

## Agent Guardrails

- Do not propose replacing Next.js/React with Vue/Angular.
- Do not add MongoDB/MySQL when Supabase PostgreSQL is the project database.
- Do not add Bootstrap/jQuery unless explicitly approved.
- Do not bypass `src/env.mjs` if introduced, or the current centralized env-check pipeline.
- Do not weaken RLS/auth/rate-limit rules for convenience.
- Do not introduce new dependencies for docs-only tasks.

## Acceptance Criteria

- This roadmap document is created at the confirmed numbered path.
- All roadmap information is in the single Skill Matrix above, without a duplicated phase or priority list.
- Every Skill Matrix status uses only `in use`, `required gap`, `planned`, or `not adopted`.
- Non-obvious current-stack gaps are marked as `required gap`; future work is marked as `planned` or `required gap` when it is already a production hardening need.
- Agent Guardrails are present.
- The project stack is represented without adopting excluded technologies.
- A task file is created with the confirmed next task number and existing task JSON format.
- The task status reflects real verification state and is not set to `done` until the roadmap, task file, final diff, required checks, and commit/hash requirements are satisfied.
- The final diff stays limited to the roadmap document, task file, and required document-map registration.

## Future Tasks

- UI accessibility full audit.
- Playwright e2e coverage.
- Upstash production rate limit activation.
- CSP nonce hardening.
- Supabase index and query-plan review.
- API documentation.
- Developer learning path by phase as a separate document/table that links to this Skill Matrix instead of duplicating it.
