/**
 * Model catalog (v0.7)
 *
 * Supabase models is the primary source of available models for both
 * /api/models and /api/compare. The hardcoded list in models.ts is an offline
 * fallback while automatic health checks are disabled.
 *
 * Access level filtering (v0.6.2):
 *   anonymous  → guests and authenticated users see these models
 *   registered → authenticated users only
 *   premium    → reserved for future paid tier
 *
 * The client only ever sees and echoes back a `selectionId`:
 *   - DB mode:       selectionId = models.id (UUID), modelKey stays server-side
 *   - fallback mode: selectionId = OpenRouter model_key
 * The OpenRouter `model_key` is resolved server-side from the selectionId.
 */

import type { ArenaModel } from "@/types/arena";
import { ApiError, withTimeout } from "./utils";
import { getSupabaseServerClient } from "./supabase";
import { ALLOWED_MODELS } from "./models";
import type { RequestIdentity } from "./auth";

export type ResolvedModel = {
  /** Identifier the client sends back (UUID in DB mode, model_key in fallback). */
  selectionId: string;
  /** Supabase models.id, or null when served from the hardcoded fallback. */
  modelId: string | null;
  /** OpenRouter model key used to call the provider. Server-side only. */
  modelKey: string;
  name: string;
  role: string;
  badge?: string;
  description?: string;
  /** Access level of the model. Used for backend validation. */
  accessLevel: "anonymous" | "registered" | "premium";
  /** True if the model supports code-oriented tasks (role_tags includes coding). */
  supportsCode: boolean;
};

type DbModelRow = {
  id: string;
  model_key: string;
  display_name: string;
  description: string | null;
  role_tags: string[] | null;
  price_label: string | null;
  access_level: string;
};

const ROLE_LABELS: Record<string, string> = {
  general: "General-модель",
  balanced: "Сбалансированный instruct",
  reasoning: "Рассуждение",
  coding: "Coding / code-oriented",
  fast: "Быстрая модель",
  "long-context": "General + длинный контекст",
  "open-source": "Открытая модель",
};

const MODEL_CATALOG_QUERY_TIMEOUT_MS = 3_500;

function roleFromTags(tags: string[] | null): string {
  const matched = tags?.find((tag) => ROLE_LABELS[tag]);
  return matched ? ROLE_LABELS[matched] : "General-модель";
}

export function badgeFromTags(tags: string[] | null, priceLabel: string | null): string | undefined {
  if (tags?.includes("coding")) return "Free Coding";
  if (tags?.includes("reasoning")) return "Free Reasoning";
  if (tags?.includes("fast")) return "Free Fast";
  return priceLabel === "free" ? "Free" : undefined;
}

/** Access levels visible to each identity kind, optionally expanded by plan/role. */
function allowedLevelsFor(identity: RequestIdentity | null, plan?: string | null): string[] {
  if (identity === null || identity.kind === "none" || identity.kind === "guest") {
    return ["anonymous"];
  }
  // Pro and admin users get access to all access levels.
  if (plan === "pro" || plan === "admin") {
    return ["anonymous", "registered", "premium"];
  }
  // Authenticated free users: anonymous + registered
  return ["anonymous", "registered"];
}

/** Fetch the plan/role for an authenticated user. Returns null if unavailable. */
async function fetchUserPlan(userId: string): Promise<string | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;
  try {
    const { data } = await withTimeout(
      supabase
        .from("profiles")
        .select("role, plan")
        .eq("id", userId)
        .single(),
      MODEL_CATALOG_QUERY_TIMEOUT_MS,
      "profiles plan query"
    );
    if (!data) return null;
    const row = data as { role: string; plan: string };
    if (row.role === "admin") return "admin";
    return row.plan ?? "free";
  } catch {
    return null;
  }
}

function allowsHardcodedCatalog(): boolean {
  return process.env.ENABLE_MODEL_HEALTH_CRON !== "true";
}

function fallbackCatalog(): ResolvedModel[] {
  if (!allowsHardcodedCatalog()) {
    // The static list cannot reflect runtime quarantines.
    throw new ApiError(
      503,
      "MODEL_CATALOG_UNAVAILABLE",
      "The model catalog is temporarily unavailable. Please try again later."
    );
  }

  return ALLOWED_MODELS.map((model) => ({
    selectionId: model.id,
    modelId: null,
    modelKey: model.id,
    name: model.name,
    role: model.role,
    badge: model.badge,
    description: model.description,
    accessLevel: "anonymous" as const,
    supportsCode: model.supportsCode,
  }));
}

function logModelCatalogFailure(reason: string, error: unknown): void {
  const diagnostic = error as { code?: unknown; message?: unknown };

  console.warn(reason, {
    code: typeof diagnostic?.code === "string" ? diagnostic.code : null,
    message: typeof diagnostic?.message === "string" ? diagnostic.message : "Unknown error",
  });
}

/**
 * Load the active/public catalog filtered by identity access level.
 * With automatic health checks enabled, Supabase owns model visibility.
 * An empty result stays empty and an unavailable catalog raises a 503.
 *
 * @param identity - The resolved request identity (null = treat as guest).
 */
