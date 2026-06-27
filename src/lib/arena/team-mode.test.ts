import { describe, it, expect, vi } from "vitest";
import {
  getTeamRoles,
  getTeamRole,
  buildPreviousStepsContext,
  buildTeamStepPrompt,
  normalizeTeamAnswer,
  runTeamMode,
  type TeamRoleId,
  type TeamStepResult,
} from "./team-mode";

// ---------------------------------------------------------------------------
// Role configuration
// ---------------------------------------------------------------------------

describe("getTeamRoles — role configuration", () => {
  it("returns roles in strict order: planner → researcher → critic → finalizer", () => {
    const ids = getTeamRoles().map((r) => r.id);
    expect(ids).toEqual(["planner", "researcher", "critic", "finalizer"]);
  });

  it("all role IDs are unique", () => {
    const ids = getTeamRoles().map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every role has a non-empty label, description, and systemPrompt", () => {
    for (const role of getTeamRoles()) {
      expect(role.label.trim().length).toBeGreaterThan(0);
      expect(role.description.trim().length).toBeGreaterThan(0);
      expect(role.systemPrompt.trim().length).toBeGreaterThan(0);
    }
  });

  it("returns exactly 4 roles", () => {
    expect(getTeamRoles().length).toBe(4);
  });
});

describe("getTeamRole", () => {
  it("returns the correct config for a valid role ID", () => {
    const planner = getTeamRole("planner");
    expect(planner).not.toBeNull();
    expect(planner?.id).toBe("planner");
    expect(planner?.label).toBeTruthy();
  });

  it("returns config for every defined role ID", () => {
    const roleIds: TeamRoleId[] = ["planner", "researcher", "critic", "finalizer"];
    for (const id of roleIds) {
      expect(getTeamRole(id)).not.toBeNull();
    }
  });

  it("returns null for an unknown role ID without throwing", () => {
    expect(() => getTeamRole("unknown" as TeamRoleId)).not.toThrow();
    expect(getTeamRole("unknown" as TeamRoleId)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Prompt building
// ---------------------------------------------------------------------------

describe("buildPreviousStepsContext", () => {
  it("returns empty string when there are no previous steps", () => {
    expect(buildPreviousStepsContext([])).toBe("");
  });

  it("includes the role label and output for a single step", () => {
    const steps: TeamStepResult[] = [
      { roleId: "planner", output: "step 1 plan", latencyMs: 100 },
    ];
    const ctx = buildPreviousStepsContext(steps);
    expect(ctx).toContain("Planner");
    expect(ctx).toContain("step 1 plan");
  });

  it("preserves role order in the output", () => {
    const steps: TeamStepResult[] = [
      { roleId: "planner", output: "plan", latencyMs: 0 },
      { roleId: "researcher", output: "research", latencyMs: 0 },
    ];
    const ctx = buildPreviousStepsContext(steps);
    expect(ctx.indexOf("Planner")).toBeLessThan(ctx.indexOf("Researcher"));
  });

  it("truncates step output that exceeds 2000 characters and appends [truncated]", () => {
    const longOutput = "x".repeat(2100);
    const steps: TeamStepResult[] = [
      { roleId: "planner", output: longOutput, latencyMs: 0 },
    ];
    const ctx = buildPreviousStepsContext(steps);
    expect(ctx).toContain("[truncated]");
    expect(ctx).not.toContain(longOutput);
  });

  it("does not truncate output that fits within 2000 characters", () => {
    const shortOutput = "short output";
    const steps: TeamStepResult[] = [
      { roleId: "planner", output: shortOutput, latencyMs: 0 },
    ];
    const ctx = buildPreviousStepsContext(steps);
    expect(ctx).not.toContain("[truncated]");
    expect(ctx).toContain(shortOutput);
  });
});

describe("buildTeamStepPrompt", () => {
  it("planner prompt contains original task", () => {
    const role = getTeamRole("planner")!;
    const prompt = buildTeamStepPrompt({ task: "build a rocket", role, previousSteps: [] });
    expect(prompt).toContain("build a rocket");
  });

  it("planner prompt does not include a previous steps context section (no steps yet)", () => {
    const role = getTeamRole("planner")!;
    const prompt = buildTeamStepPrompt({ task: "task", role, previousSteps: [] });
    expect(prompt).not.toContain("---");
  });

  it("researcher prompt contains task and planner output", () => {
    const role = getTeamRole("researcher")!;
    const steps: TeamStepResult[] = [
      { roleId: "planner", output: "planner output here", latencyMs: 0 },
    ];
    const prompt = buildTeamStepPrompt({ task: "my task", role, previousSteps: steps });
    expect(prompt).toContain("my task");
    expect(prompt).toContain("planner output here");
  });

  it("critic prompt contains task, planner output, and researcher output", () => {
    const role = getTeamRole("critic")!;
    const steps: TeamStepResult[] = [
      { roleId: "planner", output: "plan text", latencyMs: 0 },
      { roleId: "researcher", output: "research text", latencyMs: 0 },
    ];
    const prompt = buildTeamStepPrompt({ task: "the task", role, previousSteps: steps });
    expect(prompt).toContain("the task");
    expect(prompt).toContain("plan text");
    expect(prompt).toContain("research text");
  });

  it("finalizer prompt contains task and all 3 previous outputs", () => {
    const role = getTeamRole("finalizer")!;
    const steps: TeamStepResult[] = [
      { roleId: "planner", output: "plan", latencyMs: 0 },
      { roleId: "researcher", output: "research", latencyMs: 0 },
      { roleId: "critic", output: "critique", latencyMs: 0 },
    ];
    const prompt = buildTeamStepPrompt({ task: "final task", role, previousSteps: steps });
    expect(prompt).toContain("final task");
    expect(prompt).toContain("plan");
    expect(prompt).toContain("research");
    expect(prompt).toContain("critique");
  });

  it("handles empty previous steps safely — no crash, no undefined in output", () => {
    const role = getTeamRole("researcher")!;
    let prompt: string;
    expect(() => {
      prompt = buildTeamStepPrompt({ task: "task", role, previousSteps: [] });
    }).not.toThrow();
    expect(prompt!).not.toContain("undefined");
    expect(typeof prompt!).toBe("string");
  });
});

// ---------------------------------------------------------------------------
// Answer normalisation
// ---------------------------------------------------------------------------

describe("normalizeTeamAnswer", () => {
  it("returns trimmed text for a normal answer", () => {
    expect(normalizeTeamAnswer("  hello world  ")).toBe("hello world");
  });

  it("returns a non-empty fallback string for an empty input", () => {
    const result = normalizeTeamAnswer("");
    expect(result.length).toBeGreaterThan(0);
    expect(result).not.toBe("");
  });

  it("returns a non-empty fallback string for whitespace-only input", () => {
    const result = normalizeTeamAnswer("   \n   ");
    expect(result.length).toBeGreaterThan(0);
    expect(typeof result).toBe("string");
  });

  it("returns a string that looks like a stack trace as-is (does not re-throw)", () => {
    const traceText = "Error: something failed\n  at foo (bar.ts:1:2)";
    expect(() => normalizeTeamAnswer(traceText)).not.toThrow();
    expect(normalizeTeamAnswer(traceText)).toBe(traceText.trim());
  });
});

// ---------------------------------------------------------------------------
// runTeamMode orchestration
// ---------------------------------------------------------------------------

describe("runTeamMode", () => {
  it("calls callModel exactly 4 times, once per role", async () => {
    const callModel = vi.fn().mockResolvedValue("output");
    await runTeamMode({ task: "test task", modelId: "test-model" }, { callModel });
    expect(callModel).toHaveBeenCalledTimes(4);
  });

  it("calls roles in strict order: planner, researcher, critic, finalizer", async () => {
    const callModel = vi.fn().mockResolvedValue("output");
    await runTeamMode({ task: "task", modelId: "m" }, { callModel });

    const systemPrompts = callModel.mock.calls.map((call) => (call as string[])[1]);
    expect(systemPrompts[0]).toBe(getTeamRole("planner")!.systemPrompt);
    expect(systemPrompts[1]).toBe(getTeamRole("researcher")!.systemPrompt);
    expect(systemPrompts[2]).toBe(getTeamRole("critic")!.systemPrompt);
    expect(systemPrompts[3]).toBe(getTeamRole("finalizer")!.systemPrompt);
  });

  it("passes each role's output as context to the next role's prompt", async () => {
    const callModel = vi.fn()
      .mockResolvedValueOnce("plan output")
      .mockResolvedValueOnce("research output")
      .mockResolvedValueOnce("critique output")
      .mockResolvedValueOnce("final output");

    await runTeamMode({ task: "the task", modelId: "m" }, { callModel });

    const researcherPrompt = (callModel.mock.calls[1] as string[])[0];
    expect(researcherPrompt).toContain("plan output");

    const criticPrompt = (callModel.mock.calls[2] as string[])[0];
    expect(criticPrompt).toContain("plan output");
    expect(criticPrompt).toContain("research output");

    const finalizerPrompt = (callModel.mock.calls[3] as string[])[0];
    expect(finalizerPrompt).toContain("plan output");
    expect(finalizerPrompt).toContain("research output");
    expect(finalizerPrompt).toContain("critique output");
  });

  it("returns steps array with length 4", async () => {
    const callModel = vi.fn().mockResolvedValue("out");
    const result = await runTeamMode({ task: "t", modelId: "m" }, { callModel });
    expect(result.steps).toHaveLength(4);
  });

  it("finalAnswer equals normalised output of the finalizer step", async () => {
    const callModel = vi.fn()
      .mockResolvedValueOnce("plan")
      .mockResolvedValueOnce("research")
      .mockResolvedValueOnce("critique")
      .mockResolvedValueOnce("  synthesized answer  ");

    const result = await runTeamMode({ task: "t", modelId: "m" }, { callModel });
    expect(result.finalAnswer).toBe("synthesized answer");
    expect(result.steps[3]?.output).toBe("synthesized answer");
  });

  it("rejects with the original error when callModel throws", async () => {
    const callModel = vi.fn().mockRejectedValue(new Error("network timeout"));
    await expect(
      runTeamMode({ task: "t", modelId: "m" }, { callModel })
    ).rejects.toThrow("network timeout");
  });
});

// ---------------------------------------------------------------------------
// Security assertions
// ---------------------------------------------------------------------------

describe("team-mode security invariants", () => {
  it("system prompts are not sourced from user task text", () => {
    const sensitiveTask = "INJECT-XYZ-SECRET-12345";
    for (const role of getTeamRoles()) {
      expect(role.systemPrompt).not.toContain(sensitiveTask);
    }
  });

  it("system prompts do not reference API keys or auth tokens", () => {
    const forbidden = ["OPENROUTER_API_KEY", "sk-or-", "Bearer", "Authorization"];
    const allPrompts = getTeamRoles().map((r) => r.systemPrompt).join(" ");
    for (const term of forbidden) {
      expect(allPrompts).not.toContain(term);
    }
  });

  it("buildPreviousStepsContext only produces headers for steps actually in the array", () => {
    const steps: TeamStepResult[] = [
      { roleId: "planner", output: "plan only", latencyMs: 0 },
    ];
    const ctx = buildPreviousStepsContext(steps);
    expect(ctx).toContain("Planner");
    expect(ctx).not.toContain("Researcher");
    expect(ctx).not.toContain("Critic");
    expect(ctx).not.toContain("Finalizer");
  });

  it("role IDs are the fixed enum values, not sourced from user input", () => {
    const allowedIds: TeamRoleId[] = ["planner", "researcher", "critic", "finalizer"];
    for (const role of getTeamRoles()) {
      expect(allowedIds).toContain(role.id);
    }
  });

  it("callModel receives the modelId from TeamRunInput, not from user prompt content", async () => {
    const callModel = vi.fn().mockResolvedValue("out");
    const task = "my model is evil/injected-model";
    await runTeamMode({ task, modelId: "trusted/model" }, { callModel });

    for (const call of callModel.mock.calls) {
      const modelArg = (call as string[])[2];
      expect(modelArg).toBe("trusted/model");
      expect(modelArg).not.toBe("evil/injected-model");
    }
  });
});
