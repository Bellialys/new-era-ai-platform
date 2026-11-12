import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as cron } from "@/app/api/cron/model-health/route";
import { GET as listGeneral } from "@/app/api/models/route";
import { GET as listCode } from "@/app/api/code-models/route";
import type { CatalogRow, HealthSummary } from "./model-health-sync";

const TEST_DB = "https://stage5-fixture.supabase.co";
const APP = "https://stage5-fixture.test";
const MODEL = "cohere/stage5-existing:free";
const NEW_MODEL = "nvidia/stage5-discovery:free";
const PAID = "openai/stage5-priced:free";
const SECRET = "stage5-synthetic-fixture-secret-only";
const DAY = 24 * 60 * 60 * 1000;
const START = Date.UTC(2026, 10, 13);

type Row = CatalogRow & {
  provider: string;
  role_tags: string[];
  access_level: string;
  sort_order: number;
};

function freeListing(id: string, prompt = "0") {
  return {
    id,
    name: id,
    context_length: 8192,
    pricing: { prompt, completion: "0", request: "0" },
    architecture: { output_modalities: ["text"] },
  };
}

function row(modelKey: string, active = true): Row {
  return {
    id: randomUUID(),
    model_key: modelKey,
    display_name: modelKey,
    provider: "openrouter",
    is_active: active,
    is_public: active,
    price_label: "free",
    access_level: "anonymous",
    role_tags: ["coding"],
    sort_order: 10,
    updated_at: new Date(START - DAY).toISOString(),
    raw_metadata: active ? {} : { verification_retest_required: true },
  };
}

function fixture(rows: Row[], listings: ReturnType<typeof freeListing>[]) {
  const byKey = new Map(rows.map((item) => [item.model_key, item]));
  const statuses = new Map<string, number | "timeout">();
  const probes: string[] = [];

  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (url.origin === "https://openrouter.ai") {
      if (url.pathname === "/api/v1/models" && request.method === "GET") {
        return Response.json({ data: listings });
      }
      expect(url.pathname).toBe("/api/v1/chat/completions");
      expect(request.method).toBe("POST");
      const { model } = await request.json();
      expect(model).not.toBe(PAID);
      probes.push(model);
      const status = statuses.get(model) ?? 200;
      if (status === "timeout") throw new DOMException("Simulated timeout", "TimeoutError");
      if (status !== 200) return Response.json({}, { status });
      return Response.json({ choices: [{ message: { content: "OK" } }] });
    }

    // Requests outside the two synthetic adapters fail before any network call.
    expect(url.origin).toBe(TEST_DB);
    expect(url.pathname).toBe("/rest/v1/models");
    const query = url.searchParams;
    if (request.method === "PATCH") {
      const current = [...byKey.values()].find((item) =>
        query.get("id") === "eq." + item.id &&
        query.get("updated_at") === "eq." + item.updated_at
      );
      if (!current) return Response.json([]);
      const change = await request.json();
      byKey.set(current.model_key, { ...current, ...change });
      return Response.json([{ id: current.id }]);
    }
    if (request.method === "POST") {
      const inserted = await request.json();
      expect(byKey.has(inserted.model_key)).toBe(false);
      byKey.set(inserted.model_key, { ...inserted, id: randomUUID(), updated_at: new Date().toISOString() });
      return new Response(null, { status: 201 });
    }
    expect(request.method).toBe("GET");
    const visible = [...byKey.values()].filter((item) =>
      (query.get("is_active") !== "eq.true" || item.is_active) &&
      (query.get("is_public") !== "eq.true" || item.is_public)
    );
    return Response.json(visible);
  });

  return { byKey, statuses, probes };
}

function cronRequest(authorized = true) {
  return new NextRequest(APP + "/api/cron/model-health", {
    headers: authorized ? { authorization: "Bearer " + SECRET } : {},
  });
}

async function run(day: number): Promise<HealthSummary> {
  vi.setSystemTime(START + day * DAY);
  const response = await cron(cronRequest());
  expect(response.status).toBe(200);
  return (await response.json()).summary;
}

async function catalogs() {
  const [general, code] = await Promise.all([
    listGeneral(new NextRequest(APP + "/api/models")),
    listCode(new NextRequest(APP + "/api/code-models")),
  ]);
  expect(general.status).toBe(200);
  expect(code.status).toBe(200);
  const toIds = async (response: Response) =>
    (await response.json()).models.map((entry: { id: string }) => entry.id).sort();
  return { general: await toIds(general), code: await toIds(code) };
}

