/**
 * Daily, bounded free-model health and discovery for the Supabase catalog.
 * All provider calls are server-side, use a fixed OpenRouter origin, and never
 * process customer prompts. Public catalog changes require real text inference.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

const CATALOG_URL = "https://openrouter.ai/api/v1/models";
const COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions";
const PROBE_PROMPT = "Reply with exactly one word: OK";
const COOLDOWN_MS = 20 * 60 * 60 * 1000;
const PENDING_RETRY_COOLDOWN_MS = 2 * COOLDOWN_MS;
const OPENROUTER_TIMEOUT_MS = 9_000;
const MAX_ACTIVE_PROBES = 3;
const MAX_QUARANTINED_PROBES = 1;
const MAX_DISCOVERY_PROBES = 1;
const MAX_CATALOG_ROWS = 3000;
const ALLOWED_DISCOVERY_PROVIDERS = new Set([
  "cohere", "google", "nvidia", "qwen", "meta-llama",
  "mistralai", "liquid", "microsoft", "openai", "deepseek",
]);

export type ProbeStatus =
  | "OK" | "NOT_FOUND" | "EMPTY_RESPONSE" | "NOT_LISTED"
  | "NOT_FREE" | "RATE_LIMIT" | "AUTH_ERROR" | "NO_CREDITS"
  | "TIMEOUT" | "PROVIDER_ERROR" | "NETWORK_ERROR";

type ObjectValue = Record<string, unknown>;

export interface CatalogRow {
  id: string;
  model_key: string;
  display_name: string;
  is_active: boolean;
  is_public: boolean;
  price_label: string;
  updated_at: string;
  raw_metadata: unknown;
}

export interface FreeTextModel {
  id: string;
  name: string;
  context_length: number;
  created?: number;
  top_provider?: { max_completion_tokens?: number };
}

export interface HealthChange {
  is_active: boolean;
  is_public: boolean;
  raw_metadata: ObjectValue;
}

export interface HealthSummary {
  inferenceCalls: number;
  checked: number;
  healthy: number;
  hidden: number;
  restored: number;
  discovered: number;
  published: number;
  skipped: number;
}

/** Counters shared with the run journal so a failed run can record progress. */
export function createHealthSummary(): HealthSummary {
  return {
    inferenceCalls: 0, checked: 0, healthy: 0, hidden: 0,
    restored: 0, discovered: 0, published: 0, skipped: 0,
  };
}

function isObject(value: unknown): value is ObjectValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asObject(value: unknown): ObjectValue {
  return isObject(value) ? value : {};
}

function getNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function priceIsZero(value: unknown): boolean {
  return (typeof value === "string" || typeof value === "number") &&
    String(value).trim() !== "" &&
    Number.isFinite(Number(value)) && Number(value) === 0;
}

function freeModelSlug(id: unknown): id is string {
  return typeof id === "string" &&
    id.length <= 160 &&
    /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._/-]*:free$/i.test(id);
}

export function isEligibleFreeTextModel(value: unknown, today = new Date()): value is FreeTextModel {
  if (!isObject(value) || !freeModelSlug(value.id) ||
      typeof value.name !== "string" || !value.name.trim() ||
      typeof value.context_length !== "number" ||
      !Number.isInteger(value.context_length) || value.context_length < 4096) return false;
  const prices = asObject(value.pricing);
  if (!priceIsZero(prices.prompt) || !priceIsZero(prices.completion) ||
      (prices.request !== undefined && !priceIsZero(prices.request))) return false;
  const arch = asObject(value.architecture);
  const outputs = arch.output_modalities;
  const outputIsText = Array.isArray(outputs)
    ? outputs.includes("text")
    : typeof arch.modality === "string" && arch.modality.endsWith("->text");
  if (!outputIsText) return false;
  const expiration = value.expiration_date;
  if (typeof expiration === "string" && expiration.slice(0, 10) < today.toISOString().slice(0, 10)) {
    return false;
  }
  return true;
}

function healthOf(metadata: unknown): ObjectValue {
  return asObject(asObject(metadata).auto_health);
}

