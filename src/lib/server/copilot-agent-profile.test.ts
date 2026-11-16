import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Static profile validation only. It does NOT invoke the Copilot harness or
// prove that a runtime enforces the declared tool permissions.
const root = new URL("../../../.github/agents/", import.meta.url);
function agent(slug: string) {
  const source = readFileSync(new URL(slug + ".agent.md", root), "utf8");
  const frontmatter = source.match(/^---\r?\n([\s\S]+?)\r?\n---/);
  if (!frontmatter?.[1]) throw new Error("Missing agent frontmatter for " + slug);
  const entries = frontmatter[1].split(/\r?\n/);
  const get = (key: string): string | undefined => entries.find(line => line.startsWith(key + ":"))
    ?.slice(key.length + 1).trim();
  const tools = get("tools");
  if (!tools || !/^\[[^\[\]]*\]$/.test(tools)) throw new Error("Invalid tools for " + slug);
  return {
    source,
    frontmatter: frontmatter[1],
    name: get("name"),
    description: get("description"),
    target: get("target"),
    tools: tools.slice(1, -1).split(",").map(v => v.trim()),
    userInvocable: get("user-invocable"),
    disableModelInvocation: get("disable-model-invocation"),
    legacyAgents: get("agents"),
    localHandoffs: get("handoffs"),
  };
}

describe("native Copilot harness agent profiles — static contracts", () => {
  const workers = ["copilot-architect", "copilot-security", "copilot-developer"];
  it("declares four unique native Copilot profiles without Local-only metadata", () => {
    const profiles = ["copilot-coordinator", ...workers].map(agent);
    expect(new Set(profiles.map(p => p.name)).size).toBe(4);
    for (const profile of profiles) {
      expect(profile.target).toBe("github-copilot");
      expect(profile.description?.length).toBeGreaterThan(10);
      expect(profile.legacyAgents).toBeUndefined();
      expect(profile.localHandoffs).toBeUndefined();
      expect(profile.frontmatter).not.toContain("runSubagent");
      expect(profile.tools).not.toContain("*");
      expect(profile.tools).not.toContain("agent/runSubagent");
      expect(profile.source).toContain("Manual permissions");
    }
  });

  it("keeps Coordinator non-editing and uses the portable subagent alias", () => {
    const p = agent("copilot-coordinator");
    expect(p.name).toBe("Copilot Coordinator");
    expect(p.tools).toEqual(["read", "search", "agent", "todo"]);
    expect(p.userInvocable).toBe("true");
    expect(p.disableModelInvocation).toBe("true");
    expect(p.source).toContain("Copilot Architect");
    expect(p.source).toContain("Copilot Security");
    expect(p.source).toContain("Copilot Developer");
    expect(p.source).toContain("not a runtime allowlist");
  });

  it.each([
    ["copilot-architect", "Copilot Architect", ["read", "search"]],
    ["copilot-security", "Copilot Security", ["read", "search", "web"]],
  ])("keeps %s read-only and non-delegating", (slug, name, tools) => {
    const p = agent(slug);
    expect(p.name).toBe(name);
    expect(p.tools).toEqual(tools);
    expect(p.tools).not.toContain("edit");
    expect(p.tools).not.toContain("execute");
    expect(p.tools).not.toContain("agent");
    expect(p.userInvocable).toBe("false");
    expect(p.disableModelInvocation).toBe("false");
  });

  it("limits editing and command tools to Developer, with human approval", () => {
    const p = agent("copilot-developer");
    expect(p.name).toBe("Copilot Developer");
    expect(p.tools).toEqual(["read", "search", "edit", "execute"]);
    expect(p.tools).not.toContain("agent");
    expect(p.userInvocable).toBe("false");
    expect(p.disableModelInvocation).toBe("false");
    expect(p.source).toContain("explicitly approved");
    expect(p.source).toContain("production");
  });

  it("preserves the original Local configuration instead of silently converting it", () => {
    for (const name of ["architect", "security", "developer", "coordinator"]) {
      const p = agent(name);
      expect(p.target).toBe("vscode");
      expect(p.legacyAgents).toBeDefined();
    }
  });
});
