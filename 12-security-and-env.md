# 12 - Security and Environment Variables

## Purpose

This document defines the security rules for the **New Era AI** project.

The goal is to protect:

- OpenRouter API keys;
- Supabase project keys;
- Vercel environment variables;
- local `.env.local` files;
- GitHub repository history;
- user data;
- AI request history;
- votes and leaderboard data;
- future paid limits;
- future Code Arena Runner sandbox;
- future admin panel.

This file must be aligned with:

- `02-project-plan.md`;
- `04-mvp-scope.md`;
- `07-architecture.md`;
- `08-database.md`;
- `09-api-structure.md`;
- `11-ai-models.md`;
- `14-roadmap.md`;
- `16-decisions.md`;
- `17-code-arena-spec.md`;
- `18-team-mode-spec.md`.

`14-roadmap.md` is the main source for version order.

---

# 1. Main Security Principle

Secrets must never be visible in frontend code, browser requests, public logs, GitHub commits, screenshots, documentation examples, or API responses.

Correct flow:

```text
Browser
# user interface only

Next.js API route
# secure backend layer

OpenRouter API
# called only from backend

Supabase
# database protected by RLS and server rules
```

Incorrect flow:

```text
Browser -> OpenRouter directly
# forbidden because the OpenRouter API key would be exposed

Browser -> Supabase service role key
# forbidden because service role bypasses RLS

GitHub -> real .env.local
# forbidden because secrets would be leaked
```

If a secret key was committed, posted, shared, logged, or shown in a screenshot, it must be considered compromised.

Required action after leak:

```text
Revoke old key.
# leaked key must not be reused

Create new key.
# rotate credentials immediately

Update .env.local and Vercel variables.
# replace compromised value everywhere

Check Git history.
# make sure the secret is not still visible
```

---

# 2. What Counts as a Secret

A secret is any value that can spend money, access private data, modify the database, deploy the app, or control infrastructure.

## 2.1 Critical Secrets

```env
OPENROUTER_API_KEY=
# private key for AI model requests, can spend money

SUPABASE_SERVICE_ROLE_KEY=
# private Supabase key, bypasses Row Level Security, server only

DATABASE_URL=
# direct database connection string, server only

VERCEL_TOKEN=
# token for Vercel automation, private

GITHUB_TOKEN=
# token for GitHub automation, private

JWT_SECRET=
# future token signing secret, private

STRIPE_SECRET_KEY=
# future payment secret, private

ADMIN_SECRET=
# optional internal admin secret, private
```

These values must never be exposed to the client.

## 2.2 Public Environment Values

Some values can be public because they do not grant full access by themselves.

```env
NEXT_PUBLIC_SUPABASE_URL=
# public Supabase project URL

NEXT_PUBLIC_SUPABASE_ANON_KEY=
# public Supabase anon key, safe only when RLS is enabled

NEXT_PUBLIC_SITE_URL=
# public site URL

NEXT_PUBLIC_ENABLE_CODE_ARENA=
# public UI flag for Code Arena visibility

NEXT_PUBLIC_ENABLE_TEAM_MODE=
# public UI flag for Team Mode visibility
```

Important rule:

```text
NEXT_PUBLIC_ means visible in browser.
# never put secrets into NEXT_PUBLIC variables
```

---

# 3. Local Environment File

Local development uses `.env.local` in the project root.

Example structure:

```text
new-era-ai/
  .env.local
  .env.example
  package.json
  src/
  docs/
```

## 3.1 Recommended `.env.local`

```env
OPENROUTER_API_KEY=your_openrouter_api_key_here
# server-only OpenRouter API key

NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url_here
# public Supabase URL

NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
# public Supabase anon key

SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
# server-only Supabase service role key

DATABASE_URL=your_database_url_here
# optional direct database URL for migrations and server operations

NEXT_PUBLIC_SITE_URL=http://localhost:3000
# local public site URL

APP_ENV=development
# development, preview, or production

NEXT_PUBLIC_ENABLE_CODE_ARENA=false
# shows or hides Code Arena in UI

ENABLE_CODE_RUNNER=false
# server-side flag for Code Arena Runner, must remain false before v1.7

NEXT_PUBLIC_ENABLE_TEAM_MODE=false
# shows or hides AI Team Mode in UI

ENABLE_TEAM_MODE=false
# server-side flag for AI Team Mode, must remain false before v2.0
```