export async function loadModelCatalog(
  identity: RequestIdentity | null = null
): Promise<ResolvedModel[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return fallbackCatalog();
  }

  const plan = identity?.kind === "user" ? await fetchUserPlan(identity.userId) : null;
  const levels = allowedLevelsFor(identity, plan);

  try {
    const { data, error } = await withTimeout(
      supabase
        .from("models")
        .select("id, model_key, display_name, description, role_tags, price_label, access_level")
        .eq("is_active", true)
        .eq("is_public", true)
        .in("access_level", levels)
        .order("sort_order", { ascending: true }),
      MODEL_CATALOG_QUERY_TIMEOUT_MS,
      "models catalog query"
    );

    if (error || !data) {
      throw error ?? new Error("models table returned no result.");
    }

    if (data.length === 0 && allowsHardcodedCatalog()) {
      console.warn("models table returned no active public models; using hardcoded catalog.");
      return fallbackCatalog();
    }

    return (data as DbModelRow[]).map((row) => ({
      selectionId: row.id,
      modelId: row.id,
      modelKey: row.model_key,
      name: row.display_name,
      role: roleFromTags(row.role_tags),
      badge: badgeFromTags(row.role_tags, row.price_label),
      description: row.description ?? undefined,
      accessLevel: (row.access_level ?? "anonymous") as "anonymous" | "registered" | "premium",
      supportsCode: row.role_tags?.includes("coding") ?? false,
    }));
  } catch (caught) {
    logModelCatalogFailure("Supabase model catalog query failed.", caught);
    return fallbackCatalog();
  }
}

/**
 * Public catalog for the client. Uses opaque Supabase IDs in DB mode.
 *
 * @param identity - The resolved request identity for access filtering.
 */
export async function getAvailableModels(
  identity: RequestIdentity | null = null
): Promise<ArenaModel[]> {
  const catalog = await loadModelCatalog(identity);
  return catalog.map((model) => ({
    id: model.selectionId,
    name: model.name,
    provider: "openrouter" as const,
    role: model.role,
    badge: model.badge,
    description: model.description,
  }));
}

/**
 * Code-capable models only. Used by Code Arena to filter to models
 * with supports_code = true (role_tags includes "coding").
 *
 * @param identity - The resolved request identity for access filtering.
 */
export async function getAvailableCodeModels(
  identity: RequestIdentity | null = null
): Promise<ArenaModel[]> {
  const catalog = await loadModelCatalog(identity);
  return catalog
    .filter((model) => model.supportsCode)
    .map((model) => ({
      id: model.selectionId,
      name: model.name,
      provider: "openrouter" as const,
      role: model.role,
      badge: model.badge,
      description: model.description,
    }));
}

/**
 * Resolve client-selected ids to server-side models (incl. OpenRouter keys).
 * Throws 403 if any id is not part of the current catalog OR if the caller
 * does not have the required access level for a model.
 * Throws 503 if the managed catalog cannot be read.
 *
 * @param ids - selectionIds sent by the client.
 * @param identity - The resolved request identity for access validation.
 */
export async function resolveSelectedModels(
  ids: string[],
  identity: RequestIdentity | null = null
): Promise<ResolvedModel[]> {
  // Load the FULL catalog (all levels) for server-side validation, then check
  // access level per model. This prevents leaking model ids of restricted models.
  const supabase = getSupabaseServerClient();
  let allModels: ResolvedModel[];

  if (!supabase) {
    allModels = fallbackCatalog();
  } else {
    try {
      const { data, error } = await withTimeout(
        supabase
          .from("models")
          .select("id, model_key, display_name, description, role_tags, price_label, access_level")
          .eq("is_active", true)
          .eq("is_public", true)
          .in("id", ids),
        MODEL_CATALOG_QUERY_TIMEOUT_MS,
        "models selected ids query"
      );

      if (error || !data) {
        throw error ?? new Error("models table returned no result for selected ids.");
      }

      allModels = (data as DbModelRow[]).map((row) => ({
        selectionId: row.id,
        modelId: row.id,
        modelKey: row.model_key,
        name: row.display_name,
        role: roleFromTags(row.role_tags),
        badge: badgeFromTags(row.role_tags, row.price_label),
        description: row.description ?? undefined,
        accessLevel: (row.access_level ?? "anonymous") as "anonymous" | "registered" | "premium",
        supportsCode: row.role_tags?.includes("coding") ?? false,
      }));
    } catch {
      allModels = await loadModelCatalog(null);
    }
  }

  const plan = identity?.kind === "user" ? await fetchUserPlan(identity.userId) : null;
  const allowedLevels = allowedLevelsFor(identity, plan);
  const bySelectionId = new Map(allModels.map((model) => [model.selectionId, model]));

  return ids.map((id) => {
    const model = bySelectionId.get(id);
    if (!model) {
      throw new ApiError(
        403,
        "MODEL_NOT_ALLOWED",
        "One or more selected models are not allowed."
      );
    }
    if (!allowedLevels.includes(model.accessLevel)) {
      throw new ApiError(
        403,
        "MODEL_NOT_ALLOWED",
        identity?.kind === "guest"
          ? "Guests can only use free models. Sign in to access more models."
          : "You do not have access to one or more selected models."
      );
    }
    return model;
  });
}

/**
 * Resolve client-selected ids to code-capable models.
 * Same as resolveSelectedModels but additionally enforces supportsCode.
 *
 * @param ids - selectionIds sent by the client.
 * @param identity - The resolved request identity for access validation.
 */
export async function resolveSelectedCodeModels(
  ids: string[],
  identity: RequestIdentity | null = null
): Promise<ResolvedModel[]> {
  const models = await resolveSelectedModels(ids, identity);

  for (const model of models) {
    if (!model.supportsCode) {
      throw new ApiError(
        400,
        "MODEL_NOT_CODE_CAPABLE",
        `Model '${model.name}' does not support code tasks. Please select code-capable models.`
      );
    }
  }

  return models;
}
