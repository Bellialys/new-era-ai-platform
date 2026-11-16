# Copilot harness — engineering agent team (candidate, 16.11.2026)

This is a **new, separate profile set** for the native VS Code Copilot harness, created without replacing the legacy Local harness agents in PR #133. These agents manage **engineering work in VS Code**; they are not the website's end-user AI Team Mode.

## Why separate profiles
Official reference: https://code.visualstudio.com/docs/agents/reference/custom-agent-file-reference

- Old Local uses `target: vscode`, `tools: [agent]` and a fixed `agents: [...]` allowlist.
- New Copilot uses `target: github-copilot`, the `agent` tool alias for native **task** delegation, and does **not** recognize Local's `agents` field. Using the old allowlist in Copilot would create **false security assurance**.
- We keep both sets under distinct names. Nothing is automatically migrated or enabled in production.

## Candidate profiles (Copilot only)

| Profile file | Picker | Tools | Responsibility |
| --- | --- | --- | --- |
| `.github/agents/copilot-coordinator.agent.md` | Yes | `read, search, agent, todo` | Delegate and summarize, cannot edit or shell |
| `.github/agents/copilot-architect.agent.md` | No | `read, search` | Read-only architecture |
| `.github/agents/copilot-security.agent.md` | No | `read, search` | Read-only independent security |
| `.github/agents/copilot-developer.agent.md` | No | `read, search, edit, execute` | Edit/test only after explicit approval |

Note: `user-invocable: false` hides workers from the picker **but permits subagent invocation**. `disable-model-invocation: true` on Coordinator keeps it out of the pool of callable subagents. A worker has no delegation tool.

## Important unresolved security boundary
The Copilot schema **does not supply a fixed allowed-subagent name list** like Local. Coordinator instructions request exact worker names, but another subagent may still be available to its native `task` tool. This is not an enforceable allowlist. Also, the Developer's `execute` tool can run powerful shell commands; prose cannot prevent action if GitHub/cloud credentials permit it. Require Manual permissions, protected GitHub branches, a restricted shell, no production secrets in agent workspace, and an isolated test environment. Test actual tool grants and invocation history in VS Code.

## Acceptance — must be performed in a live Copilot harness

1. Open the repository in current VS Code, **select Copilot harness** (not Local), select **Manual permissions**, verify active workspace and no credentials in tool environment. Run `git status --short` yourself first.
2. Open Chat Customizations → Agents. Confirm the four Copilot profiles are valid with no frontmatter errors; only `Copilot Coordinator` appears in picker, the three workers are subagent-callable.
3. Select `Copilot Coordinator` and send the following *read-only* prompt:

   > Проанализируй `src/app/api/compare/route.ts` только для чтения. Вызови через native task отдельно **Copilot Architect** для карты исполнения и **Copilot Security** для анализа границ доверия. **Copilot Developer не вызывай**. Ничего не изменяй. Верни отдельные результаты с путями файлов.

4. Inspect **actual** task calls: both named workers ran independently, Architect/Security used read/search only, no shell or edit, Coordinator never invoked Developer, and no external MCP/production actions.
5. Independently verify `git status --short` unchanged. If any unsupported field/tool, missing worker or unexpected subagent appears, record **FAIL**, not assumed success.
6. Only after explicit approval, on a temporary *non-production feature branch* test Developer on an innocuous test-only change. Approve each sensitive tool call one time, then request an independent Security review. **Never merge automatically**.
7. Verify GitHub Settings → Branches/Rulesets for `main` (PR requirement, status checks, review requirements, force-push/deletion/bypass). Current connector cannot read detailed protection (HTTP 403); an empty rulesets list is not evidence of adequate protection.
8. Record VS Code/Copilot versions, selected harness, called workers, tool history, branch/diff, CI and human review in issue #158. Do **not** close the acceptance issue before these observations.

## Release/compatibility gates

- **Status now:** files and static tests only; real native Copilot delegation **NOT RUN**.
- Legacy PR #133 remains Draft. Its Local harness remains usable in supported VS Code until deprecation/removal, but must not be presented as equivalent to Copilot.
- Quota PR #134 still requires gated migration, staging Supabase RLS/auth checks and operational `pg_cron` proof (issue #160). New Copilot profiles do not authorize those operations.
- Sources: https://code.visualstudio.com/docs/agents/run/subagents and https://docs.github.com/en/copilot/reference/custom-agents-configuration
