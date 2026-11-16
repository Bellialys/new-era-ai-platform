import { NextRequest, NextResponse } from "next/server";
import {
  resolveRequestIdentity,
  checkRateLimit,
  fetchOpenRouterResponse,
  saveArenaRun,
  logApiRequest,
  isJsonObject,
  ApiError,
  resolveOpenRouterRuntimeCredential,
  getActiveFreeOpenRouterModelIds,
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
import { ALLOWED_MODELS } from "@/lib/server/models";

const TEAM_ALLOWED_MODEL_IDS = new Set(ALLOWED_MODELS.map((m) => m.id));

// Four sequential LLM calls fit a 60-second Vercel function budget.
// Keep time for auth/rate-limit checks and best-effort persistence; abort
// provider requests instead of letting a single slow role consume the run.
export const maxDuration = 60;
const TEAM_INFERENCE_BUDGET_MS = 52_000;
const TEAM_STEP_TIMEOUT_MS = 12_000;
const TEAM_TRANSIENT_RETRY_DELAY_MS = 200;
const TEAM_TRANSIENT_RETRY_MIN_REMAINING_MS = TEAM_STEP_TIMEOUT_MS + 1_000;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

  // Backend feature flag — independent from the NEXT_PUBLIC_ UI flag.
  // Without this, the UI flag only hides the button but doesn't block direct API calls.
  if (process.env.ENABLE_TEAM_MODE !== "true") {
    logApiRequest("POST", "/api/team-run", 503, Date.now() - startTime, requestId);
    return NextResponse.json(
      { status: "error", errorCode: "SERVICE_UNAVAILABLE", message: "Team Mode is not enabled." },
      { status: 503 }
    );
  }

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

    if (!isJsonObject(body)) {
      logApiRequest("POST", "/api/team-run", 400, Date.now() - startTime, requestId);
      return NextResponse.json(
        {
          status: "error",
          errorCode: "INVALID_BODY",
          message: "Request body must be a JSON object.",
          requestId,
        },
        { status: 400 }
      );
    }

    const b = body;

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

    const requestedModelId = typeof b.modelId === "string" ? b.modelId.trim() : "";
    const liveModels = await getActiveFreeOpenRouterModelIds(identity);
    const available = [...TEAM_ALLOWED_MODEL_IDS].filter((id) => liveModels.has(id));
    const requested = available.find((id) => id === requestedModelId || liveModels.get(id) === requestedModelId);
    const modelId = requested ?? available.find((id) => id === TEAM_DEFAULT_MODEL_ID) ?? available[0];
    if (!modelId) {
      throw new ApiError(
        503, "TEAM_MODEL_UNAVAILABLE", "Сейчас нет доступной бесплатной модели для AI Team. Попробуйте позже."
      );
    }
    const gatewayCredential =
      await resolveOpenRouterRuntimeCredential(identity);

    // Execute team mode with a bounded provider budget and at most one
    // additional inference call for a transient 502/503 over the ENTIRE run.
    // This never retries auth, credits, rate-limit, or timeout failures.
    // System prompts are server-defined and are never read from the client.
    let transientRetryUsed = false;
    const inferenceDeadline = startTime + TEAM_INFERENCE_BUDGET_MS;
    const result = await runTeamMode(
      { task: rawTask, modelId },
      {
        callModel: async (prompt, systemPrompt, mId) => {
          const invoke = async () => {
            const remainingMs = inferenceDeadline - Date.now();
            if (remainingMs <= 1_000) {
              throw new ApiError(
                504,
                "TEAM_RUN_TIMEOUT",
                "AI Team exceeded its response time budget. Please try again."
              );
            }
            return fetchOpenRouterResponse(prompt, mId, {
              systemPrompt,
              credential: gatewayCredential,
              signal: AbortSignal.timeout(Math.min(TEAM_STEP_TIMEOUT_MS, remainingMs)),
              telemetry: {
                userId: identity.userId,
                guestId: null,
                modeSlug: MODE_SLUG_AI_TEAM,
                requestKind: "text",
              },
            });
          };

          try {
            return (await invoke()).text;
          } catch (error) {
            const retryable =
              error instanceof ApiError &&
              (error.statusCode === 502 || error.statusCode === 503);
            if (
              !retryable ||
              transientRetryUsed ||
              inferenceDeadline - Date.now() <= TEAM_TRANSIENT_RETRY_MIN_REMAINING_MS
            ) {
              throw error;
            }

            transientRetryUsed = true;
            // Do not log the prompt, API key, authorization, or provider error body.
            console.warn("[/api/team-run] Retrying transient upstream failure", {
              modelId: mId,
              httpStatus: error.statusCode,
              retriesUsed: 1,
            });
            await new Promise((resolve) =>
              setTimeout(resolve, TEAM_TRANSIENT_RETRY_DELAY_MS)
            );
            return (await invoke()).text;
          }
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
