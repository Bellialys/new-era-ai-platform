/**
 * Server-side history queries.
 *
 * The backend Supabase client uses the service role, which BYPASSES RLS, so
 * ownership is NOT enforced by the database for these reads. Every query in
 * this module must therefore scope by the caller's identity in the WHERE
 * clause via `applyOwnerFilter`. Identity is resolved by the route from the
 * verified session / guest cookie — never from the request body — exactly like
 * voting (see ./votes and ./auth).
 *
 * Reads degrade gracefully: when Supabase is not configured the helpers return
 * an empty list / null instead of throwing, so the history pages stay usable in
 * environments without a database.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ALLOWED_MODE_SLUGS,
  HISTORY_PAGE_SIZE_DEFAULT,
  HISTORY_PAGE_SIZE_MAX,
} from "@/lib/arena/constants";
import { ApiError } from "./utils";
import { getSupabaseServerClient } from "./supabase";

/**
 * A caller identity that is guaranteed to be either a user OR a guest — the
 * "none" case is unrepresentable, so routes must reject it before querying.
 */
export type HistoryIdentity =
  | { userId: string; anonymousSessionId: null }
  | { userId: null; anonymousSessionId: string };

export type HistoryListItem = {
  taskId: string;
  modeSlug: string;
  taskText: string;
  status: string;
  selectedModels: string[];
  modelCount: number;
  createdAt: string;
  hasWinner: boolean;
};

export type HistoryListResult = {
  items: HistoryListItem[];
  /** created_at of the last row; pass back as `cursor` to load older rows. */
  nextCursor: string | null;
};

export type HistoryResponseItem = {
  responseId: string;
  modelKey: string;
  displayName: string | null;
  status: string;
  responseText: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  latencyMs: number | null;
  isWinner: boolean;
};

export type HistoryDetail = {
  taskId: string;
  modeSlug: string;
  taskText: string;
  status: string;
  selectedModels: string[];
  settings: Record<string, unknown>;
  createdAt: string;
  errorMessage: string | null;
  winnerResponseId: string | null;
  responses: HistoryResponseItem[];
};

type TaskListRow = {
  id: string;
  mode_slug: string;
  task_text: string;
  status: string;
  selected_models: unknown;
  created_at: string;
};

type TaskDetailRow = TaskListRow & {
  settings: unknown;
  error_message: string | null;
};

type ResponseRow = {
  id: string;
  model_key: string;
  display_name: string | null;
  status: string;
  response_text: string | null;
  error_code: string | null;
  error_message: string | null;
  latency_ms: number | null;
};

type OwnerFilter = {
  column: "user_id" | "anonymous_session_id";
  value: string;
};

/**
 * The column/value that scopes a query to the caller. This is the ONLY thing
 * standing between a user and another user's data (service role bypasses RLS),
 * so every tasks/votes read in this module applies it via
 * `.eq(owner.column, owner.value)`.
 *
 * Returned as a pair (rather than wrapping the query builder) to avoid a
 * self-referential generic over Supabase's builder type, which trips
 * TS2589 "excessively deep" instantiation.
 */
function ownerFilter(identity: HistoryIdentity): OwnerFilter {
  return identity.userId !== null
    ? { column: "user_id", value: identity.userId }
    : { column: "anonymous_session_id", value: identity.anonymousSessionId };
}

function clampLimit(limit: number): number {
  if (!Number.isFinite(limit) || limit <= 0) {
    return HISTORY_PAGE_SIZE_DEFAULT;
  }
  return Math.min(Math.floor(limit), HISTORY_PAGE_SIZE_MAX);
}

/** `tasks.selected_models` is jsonb; normalize whatever comes back to string[]. */
function normalizeSelectedModels(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string");
}

function isAllowedModeSlug(modeSlug: string): boolean {
  return (ALLOWED_MODE_SLUGS as readonly string[]).includes(modeSlug);
}

/**
 * Which of the given tasks already have a "best" vote by this owner. Done in a
 * single batched query for the whole page rather than per-row. Non-fatal: on
 * error the page still renders, just without winner badges.
 */
async function loadWinnerTaskIds(
  supabase: SupabaseClient,
  identity: HistoryIdentity,
  taskIds: string[]
): Promise<Set<string>> {
  if (taskIds.length === 0) {
    return new Set();
  }

  const owner = ownerFilter(identity);
  const { data, error } = await supabase
    .from("votes")
    .select("task_id")
    .eq("vote_type", "best")
    .in("task_id", taskIds)
    .eq(owner.column, owner.value);
  if (error) {
    console.error("listHistory winner-flag query failed:", error);
    return new Set();
  }

  return new Set(((data ?? []) as Array<{ task_id: string }>).map((row) => row.task_id));
}