## 3.2 What Must Not Be Done

```text
Do not commit .env.local.
# real secrets must not enter Git history

Do not send .env.local in chat.
# real secrets must not be shared

Do not paste real keys into Markdown documentation.
# documentation can become public

Do not place real keys in frontend files.
# frontend code is visible to the browser

Do not use NEXT_PUBLIC_ for private keys.
# NEXT_PUBLIC variables are bundled into client code

Do not screenshot pages with visible keys.
# screenshots can leak secrets
```

---

# 4. `.env.example`

The repository should contain `.env.example`, but not `.env.local`.

`.env.example` shows required variable names without real secrets.

Recommended `.env.example`:

```env
OPENROUTER_API_KEY=
# server-only OpenRouter API key

NEXT_PUBLIC_SUPABASE_URL=
# public Supabase URL

NEXT_PUBLIC_SUPABASE_ANON_KEY=
# public Supabase anon key

SUPABASE_SERVICE_ROLE_KEY=
# server-only Supabase service role key

DATABASE_URL=
# optional direct database URL

NEXT_PUBLIC_SITE_URL=http://localhost:3000
# local public site URL

APP_ENV=development
# development, preview, or production

NEXT_PUBLIC_ENABLE_CODE_ARENA=false
# UI flag for Code Arena

ENABLE_CODE_RUNNER=false
# server flag for Code Arena Runner

NEXT_PUBLIC_ENABLE_TEAM_MODE=false
# UI flag for Team Mode

ENABLE_TEAM_MODE=false
# server flag for Team Mode
```

---

# 5. `.gitignore` Rules

The repository must ignore local secrets and temporary files.

Recommended `.gitignore` entries:

```gitignore
.env
# ignore generic env file

.env.local
# ignore local secrets

.env.development.local
# ignore development secrets

.env.test.local
# ignore test secrets

.env.production.local
# ignore production secrets

.vercel
# ignore local Vercel configuration

.next
# ignore Next.js build output

node_modules
# ignore installed dependencies

coverage
# ignore test coverage output

*.log
# ignore logs that may contain sensitive data
```

Check Git before commit:

```bash
git status
# show changed files before commit

git diff --cached
# inspect staged changes before commit
```

---

# 6. Vercel Environment Variables

Vercel must contain the same required environment variables as local development, but values can differ by environment.

Recommended Vercel groups:

```text
Development
# local and development testing

Preview
# pull request and branch deployments

Production
# real public project
```

Rules:

```text
Use separate variables for Production.
# production must not depend on local test values

Do not expose service role key to frontend.
# only API routes can use it

Do not use expensive models by default in Preview.
# preview builds should not waste budget

Keep ENABLE_CODE_RUNNER=false before v1.7.
# Runner is unsafe before sandbox implementation

Keep ENABLE_TEAM_MODE=false before v2.0.
# Team Mode is not part of MVP
```

After changing Vercel variables:

```bash
vercel env pull .env.local
# pull Vercel variables locally if needed

npm run build
# verify that the project builds with current environment variables
```

---

# 7. OpenRouter Security Rules

OpenRouter must be called only from server-side code.

Allowed locations:

```text
src/app/api/arena/route.ts
# server API route for Prompt Arena

src/app/api/models/route.ts
# server API route for allowed models

src/lib/server/openrouter.ts
# server-only OpenRouter helper
```

Forbidden locations:

```text
React components
# client code must not contain API keys

Browser fetch directly to OpenRouter
# exposes usage control and can leak request structure

NEXT_PUBLIC_OPENROUTER_API_KEY
# forbidden variable name, never create it
```

