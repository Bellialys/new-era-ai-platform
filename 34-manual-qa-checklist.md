# 34. Manual QA Checklist

## 1. Purpose

This document defines the manual QA checklist for the New Era AI Platform.

The checklist is used before closing an important development stage, before accepting a Codex task, before deploying to Vercel, and after changes that can affect Prompt Arena, guest mode, model catalog, database access, API routes, feature flags, or UI layout.

The goal is simple: the stage is not done until the product still works.

## 2. QA severity levels

| Level | Meaning | Blocks release? | Action |
| :--- | :--- | :--- | :--- |
| P0 - Smoke | Site availability, API health, critical path | Yes | Abort immediately and fix first |
| P1 - Core Flow | Main user journey from entry to result | Yes | Fix before accepting the stage |
| P2 - Polish / Regression | Mobile, accessibility, performance, edge cases | No, unless severe | Create bug and decide priority |

Rules:

- Any P0 failure blocks the stage.
- Any P1 failure blocks the stage.
- P2 failures do not always block the stage, but must be documented.
- Security and data ownership failures are always treated as P0 or P1, depending on impact.

## 3. Pre-flight checklist

Before manual testing, verify the environment.

- [ ] The latest code is deployed or running locally.
- [ ] The correct environment is selected: local, preview, staging, or production.
- [ ] Required environment variables are configured.
- [ ] Public variables use only safe `NEXT_PUBLIC_*` values.
- [ ] Server-only secrets are not exposed in frontend code.
- [ ] Supabase project URL and keys are configured correctly.
- [ ] AI provider key is configured only in server-side environment.
- [ ] Database migrations are applied.
- [ ] Feature flags are set to the intended values.
- [ ] Build finished without errors.
- [ ] No temporary debug UI is visible.

Expected result:

The test environment is ready and matches the feature state that must be verified.

## 4. Required viewport matrix

Manual UI checks should use these viewports.

| Device type | Viewport | Required checks |
| :--- | :--- | :--- |
| Desktop | 1440x900 | Full layout, header, Prompt Arena, model list, response layout |
| Tablet | 768x1024 | Model grid, touch targets, modal or gate layout |
| Mobile portrait | 375x812 | Prompt input, scroll, submit button, result stacking |
| Mobile landscape | 812x375 | Header, prompt input, no broken horizontal layout |

Minimum rule:

- For every important UI change, verify desktop and mobile portrait.
- For layout-heavy changes, verify all four viewports.

## 5. P0 - Smoke tests

P0 checks are mandatory. If any P0 check fails, stop and fix before continuing.

### 5.1 Site load

- [ ] `GET /` returns 200.
- [ ] The site opens without a blank page.
- [ ] The main JavaScript and CSS assets load without 404 errors.
- [ ] The page title or main heading clearly identifies the platform or Prompt Arena.
- [ ] There are no critical console errors.

Visual checkpoint:

- Desktop 1440x900: header, main content area, prompt area or entry area are visible.
- Mobile 375x812: no horizontal scroll, main action remains reachable.

Expected result:

The application is reachable and renders the main UI.

### 5.2 API health

- [ ] `GET /api/health` returns 200.
- [ ] Response confirms API status is OK.
- [ ] Response does not expose secrets.
- [ ] If database status is included, it is safe and readable.
- [ ] If version or commit is included, it matches the deployed version.

Expected safe response example:

`{"status":"ok","db":"connected","version":"x.y.z"}`

Expected result:

The backend API layer is alive.

### 5.3 Prompt Arena renders

- [ ] Prompt Arena is visible.
- [ ] Prompt input field is visible and active.
- [ ] Main submit button is visible.
- [ ] Model selection area is visible.
- [ ] The UI does not crash if model loading is delayed.

Visual checkpoint:

- Desktop 1440x900: visible input field, Compare button, and model list with at least 2 items when models are available.
- Mobile 375x812: input and submit button are reachable without broken layout.

Expected result:

The user can start the main MVP flow.

### 5.4 Model catalog load

- [ ] `GET /api/models` returns 200.
- [ ] Response contains a non-empty array when models are configured.
- [ ] Only active models are shown as selectable.
- [ ] Model display names are readable.
- [ ] Provider names or icons are shown if the UI supports them.
- [ ] If Supabase is unavailable, fallback models work if fallback is enabled.

Visual checkpoint:

- Model dropdown or model cards show at least 2 models.
- Disabled or unavailable models are not shown as normal selectable models.

Expected result:

The user can select models for comparison.

### 5.5 Critical prompt submission

- [ ] User can enter a prompt.
- [ ] User can select the required number of models.
- [ ] User can submit the prompt.
- [ ] Loading state appears after submission.
- [ ] At least one response or a clear error is shown.
- [ ] Failed model response does not break the whole page.

Visual checkpoint:

- After clicking Compare, the user sees a loader, progress state, result block, or understandable error.

Expected result:

The critical path works: prompt input -> model selection -> submit -> result or clear error.

## 6. P1 - Core user journey

P1 checks verify that the product is usable, not only alive.

### 6.1 Guest mode

- [ ] Guest mode can be started without login.
- [ ] Guest session is created correctly.
- [ ] Guest user receives a visible anonymous name.
- [ ] Anonymous display name follows the format `Анонимус #xxxx`.
- [ ] Guest mode does not expose account-only functionality.
- [ ] Guest session survives normal page navigation if this is expected by the current MVP.

Visual checkpoint:

- User identity area shows `Анонимус #xxxx` or equivalent guest identity.
- Continue as Guest button is visible and clickable when Access Gate is shown.

Expected result:

A guest user can use allowed MVP functionality without registration.

### 6.2 Access Gate

- [ ] Access Gate appears only when needed.
- [ ] Access Gate text is understandable.
- [ ] Guest access is not blocked for allowed public functionality.
- [ ] Restricted account-only functionality is blocked correctly.
- [ ] Disabled features do not appear as fully available.

Visual checkpoint:

- Access Gate shows clear actions: continue as guest, login, or restricted feature explanation.

Expected result:

The user understands what is available and what requires authorization.

### 6.3 Anonymous comparison task

- [ ] Guest selects allowed models.
- [ ] Guest enters a prompt.
- [ ] Guest clicks Compare.
- [ ] API returns success or clear model/provider error.
- [ ] Results appear in the UI.
- [ ] Responses are connected to the correct models.

Database checkpoint if database access is available:

- [ ] Task has `anonymous_session_id`.
- [ ] Task has `user_id = NULL`.
- [ ] Model responses are linked to the task.

Expected result:

Anonymous comparison works and data ownership is correct.

### 6.4 Voting

Use this block when voting is enabled by feature flags.

- [ ] Vote buttons appear after model responses.
- [ ] User can vote for one response.
- [ ] Vote API returns 200.
- [ ] Repeated vote is idempotent or updates according to product policy.
- [ ] UI shows the selected vote state.
- [ ] Vote is linked to the correct task and model response.

Expected result:

Voting works without double-counting or wrong ownership.

### 6.5 History

Use this block when history is enabled by feature flags.

- [ ] History API returns 200 for the current user or guest.
- [ ] History shows only current owner data.
- [ ] Items are sorted by `created_at DESC`.
- [ ] Pagination or cursor works if there are many tasks.
- [ ] Opening a history item shows saved prompt and responses.

Expected result:

History is correct, private, and navigable.

### 6.6 Login and guest merge

Use this block when authentication and merge are implemented.

- [ ] User creates several tasks as guest.
- [ ] User logs in.
- [ ] Guest history is still visible after login.
- [ ] Old guest tasks receive `user_id`.
- [ ] Old guest tasks receive `anonymous_session_id = NULL` if this is the selected ownership policy.
- [ ] No duplicate tasks are created during merge.

Expected result:

Guest work is preserved and correctly claimed by the user account.

