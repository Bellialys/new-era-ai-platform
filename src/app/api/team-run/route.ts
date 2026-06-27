import { NextRequest, NextResponse } from "next/server";
import {
  resolveRequestIdentity,
  checkRateLimit,
  fetchOpenRouterResponse,
  saveArenaRun,
  logApiRequest,
  ApiError,
} from "@/lib/server";
import {
  runTeamMode,
  getTeamRole,
  MODE_SLUG_AI_TEAM,
  TEAM_DEFAULT_MODEL_ID,
  TEAM_RUN_TASK_MIN_LENGTH,
  TEAM_RUN_TASK_MAX_LENGTH,
  TEAM_RUN_RATE_LIMIT_MAX,
  TEAM_RUN_RATE_LIMIT_WINDOW_MS,
} from "@/lib/arena/team-mode";

// 4 sequential LLM calls — allow up to 60s.
export const maxDuration = 60;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

  try {
    // Auth — team mode requires a full user account, not a guest session.
    const identity = await resolveRequestIdentity(request);
    if (identity.kind !== "user") {
      logApiRequest("POST", "/api/team-run", 401, Date.now() - startTime, requestId);
      return NextResponse.json(
        {
          status: "error",
          errorCode: "AUTH_REQUIRED",
          message: "Sign in to use AI Team Mode.",
          requestId,
        },
        { status: 401 }
      );
    }

    // Rate limit keyed to verified session userId — not to anything from the request body.
    const rateLimitKey = `team-run:user:${identity.userId}`;
    const { limited, resetAt } = await checkRateLimit(
      rateLimitKey,
      TEAM_RUN_RATE_LIMIT_MAX,
      TEAM_RUN_RATE_LIMIT_WINDOW_MS
    );
    if (limited) {
      logApiRequest("POST", "/api/team-run", 429, Date.now() - startTime, requestId);
      return NextResponse.json(
        {
          status: "error",
          errorCode: "RATE_LIMIT",
          message: "Too many team runs. Please wait before trying again.",
          requestId,
        },
        {
          status: 429,
          headers: {
            "Retry-After": Math.max(Math.ceil((resetAt - Date.now()) / 1000), 1).toString(),
          },
        }
      );
    }

    // Parse body.
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      logApiRequest("POST", "/api/team-run", 400, Date.now() - startTime, requestId);
      return NextResponse.json(
        {
          status: "error",
          errorCode: "INVALID_JSON",
          message: "Request body must be valid JSON.",
          requestId,
        },
        { status: 400 }
      );
    }

    const b = body as Record<string, unknown>;

    // Validate task — trim first so whitespace-only input fails the min-length check.
    const rawTask = typeof b.task === "string" ? b.task.trim() : "";
    if (rawTask.length < TEAM_RUN_TASK_MIN_LENGTH) {
      logApiRequest("POST", "/api/team-run", 400, Date.now() - startTime, requestId);
      return NextResponse.json(
        {
          status: "error",
          errorCode: "VALIDATION_ERROR",
          message: `Task must be at least ${TEAM_RUN_TASK_MIN_LENGTH} characters.`,
          requestId,
        },
        { status: 400 }
      );
    }
    if (rawTask.length > TEAM_RUN_TASK_MAX_LENGTH) {
      logApiRequest("POST", "/api/team-run", 400, Date.now() - startTime, requestId);
      return NextResponse.json(
        {
          status: "error",
          errorCode: "VALIDATION_ERROR",
          message: `Task must be at most ${TEAM_RUN_TASK_MAX_LENGTH} characters.`,
          requestId,
        },
        { status: 400 }
      );
    }

    // modelId is optional — only accepted as a model selector, never as an API key or endpoint.
    const modelId =
      typeof b.modelId === "string" && b.modelId.trim().length > 0
        ? b.modelId.trim()
        : TEAM_DEFAULT_MODEL_ID;

    // Execute team mode. callModel wraps fetchOpenRouterResponse with the server-side API key.
    // System prompts are defined in team-mode.ts — they are not read from the request body.
    const result = await runTeamMode(
      { task: rawTask, modelId },
      {
        callModel: async (prompt, systemPrompt, mId) => {
          const { text } = await fetchOpenRouterResponse(prompt, mId, { systemPrompt });
          return text;
        },
      }
    );

    // Persist task + step results. Best-effort: a DB failure must not discard results
    // that the user already received.
    let taskId: string | null = null;
    try {
      const saved = await saveArenaRun({
        prompt: rawTask,
        modeSlug: MODE_SLUG_AI_TEAM,
        modelKeys: [modelId],
        settings: { preset: "balanced", finalAnswer: result.finalAnswer },
        owner: { userId: identity.userId, anonymousSessionId: null },
        responses: result.steps.map((step) => ({
          id: crypto.randomUUID(),
          modelId: step.roleId,
          modelKey: modelId,
          dbModelId: null,
          modelName: getTeamRole(step.roleId)?.label ?? step.roleId,
          status: "success" as const,
          answerText: step.output,
          latencyMs: step.latencyMs,
        })),
      });
      taskId = saved.taskId;
    } catch (persistError) {
      console.error("[/api/team-run] Persistence failed (continuing):", persistError);
    }

    logApiRequest("POST", "/api/team-run", 200, Date.now() - startTime, requestId);
    return NextResponse.json(
      { taskId, steps: result.steps, finalAnswer: result.finalAnswer },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof ApiError) {
      logApiRequest("POST", "/api/team-run", error.statusCode, Date.now() - startTime, requestId);
      return NextResponse.json(
        {
          status: "error",
          errorCode: error.errorCode,
          message: error.message,
          requestId,
        },
        { status: error.statusCode }
      );
    }
    console.error(
      "[/api/team-run] Unexpected error:",
      error instanceof Error ? error.message : error
    );
    logApiRequest("POST", "/api/team-run", 500, Date.now() - startTime, requestId);
    return NextResponse.json(
      {
        status: "error",
        errorCode: "INTERNAL_ERROR",
        message: "An unexpected error occurred.",
        requestId,
      },
      { status: 500 }
    );
  }
}
