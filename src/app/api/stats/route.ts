import { NextRequest, NextResponse } from "next/server";
import {
  resolveRequestIdentity,
  getSupabaseServerClient,
  createErrorResponse,
  logApiRequest,
} from "@/lib/server";

// Returns per-model win counts and total comparisons for the current user
export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();
  const identity = await resolveRequestIdentity(request);
  if (identity.kind === "none") {
    logApiRequest("GET", "/api/stats", 401, Date.now() - startTime);
    return NextResponse.json({ error: { code: "AUTH_REQUIRED" } }, { status: 401 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    logApiRequest("GET", "/api/stats", 200, Date.now() - startTime);
    return NextResponse.json({ stats: null });
  }

  try {
    // Build identity filter
    const identityFilter =
      identity.kind === "user"
        ? { column: "user_id", value: identity.userId! }
        : { column: "anonymous_session_id", value: identity.guestId! };

    // Total tasks by mode
    const { data: taskCounts, error: taskErr } = await supabase
      .from("tasks")
      .select("mode_slug, id", { count: "planned" })
      .eq(identityFilter.column, identityFilter.value);

    if (taskErr) throw taskErr;

    // Get all votes with winner_response_id for this user's tasks
    // Join through tasks to filter by identity
    const taskIds = (taskCounts ?? []).map((t) => (t as { id: string }).id);

    let winnerStats: { display_name: string; count: number }[] = [];

    if (taskIds.length > 0) {
      const { data: voteData, error: voteErr } = await supabase
        .from("votes")
        .select("winner_response_id, model_responses!inner(display_name, model_key)")
        .in("task_id", taskIds.slice(0, 500)) // cap at 500 tasks
        .not("winner_response_id", "is", null);

      if (voteErr) throw voteErr;

      // Tally wins per model display name
      const tallyMap = new Map<string, number>();
      for (const vote of voteData ?? []) {
        const voteRecord = (vote as unknown) as {
          winner_response_id: string;
          model_responses: { display_name: string | null; model_key: string } | { display_name: string | null; model_key: string }[] | null;
        };
        const mr = Array.isArray(voteRecord.model_responses)
          ? voteRecord.model_responses[0] ?? null
          : voteRecord.model_responses;
        const name = mr?.display_name ?? mr?.model_key ?? "Unknown";
        tallyMap.set(name, (tallyMap.get(name) ?? 0) + 1);
      }

      winnerStats = Array.from(tallyMap.entries())
        .map(([display_name, count]) => ({ display_name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
    }

    // Count by mode
    const modeCounts: Record<string, number> = {};
    for (const t of taskCounts ?? []) {
      const row = t as { mode_slug: string };
      modeCounts[row.mode_slug] = (modeCounts[row.mode_slug] ?? 0) + 1;
    }

    const totalTasks = taskIds.length;
    const totalVotes = winnerStats.reduce((sum, s) => sum + s.count, 0);

    logApiRequest("GET", "/api/stats", 200, Date.now() - startTime);
    return NextResponse.json({
      stats: {
        totalTasks,
        totalVotes,
        modeCounts,
        topModels: winnerStats,
      },
    });
  } catch (err) {
    const safe = createErrorResponse(err);
    logApiRequest("GET", "/api/stats", 500, Date.now() - startTime);
    return NextResponse.json(safe, { status: 500 });
  }
}
