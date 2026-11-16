import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Static frontmatter assertions only. CI does not execute native Copilot tasks
// or prove real editor tool authorization; issue #158 owns the manual gate.
function readAgent(role: string): string {
  return readFileSync(
    new URL("../../../.github/agents/copilot-" + role + ".agent.md", import.meta.url),
    "utf8",
  );
}

function parseFrontmatter(role: string) {
  const source = readAgent(role);
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match?.[1]) throw new Error("Missing Copilot frontmatter: " + role);
  const lines = match[1].split(/\r?\n/);
  const get = (field: string) => {
    const line = lines.find((entry) => entry.startsWith(field + ":"));
    if (!line) throw new Error("Missing field " + field + " in " + role);
    return line.slice(field.length + 1).trim();
  };
  const tools = get("tools");
  if (!/^\[[a-z, ]+\]$/.test(tools)) throw new Error("Unsafe tool list: " + role);
  return {
    header: match[1],
    name: get("name"),
    description: get("description"),
    target: get("target"),
    tools: tools.slice(1, -1).split(",").map((entry) => entry.trim()),
    visible: get("user-invocable"),
    disabledAsSubagent: get("disable-model-invocation"),
  };
}

describe("Copilot harness engineering workers — static safety contracts", () => {
  it("exposes an orchestration-only coordinator with the native task alias", () => {
    const agent = parseFrontmatter("coordinator");
    expect(agent.name).toBe("NE Copilot Coordinator");
    expect(agent.target).toBe("github-copilot");
    expect(agent.tools).toEqual(["read", "search", "agent"]);
    expect(agent.visible).toBe("true");
    expect(agent.disabledAsSubagent).toBe("true");
    expect(agent.tools).not.toContain("edit");
    expect(agent.tools).not.toContain("execute");
    expect(readAgent("coordinator")).toContain("native task");
  });

  it.each(["architect", "security"])("keeps %s read-only", (role) => {
    const agent = parseFrontmatter(role);
    expect(agent.target).toBe("github-copilot");
    expect(agent.tools).toEqual(["read", "search"]);
    expect(agent.visible).toBe("false");
    expect(agent.disabledAsSubagent).toBe("false");
  });

  it("gives edit/execute only to a hidden, callable Developer", () => {
    const agent = parseFrontmatter("developer");
    expect(agent.target).toBe("github-copilot");
    expect(agent.tools).toEqual(["read", "search", "edit", "execute"]);
    expect(agent.visible).toBe("false");
    expect(agent.disabledAsSubagent).toBe("false");
    expect(readAgent("developer")).toContain("Manual permissions");
  });

  it.each(["coordinator", "architect", "developer", "security"])(
    "keeps %s free of unsupported Local-only metadata and wildcards",
    (role) => {
      const agent = parseFrontmatter(role);
      expect(agent.description.length).toBeGreaterThan(15);
      expect(agent.target).toBe("github-copilot");
      for (const forbidden of [
        "agents", "handoffs", "advancedOptions", "argument-hint", "strict-tools-list",
      ]) {
        expect(
          agent.header.split(/\r?\n/).some((line) => line.startsWith(forbidden + ":")),
        ).toBe(false);
      }
      expect(agent.tools).not.toContain("*");
    },
  );

  it("documents the manual native-task acceptance and lack of worker allowlists", () => {
    const doc = readFileSync(
      new URL("../../../docs/engineering/copilot-harness-agent-team.md", import.meta.url),
      "utf8",
    );
    expect(doc).toContain("NOT RUN");
    expect(doc).toContain("not a technical subagent allowlist");
    expect(doc).toContain("issue #158");
    expect(doc).toContain("February 2027");
    expect(doc).toContain("Manual permissions");
  });
});
