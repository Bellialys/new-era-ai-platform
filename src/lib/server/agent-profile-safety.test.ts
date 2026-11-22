import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Static checks only: they do not execute or authorize any VS Code subagent.
// The operational read-only delegation test must be performed in VS Code.
function readAgent(name: string): string {
  return readFileSync(new URL("../../../.github/agents/" + name + ".agent.md", import.meta.url), "utf8");
}

function readFields(name: string) {
  const source = readAgent(name);
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match?.[1]) throw new Error("Missing frontmatter for " + name);
  const lines = match[1].split(/\r?\n/);
  const get = (key: string) => {
    const row = lines.find(line => line.startsWith(key + ":"));
    if (!row) throw new Error("Missing " + key + " for " + name);
    return row.slice(key.length + 1).trim();
  };
  const array = (key: string) => {
    const value = get(key);
    if (!value.startsWith("[") || !value.endsWith("]")) throw new Error("Invalid allowlist " + key);
    return value.slice(1, -1).split(",").map(item => item.trim()).filter(Boolean);
  };
  return {
    name: get("name"),
    target: get("target"),
    tools: array("tools"),
    agents: array("agents"),
    userInvocable: get("user-invocable"),
    disableModelInvocation: get("disable-model-invocation"),
  };
}

describe("Local VS Code agent profiles — static least-privilege contract", () => {
  it("Coordinator delegates to only the three named workers", () => {
    const agent = readFields("coordinator");
    expect(agent.name).toBe("Coordinator");
    expect(agent.target).toBe("vscode");
    expect(agent.tools).toEqual(["read", "search", "agent", "todos"]);
    expect(agent.agents).toEqual(["Architect", "Developer", "Security"]);
    expect(agent.userInvocable).toBe("true");
    expect(agent.disableModelInvocation).toBe("true");
  });

  it.each([["architect", "Architect"], ["security", "Security"]])(
    "keeps %s read-only, non-delegating and not user-invocable",
    (file, displayName) => {
      const agent = readFields(file);
      expect(agent.name).toBe(displayName);
      expect(agent.target).toBe("vscode");
      expect(agent.tools).toContain("read");
      expect(agent.tools).toContain("search");
      expect(agent.tools).not.toContain("edit");
      expect(agent.tools).not.toContain("execute");
      expect(agent.tools).not.toContain("agent");
      expect(agent.agents).toEqual([]);
      expect(agent.userInvocable).toBe("false");
      expect(agent.disableModelInvocation).toBe("false");
    }
  );

  it("reserves write and command tools for a constrained Developer worker", () => {
    const agent = readFields("developer");
    expect(agent.name).toBe("Developer");
    expect(agent.target).toBe("vscode");
    expect(agent.tools).toEqual(["read", "search", "edit", "execute"]);
    expect(agent.agents).toEqual([]);
    expect(agent.userInvocable).toBe("false");
    expect(agent.disableModelInvocation).toBe("false");
    expect(readAgent("developer")).toContain("Manual permissions");
  });

  it("explicitly preserves the operational manual acceptance gate", () => {
    const guide = readFileSync(new URL("../../../docs/engineering/copilot-agent-team.md", import.meta.url), "utf8");
    expect(guide).toContain("## Проверка 16.11.2026");
    expect(guide).toContain("Local harness");
    expect(guide).toContain("Copilot harness");
    expect(guide).toContain("не считать иерархию operational PASS");
  });
});
