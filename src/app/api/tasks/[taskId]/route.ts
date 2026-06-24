import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient, createErrorResponse, logApiRequest } from "@/lib/server";

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

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    logApiRequest("GET", "/api/tasks/[taskId]", 503, Date.now() - startTime);
    return NextResponse.json({ error: { code: "DB_UNAVAILABLE" } }, { status: 503 });
  }

  try {
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select(
        `id, mode_slug, prompt_text, title, status, created_at, settings, judge_verdict,
         model_responses(id, model_key, display_name, status, response_text, latency_ms, error_code, error_message),
         votes(id, model_response_id, vote_type)`
      )
      .eq("id", taskId)
      .single();

    if (taskError || !task) {
      logApiRequest("GET", "/api/tasks/[taskId]", 404, Date.now() - startTime);
      return NextResponse.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
    }

    // Find winner response id from the 'best' vote. Votes have no winner column;
    // a best vote references the winning model_responses row via model_response_id.
    const votesArr = (task.votes as { id: string; model_response_id: string | null; vote_type: string }[] | null) ?? [];
    const winnerResponseId = votesArr.find((v) => v.vote_type === "best")?.model_response_id ?? null;

    const responses = (task.model_responses as {
      id: string; model_key: string; display_name: string | null;
      status: string; response_text: string | null; latency_ms: number | null;
      error_code: string | null; error_message: string | null;
    }[]) ?? [];

    logApiRequest("GET", "/api/tasks/[taskId]", 200, Date.now() - startTime);
    return NextResponse.json({
      task: {
        id: task.id,
        modeSlug: task.mode_slug,
        prompt: task.prompt_text,
        title: task.title ?? null,
        status: task.status,
        createdAt: task.created_at,
        settings: task.settings ?? {},
        winnerResponseId,
        judgeVerdict: (task.judge_verdict as Record<string, unknown> | null) ?? null,
        responses: responses.map((r) => ({
          id: r.id,
          modelKey: r.model_key,
          modelName: r.display_name ?? r.model_key,
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