## 7.1 Server-only OpenRouter Helper

Recommended file:

```text
src/lib/server/openrouter.ts
# helper used only by backend routes
```

Security rules:

```text
Read OPENROUTER_API_KEY only on server.
# never pass the key to the client

Use allowlisted model IDs.
# users must not submit arbitrary paid model IDs

Validate prompt length.
# prevent excessive cost and abuse

Set max_tokens.
# prevent uncontrolled output cost

Set timeout.
# avoid hanging requests

Handle provider errors.
# avoid leaking raw internal errors
```

## 7.2 Model Allowlist

Users must not be allowed to send any model ID they want.

Correct approach:

```text
User selects model from UI.
# user sees only allowed options

Backend receives model ID.
# backend does not trust it blindly

Backend checks model ID in database or allowlist.
# only active models are allowed

Backend sends request to OpenRouter.
# safe server-side call
```

Required model fields are defined in `08-database.md` and `11-ai-models.md`.

For MVP, the backend should check:

```text
is_active = true
# model is enabled

is_public = true
# model is visible to normal users

role_tags contains prompt
# model can be used in Prompt Arena

max_output_tokens is controlled
# model cannot produce unlimited output
```

---

# 8. Supabase Security Rules

Supabase security depends on correct key usage and Row Level Security.

## 8.1 Supabase Keys

```text
Anon key
# public, used by frontend, protected by RLS

Service role key
# private, server only, bypasses RLS
```

Critical rule:

```text
SUPABASE_SERVICE_ROLE_KEY must never be used in frontend code.
# it can bypass database protection
```

## 8.2 Row Level Security

RLS must be enabled before real users or private data are stored.

For MVP tables:

```sql
alter table public.models enable row level security;
-- protect model table

alter table public.tasks enable row level security;
-- protect submitted tasks

alter table public.model_responses enable row level security;
-- protect AI responses

alter table public.votes enable row level security;
-- protect voting data
```

For public MVP mode, reading may be open while writing stays controlled through API routes.

Example read policy for active public models:

```sql
create policy "Read active public models"
on public.models
for select
using (
  is_active = true
  and is_public = true
);
-- users can read only active public models
```

Example principle for writes:

```text
Do not allow direct public insert into sensitive tables unless it is intentionally designed.
# prefer API routes for task creation, AI responses, and votes
```

## 8.3 Service Role Usage

Service role may be used only in server-side API routes or trusted backend scripts.

Allowed:

```text
Server API route creates task.
# backend validates input first

Server API route saves AI response.
# backend controls model and output

Server API route calculates aggregate stats.
# backend controls query logic
```

Forbidden:

```text
Client component imports service role key.
# critical leak

Browser request contains service role key.
# critical leak

Public API returns service role key.
# critical leak
```

---

# 9. API Route Security

Every API route must validate input, enforce limits, and return safe errors.

## 9.1 Required API Checks

For `/api/arena`:

```text
Check prompt exists.
# empty prompt must be rejected

Check prompt length.
# long prompts can create high cost

Check selected models.
# only allowed model IDs can be used

Check model count.
# too many models can create high cost

Check request method.
# only POST should create arena requests

Check timeout.
# long-running requests must be controlled

Check response size.
# avoid huge database rows
```

For `/api/vote`:

```text
Check task exists.
# vote must belong to real task

Check response exists.
# vote must target real model response

Check duplicate vote rules.
# prevent simple vote spam

Check IP or user identity later.
# stronger protection after accounts
```

For `/api/history`:

```text
Limit page size.
# prevent heavy database reads

Order by creation date.
# predictable result order

Do not expose private metadata.
# avoid leaking internal data
```

## 9.2 Safe Error Responses

Do not return raw internal errors to the browser.

Bad example:

```text
Database connection failed with full connection string...
# exposes sensitive infrastructure data
```

Good example:

```json
{
  "error": "Request failed. Please try again later."
}
```

Server logs may contain more detail, but must not contain secrets.

---

# 10. Cost Protection

AI requests can spend money. The project must control usage before public launch.

