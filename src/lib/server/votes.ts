import { ApiError } from "./utils";
import { getSupabaseServerClient } from "./supabase";

type SaveBestVoteInput = {
  taskId: string;
  responseId: string;
  userId?: string | null;
  anonymousSessionId?: string | null;
};

type SaveBestVoteResult = {
  voteId: string;
  taskId: string;
  responseId: string;
  voteType: "best";
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

function validateUserId(userId: string | null): string | null {
  if (userId === null) return null;

  if (!UUID_PATTERN.test(userId)) {
    throw new ApiError(400, "VALIDATION_ERROR", "userId must be a valid UUID.");
  }

  return userId;
}

function normalizeAnonymousSessionId(anonymousSessionId: string | null): string | null {
  if (!anonymousSessionId) return null;

  const normalized = anonymousSessionId.trim();

  if (normalized.length === 0) return null;

  if (normalized.length > 128) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      "anonymousSessionId must be 128 characters or less."
    );
  }

  return normalized;
}

export async function saveBestVote({
  taskId,
  responseId,
  userId = null,
  anonymousSessionId = null,
}: SaveBestVoteInput): Promise<SaveBestVoteResult> {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    throw new ApiError(503, "DATABASE_NOT_CONFIGURED", "Voting is not available yet.");
  }

  const normalizedUserId = validateUserId(userId);
  const normalizedAnonymousSessionId = normalizeAnonymousSessionId(anonymousSessionId);

  if (!normalizedUserId && !normalizedAnonymousSessionId) {
    throw new ApiError(
      400,
      "VOTER_REQUIRED",
      "Voting requires either userId or anonymousSessionId."
    );
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
    throw new ApiError(400, "INVALID_VOTE_TARGET", "Only successful responses can be selected as best.");
  }

  let deleteQuery = supabase
    .from("votes")
    .delete()
    .eq("task_id", taskId)
    .eq("vote_type", "best");

  if (normalizedUserId) {
    deleteQuery = deleteQuery.eq("user_id", normalizedUserId);
  } else {
    deleteQuery = deleteQuery.eq("anonymous_session_id", normalizedAnonymousSessionId);
  }

  const { error: deleteError } = await deleteQuery;

  if (deleteError) {
    throw new ApiError(500, "VOTE_SAVE_FAILED", "Could not replace previous best vote.");
  }

  const { data: vote, error: voteError } = await supabase
    .from("votes")
    .insert({
      task_id: taskId,
      model_response_id: responseId,
      user_id: normalizedUserId,
      anonymous_session_id: normalizedAnonymousSessionId,
      vote_type: "best",
    })
    .select("id, task_id, model_response_id, vote_type")
    .single();

  if (voteError || !vote) {
    throw new ApiError(500, "VOTE_SAVE_FAILED", "Could not save best vote. Please try again.");
  }

  return {
    voteId: vote.id,
    taskId: vote.task_id,
    responseId: vote.model_response_id,
    voteType: "best",
  };
}

export const saveWinnerVote = saveBestVote;
