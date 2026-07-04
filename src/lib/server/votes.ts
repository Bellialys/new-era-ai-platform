import { ApiError } from "./utils";
import { getSupabaseServerClient } from "./supabase";

type SaveBestVoteInput = {
  taskId: string;
  responseId: string;
  /** Verified Supabase user id, or null for a guest. */
  userId?: string | null;
  /** Server-issued anonymous guest id, or null for an authenticated user. */
  anonymousSessionId?: string | null;
};

type SaveBestVoteResult = {
  voteId: string;
  taskId: string;
  responseId: string;
  voteType: "best";
};

export type BlindRevealItem = {
  responseId: string;
  modelName: string;
  modelKey: string;
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

type CastBestVoteRow = {
  id: string;
  task_id: string;
  model_response_id: string;
};

type SupabaseErrorLike = {
  code?: string;
  message?: string;
};

/**
 * Persist a "best" vote. Identity is resolved by the caller from the verified
 * session / guest cookie — never from the request body — so votes cannot be
 * attributed to an arbitrary user.
 *
 * The replace-previous-vote + insert happens inside the cast_best_vote RPC, so
 * it is a single atomic transaction (no delete-then-insert race).
 */
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

  if (!userId && !anonymousSessionId) {
    throw new ApiError(400, "VOTER_REQUIRED", "Voting requires a session.");
  }

  const { data, error } = await supabase.rpc("cast_best_vote", {
    p_task_id: taskId,
    p_response_id: responseId,
    p_user_id: userId,
    p_anon_id: anonymousSessionId,
  });

  if (error) {
    if (isBestVoteDuplicateError(error)) {
      const existingVote = await getExistingBestVote({
        taskId,
        responseId,
        userId,
        anonymousSessionId,
      });
      if (existingVote) {
        return existingVote;
      }
    }

    const message = error.message ?? "";
    if (message.includes("RESPONSE_NOT_FOUND")) {
      throw new ApiError(404, "RESPONSE_NOT_FOUND", "Selected response was not found for this task.");
    }
    if (message.includes("TASK_NOT_FOUND")) {
      throw new ApiError(404, "TASK_NOT_FOUND", "Task was not found.");
    }
    if (message.includes("TASK_STILL_RUNNING")) {
      throw new ApiError(409, "TASK_STILL_RUNNING", "Voting opens when all models finish. Please wait.");
    }
    if (message.includes("INVALID_VOTE_TARGET")) {
      throw new ApiError(400, "INVALID_VOTE_TARGET", "Only successful responses can be selected as best.");
    }
    if (message.includes("VOTER_REQUIRED")) {
      throw new ApiError(400, "VOTER_REQUIRED", "Voting requires a session.");
    }

    console.error("cast_best_vote RPC failed:", error);
    throw new ApiError(500, "VOTE_SAVE_FAILED", "Could not save best vote. Please try again.");
  }

  const vote = (Array.isArray(data) ? data[0] : data) as CastBestVoteRow | null;

  if (!vote) {
    throw new ApiError(500, "VOTE_SAVE_FAILED", "Could not save best vote. Please try again.");
  }

  return {
    voteId: vote.id,
    taskId: vote.task_id,
    responseId: vote.model_response_id,
    voteType: "best",
  };
}

function isBestVoteDuplicateError(error: SupabaseErrorLike): boolean {
  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "23505" ||
    message.includes("duplicate key") ||
    message.includes("votes_best_per_user_uniq") ||
    message.includes("votes_best_per_anon_uniq")
  );
}

async function getExistingBestVote({
  taskId,
  responseId,
  userId,
  anonymousSessionId,
}: Required<Pick<SaveBestVoteInput, "taskId" | "responseId">> &
  Pick<SaveBestVoteInput, "userId" | "anonymousSessionId">): Promise<SaveBestVoteResult | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return null;
  }

  let query = supabase
    .from("votes")
    .select("id, task_id, model_response_id")
    .eq("task_id", taskId)
    .eq("vote_type", "best");

  if (userId) {
    query = query.eq("user_id", userId);
  } else if (anonymousSessionId) {
    query = query.eq("anonymous_session_id", anonymousSessionId);
  } else {
    return null;
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error("Existing best vote lookup failed after duplicate:", error);
    return null;
  }

  const vote = data as CastBestVoteRow | null;
  if (!vote || vote.model_response_id !== responseId) {
    return null;
  }

  return {
    voteId: vote.id,
    taskId: vote.task_id,
    responseId: vote.model_response_id,
    voteType: "best",
  };
}

export async function getBlindReveal(taskId: string): Promise<BlindRevealItem[] | null> {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    return null;
  }

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("is_blind")
    .eq("id", taskId)
    .maybeSingle();

  if (taskError) {
    console.error("Blind reveal task query failed:", taskError);
    return null;
  }

  if (!(task as { is_blind?: boolean } | null)?.is_blind) {
    return null;
  }

  const { data: responses, error: responsesError } = await supabase
    .from("model_responses")
    .select("id, display_name, model_key")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  if (responsesError) {
    console.error("Blind reveal responses query failed:", responsesError);
    return null;
  }

  return ((responses ?? []) as Array<{
    id: string;
    display_name: string | null;
    model_key: string;
  }>).map((response) => ({
    responseId: response.id,
    modelName: response.display_name ?? response.model_key,
    modelKey: response.model_key,
  }));
}