Minimum MVP controls:

```text
Limit prompt length.
# reduce abuse and cost

Limit number of selected models.
# prevent expensive multi-model requests

Use cheap or free models in development.
# protect budget during testing

Set max output tokens.
# prevent expensive long answers

Disable very expensive models by default.
# use them only in special modes later

Log model usage.
# needed for future limits and debugging
```

Recommended MVP values:

```text
Max prompt length: 4000 characters
# enough for MVP tasks without uncontrolled cost

Max selected models: 2 or 3
# enough for comparison mode

Max output tokens per model: 800 to 1500
# enough for readable answers

Request timeout: 45 to 60 seconds
# prevents hanging requests
```

Production values can be adjusted later after real testing.

---

# 11. Rate Limit Strategy

Rate limiting should be introduced in stages.

## 11.1 MVP Soft Limits

Before accounts, use simple controls:

```text
Limit prompt size.
# prevents huge requests

Limit model count.
# prevents expensive requests

Limit repeated vote attempts.
# reduces simple abuse

Limit history page size.
# protects database reads
```

## 11.2 Stronger Limits After Accounts

After `v1.5 - Accounts and Profiles`, add user-based limits:

```text
Daily request limit per user.
# controls cost

Daily vote limit per user.
# protects Leaderboard

Model access by user role.
# separates free, trusted, and admin usage

Usage logs.
# tracks cost and abuse
```

## 11.3 Admin Panel Limits

After `v1.6 - Admin Panel and Limits`, add admin controls:

```text
Enable or disable model.
# control model availability

Set per-model request limit.
# control expensive models

Set global daily budget.
# protect project finances

Review suspicious usage.
# detect abuse
```

---

# 12. Prompt Injection Protection

Prompt injection cannot be fully eliminated, but the project must reduce damage.

Main rules:

```text
Do not put secrets into prompts.
# AI model must never receive API keys

Do not send service role key to AI models.
# critical secret leak

Do not send internal database URLs to AI models.
# infrastructure leak

Do not trust AI output as code execution permission.
# AI output is text, not authority

Separate user prompt from system rules.
# backend controls instruction structure
```

For future Judge Mode:

```text
Judge models must receive only necessary evaluation data.
# avoid leaking extra user data

Judge output must be validated.
# model can produce malformed JSON

Judge must not decide billing or permissions alone.
# backend remains source of truth
```

---

# 13. Logging Rules

Logs are useful, but logs can leak sensitive data.

Allowed logs:

```text
request_id
# useful for debugging

model_id
# useful for cost tracking

status
# success or failed

duration_ms
# performance monitoring

created_at
# timeline debugging

error_type
# safe category of error
```

Dangerous logs:

```text
OPENROUTER_API_KEY
# never log

SUPABASE_SERVICE_ROLE_KEY
# never log

full DATABASE_URL
# never log

full raw headers
# can contain secrets

full cookies
# can contain session data

private user data
# avoid unless necessary and protected
```

For MVP, it is acceptable to log limited prompt metadata, but avoid storing sensitive user text in public logs.

---

# 14. GitHub Security Rules

GitHub repository must never contain real secrets.

Before every important commit:

```bash
git status
# check changed files

git diff
# review unstaged changes

git diff --cached
# review staged changes
```

If `.env.local` appears in Git status:

```bash
git restore --staged .env.local
# remove .env.local from staged files if it was staged by mistake
```

Add `.env.local` to `.gitignore`:

```bash
echo ".env.local" >> .gitignore
# make sure local env file is ignored
```

Do not rely only on `.gitignore` if the file was already committed once. If a secret was committed, rotate the key.

---

# 15. Code Arena Security

Code Arena must be split into two separate stages.

## 15.1 `v1.1 - Code Arena Lite`

Code Arena Lite is allowed before Runner because it does not execute code.

Allowed:

```text
User submits coding task.
# text task only

Models generate code answers.
# AI responses are text

User compares code answers.
# no execution

User votes for best answer.
# comparison only
```