## 7. P1 - Error handling

Errors must be understandable and safe.

### 7.1 Validation errors

- [ ] Empty prompt is rejected.
- [ ] Too long prompt is rejected or clearly limited.
- [ ] Invalid model ID is rejected.
- [ ] API returns a structured validation error.
- [ ] UI shows inline error near the relevant field.
- [ ] UI does not show stack traces.

Expected result:

The user understands what to fix.

### 7.2 Authorization errors

- [ ] Guest cannot use pro-only models.
- [ ] Guest receives `403 MODEL_NOT_ALLOWED` or equivalent policy error.
- [ ] UI disables unavailable models or shows a clear upgrade/auth message.
- [ ] Account-only routes require authentication.

Expected result:

Access control is enforced both in UI and API.

### 7.3 Rate limit errors

- [ ] Rapid guest requests eventually return 429 if rate limiting is enabled.
- [ ] Response includes safe retry information if available.
- [ ] UI shows a clear wait message.
- [ ] The user can retry after the reset period.

Expected result:

Rate limits protect the system and remain understandable.

### 7.4 Server errors

- [ ] Provider failure does not crash the page.
- [ ] Database failure does not expose secrets.
- [ ] Error response includes `request_id`.
- [ ] UI shows a general safe message.
- [ ] Logs contain enough data for debugging without exposing secrets.

Expected result:

Server failures degrade safely.

## 8. API validators

These checks are used manually through browser, Postman, curl, or future scripts.

| Check | Method | Expected result | Status |
| :--- | :--- | :--- | :--- |
| Health | `GET /api/health` | 200, status ok | Required now |
| Models | `GET /api/models` | 200, non-empty active model array | Required now |
| Compare happy path | `POST /api/compare` | 200, task or comparison ID | When implemented |
| Compare guest with restricted model | `POST /api/compare` | 403, MODEL_NOT_ALLOWED | When access levels exist |
| Vote | `POST /api/vote` | 200, idempotent behavior | When voting enabled |
| History | `GET /api/history?cursor=...` | 200, paginated owner-only data | When history enabled |

Expected result:

API behavior matches the contracts and does not expose unsafe data.

## 9. P2 - Mobile and responsive UI

P2 mobile issues can become P1 if the main flow becomes unusable.

### 9.1 Mobile portrait

- [ ] Prompt input remains usable.
- [ ] Submit button remains visible or reachable.
- [ ] On-screen keyboard does not permanently hide the input.
- [ ] Model selection is readable.
- [ ] Response blocks stack vertically if side-by-side is too narrow.
- [ ] There is no unwanted horizontal scroll.

Visual checkpoint:

- Mobile 375x812: the user can enter prompt, select models, submit, and read the response.

### 9.2 Mobile landscape

- [ ] Header does not take the entire screen.
- [ ] Main controls remain reachable.
- [ ] No important button is hidden outside the viewport.
- [ ] Layout does not overlap.

Visual checkpoint:

- Mobile landscape 812x375: header, input, and main action remain usable.

### 9.3 Tablet

- [ ] Model grid or selector does not collapse incorrectly.
- [ ] Cards have readable width.
- [ ] Touch targets are comfortable.
- [ ] Modals and gates fit the viewport.

Expected result:

The product remains usable on common device sizes.

## 10. P2 - Accessibility

Accessibility is checked manually and later can be automated partly through Lighthouse.

- [ ] Tab navigation works from Access Gate to model selection, prompt input, Compare button, result area, and Vote button.
- [ ] Focus indicators are visible.
- [ ] Compare and Vote buttons have accessible names.
- [ ] Form inputs have labels or accessible labels.
- [ ] Error messages are connected to relevant inputs where possible.
- [ ] Main text contrast is at least WCAG AA target, usually 4.5:1.
- [ ] Model list is announced as a list or clear group, not as unrelated text.

Expected result:

The core flow can be used without a mouse and is understandable for assistive technologies.