/**
 * List the caller's past comparisons, newest first, with keyset pagination.
 *
 * Pagination note: the cursor is `created_at` only. Two runs sharing the exact
 * same timestamp at the page boundary could be skipped — acceptable at MVP
 * write volume. A compound (created_at, id) keyset or a covering index is the
 * follow-up if/when this matters (see 14-roadmap.md v0.8 perf note).
 */
export async function listHistory({
  identity,
  limit = HISTORY_PAGE_SIZE_DEFAULT,
  cursor = null,
  modeSlug = null,
}: {
  identity: HistoryIdentity;
  limit?: number;
  cursor?: string | null;
  modeSlug?: string | null;
}): Promise<HistoryListResult> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return { items: [], nextCursor: null };
  }

  const safeLimit = clampLimit(limit);
  const owner = ownerFilter(identity);

  let query = supabase
    .from("tasks")
    .select("id, mode_slug, task_text, status, selected_models, created_at")
    .eq(owner.column, owner.value);

  if (modeSlug && isAllowedModeSlug(modeSlug)) {
    query = query.eq("mode_slug", modeSlug);
  }

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(safeLimit + 1);

  if (error) {
    console.error("listHistory tasks query failed:", error);
    throw new ApiError(500, "HISTORY_LOAD_FAILED", "Could not load history. Please try again.");
  }

  const rows = (data ?? []) as TaskListRow[];
  const hasMore = rows.length > safeLimit;
  const pageRows = hasMore ? rows.slice(0, safeLimit) : rows;
  const nextCursor = hasMore ? pageRows[pageRows.length - 1].created_at : null;

  const winnerTaskIds = await loadWinnerTaskIds(
    supabase,
    identity,
    pageRows.map((row) => row.id)
  );

  const items: HistoryListItem[] = pageRows.map((row) => {
    const selectedModels = normalizeSelectedModels(row.selected_models);
    return {
      taskId: row.id,
      modeSlug: row.mode_slug,
      taskText: row.task_text,
      status: row.status,
      selectedModels,
      modelCount: selectedModels.length,
      createdAt: row.created_at,
      hasWinner: winnerTaskIds.has(row.id),
    };
  });

  return { items, nextCursor };
}

/**
 * Load one comparison with its responses and winner, scoped to the caller.
 * Returns null when the task does not exist OR is not owned by the caller —
 * the route maps both to 404 so task existence is not leaked.
 */
export async function getHistoryTask({
  identity,
  taskId,
}: {
  identity: HistoryIdentity;
  taskId: string;
}): Promise<HistoryDetail | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return null;
  }

  const owner = ownerFilter(identity);

  // Ownership is enforced HERE: the owner filter is part of the WHERE clause, so
  // a foreign task simply returns no row → null → 404.
  const { data: taskData, error: taskError } = await supabase
    .from("tasks")
    .select(
      "id, mode_slug, task_text, status, selected_models, settings, created_at, error_message"
    )
    .eq("id", taskId)
    .eq(owner.column, owner.value)
    .maybeSingle();

  if (taskError) {
    console.error("getHistoryTask task query failed:", taskError);
    throw new ApiError(
      500,
      "HISTORY_LOAD_FAILED",
      "Could not load this comparison. Please try again."
    );
  }

  if (!taskData) {
    return null;
  }

  const task = taskData as TaskDetailRow;

  const { data: responseData, error: responsesError } = await supabase
    .from("model_responses")
    .select(
      "id, model_key, display_name, status, response_text, error_code, error_message, latency_ms"
    )
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  if (responsesError) {
    console.error("getHistoryTask responses query failed:", responsesError);
    throw new ApiError(
      500,
      "HISTORY_LOAD_FAILED",
      "Could not load this comparison. Please try again."
    );
  }

  const { data: winnerData, error: winnerError } = await supabase
    .from("votes")
    .select("model_response_id")
    .eq("task_id", taskId)
    .eq("vote_type", "best")
    .eq(owner.column, owner.value)
    .maybeSingle();
  if (winnerError) {
    // Non-fatal: render responses without a winner badge.
    console.error("getHistoryTask winner query failed:", winnerError);
  }

  const winnerResponseId =
    (winnerData as { model_response_id: string } | null)?.model_response_id ?? null;

  const responses: HistoryResponseItem[] = ((responseData ?? []) as ResponseRow[]).map((row) => ({
    responseId: row.id,
    modelKey: row.model_key,
    displayName: row.display_name,
    status: row.status,
    responseText: row.response_text,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    latencyMs: row.latency_ms,
    isWinner: row.id === winnerResponseId,
  }));

  return {
    taskId: task.id,
    modeSlug: task.mode_slug,
    taskText: task.task_text,
    status: task.status,
    selectedModels: normalizeSelectedModels(task.selected_models),
    settings: (task.settings ?? {}) as Record<string, unknown>,
    createdAt: task.created_at,
    errorMessage: task.error_message,
    winnerResponseId,
    responses,
  };
}