function lastProbeAt(row: CatalogRow): number {
  const last = healthOf(row.raw_metadata).checked_at;
  if (typeof last !== "string") return 0;
  const parsed = Date.parse(last);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function shouldProbe(row: CatalogRow, now: Date): boolean {
  const meta = asObject(row.raw_metadata);
  const health = healthOf(row.raw_metadata);
  const reportsRepeatedTemporaryFailure = health.state === "pending" &&
    getNumber(health.temporary_streak) >= 2;
  const cooldown = reportsRepeatedTemporaryFailure ? PENDING_RETRY_COOLDOWN_MS : COOLDOWN_MS;
  return meta.auto_health_exempt !== true &&
    now.getTime() - lastProbeAt(row) >= cooldown;
}

function healthStatusCounts(status: ProbeStatus): "ok" | "hard" | "neutral" {
  if (status === "OK") return "ok";
  if (status === "NOT_FOUND" || status === "EMPTY_RESPONSE" ||
      status === "NOT_LISTED" || status === "NOT_FREE") return "hard";
  return "neutral";
}

export function transitionHealth(
  row: Pick<CatalogRow, "is_active" | "is_public" | "raw_metadata">,
  status: ProbeStatus,
  checkedAt: string,
): HealthChange {
  const meta = asObject(row.raw_metadata);
  const previous = healthOf(meta);
  const classification = healthStatusCounts(status);
  const successStreak = classification === "ok"
    ? getNumber(previous.success_streak) + 1
    : classification === "hard" ? 0 : getNumber(previous.success_streak);
  const failureStreak = classification === "hard"
    ? getNumber(previous.failure_streak) + 1
    : classification === "ok" ? 0 : getNumber(previous.failure_streak);
  const temporaryStreak = classification === "neutral"
    ? getNumber(previous.temporary_streak) + 1
    : 0;
  const discovered = previous.discovered === true;
  let active = row.is_active;
  let isPublic = row.is_public;
  if (status === "NOT_FREE") {
    active = false;
    isPublic = false;
  } else if (classification === "hard" && failureStreak >= 2) {
    active = false;
    isPublic = false;
  } else if (classification === "ok" && successStreak >= 2) {
    active = true;
    isPublic = true;
  }
  const state = active && isPublic
    ? "healthy"
    : discovered && failureStreak >= 2
      ? "rejected"
      : discovered ? "pending" : "quarantined";
  return {
    is_active: active,
    is_public: isPublic,
    raw_metadata: {
      ...meta,
      verification_status: active && isPublic
        ? "auto_live_inference_verified"
        : status === "NOT_FREE" ? "auto_non_free_quarantined" : "auto_pending_or_quarantined",
      verification_retest_required: !(active && isPublic),
      auto_health: {
        ...previous,
        managed: true,
        state,
        success_streak: successStreak,
        failure_streak: failureStreak,
        temporary_streak: temporaryStreak,
        checked_at: checkedAt,
        last_status: status,
      },
    },
  };
}

export function extractText(value: unknown): string {
  const data = asObject(value);
  const choices = data.choices;
  if (!Array.isArray(choices) || !choices.length) return "";
  const message = asObject(asObject(choices[0]).message);
  if (typeof message.content === "string") return message.content.trim();
  if (Array.isArray(message.content)) {
    return message.content.map((piece: unknown) => {
      const item = asObject(piece);
      return item.type === "text" && typeof item.text === "string" ? item.text : "";
    }).join("").trim();
  }
  return "";
}

function openRouterSignal(runSignal?: AbortSignal): AbortSignal {
  const timeout = AbortSignal.timeout(OPENROUTER_TIMEOUT_MS);
  return runSignal ? AbortSignal.any([runSignal, timeout]) : timeout;
}

export async function probeFreeModel(
  modelId: string,
  apiKey: string,
  callFetch: typeof fetch = fetch,
  runSignal?: AbortSignal,
): Promise<ProbeStatus> {
  if (!freeModelSlug(modelId)) return "NOT_FREE";
  try {
    const response = await callFetch(COMPLETIONS_URL, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://new-era-ai-platform.vercel.app",
        "X-Title": "New Era AI Platform model health check",
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "user", content: PROBE_PROMPT }],
        max_tokens: 384,
        temperature: 0,
        stream: false,
      }),
      cache: "no-store",
      signal: openRouterSignal(runSignal),
    });
    if (response.status === 429) return "RATE_LIMIT";
    if (response.status === 404) return "NOT_FOUND";
    if (response.status === 401 || response.status === 403) return "AUTH_ERROR";
    if (response.status === 402) return "NO_CREDITS";
    if (!response.ok) return "PROVIDER_ERROR";
    const result: unknown = await response.json();
    return extractText(result) ? "OK" : "EMPTY_RESPONSE";
  } catch (error) {
    return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")
      ? "TIMEOUT" : "NETWORK_ERROR";
  }
}