## 11. P2 - Performance budget

These targets are initial MVP budgets. They can be tightened later.

| Metric | Budget | How to check |
| :--- | :--- | :--- |
| First Contentful Paint | < 1.5s | Lighthouse |
| Largest Contentful Paint | < 2.5s | Lighthouse |
| Time to Interactive | < 3.5s | Lighthouse |
| Lighthouse Performance | >= 75 mobile | Lighthouse CI or DevTools |
| Lighthouse Accessibility | >= 90 | Lighthouse CI or DevTools |
| `/api/models` response time | < 300-500ms | browser network, logs |
| `/api/compare` first response or streaming start | < 2s when streaming exists | browser network |
| `/api/compare` full response | < 10s P95 target | monitoring |

Expected result:

The MVP feels responsive enough for real testing.

## 12. Data ownership and retention checks

Use this section when the related database logic exists.

### 12.1 Ownership

- [ ] Guest-created tasks are linked to `anonymous_session_id`.
- [ ] Authenticated user tasks are linked to `user_id`.
- [ ] Guest cannot see another guest session history.
- [ ] User A cannot see User B history.
- [ ] Direct API access to another owner's task returns 403 or 404.
- [ ] RLS policies protect tables in Supabase.

Expected result:

Data is visible only to the correct owner.

### 12.2 Retention

- [ ] Guest tasks older than the configured retention period are absent from normal history.
- [ ] Guest anonymous sessions are cleaned according to retention policy.
- [ ] Deleted account uses `deleted_at` or selected deletion policy.
- [ ] Grace period works if configured.
- [ ] Logs do not retain secrets or unnecessary personal data.

Expected result:

Data lifecycle follows the retention policy.

Related documents:

- `29-database-ownership.md`, if present.
- `30-data-retention-policy.md`.

## 13. Security spot checks

- [ ] Browser DevTools must not show server-only secrets.
- [ ] Frontend bundle must not include server-only environment values.
- [ ] Authorization data must not be printed into UI.
- [ ] Error messages must not expose internal stack traces to users.
- [ ] Prompt text must not be logged in a way that violates the logging policy.
- [ ] Unsafe user input must be displayed as text, not executed as markup.
- [ ] Unexpected query input must not break API routes.
- [ ] Logout clears the active session if authentication exists.

Expected result:

The app does not leak secrets and does not expose user data through obvious paths.

## 14. Regression Shield

Use this section whenever a new feature, model, endpoint, or UI area is added.

### 14.1 New model regression

- [ ] New model exists in the model catalog.
- [ ] `model_key` is unique.
- [ ] Provider is correct.
- [ ] Display name is readable.
- [ ] Access level is correct.
- [ ] Free or paid status is correct.
- [ ] Active or inactive status works.
- [ ] Guest sees only allowed public models.
- [ ] Pro or authenticated user sees the expected models.
- [ ] Fallback works if the model is unavailable.
- [ ] Golden prompts pass basic baseline checks.

### 14.2 New API endpoint regression

- [ ] Endpoint is documented in API contracts.
- [ ] Request validation exists.
- [ ] Error format is structured.
- [ ] Access control is checked server-side.
- [ ] Response does not expose secrets.
- [ ] UI handles success, loading, empty, and error states.

### 14.3 New UI feature regression

- [ ] Feature respects feature flags.
- [ ] Feature is hidden or disabled when flag is off.
- [ ] Existing Prompt Arena flow still works.
- [ ] Existing model loading still works.
- [ ] Mobile layout still works.
- [ ] Error handling still works.

Expected result:

New work does not break old working behavior.

## 15. Screenshot verification rules

Screenshots are required when manual checking is done visually or through ChatGPT review.

Required screenshot set for a full QA pass:

- [ ] Home page opened.
- [ ] Prompt Arena visible.
- [ ] Access Gate state if enabled.
- [ ] Guest mode with `Анонимус #xxxx`.
- [ ] Model list loaded.
- [ ] Prompt submitted.
- [ ] Response or error displayed.
- [ ] Desktop 1440x900.
- [ ] Mobile 375x812.
- [ ] `/api/health` result.

