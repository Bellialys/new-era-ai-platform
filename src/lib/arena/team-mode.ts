// AI Team Mode — role definitions, prompt builders, and orchestrator.
// No network calls, no API keys, no Supabase imports in this file.
// All dependencies that require network/env are injected by the caller (PR19 route).

export const MODE_SLUG_AI_TEAM = "ai-team-mode" as const;
export const TEAM_DEFAULT_MODEL_ID = "google/gemini-flash-1.5";
export const TEAM_RUN_TASK_MIN_LENGTH = 10;
export const TEAM_RUN_TASK_MAX_LENGTH = 4000;
export const TEAM_RUN_RATE_LIMIT_MAX = 3;
export const TEAM_RUN_RATE_LIMIT_WINDOW_MS = 600_000; // 10 min

// Maximum characters from each role output passed as context to the next role.
const TEAM_STEP_CONTEXT_MAX_CHARS = 2000;
const TEAM_ANSWER_FALLBACK = "[No response]";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TeamRoleId = "planner" | "researcher" | "critic" | "finalizer";

export interface TeamRole {
  id: TeamRoleId;
  label: string;
  description: string;
  systemPrompt: string;
}

export interface TeamStepInput {
  task: string;
  role: TeamRole;
  previousSteps: TeamStepResult[];
}

export interface TeamStepResult {
  roleId: TeamRoleId;
  output: string;
  latencyMs: number;
}

export interface TeamRunInput {
  task: string;
  modelId: string;
}

export interface TeamRunResult {
  steps: TeamStepResult[];
  finalAnswer: string;
}

// ---------------------------------------------------------------------------
// Role definitions — fixed order, server-side only, not sourced from user input
// ---------------------------------------------------------------------------

const TEAM_ROLES: readonly TeamRole[] = Object.freeze([
  {
    id: "planner",
    label: "Planner",
    description: "Breaks the task into a structured action plan.",
    systemPrompt:
      "You are a strategic planner. Break the user's task into a clear, numbered action plan. " +
      "Be concise: 5-8 steps maximum. Focus on WHAT to do, not HOW. " +
      "Output only the plan, no preamble.",
  },
  {
    id: "researcher",
    label: "Researcher",
    description: "Expands each plan step with knowledge and analysis.",
    systemPrompt:
      "You are a research analyst. Given a task and its action plan, expand each step with " +
      "relevant knowledge, examples, and analysis. Be thorough but structured. " +
      "Stay within the plan's scope.",
  },
  {
    id: "critic",
    label: "Critic",
    description: "Identifies weaknesses, risks, and missing assumptions.",
    systemPrompt:
      "You are a critical reviewer. Review the plan and research below. " +
      "Identify: (1) logical gaps or missing steps, (2) risks or edge cases, " +
      "(3) assumptions that may not hold. Be constructive, not destructive. " +
      "Output a numbered list of findings.",
  },
  {
    id: "finalizer",
    label: "Finalizer",
    description: "Synthesizes all previous outputs into a final answer.",
    systemPrompt:
      "You are a senior synthesizer. Using the plan, research, and critique below, " +
      "produce a clear, actionable final answer to the original task. " +
      "Incorporate the critique's valid points. Write for a professional audience. " +
      "Output only the final answer.",
  },
] satisfies TeamRole[]);

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

export function getTeamRoles(): readonly TeamRole[] {
  return TEAM_ROLES;
}

export function getTeamRole(roleId: TeamRoleId): TeamRole | null {
  return TEAM_ROLES.find((r) => r.id === roleId) ?? null;
}

// Builds a formatted context block from completed steps for injection into the
// next role's user prompt. Each step's output is truncated to prevent runaway
// context growth. Returns "" when there are no previous steps.
export function buildPreviousStepsContext(steps: TeamStepResult[]): string {
  if (steps.length === 0) return "";

  return steps
    .map((step) => {
      const role = TEAM_ROLES.find((r) => r.id === step.roleId);
      const label = role?.label ?? step.roleId;
      const truncated =
        step.output.length > TEAM_STEP_CONTEXT_MAX_CHARS
          ? step.output.slice(0, TEAM_STEP_CONTEXT_MAX_CHARS) + " [truncated]"
          : step.output;
      return `--- ${label} ---\n${truncated}`;
    })
    .join("\n\n");
}

// Builds the user-facing prompt for a single role step.
// Planner gets the task alone; every subsequent role gets the task + all prior outputs.
export function buildTeamStepPrompt(input: TeamStepInput): string {
  const context = buildPreviousStepsContext(input.previousSteps);
  const parts: string[] = [`Task: ${input.task}`];
  if (context) {
    parts.push(context);
  }
  return parts.join("\n\n");
}

// Trims model output and returns a guaranteed non-empty string.
export function normalizeTeamAnswer(text: string): string {
  const trimmed = text.trim();
  return trimmed.length > 0 ? trimmed : TEAM_ANSWER_FALLBACK;
}

// Runs all four team roles sequentially, passing each role's output as context
// to the next. Uses injected callModel to avoid importing network dependencies.
export async function runTeamMode(
  input: TeamRunInput,
  deps: {
    callModel: (
      prompt: string,
      systemPrompt: string,
      modelId: string
    ) => Promise<string>;
  }
): Promise<TeamRunResult> {
  const roles = getTeamRoles();
  const steps: TeamStepResult[] = [];

  for (const role of roles) {
    const startTime = Date.now();
    const prompt = buildTeamStepPrompt({
      task: input.task,
      role,
      previousSteps: steps,
    });
    const raw = await deps.callModel(prompt, role.systemPrompt, input.modelId);
    const latencyMs = Date.now() - startTime;
    steps.push({ roleId: role.id, output: normalizeTeamAnswer(raw), latencyMs });
  }

  const finalizerStep = steps[steps.length - 1];
  const finalAnswer = finalizerStep?.output ?? normalizeTeamAnswer("");

  return { steps, finalAnswer };
}
