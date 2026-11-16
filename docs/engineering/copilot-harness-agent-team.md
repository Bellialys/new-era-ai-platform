# Copilot harness agent team — isolated test candidate (2026-11-16)

## Purpose and compatibility

This is a **native Copilot-harness** engineering team, distinct from the deprecated VS Code Local harness profiles in Draft PR #133 and from the website's end-user AI Team Mode. It is an optional workspace prototype, **not operationally accepted until a real VS Code session succeeds**.

Official references: https://code.visualstudio.com/docs/agents/reference/custom-agent-file-reference and https://code.visualstudio.com/docs/agents/run/subagents and https://code.visualstudio.com/docs/agent-customization/migrate-customizations .

The four new files live in `.github/agents/copilot-*.agent.md` with `target: github-copilot`. The selected **session harness** must also be Copilot; the target field alone does not switch the session.

Copilot uses native `task` for delegation (through the `agent` tools alias). Local's `agents` frontmatter allowlist, Local's `runSubagent` arguments and `handoffs` are **not portable**. Explicitly naming three workers in Coordinator's instructions is a **procedural rule**, not a technical subagent allowlist. Native tool availability and authorization must be checked at runtime.

## Static tool configuration

| File | Tools | User picker | May be invoked by a worker |
| --- | --- | --- | --- |
| `copilot-coordinator.agent.md` | read, search, agent | yes | no |
| `copilot-architect.agent.md` | read, search | no | yes |
| `copilot-security.agent.md` | read, search | no | yes |
| `copilot-developer.agent.md` | read, search, edit, execute | no | yes |

All workers have `user-invocable: false`, but remain task-callable. The Coordinator has `disable-model-invocation: true`. `agents`, `handoffs`, `advancedOptions`, `argument-hint` and `strict-tools-list` have **not** been added: the latter is not reliably forwarded to the Copilot runtime by VS Code. These files are not a substitute for GitHub branch protection or least-privilege cloud credentials.

## Controlled acceptance test — NOT RUN

1. In a trusted local VS Code workspace, check out this Draft feature branch and verify the changed files. Start a **new Copilot harness** session, not Local. Select `NE Copilot Coordinator`.
2. Enable **Manual permissions**, review the available tools in Agent Customizations, deny broad terminal access and ensure no production keys/secrets are available to the session.
3. Submit this read-only prompt (without editing files):

> Проведи только read-only анализ маршрута /api/compare. Используй native task, чтобы независимо вызвать NE Copilot Architect для архитектуры и NE Copilot Security для оценки границ доступа. НЕ вызывай NE Copilot Developer. Не изменяй файлы, не выполняй команды, верни два отдельных отчёта с точными путями файлов и непроверенными допущениями.

4. Inspect the actual `task` calls and worker names in VS Code's Agents window. Confirm that Architect and Security only read/search, neither calls `edit`, `execute` or delegates; and compare outputs with source files.
5. From a trusted terminal **outside the agent**, check `git status --porcelain` remains clean. Record VS Code and Copilot versions, harness, observed tool calls and pass/fail in issue #158. If a tool or worker isn't available, mark BLOCKED instead of claiming success.
6. Only after the read-only gate, authorize a second bounded harmless feature-branch implementation task for Developer, requiring an independent Security post-audit and actual test evidence. No direct `main` push, merge or deploy.

## Release gates / residual risks

- `tools` limits which capabilities the Copilot runtime exposes to agents in that session, but does not isolate the OS, inherited credentials, hidden model behavior or other environments. Confirm actual permissions, GitHub protection and CI policies.
- GitHub branch protection detailed endpoint returned 403 to the connected integration, while rulesets were empty. That does **not** prove branch security is enabled or disabled; a human with settings access must verify required PR reviews, checks, bypass and force-push rules.
- Stage 3.2 KMS/OIDC activation and quota Draft PR #134 are separately gated. This change has no production runtime, database or billing effect.
- The team should not replace the existing Local profiles before an actual Copilot session demonstrates equivalent behavior. The Local harness is slated for removal in February 2027.

## Automated checks

`src/lib/server/copilot-agent-profile-safety.test.ts` checks the Copilot YAML header, tools, picker/invocation flags and absence of deprecated Local-only fields. It does **not** execute the Copilot harness, native task delegation, or manual approvals.
