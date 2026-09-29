import { IMAGE_MODELS } from "@/lib/arena/image-models";
import { ALLOWED_MODELS } from "./models";
import { getSupabaseServerClient } from "./supabase";
import { ApiError } from "./utils";

const OPENROUTER_TEXT_MODELS_URL =
  "https://openrouter.ai/api/v1/models?output_modalities=text";
const OPENROUTER_IMAGE_MODELS_URL =
  "https://openrouter.ai/api/v1/images/models";
const OPENROUTER_PRICING_TIMEOUT_MS = 15_000;

export const OPENROUTER_PRICING_STALE_AFTER_MS = 24 * 60 * 60 * 1000;

type JsonRecord = Record<string, unknown>;

export type OpenRouterPublishedPriceSnapshot = {
  modelKey: string;
  provider: "openrouter";
  inputPricePerMillion: number | null;
  outputPricePerMillion: number | null;
  rawPricing: JsonRecord;
  currency: "USD";
  source: "openrouter_models_api";
  sourceCheckedAt: string;
};

export type CurrentModelPriceRow = {
  model_key: string;
  input_price_per_million: number | string | null;
  output_price_per_million: number | string | null;
  source_checked_at: string | null;
  currency: string | null;
  source: string;
};

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parsePerTokenPrice(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function toPerMillion(value: unknown): number | null {
  const perToken = parsePerTokenPrice(value);
  return perToken === null ? null : perToken * 1_000_000;
}

export function normalizeOpenRouterPricingResponse(
  body: unknown,
  checkedAt: string,
  allowedModelIds: ReadonlySet<string>
): {
  snapshots: OpenRouterPublishedPriceSnapshot[];
  missingModelIds: string[];
} {
  if (!isJsonRecord(body) || !Array.isArray(body.data)) {
    throw new ApiError(
      502,
      "PROVIDER_PRICING_INVALID",
      "OpenRouter pricing response is invalid."
    );
  }

  const byId = new Map<string, OpenRouterPublishedPriceSnapshot>();
  for (const item of body.data) {
    if (!isJsonRecord(item) || typeof item.id !== "string") continue;
    const modelKey = item.id.trim();
    if (!allowedModelIds.has(modelKey)) continue;

    const rawPricing = isJsonRecord(item.pricing) ? item.pricing : {};
    byId.set(modelKey, {
      modelKey,
      provider: "openrouter",
      inputPricePerMillion: toPerMillion(rawPricing.prompt),
      outputPricePerMillion: toPerMillion(rawPricing.completion),
      rawPricing,
      currency: "USD",
      source: "openrouter_models_api",
      sourceCheckedAt: checkedAt,
    });
  }

  const missingModelIds = [...allowedModelIds]
    .filter((modelId) => !byId.has(modelId))
    .sort();

  return {
    snapshots: [...byId.values()].sort((a, b) =>
      a.modelKey.localeCompare(b.modelKey)
    ),
    missingModelIds,
  };
}

async function fetchPricingBody(url: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(OPENROUTER_PRICING_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    throw new ApiError(
      502,
      "PROVIDER_PRICING_UNAVAILABLE",
      "OpenRouter pricing is temporarily unavailable."
    );
  }

  if (!response.ok) {
    throw new ApiError(
      502,
      "PROVIDER_PRICING_UNAVAILABLE",
      "OpenRouter pricing is temporarily unavailable."
    );
  }

  try {
    return await response.json();
  } catch {
    throw new ApiError(
      502,
      "PROVIDER_PRICING_INVALID",
      "OpenRouter pricing response is invalid."
    );
  }
}

export async function fetchCuratedOpenRouterPricing(): Promise<{
  snapshots: OpenRouterPublishedPriceSnapshot[];
  missingModelIds: string[];
  checkedAt: string;
}> {
  const checkedAt = new Date().toISOString();
  const textIds = new Set(ALLOWED_MODELS.map((model) => model.id));
  const imageIds = new Set(IMAGE_MODELS.map((model) => model.id));

  const [textBody, imageBody] = await Promise.all([
    fetchPricingBody(OPENROUTER_TEXT_MODELS_URL),
    fetchPricingBody(OPENROUTER_IMAGE_MODELS_URL),
  ]);

  const text = normalizeOpenRouterPricingResponse(textBody, checkedAt, textIds);
  const images = normalizeOpenRouterPricingResponse(imageBody, checkedAt, imageIds);

  const snapshots = new Map<string, OpenRouterPublishedPriceSnapshot>();
  for (const snapshot of [...text.snapshots, ...images.snapshots]) {
    snapshots.set(snapshot.modelKey, snapshot);
  }

  return {
    snapshots: [...snapshots.values()].sort((a, b) =>
      a.modelKey.localeCompare(b.modelKey)
    ),
    missingModelIds: [...new Set([
      ...text.missingModelIds,
      ...images.missingModelIds,
    ])].sort(),
    checkedAt,
  };
}

export async function syncCuratedOpenRouterPricing(): Promise<{
  checkedAt: string;
  synced: number;
  changed: number;
  missingModelIds: string[];
}> {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    throw new ApiError(500, "INTERNAL_ERROR", "Database not configured.");
  }

  const { snapshots, missingModelIds, checkedAt } =
    await fetchCuratedOpenRouterPricing();

  let changed = 0;
  for (const snapshot of snapshots) {
    const { data, error } = await supabase.rpc("upsert_model_price_snapshot", {
      p_model_key: snapshot.modelKey,
      p_provider: snapshot.provider,
      p_input_price_per_million: snapshot.inputPricePerMillion,
      p_output_price_per_million: snapshot.outputPricePerMillion,
      p_raw_pricing: snapshot.rawPricing,
      p_checked_at: snapshot.sourceCheckedAt,
      p_currency: snapshot.currency,
      p_source: snapshot.source,
    });

    if (error) {
      console.error("[OpenRouter pricing] snapshot sync failed", {
        modelKey: snapshot.modelKey,
        errorCode: typeof error.code === "string" ? error.code : null,
      });
      throw new ApiError(
        500,
        "PRICING_SYNC_FAILED",
        "Could not persist OpenRouter pricing."
      );
    }

    const rows = Array.isArray(data) ? data : [];
    const result = rows[0] as { changed?: unknown } | undefined;
    if (result?.changed === true) changed += 1;
  }

  return {
    checkedAt,
    synced: snapshots.length,
    changed,
    missingModelIds,
  };
}