Forbidden in Lite:

```text
Run user code.
# not allowed before Runner

Run AI-generated code.
# not allowed before Runner

Execute tests.
# not allowed before Runner

Use Docker sandbox.
# belongs to Runner stage

Store execution logs.
# belongs to Runner stage
```

## 15.2 `v1.7 - Code Arena Runner`

Runner can only be added after:

```text
v1.5 - Accounts and Profiles
# user identity and ownership

v1.6 - Admin Panel and Limits
# administrative control and usage limits

Security review
# separate review before executing code

Sandbox design
# isolated execution environment
```

Runner must not run on the same simple serverless API route without sandbox control.

Minimum Runner requirements:

```text
Isolated sandbox.
# user code cannot access project secrets

Execution timeout.
# prevents infinite loops

Memory limit.
# prevents resource abuse

CPU limit.
# prevents heavy abuse

Network disabled by default.
# prevents exfiltration and abuse

File system isolation.
# prevents reading server files

Language allowlist.
# only supported languages run

Test case validation.
# tests must be controlled

Execution logs sanitized.
# logs must not leak secrets
```

Important rule:

```text
ENABLE_CODE_RUNNER=false before v1.7.
# do not enable code execution during MVP
```

---

# 16. AI Team Mode Security

AI Team Mode belongs to `v2.0`, not MVP.

Before enabling Team Mode, the project must already have:

```text
Stable Prompt Arena.
# core comparison works

Accounts.
# user identity exists

Limits.
# usage is controlled

Admin panel.
# models can be managed

Cost tracking.
# multi-step mode can be expensive
```

Team Mode risks:

```text
Many model calls per task.
# high cost risk

Long context chains.
# token cost risk

Role confusion.
# model may ignore assigned role

Prompt injection.
# one step can poison later steps

Large stored outputs.
# database growth risk
```

Required controls:

```text
Limit number of rounds.
# control cost

Limit number of roles.
# control complexity

Limit context passed between steps.
# control token usage

Validate final response.
# avoid broken or unsafe output

Keep ENABLE_TEAM_MODE=false before v2.0.
# do not enable early
```

---

# 17. Leaderboard Protection

Leaderboard must not be easy to manipulate.

Minimum protection before public Leaderboard:

```text
Prevent duplicate votes.
# reduce basic abuse

Store vote metadata.
# detect suspicious patterns

Use accounts before serious ranking.
# anonymous votes are weaker

Separate public score from internal score.
# allow moderation and recalculation

Do not let models vote for themselves.
# avoid artificial scoring
```

Advanced protection after accounts:

```text
One vote per user per task.
# fair voting

Suspicious activity detection.
# identify abuse patterns

Admin moderation.
# remove bad tasks or manipulated votes

Weighted judge evaluations.
# combine user votes and judge results later
```

---

# 18. Admin Panel Security

Admin panel belongs to `v1.6`.

Admin panel must not be public by default.

Required controls:

```text
Authentication required.
# only logged-in admin can access

Admin role required.
# normal users cannot access

Server-side permission check.
# UI hiding is not enough

Audit important changes.
# record model and limit changes

Do not expose secrets in admin UI.
# admins can manage without seeing keys
```

Forbidden:

```text
Admin access controlled only by frontend.
# browser checks can be bypassed

Admin secret stored in NEXT_PUBLIC variable.
# public variable leaks secret

Service role key shown in UI.
# critical leak
```

---

# 19. Deployment Security Checklist

Before local development:

```bash
cp .env.example .env.local
# create local env file from safe example

npm install
# install dependencies

npm run dev
# start local development server
```

Before commit:

```bash
git status
# check changed files

git diff
# review local changes

npm run lint
# check code quality

npm run build
# verify production build
```

Before Vercel deployment:

```text
Check Vercel environment variables.
# required variables must exist

Check .env.local is not committed.
# secrets must stay local

Check OpenRouter key is server-only.
# no frontend exposure

Check Supabase RLS.
# database must be protected

Check expensive models are disabled by default.
# budget protection

Check Runner is disabled before v1.7.
# no unsafe execution

Check Team Mode is disabled before v2.0.
# no uncontrolled multi-step cost
```