Recommended screenshot naming:

- `qa-YYYY-MM-DD-desktop-home.png`
- `qa-YYYY-MM-DD-desktop-prompt-arena.png`
- `qa-YYYY-MM-DD-mobile-prompt-arena.png`
- `qa-YYYY-MM-DD-guest-session.png`
- `qa-YYYY-MM-DD-api-health.png`
- `qa-YYYY-MM-DD-error-state.png`

Expected result:

Screenshots prove that the main MVP flow was checked and can be compared later.

## 16. Abort and rollback criteria

If any item below happens, the stage is not accepted.

- [ ] Any P0 check fails.
- [ ] Site does not open.
- [ ] `/api/health` fails.
- [ ] Prompt Arena does not render.
- [ ] Models do not load and fallback does not work.
- [ ] Prompt cannot be submitted.
- [ ] Server error on `/api/compare` in 2 or more consecutive attempts.
- [ ] Guest mode is broken when guest mode is enabled.
- [ ] Access Gate blocks allowed guest usage.
- [ ] Guest sees another user's or another guest's history.
- [ ] User A sees User B data.
- [ ] Mobile UI makes it impossible to submit prompt or vote.
- [ ] Server error response has no `request_id`.
- [ ] Server-only secret appears in frontend.
- [ ] Lighthouse Performance is below 50 on mobile after a UI change.

Rollback rule:

If production is affected by any abort criterion, revert the last risky change or disable the feature through feature flags.

## 17. Manual QA report template

Use this template after each important stage.

```markdown
# Manual QA Report

Date:
Environment:
Version or commit:
Tester:
Feature flags:

Overall result: PASS / FAIL

## Checked items

- Site opens:
- `/api/health`:
- `/api/models`:
- Prompt Arena:
- Access Gate:
- Guest mode:
- Models loading:
- Prompt sending:
- Voting:
- History:
- Error handling:
- Mobile layout:
- Accessibility quick check:
- Performance quick check:
- Security spot check:

## Found issues

1. Severity:
   Area:
   Steps:
   Expected:
   Actual:
   Screenshot:
   Request ID:

2. Severity:
   Area:
   Steps:
   Expected:
   Actual:
   Screenshot:
   Request ID:

## Final decision

The stage is ready / not ready for completion.
```

## 18. Future automation

These checks should be automated gradually after the MVP is stable.

| Check | Tool | Suggested frequency |
| :--- | :--- | :--- |
| P0 API smoke | shell script with safe HTTP checks | Every stage |
| Screenshot diff | Playwright screenshots | Every deployment preview |
| Lighthouse | Lighthouse CI | Every stage or PR |
| API contract | Contract tests or custom tests | Every API change |
| Dead links | link checker | Documentation changes |
| Console errors | Playwright page errors | Every UI change |

Initial automation tasks:

- [ ] Create `scripts/qa-smoke.sh` for P0 checks.
- [ ] Add Playwright screenshots for desktop and mobile.
- [ ] Add Lighthouse CI budget.
- [ ] Store QA screenshots as CI artifacts.
- [ ] Add `qa-verified` label or PR checklist before merge.
- [ ] Add Regression Shield section to PR descriptions.

## 19. Rule for Codex

Codex must not mark a task as completed until this checklist is reviewed.

Codex final report must include:

- what was changed;
- what was checked;
- what was not checked;
- build, lint, typecheck status if available;
- API smoke status if available;
- screenshots or visual verification if UI changed;
- known remaining issues.

If manual verification is impossible, Codex must clearly say what was not checked and why.

## 20. Related documents

- `25-definition-of-done.md`
- `28-api-contracts.md`
- `29-database-ownership.md`, if present
- `30-data-retention-policy.md`
- `32-model-catalog-governance.md`
- `33-feature-flags.md`