async function fetchEligibleModels(apiKey: string, runSignal: AbortSignal): Promise<FreeTextModel[]> {
  const response = await fetch(CATALOG_URL, {
    headers: { Authorization: "Bearer " + apiKey },
    cache: "no-store",
    signal: openRouterSignal(runSignal),
  });
  if (!response.ok) throw new Error("OpenRouter catalog is unavailable (HTTP " + response.status + ").");
  const payload: unknown = await response.json();
  const data = asObject(payload).data;
  if (!Array.isArray(data)) throw new Error("OpenRouter returned an invalid model catalog.");
  return data.filter((model) => isEligibleFreeTextModel(model));
}

function chooseLeastRecent(rows: CatalogRow[], count: number): CatalogRow[] {
  return [...rows].sort((a, b) => lastProbeAt(a) - lastProbeAt(b) ||
    a.model_key.localeCompare(b.model_key)).slice(0, count);
}

export function selectHealthTargets(
  rows: CatalogRow[],
  catalog: FreeTextModel[],
  now: Date,
): { active: CatalogRow[]; quarantined: CatalogRow[]; pending: CatalogRow[]; fresh: FreeTextModel[] } {
  const eligibleRows = rows.filter((row) => shouldProbe(row, now) &&
    freeModelSlug(row.model_key) && row.price_label === "free");
  const activeRows = eligibleRows.filter((row) => row.is_active && row.is_public);
  const priority = chooseLeastRecent(
    activeRows.filter((row) => getNumber(healthOf(row.raw_metadata).failure_streak) === 1),
    1,
  );
  const active = [
    ...priority,
    ...chooseLeastRecent(activeRows.filter((row) => row.id !== priority[0]?.id), MAX_ACTIVE_PROBES - priority.length),
  ];
  const quarantined = chooseLeastRecent(
    eligibleRows.filter((row) => {
      const meta = asObject(row.raw_metadata);
      const health = healthOf(meta);
      return !row.is_active && health.state !== "pending" &&
        health.state !== "rejected" &&
        (meta.verification_retest_required === true || health.state === "quarantined");
    }),
    MAX_QUARANTINED_PROBES,
  );
  const pending = chooseLeastRecent(
    eligibleRows.filter((row) =>
      !row.is_active && healthOf(row.raw_metadata).state === "pending"),
    MAX_DISCOVERY_PROBES,
  );
  const known = new Set(rows.map((row) => row.model_key));
  const newModels = catalog.filter((model) =>
    ALLOWED_DISCOVERY_PROVIDERS.has(model.id.split("/")[0]) && !known.has(model.id));
  newModels.sort((a, b) => (b.created ?? 0) - (a.created ?? 0) || a.id.localeCompare(b.id));
  const day = Math.floor(now.getTime() / 86400000);
  const fresh = pending.length || !newModels.length
    ? [] : [newModels[day % newModels.length]];
  return { active, quarantined, pending, fresh };
}

async function updateExisting(
  db: SupabaseClient,
  row: CatalogRow,
  result: HealthChange,
  checkedAt: string,
  signal: AbortSignal,
): Promise<boolean> {
  // Optimistic compare-and-swap: a stale cron run cannot overwrite a newer
  // admin/catalog update. One model's in-flight result never touches others.
  const { data, error } = await db.from("models")
    .update({
      is_active: result.is_active,
      is_public: result.is_public,
      raw_metadata: result.raw_metadata,
      updated_at: checkedAt,
    })
    .eq("id", row.id)
    .eq("updated_at", row.updated_at)
    .select("id")
    .abortSignal(signal);
  if (error) throw new Error("Failed to persist model health update.");
  return Array.isArray(data) && data.length === 1;
}