function numericOrNull(value: number | string | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function loadCurrentOpenRouterPricing(
  modelKeys: readonly string[]
): Promise<Map<string, {
  inputPricePerMillion: number | null;
  outputPricePerMillion: number | null;
  currency: string;
  source: string;
  sourceCheckedAt: string | null;
  stale: boolean;
}>> {
  const supabase = getSupabaseServerClient();
  if (!supabase || modelKeys.length === 0) return new Map();

  const { data, error } = await supabase
    .from("model_price_history")
    .select(
      "model_key, input_price_per_million, output_price_per_million, source_checked_at, currency, source"
    )
    .eq("provider", "openrouter")
    .is("effective_to", null)
    .in("model_key", [...modelKeys]);

  if (error) {
    console.error("[OpenRouter pricing] current price query failed", {
      errorCode: typeof error.code === "string" ? error.code : null,
    });
    return new Map();
  }

  const now = Date.now();
  return new Map(
    ((data ?? []) as CurrentModelPriceRow[]).map((row) => {
      const checkedMs = row.source_checked_at
        ? Date.parse(row.source_checked_at)
        : Number.NaN;
      return [
        row.model_key,
        {
          inputPricePerMillion: numericOrNull(row.input_price_per_million),
          outputPricePerMillion: numericOrNull(row.output_price_per_million),
          currency: row.currency ?? "USD",
          source: row.source,
          sourceCheckedAt: row.source_checked_at,
          stale:
            !Number.isFinite(checkedMs) ||
            now - checkedMs > OPENROUTER_PRICING_STALE_AFTER_MS,
        },
      ];
    })
  );
}