---

# 20. Security by Version

## `v0.1 - Documentation`

Required:

```text
Security rules documented.
# this file exists

Secrets policy defined.
# keys are not committed

Runner forbidden before v1.7.
# safe roadmap
```

## `v0.2 - Next.js Base`

Required:

```text
.env.example added.
# safe environment template

.env.local ignored.
# real secrets protected

API route structure prepared.
# backend layer exists
```

## `v0.3 - UI MVP`

Required:

```text
No real API keys in frontend.
# UI works without exposing secrets

Mock data does not include secrets.
# safe local testing
```

## `v0.4 - OpenRouter Integration`

Required:

```text
OpenRouter called from backend only.
# key remains secret

Model allowlist exists.
# user cannot select arbitrary models

Prompt and model count are limited.
# cost protection
```

## `v0.5 - Supabase Integration`

Required:

```text
RLS enabled.
# database protection

Service role used only server-side.
# no frontend leak

Public reads are intentional.
# no accidental data exposure
```

## `v0.6 - Voting`

Required:

```text
Votes validated.
# vote must target real response

Duplicate voting considered.
# basic anti-abuse
```

## `v0.7 - History`

Required:

```text
History page is paginated.
# no heavy database reads

Private data is not exposed.
# safe public display
```

## `v0.8 - Deployment`

Required:

```text
Vercel variables configured.
# production can run safely

Production secrets separate from local secrets.
# safer operations
```

## `v0.9 - Stabilization`

Required:

```text
Safe errors.
# no raw internal leaks

Basic logs.
# debugging without secrets

Basic usage limits.
# cost protection
```

## `v1.0 - Stable Prompt Arena`

Required:

```text
Prompt Arena works safely.
# MVP is usable

Secrets are protected.
# no exposed keys

Database writes are controlled.
# stable MVP data flow
```

## `v1.1 - Code Arena Lite`

Required:

```text
No code execution.
# Lite means text-only comparison

Code answers are stored as text.
# no sandbox needed yet
```

## `v1.5 - Accounts and Profiles`

Required:

```text
User ownership added.
# tasks and votes can be tied to user

Per-user limits become possible.
# better cost control
```

## `v1.6 - Admin Panel and Limits`

Required:

```text
Admin role check server-side.
# protected admin actions

Model limits configurable.
# budget and access control
```

## `v1.7 - Code Arena Runner`

Required:

```text
Sandbox ready.
# code execution isolated

Timeouts ready.
# no infinite execution

Resource limits ready.
# no resource abuse

Security review complete.
# final check before code execution
```

## `v2.0 - AI Team Mode`

Required:

```text
Multi-step cost controls.
# Team Mode can be expensive

Role limits.
# prevent uncontrolled chains

Context limits.
# prevent huge token usage
```

---

# 21. Final Rules

The project must follow these final rules:

```text
No secrets in frontend.
# browser must never see private keys

No secrets in GitHub.
# repository must stay safe

No service role in client code.
# Supabase protection depends on this

No arbitrary model IDs from users.
# backend must enforce allowlist

No unlimited prompts.
# cost protection

No unlimited model count.
# cost protection

No Code Arena Runner before v1.7.
# unsafe without sandbox

No AI Team Mode before v2.0.
# too complex and expensive for MVP

No raw internal errors in API responses.
# avoid leaking system details

No public release without checking environment variables.
# deployment must be safe
```

---

# 22. Commit Recommendation

After replacing this file, make a commit:

```bash
git add docs/12-security-and-env.md
# stage updated security and environment documentation

git commit -m "docs: update security and environment rules"
# save the corrected security documentation
```

If the file is located in the project root instead of `docs/`, use:

```bash
git add 12-security-and-env.md
# stage updated security and environment documentation

git commit -m "docs: update security and environment rules"
# save the corrected security documentation
```