async function insertDiscovery(
  db: SupabaseClient,
  model: FreeTextModel,
  result: HealthChange,
  signal: AbortSignal,
): Promise<boolean> {
  const { error } = await db.from("models").insert({
    provider: "openrouter",
    model_key: model.id,
    display_name: model.name.trim().slice(0, 120),
    description: "Автоматически обнаруженная бесплатная модель. Правила хранения данных зависят от провайдера; не отправляйте конфиденциальную информацию.",
    price_label: "free",
    is_active: result.is_active,
    is_public: result.is_public,
    access_level: "anonymous",
    role_tags: ["general", "auto-discovered"],
    context_length: model.context_length,
    max_output_tokens: model.top_provider?.max_completion_tokens ?? null,
    input_price_per_million: 0,
    output_price_per_million: 0,
    sort_order: 1000,
    raw_metadata: result.raw_metadata,
  }).abortSignal(signal);
  // A concurrent discovery may have inserted the exact same model.
  if (error?.code === "23505") return false;
  if (error) throw new Error("Failed to persist discovered model.");
  return true;
}

/** Check the next bounded batch and retain counters for each saved change. */
export async function runModelHealthSync(
  db: SupabaseClient,
  apiKey: string,
  {
    signal = new AbortController().signal,
    summary = createHealthSummary(),
  }: { signal?: AbortSignal; summary?: HealthSummary } = {},
): Promise<HealthSummary> {
  if (!apiKey.trim()) throw new Error("Missing OpenRouter credential.");
  signal.throwIfAborted();
  const now = new Date();
  const checkedAt = now.toISOString();
  const { data, error } = await db.from("models")
    .select("id, model_key, display_name, is_active, is_public, price_label, updated_at, raw_metadata")
    .eq("provider", "openrouter")
    .limit(MAX_CATALOG_ROWS)
    .abortSignal(signal);
  if (error || !data) throw new Error("Unable to load model catalog from Supabase.");
  const rows = data as CatalogRow[];
  const catalog = await fetchEligibleModels(apiKey, signal);
  signal.throwIfAborted();
  // Fail closed on malformed/empty provider catalogs to avoid mass removal.
  if (catalog.length === 0) throw new Error("OpenRouter returned no eligible free models.");
  const { active, quarantined, pending, fresh } = selectHealthTargets(rows, catalog, now);
  const listing = new Map(catalog.map((model) => [model.id, model]));
  for (const row of [...active, ...quarantined, ...pending]) {
    signal.throwIfAborted();
    const isListed = listing.has(row.model_key);
    if (isListed) summary.inferenceCalls++;
    const status = isListed
      ? await probeFreeModel(row.model_key, apiKey, fetch, signal)
      : "NOT_LISTED";
    signal.throwIfAborted();
    if (status === "AUTH_ERROR" || status === "NO_CREDITS") {
      // Account-wide failures must not change individual models.
      throw new Error("Provider credential or credits unavailable; model states unchanged for this probe.");
    }
    const change = transitionHealth(row, status, checkedAt);
    const saved = await updateExisting(db, row, change, checkedAt, signal);
    if (!saved) {
      summary.skipped++;
      continue;
    }
    summary.checked++;
    if (status === "OK") summary.healthy++;
    if (row.is_active && !change.is_active) summary.hidden++;
    if (!row.is_active && change.is_active) {
      if (healthOf(row.raw_metadata).state === "pending") summary.published++;
      else summary.restored++;
    }
  }

  for (const model of fresh) {
    signal.throwIfAborted();
    summary.inferenceCalls++;
    const status = await probeFreeModel(model.id, apiKey, fetch, signal);
    signal.throwIfAborted();
    if (status === "AUTH_ERROR" || status === "NO_CREDITS") {
      throw new Error("Provider credential or credits unavailable during discovery.");
    }
    // Persist only the first confirmed working probe, not every API listing.
    if (status !== "OK") {
      summary.skipped++;
      continue;
    }
    const initial: ObjectValue = {
      auto_health: { managed: true, discovered: true, state: "pending" },
      data_policy: "provider_policy_applies",
      verification_source: CATALOG_URL,
    };
    const change = transitionHealth(
      { is_active: false, is_public: false, raw_metadata: initial },
      status, checkedAt,
    );
    if (!await insertDiscovery(db, model, change, signal)) {
      summary.skipped++;
      continue;
    }
    summary.discovered++;
    summary.checked++;
    summary.healthy++;
  }

  signal.throwIfAborted();
  return summary;
}
