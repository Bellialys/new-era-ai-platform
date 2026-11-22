import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type AgentConfig = {
  name: string;
  target: string;
  tools: string[];
  userInvocable: string;
  disableModelInvocation: string;
  keys: string[];
};

function readProfile(file: string): AgentConfig {
  const contents = readFileSync(new URL("../../../.github/agents/" + file + ".agent.md", import.meta.url), "utf8");
  const frontmatter = contents.match(/^---\r?\n([\s\S]+?)\r?\n---/);
  if (!frontmatter?.[1]) throw new Error("Missing Copilot profile header: " + file);
  const fields = frontmatter[1].split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const get = (key: string): string => {
    const field = fields.find(line => line.startsWith(key + ":"));
    if (!field) throw new Error("Missing " + key + ": " + file);
    return field.slice(key.length + 1).trim();
  };
  const rawTools = get("tools");
  if (!/^\[[a-z,\s]+\]$/.test(rawTools)) throw new Error("Unsupported tools list: " + file);
  return {
    name: get("name"), target: get("target"),
    tools: rawTools.slice(1, -1).split(",").map(value => value.trim()).filter(Boolean),
    userInvocable: get("user-invocable"),
    disableModelInvocation: get("disable-model-invocation"),
    keys: fields.map(line => line.split(":")[0]),
  };
}

describe("Copilot harness profiles — static contract only", () => {
  const config = {
    coordinator: readProfile("copilot-coordinator"),
    architect: readProfile("copilot-architect"),
    security: readProfile("copilot-security"),
    developer: readProfile("copilot-developer"),
  };

  it("uses only Copilot-compatible frontmatter; never Local-only agents/handoffs", () => {
    for (const profile of Object.values(config)) {
      expect(profile.target).toBe("github-copilot");
      expect(profile.keys).not.toContain("agents");
      expect(profile.keys).not.toContain("handoffs");
      expect(profile.keys).not.toContain("advancedOptions");
      expect(profile.keys).not.toContain("argument-hint");
    }
  });

  it("rejects unsupported or editor-only fields that would imply unenforced runtime security", () => {
    // VS Code may highlight fields that its Copilot SDK conversion does not
    // actually forward. Avoid pretending those keys enforce a permission rule.
    const explicitlySupported = [
      "name",
      "description",
      "target",
      "tools",
      "user-invocable",
      "disable-model-invocation",
    ].sort();
    for (const profile of Object.values(config)) {
      expect([...profile.keys].sort()).toEqual(explicitlySupported);
      expect(new Set(profile.keys).size).toBe(profile.keys.length);
      expect(profile.tools).not.toContain("*");
    }
  });

  it("gives Coordinator task delegation but no edit or shell and no model-callable role", () => {
    expect(config.coordinator).toMatchObject({
      name: "Copilot Coordinator", userInvocable: "true", disableModelInvocation: "true",
      tools: ["read", "search", "agent", "todo"],
    });
  });

  it.each(["architect", "security"] as const)("makes %s read-only without delegation tools", name => {
    const profile = config[name];
    expect(profile.tools).toEqual(["read", "search"]);
    expect(profile.tools).not.toContain("agent");
    expect(profile.tools).not.toContain("edit");
    expect(profile.tools).not.toContain("execute");
    expect(profile.userInvocable).toBe("false");
    expect(profile.disableModelInvocation).toBe("false");
  });

  it("keeps high-trust commands scoped to a hidden Developer", () => {
    expect(config.developer).toMatchObject({
      name: "Copilot Developer", userInvocable: "false", disableModelInvocation: "false",
      tools: ["read", "search", "edit", "execute"],
    });
    expect(config.coordinator.tools).not.toContain("execute");
  });

  it("states runtime allowlist and real-session acceptance limitations explicitly", () => {
    const guide = readFileSync(new URL("../../../docs/engineering/copilot-harness-agent-team.md", import.meta.url), "utf8");
    expect(guide).toContain("NOT RUN");
    expect(guide).toContain("does not supply a fixed allowed-subagent");
    expect(guide).toContain("Manual permissions");
    expect(guide).toContain("issue #158");
  });
});
