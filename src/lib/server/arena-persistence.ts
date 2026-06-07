import { MODE_SLUG_PROMPT_ARENA } from "@/lib/arena/constants";
import { ApiError } from "./utils";
import { getSupabaseServerClient } from "./supabase";

type ArenaResponseForPersistence = {
  id: string;
  modelId: string;
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

type SavePromptArenaRunInput = {
  prompt: string;
  modelIds: string[];
  responses: ArenaResponseForPersistence[];
};

type SavePromptArenaRunResult = {
  taskId: string | null;
  responseIdsByModelId: Record<string, string>;
};

export async function savePromptArenaRun({
  prompt,
  modelIds,
  responses,
}: SavePromptArenaRunInput): Promise<SavePromptArenaRunResult> {
  const supabase = getSupabaseServerClient();

  if (!supabase) {
    console.warn("Supabase is not configured; skipping Prompt Arena persistence.");
    return { taskId: null, responseIdsByModelId: {} };
  }

  const successCount = responses.filter((response) => response.status === "success").length;
  const taskStatus =
    successCount === responses.length ? "completed" : successCount > 0 ? "partial" : "failed";

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .insert({
      mode_slug: MODE_SLUG_PROMPT_ARENA,
      prompt_text: prompt,
      status: taskStatus,
      selected_models: modelIds,
      settings: {},
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

  const { data: modelRows, error: modelsError } = await supabase
    .from("models")
    .select("id, model_key")
    .in("model_key", modelIds);

  if (modelsError) {
    console.warn("Supabase model lookup failed; saving responses without model_id:", modelsError);
  }

  const modelIdsByKey = new Map(
    (modelRows ?? []).map((model) => [model.model_key, model.id])
  );

  const responseRows = responses.map((response) => ({
    task_id: task.id,
    model_id: modelIdsByKey.get(response.modelId) ?? null,
    model_key: response.modelId,
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

  return {
    taskId: task.id,
    responseIdsByModelId: Object.fromEntries(
      savedResponses.map((response) => [response.model_key, response.id])
    ),
  };
}
