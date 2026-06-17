/**
 * GET /api/profile/stats — arena statistics for the current user
 *
 * Returns counts of tasks, model_responses, and best-votes attributed to the
 * authenticated user. Requires an authenticated session.
 */
import { NextRequest, NextResponse } from "next/server";
import { createErrorResponse, logApiRequest, ApiError, getAuthenticatedUserId } from "@/lib/server";
import { getSupabaseServerClient } from "@/lib/server/supabase";

interface StatsResponse {
  status: "success";
  stats: {
    totalComparisons: number;
    totalResponses: number;
    totalVotes: number;
    lastActiveAt: string | null;
  };
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  try {
    const userId = await getAuthenticatedUserId(request);
    if (!userId) {
      logApiRequest("GET", "/api/profile/stats", 401, Date.now() - startTime);
      return NextResponse.json(
        createErrorResponse(new ApiError(401, "AUTH_REQUIRED", "Sign in to view statistics.")),
        { status: 401 }
      );
    }

    const supabase = getSupabaseServerClient();
    if (!supabase) {
      return NextResponse.json<StatsResponse>({
        status: "success",
        stats: { totalComparisons: 0, totalResponses: 0, totalVotes: 0, lastActiveAt: null },
      });
    }

    const [tasksResult, votesResult, lastTaskResult, taskIdsResult] = await Promise.all([
      supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),

      supabase
        .from("votes")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),

      supabase
        .from("tasks")
        .select("created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1),

      supabase
        .from("tasks")
        .select("id")
        .eq("user_id", userId)
        .limit(500),
    ]);

    if (tasksResult.error || votesResult.error || lastTaskResult.error || taskIdsResult.error) {
      console.error("Profile stats query error:", {
        tasks: tasksResult.error,
        votes: votesResult.error,
        lastTask: lastTaskResult.error,
        taskIds: taskIdsResult.error,
      });
      throw new ApiError(500, "INTERNAL_ERROR", "Failed to load profile statistics.");
    }

    const totalComparisons = tasksResult.count ?? 0;
    const totalVotes = votesResult.count ?? 0;
    const taskIds = ((taskIdsResult.data ?? []) as Array<{ id: string }>).map((task) => task.id);

    // Responses are linked via task_id — use a server-side count query
    let totalResponses = 0;
    if (taskIds.length > 0) {
      const { count: responseCount, error: responseError } = await supabase
        .from("model_responses")
        .select("id", { count: "exact", head: true })
        .in("task_id", taskIds);

      if (responseError) {
        console.error("Profile response-count query error:", responseError);
        throw new ApiError(500, "INTERNAL_ERROR", "Failed to load profile statistics.");
      }

      totalResponses = responseCount ?? 0;
    }

    const lastActiveAt =
      (lastTaskResult.data as Array<{ created_at: string }> | null)?.[0]?.created_at ?? null;

    logApiRequest("GET", "/api/profile/stats", 200, Date.now() - startTime);
    return NextResponse.json<StatsResponse>({
      status: "success",
      stats: { totalComparisons, totalResponses, totalVotes, lastActiveAt },
    });
  } catch (error) {
    const statusCode = error instanceof ApiError ? error.statusCode : 500;
    logApiRequest("GET", "/api/profile/stats", statusCode, Date.now() - startTime);
    return NextResponse.json(createErrorResponse(error), { status: statusCode });
  }
}
