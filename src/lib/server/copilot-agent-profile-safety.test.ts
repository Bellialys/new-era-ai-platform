import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Static metadata test. A real Copilot session and human review are required
// for evidence of actual native task delegation and tool permissions.
const filenames = {
  coordinator: "copilot-coordinator.agent.md",
  architect: "copilot-architect.agent.md",
  security: "copilot-security.agent.md",
  developer: "copilot-developer.agent.md",
} as const;
type Agent = keyof typeof filenames;

function load(role: Agent) {
  const source = readFileSync(
    new URL("../../../.github/agents/" + filenames[role], import.meta.url),
    "utf8"
  );
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match?.[1]) throw new Error("Missing agent frontmatter for " + role);
  const fm = match[1];
  const field = (key: string) => (
    fm.split(/\r?\n/).find(line => line.startsWith(key + ":"))?.slice(key.length + 1).trim() ?? null
  );
  const toolsText = field("tools");
  if (!toolsText || !/^\[[a-z, ]+\]$/.test(toolsText)) {
    throw new Error("Invalid tool allowlist for " + role);
  }
  return {
    source,
    fm,
    name: field("name"),
    description: field("description"),
    target: field("target"),
    tools: toolsText.slice(1, -1).split(",").map(value => value.trim()),
    invocable: field("user-invocable"),
  };
}

describe("Copilot-native agent configuration — static only", () => {
  it.each(Object.keys(filenames) as Agent[])("%s is Copilot-only with explicit tools", role => {
    const p = load(role);
    expect(p.name).toBe("Copilot " + role[0].toUpperCase() + role.slice(1));
    expect(p.target).toBe("github-copilot");
    expect(p.description?.length).toBeGreaterThan(15);
    expect(p.fm).not.toMatch(/^agents:/m);
    expect(p.fm).not.toMatch(/^handoffs:/m);
    expect(p.fm).not.toMatch(/^advancedOptions:/m);
    expect(p.tools).not.toContain("*");
    expect(p.tools.length).toBeGreaterThan(0);
  });

  it("Coordinator can delegate using the Copilot agent tool, not edit or execute", () => {
    const p = load("coordinator");
    expect(p.tools).toEqual(["read", "search", "agent", "todo"]);
    expect(p.invocable).toBe("true");
    expect(p.source).toContain("NOT an enforced allowlist or security boundary");
    expect(p.source).toContain("Manual permissions");
  });

  it.each(["architect", "security"] as Agent[])("%s is read-only and cannot delegate", role => {
    const p = load(role);
    expect(p.tools).toEqual(["read", "search"]);
    expect(p.invocable).toBe("false");
  });

  it("Developer alone has edit and execute, not subagent delegation", () => {
    const p = load("developer");
    expect(p.tools).toEqual(["read", "search", "edit", "execute"]);
    expect(p.tools).not.toContain("agent");
    expect(p.source).toContain("Manual permissions");
  });

  it("maintains an explicit real-Copilot acceptance gate", () => {
    const content = readFileSync(
      new URL("../../../docs/engineering/copilot-harness-migration-20261116.md", import.meta.url),
      "utf8"
    );
    expect(content).toContain("NOT TESTED");
    expect(content).toContain("does not provide an equivalent runtime allowlist");
    expect(content).toContain("issues/158");
  });
});
