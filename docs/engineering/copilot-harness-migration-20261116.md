# Copilot-native agent profiles — migration pilot (16 November 2026)

**State: DRAFT, static CI only. Live VS Code Copilot delegation NOT TESTED.** These files concern the engineering workflow, not the platform's user-facing AI Team Mode.

## Why separate profiles

Legacy Local profiles live in Draft PR #133 with target vscode, Local-only agents allowlists and runSubagent delegation. VS Code has deprecated Local and plans its removal in February 2027. The Copilot harness uses target github-copilot and native task delegation. It **does not support** Local agents allowlists. Merely replacing target would silently break the old assumption about permitted subagent names.

Official docs:
- https://code.visualstudio.com/docs/agents/reference/custom-agent-file-reference
- https://code.visualstudio.com/docs/agents/run/subagents
- https://code.visualstudio.com/docs/agent-customization/migrate-customizations

## Profiles and tool boundaries

| File (.github/agents/) | Name | Tools |
| --- | --- | --- |
| copilot-coordinator.agent.md | Copilot Coordinator | read, search, agent, todo |
| copilot-architect.agent.md | Copilot Architect | read, search |
| copilot-security.agent.md | Copilot Security | read, search |
| copilot-developer.agent.md | Copilot Developer | read, search, edit, execute |

All profiles explicitly set target github-copilot and use supported built-in tool aliases. No file uses Local-only agents or handoffs frontmatter. Copilot Coordinator may request a native task but the harness **does not provide an equivalent runtime allowlist** of specific named worker agents. Delegating only to the three intended workers remains an instruction-level rule, not a security boundary. Tool and resource controls must be verified in a real session.

Workers set user-invocable false but remain available as custom subagents. This field is NOT an authorization control. Copilot Developer is the only profile offered edit/execute, and remains bound by manual approvals, protected branch rules and least-privilege credentials. Never expose production secrets or permit uncontrolled paid OpenRouter calls.

## Manual VS Code acceptance — issue #158

1. Open the actual repository in VS Code. Select the **Copilot harness**, not Local or Codex. Choose VS Code **Manual permissions**, not Allow All or Autopilot. Keep credentials separated and prevent production access to the session.
2. Confirm all four Copilot-prefixed agents are discovered. Choose Copilot Coordinator and send:

> Проведи только read-only аудит маршрута /api/compare. Делегируй Copilot Architect анализ архитектуры, а Copilot Security — независимый анализ границ доверия. Не вызывай Developer, ничего не меняй и не выполняй команды. Верни два отдельных отчёта с путями файлов.

3. Inspect real native task tool invocations and agent names. Require two independent read-only reports and zero Developer calls/edits. Confirm clean Git working tree using your own trusted terminal. A text response claiming delegation is NOT proof.
4. Test a second bounded, harmless task in an isolated branch only after explicit authorization. Confirm Copilot Developer's actual edit/execute approvals and Security's independent diff review. Stop if the agent tries to merge, deploy, access secrets or use extra tools.
5. Verify GitHub Settings → Branches / Rulesets: required PRs and CI, no bypass/direct push/force-push/deletion, human reviews, minimal Actions permissions and restricted deployment environments. The ChatGPT GitHub connector's detailed branch protection API returned HTTP 403 and listed no rulesets; settings are NOT verified from that result.

Attach VS Code and Copilot versions, selected harness, actual task evidence, tool approvals, clean Git status and GitHub protections to https://github.com/Bellialys/new-era-ai-platform/issues/158. Mark each test PASS/FAIL/NOT RUN and leave the profile pilot DRAFT until runtime evidence is reviewed.

## Automated validation

src/lib/server/copilot-agent-profile-safety.test.ts verifies metadata, unique profile names, explicit least-privilege tools, lack of Local-only fields and human-approval documentation. Passing CI does not execute VS Code, guarantee actual subagent selection, prove branch protection or authorize PR #134 quota migrations and production release.
