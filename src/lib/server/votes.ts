import { ApiError } from "./utils";
import { getSupabaseServerClient } from "./supabase";

type SaveWinnerVoteInput = {
  taskId: string;
  responseId: string;
  anonymousSessionId?: string | null;
};

type SaveWinnerVoteResult = {
  voteId: string;
  taskId: string;
  responseId: string;
  voteType: "winner";
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateVoteIds(taskId: unknown, responseId: unknown): { taskId: string; responseId: string } {
  if (typeof taskId !== "string" || !UUID_PATTERN.test(taskId)) {
    throw new ApiError(400, "VALIDATION_ERROR", "taskId must be a valid UUID.");
  }

  if (typeof responseId !== "string" || !UUID_PATTERN.test(responseId)) {
    throw new ApiError(400, "VALIDATION_ERROR", "responseId must be a valid UUID.");
  }

  return { taskId, responseId };
}

export async function saveWinnerVote({
  taskId,
  responseId,
  anonymousSessionId = null,
}: SaveWinnerVoteInput): Promise<SaveWinnerVoteResult> {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    throw new ApiError(503, "DATABASE_NOT_CONFIGURED", "Voting is not available yet.");
  }

  const { data: response, error: responseError } = await supabase
    .from("model_responses")
    .select("id, task_id, status")
    .eq("id", responseId)
    .eq("task_id", taskId)
    .single();

  if (responseError || !response) {
    throw new ApiError(404, "RESPONSE_NOT_FOUND", "Selected response was not found for this task.");
  }

  if (response.status !== "success") {
    throw new ApiError(400, "INVALID_VOTE_TARGET", "Only successful responses can be selected as winner.");
  }

  const { data: vote, error: voteError } = await supabase
    .from("votes")
    .upsert(
      {
        task_id: taskId,
        response_id: responseId,
        anonymous_session_id: anonymousSessionId,
        vote_type: "winner",
      },
      { onConflict: "task_id,vote_type" }
    )
    .select("id, task_id, response_id, vote_type")
    .single();

  if (voteError || !vote) {
    throw new ApiError(500, "VOTE_SAVE_FAILED", "Could not save winner vote. Please try again.");
  }

  return {
    voteId: vote.id,
    taskId: vote.task_id,
    responseId: vote.response_id,
    voteType: "winner",
  };
}
