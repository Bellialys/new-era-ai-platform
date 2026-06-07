/**
 * Model catalog (v0.5)
 *
 * The catalog is the single source of available models for both /api/models and
 * /api/compare. When Supabase is configured, it must be read from the database.
 * The hardcoded list is only an offline fallback for unconfigured environments.
 *
 * The client only ever sees and echoes back a `selectionId`:
 *   - DB mode:       selectionId = models.id (UUID), modelKey stays server-side
 *   - fallback mode: selectionId = OpenRouter model_key (dev/unconfigured only)
 * The OpenRouter `model_key` is resolved server-side from the selectionId, so
 * the browser never needs to know the raw provider key.
 */

import type { ArenaModel } from "@/types/arena";
import { ApiError } from "./utils";
import { getSupabaseServerClient } from "./supabase";
import { ALLOWED_MODELS } from "./models";

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
};

type DbModelRow = {
  id: string;
  model_key: string;
  display_name: string;
  description: string | null;
  role_tags: string[] | null;
  price_label: string | null;
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

function roleFromTags(tags: string[] | null): string {
  const matched = tags?.find((tag) => ROLE_LABELS[tag]);
  return matched ? ROLE_LABELS[matched] : "General-модель";
}

function badgeFromTags(tags: string[] | null, priceLabel: string | null): string | undefined {
  if (tags?.includes("coding")) return "Free Coding";
  if (tags?.includes("reasoning")) return "Free Reasoning";
  if (tags?.includes("fast")) return "Free Fast";
  return priceLabel === "free" ? "Free" : undefined;
}

function fallbackCatalog(): ResolvedModel[] {
  return ALLOWED_MODELS.map((model) => ({
    selectionId: model.id,
    modelId: null,
    modelKey: model.id,
    name: model.name,
    role: model.role,
    badge: model.badge,
    description: model.description,
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
 * Load the full active/public catalog. Falls back only when Supabase is not
 * configured; configured database failures must be visible so v0.5 does not
 * silently expose OpenRouter keys as client selection ids.
 */
export async function loadModelCatalog(): Promise<ResolvedModel[]> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return fallbackCatalog();
  }

  try {
    const { data, error } = await supabase
      .from("models")
      .select("id, model_key, display_name, description, role_tags, price_label")
      .eq("is_active", true)
      .eq("is_public", true)
      .order("sort_order", { ascending: true });

    if (error) {
      logModelCatalogFailure("models table query failed", error);
      throw new ApiError(
        503,
        "MODEL_CATALOG_UNAVAILABLE",
        "Model catalog is unavailable. Please try again later."
      );
    }

    if (!data || data.length === 0) {
      console.warn("models table returned no active public models.");
      throw new ApiError(
        503,
        "MODEL_CATALOG_EMPTY",
        "Model catalog is not configured. Please contact the project owner."
      );
    }

    return (data as DbModelRow[]).map((row) => ({
      selectionId: row.id,
      modelId: row.id,
      modelKey: row.model_key,
      name: row.display_name,
      role: roleFromTags(row.role_tags),
      badge: badgeFromTags(row.role_tags, row.price_label),
      description: row.description ?? undefined,
    }));
  } catch (caught) {
    if (caught instanceof ApiError) {
      throw caught;
    }

    logModelCatalogFailure("models table is unavailable", caught);
    throw new ApiError(
      503,
      "MODEL_CATALOG_UNAVAILABLE",
      "Model catalog is unavailable. Please try again later."
    );
  }
}

/**
 * Public catalog for the client. Never exposes the OpenRouter model_key.
 */
export async function getAvailableModels(): Promise<ArenaModel[]> {
  const catalog = await loadModelCatalog();
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
 * Resolve client-selected ids to server-side models (incl. OpenRouter keys).
 * Throws 403 if any id is not part of the current catalog.
 */
export async function resolveSelectedModels(ids: string[]): Promise<ResolvedModel[]> {
  const catalog = await loadModelCatalog();
  const bySelectionId = new Map(catalog.map((model) => [model.selectionId, model]));

  return ids.map((id) => {
    const model = bySelectionId.get(id);
    if (!model) {
      throw new ApiError(
        403,
        "MODEL_NOT_ALLOWED",
        "One or more selected models are not allowed."
      );
    }
    return model;
  });
}
