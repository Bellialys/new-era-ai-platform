import { MODE_SLUG_PROMPT_ARENA } from "@/lib/arena/constants";
import { ApiError } from "./utils";
import { getSupabaseServerClient } from "./supabase";

type ArenaResponseForPersistence = {
  id: string;
  /** Identifier the client echoes back (UUID in DB mode, model_key otherwise). */
  modelId: string;
  /** OpenRouter model key. */
  modelKey: string;
  /** Supabase models.id, or null when served from the hardcoded fallback. */
  dbModelId: string | null;
  modelName: string;
  status: "success" | "error";
  answerText: string | null;
  latencyMs?: number;
  errorCode?: string;
  errorMessage?: string;
  usage?: {
    inputTokens: number | null;
    outputTokens: number | null;
    totalTokens: number | null;
  };
};

type SaveArenaRunInput = {
  prompt: string;
  modeSlug?: string;
  modelKeys: string[];
  responses: ArenaResponseForPersistence[];
  /** Extra JSONB metadata stored in tasks.settings. */
  settings?: Record<string, unknown>;
  /** Verified owner of the run: a user id, a guest id, or neither. */
  owner?: {
    userId: string | null;
    anonymousSessionId: string | null;
  };
};

type SaveArenaRunResult = {
  taskId: string | null;
  responseIdsByModelId: Record<string, string>;
};

/** @deprecated Use saveArenaRun instead. */
export type SavePromptArenaRunInput = SaveArenaRunInput;

export async function saveArenaRun({
  prompt,
  modeSlug = MODE_SLUG_PROMPT_ARENA,
  modelKeys,
  responses,
  settings = {},
  owner,
}: SaveArenaRunInput): Promise<SaveArenaRunResult> {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    console.warn("Supabase is not configured; skipping arena run persistence.");
    return { taskId: null, responseIdsByModelId: {} };
  }

  const successCount = responses.filter((response) => response.status === "success").length;
  const taskStatus =
    successCount === responses.length ? "completed" : successCount > 0 ? "partial" : "failed";

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .insert({
      mode_slug: modeSlug,
      task_text: prompt,
      status: taskStatus,
      selected_models: modelKeys,
      settings,
      user_id: owner?.userId ?? null,
      anonymous_session_id: owner?.anonymousSessionId ?? null,
      error_message:
        taskStatus === "failed" ? "All selected models failed to return a response." : null,
    })
    .select("id")
    .single();

  if (taskError || !task) {
    console.error("Supabase task insert failed:", taskError);
    throw new ApiError(
      500,
      "DATABASE_SAVE_FAILED",
      "Could not save comparison. Please try again."
    );
  }

  // model_id (Supabase UUID) is already resolved upstream by the model catalog,
  // so no extra models lookup is needed here.
  const responseRows = responses.map((response) => ({
    task_id: task.id,
    model_id: response.dbModelId,
    model_key: response.modelKey,
    display_name: response.modelName,
    response_text: response.status === "success" ? response.answerText : null,
    status: response.errorCode === "TIMEOUT" ? ("timeout" as const) : response.status,
    error_code: response.errorCode ?? null,
    error_message: response.errorMessage ?? null,
    latency_ms: response.latencyMs ?? null,
    input_tokens: response.usage?.inputTokens ?? null,
    output_tokens: response.usage?.outputTokens ?? null,
    total_tokens: response.usage?.totalTokens ?? null,
    raw_response: {},
  }));

  const { data: savedResponses, error: responsesError } = await supabase
    .from("model_responses")
    .insert(responseRows)
    .select("id, model_key");

  if (responsesError || !savedResponses) {
    console.error("Supabase response insert failed:", responsesError);
    throw new ApiError(
      500,
      "DATABASE_SAVE_FAILED",
      "Could not save comparison responses. Please try again."
    );
  }

  // Map the saved row ids back to the client-facing selectionId. modelKey is
  // unique within a run, so it is a safe correlation key.
  const selectionIdByModelKey = new Map(
    responses.map((response) => [response.modelKey, response.modelId])
  );

  return {
    taskId: task.id,
    responseIdsByModelId: Object.fromEntries(
      savedResponses.map((response) => [
        selectionIdByModelKey.get(response.model_key) ?? response.model_key,
        response.id,
      ])
    ),
  };
}

/** @deprecated Use saveArenaRun instead. */
export const savePromptArenaRun = saveArenaRun;