describe("Stage 5 Preview lifecycle with isolated data", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(START);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", TEST_DB);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "stage5-test-placeholder");
    vi.stubEnv("OPENROUTER_API_KEY", "stage5-test-placeholder");
    vi.stubEnv("CRON_SECRET", SECRET);
    vi.stubEnv("ENABLE_MODEL_HEALTH_CRON", "true");
    for (const name of ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "KV_REST_API_URL", "KV_REST_API_TOKEN"]) {
      vi.stubEnv(name, undefined);
    }
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("keeps a model after 429/timeout, hides after two failures, restores its UUID, and discovers only verified free models", async () => {
    const original = row(MODEL);
    const { byKey, probes, statuses } = fixture([original], [
      freeListing(MODEL), freeListing(NEW_MODEL), freeListing(PAID, "0.01"),
    ]);
    statuses.set(MODEL, 404);
    expect(await run(0)).toMatchObject({ checked: 2, hidden: 0, discovered: 1 });
    const discovered = byKey.get(NEW_MODEL)!;
    expect(discovered).toMatchObject({ is_active: false, is_public: false });
    expect(await catalogs()).toEqual({ general: [original.id], code: [original.id] });
    expect(await run(0)).toMatchObject({ checked: 0 });
    expect(probes).toEqual([MODEL, NEW_MODEL]);

    statuses.set(MODEL, 429);
    expect(await run(1)).toMatchObject({ hidden: 0, restored: 1 });
    const activeIds = [original.id, discovered.id].sort();
    expect(await catalogs()).toEqual({ general: activeIds, code: [original.id] });
    expect(byKey.get(MODEL)?.raw_metadata).toMatchObject({
      auto_health: { failure_streak: 1, last_status: "RATE_LIMIT" },
    });

    statuses.set(MODEL, "timeout");
    expect(await run(2)).toMatchObject({ hidden: 0 });
    expect(await catalogs()).toEqual({ general: activeIds, code: [original.id] });
    expect(byKey.get(MODEL)?.raw_metadata).toMatchObject({
      auto_health: { failure_streak: 1, last_status: "TIMEOUT" },
    });

    statuses.set(MODEL, 404);
    expect(await run(3)).toMatchObject({ hidden: 1 });
    expect(await catalogs()).toEqual({ general: [discovered.id], code: [] });
    expect(byKey.get(MODEL)?.id).toBe(original.id);

    statuses.set(MODEL, 200);
    expect(await run(4)).toMatchObject({ restored: 0 });
    expect(await catalogs()).toEqual({ general: [discovered.id], code: [] });
    expect(await run(5)).toMatchObject({ restored: 1 });
    expect(await catalogs()).toEqual({ general: activeIds, code: [original.id] });
    expect(byKey.get(MODEL)?.id).toBe(original.id);
    expect(byKey.get(NEW_MODEL)?.id).toBe(discovered.id);
    expect(byKey.has(PAID)).toBe(false);
  });

  it("uses at most five probes in a run across active, quarantined, and discovery candidates", async () => {
    const active = Array.from({ length: 4 }, (_, n) => row("cohere/stage5-active-" + n + ":free"));
    const quarantined = row("cohere/stage5-quarantined:free", false);
    const { probes } = fixture([ ...active, quarantined ], [
      ...active.map(({ model_key }) => freeListing(model_key)),
      freeListing(quarantined.model_key),
      freeListing(NEW_MODEL),
    ]);
    expect(await run(0)).toMatchObject({ checked: 5, discovered: 1 });
    expect(probes).toHaveLength(5);
    expect(new Set(probes).size).toBe(5);
  });

  it("rejects unauthorized and disabled cron requests without reaching the fixture", async () => {
    const fetchSpy = vi.fn(() => { throw new Error("External call not expected"); });
    vi.stubGlobal("fetch", fetchSpy);
    expect((await cron(cronRequest(false))).status).toBe(401);
    vi.stubEnv("ENABLE_MODEL_HEALTH_CRON", "false");
    const response = await cron(cronRequest());
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "MODEL_HEALTH_DISABLED" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
