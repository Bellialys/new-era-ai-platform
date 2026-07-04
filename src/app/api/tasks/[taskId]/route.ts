import { NextRequest, NextResponse } from "next/server";
import {
  getSupabaseServerClient,
  createErrorResponse,
  logApiRequest,
  resolveRequestIdentity,
  ApiError,
  blindSlotName,
} from "@/lib/server";

interface RouteContext {
  params: Promise<{ taskId: string }>;
}

export async function GET(request: NextRequest, context: RouteContext): Promise<NextResponse> {
  const startTime = Date.now();
  const { taskId } = await context.params;

  if (!taskId || !/^[0-9a-f-]{36}$/.test(taskId)) {
    logApiRequest("GET", "/api/tasks/[taskId]", 400, Date.now() - startTime);
    return NextResponse.json({ error: { code: "INVALID_ID" } }, { status: 400 });
  }

  const identity = await resolveRequestIdentity(request);
  if (identity.kind !== "user") {
    logApiRequest("GET", "/api/tasks/[taskId]", 401, Date.now() - startTime);
    return NextResponse.json(
      createErrorResponse(new ApiError(401, "AUTH_REQUIRED", "Sign in to view task details.")),
      { status: 401 }
    );
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    logApiRequest("GET", "/api/tasks/[taskId]", 503, Date.now() - startTime);
    return NextResponse.json({ error: { code: "DB_UNAVAILABLE" } }, { status: 503 });
  }

  try {
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select(
        `id, mode_slug, task_text, title, status, created_at, settings, judge_verdict, is_blind,
         model_responses(id, model_key, display_name, status, response_text, latency_ms, error_code, error_message, created_at)`
      )
      .eq("id", taskId)
      .eq("user_id", identity.userId)
      .single();

    if (taskError || !task) {
      logApiRequest("GET", "/api/tasks/[taskId]", 404, Date.now() - startTime);
      return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
    }

    const { data: winnerData, error: winnerError } = await supabase
      .from("votes")
      .select("model_response_id")
      .eq("task_id", taskId)
      .eq("vote_type", "best")
      .eq("user_id", identity.userId)
      .maybeSingle();

    if (winnerError) {
      console.error("Task detail winner query failed:", winnerError);
    }

    const winnerResponseId =
      (winnerData as { model_response_id: string } | null)?.model_response_id ?? null;

    const responses = (task.model_responses as {
      id: string; model_key: string; display_name: string | null;
      status: string; response_text: string | null; latency_ms: number | null;
      error_code: string | null; error_message: string | null; created_at?: string | null;
    }[]) ?? [];
    const masked = Boolean((task as { is_blind?: boolean }).is_blind) && !winnerResponseId;
    // Blind slot labels must be stable across refreshes, so use response insertion order.
    const orderedResponses = [...responses].sort((a, b) =>
      (a.created_at ?? "").localeCompare(b.created_at ?? "")
    );

    logApiRequest("GET", "/api/tasks/[taskId]", 200, Date.now() - startTime);
    return NextResponse.json({
      task: {
        id: task.id,
        modeSlug: task.mode_slug,
        prompt: task.task_text,
        title: task.title ?? null,
        status: task.status,
        createdAt: task.created_at,
        settings: task.settings ?? {},
        isBlind: Boolean((task as { is_blind?: boolean }).is_blind),
        winnerResponseId,
        judgeVerdict: (task.judge_verdict as Record<string, unknown> | null) ?? null,
        responses: orderedResponses.map((r, index) => ({
          id: r.id,
          ...(masked ? {} : { modelKey: r.model_key }),
          modelName: masked ? blindSlotName(index) : r.display_name ?? r.model_key,
          status: r.status,
          answerText: r.response_text ?? null,
          latencyMs: r.latency_ms ?? undefined,
          errorCode: r.error_code ?? undefined,
          errorMessage: r.error_message ?? undefined,
        })),
      },
    });
  } catch (err) {
    const safe = createErrorResponse(err);
    logApiRequest("GET", "/api/tasks/[taskId]", 500, Date.now() - startTime);
    return NextResponse.json(safe, { status: 500 });
  }
}
