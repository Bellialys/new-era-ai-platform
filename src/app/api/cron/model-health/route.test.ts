import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getSupabaseServerClient } from "@/lib/server/supabase";
import type { CatalogRow } from "@/lib/server/model-health-sync";
import { GET } from "./route";

vi.mock("@/lib/server/supabase", () => ({ getSupabaseServerClient: vi.fn() }));

const SECRET = "fixture-".repeat(5);
const FIRST_DAY = "2026-11-16";
const FIRST_RUN = `${FIRST_DAY}T03:17:00.000Z`;
const MODEL_KEY = "google/fixture-sample:free";
const MODEL_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function request(headers: Record<string, string> = { "x-vercel-cron-schedule": "17 3 * * *" }) {
  return new NextRequest("https://app.test/api/cron/model-health", {
    headers: { Authorization: "Bearer " + SECRET, ...headers },
  });
}

function listing(id: string) {
  return {
    id,
    name: id,
    context_length: 16384,
    architecture: { output_modalities: ["text"] },
    pricing: { prompt: "0", completion: "0", request: "0" },
  };
}

function catalogRow(modelKey: string, id = MODEL_ID): CatalogRow {
  return {
    id,
    model_key: modelKey,
    display_name: modelKey,
    is_active: true,
    is_public: true,
    price_label: "free",
    raw_metadata: {},
    updated_at: "2026-11-15T03:17:00.000Z",
  };
}

function createFixture() {
  const journal = new Map<string, Record<string, unknown>>();
  const models = [catalogRow(MODEL_KEY)];
  const listings = [listing(MODEL_KEY)];
  const inference = vi.fn((_model: string) =>
    Response.json({ choices: [{ message: { content: "OK" } }] })
  );
  const options = { claimUnavailable: false, finishUnavailable: false };

  const rest = vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : null;

    if (url.pathname === "/rest/v1/model_health_runs") {
      if (method === "POST") {
        if (options.claimUnavailable) {
          return Response.json({ code: "PGRST205", message: "Table unavailable" }, { status: 404 });
        }
        if (journal.has(body.run_date)) {
          return Response.json({ code: "23505", message: "Duplicate date" }, { status: 409 });
        }
        journal.set(body.run_date, { ...body, status: "running" });
        return new Response(null, { status: 201 });
      }
      if (method === "PATCH") {
        if (options.finishUnavailable) {
          return Response.json({ code: "503", message: "Unavailable" }, { status: 503 });
        }
        const runDate = url.searchParams.get("run_date")?.slice(3) ?? "";
        const saved = journal.get(runDate);
        if (saved?.status !== "running" || url.searchParams.get("status") !== "eq.running") {
          return Response.json([]);
        }
        Object.assign(saved, body);
        return Response.json([{ run_date: runDate }]);
      }
    }
    if (url.pathname === "/rest/v1/models") {
      if (method === "GET") return Response.json(models);
      if (method === "POST") {
        models.push({ ...body, id: crypto.randomUUID(), updated_at: new Date().toISOString() });
        return new Response(null, { status: 201 });
      }
      if (method === "PATCH") {
        const model = models.find(({ id, updated_at }) =>
          url.searchParams.get("id") === "eq." + id &&
          url.searchParams.get("updated_at") === "eq." + updated_at
        );
        if (!model) return Response.json([]);
        Object.assign(model, body);
        return Response.json([{ id: model.id }]);
      }
    }
    throw new Error("Unexpected database request in the fixture.");
  });

  const provider = vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(String(input));
    if (url.href === "https://openrouter.ai/api/v1/models") {
      return Response.json({ data: listings });
    }
    if (url.href === "https://openrouter.ai/api/v1/chat/completions") {
      const { model } = JSON.parse(String(init?.body)) as { model: string };
      return inference(model);
    }
    throw new Error("Unexpected network request in the fixture.");
  });

  const client = createClient("https://fixture.supabase.co", "fixture-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: rest },
  });
  vi.mocked(getSupabaseServerClient).mockReturnValue(client);
  vi.stubGlobal("fetch", provider);

  return { journal, models, listings, inference, options, provider, rest };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(FIRST_RUN));
  vi.stubEnv("ENABLE_MODEL_HEALTH_CRON", "true");
  vi.stubEnv("CRON_SECRET", SECRET);
  vi.stubEnv("OPENROUTER_API_KEY", "fixture-provider-key");
  vi.mocked(getSupabaseServerClient).mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the model health cron run journal", () => {
  it("rejects unsigned and disabled calls before claiming a run", async () => {
    const fixture = createFixture();
    expect((await GET(new NextRequest("https://app.test/api/cron/model-health"))).status).toBe(401);
    vi.stubEnv("ENABLE_MODEL_HEALTH_CRON", "false");
    expect((await GET(request())).status).toBe(503);
    expect(fixture.rest).not.toHaveBeenCalled();
    expect(fixture.provider).not.toHaveBeenCalled();
  });

  it("admits only one of two simultaneous authenticated calls before provider discovery", async () => {
    const fixture = createFixture();
    const [first, duplicate] = await Promise.all([GET(request()), GET(request({}))]);
    expect(await first.json()).toMatchObject({
      status: "success", runDate: FIRST_DAY, summary: { checked: 1, inferenceCalls: 1 },
    });
    expect(await duplicate.json()).toEqual({
      status: "skipped", code: "MODEL_HEALTH_ALREADY_RUN", runDate: FIRST_DAY,
    });
    expect(fixture.provider).toHaveBeenCalledTimes(2);
    expect(fixture.inference).toHaveBeenCalledOnce();
    expect(fixture.journal.get(FIRST_DAY)).toMatchObject({
      source: "scheduled", status: "succeeded", checked: 1, inference_calls: 1,
    });
  });

  it("records completed work when an account failure interrupts a run", async () => {
    const fixture = createFixture();
    fixture.models.push(catalogRow("google/fixture-second:free", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"));
    fixture.listings.push(listing("google/fixture-second:free"));
    fixture.inference.mockImplementation((model) => model === MODEL_KEY
      ? Response.json({ choices: [{ message: { content: "OK" } }] })
      : new Response(null, { status: 401 }));

    const result = await GET(request({}));

    expect(result.status).toBe(503);
    expect(fixture.journal.get(FIRST_DAY)).toMatchObject({
      source: "manual", status: "failed", error_code: "MODEL_HEALTH_SYNC_FAILED",
      inference_calls: 2, checked: 1, healthy: 1,
    });
    expect(fixture.models[0].updated_at).toBe(FIRST_RUN);
    expect(fixture.models[1].updated_at).not.toBe(FIRST_RUN);
  });

  it("distinguishes a successful run with no work from an absent invocation", async () => {
    const fixture = createFixture();
    fixture.models.length = 0;
    fixture.listings.splice(0, 1, listing("unapproved-provider/candidate:free"));

    const result = await GET(request());

    expect(result.status).toBe(200);
    expect(fixture.journal.get(FIRST_DAY)).toMatchObject({
      status: "succeeded", error_code: null, checked: 0, inference_calls: 0,
    });
    expect(fixture.inference).not.toHaveBeenCalled();
  });

  it("fails closed before provider access when the journal is unavailable", async () => {
    const fixture = createFixture();
    fixture.options.claimUnavailable = true;

    const result = await GET(request());

    expect(result.status).toBe(503);
    expect(await result.json()).toMatchObject({ code: "MODEL_HEALTH_JOURNAL_UNAVAILABLE" });
    expect(fixture.provider).not.toHaveBeenCalled();
  });

  it("records missing provider credentials as a failed invocation", async () => {
    const fixture = createFixture();
    vi.stubEnv("OPENROUTER_API_KEY", "");

    const result = await GET(request());

    expect(result.status).toBe(503);
    expect(fixture.journal.get(FIRST_DAY)).toMatchObject({
      status: "failed", error_code: "MODEL_HEALTH_CREDENTIALS_MISSING", inference_calls: 0,
    });
    expect(fixture.provider).not.toHaveBeenCalled();
  });

  it("keeps a run reserved if journal finalization fails and admits the next UTC day", async () => {
    const fixture = createFixture();
    fixture.options.finishUnavailable = true;

    expect((await GET(request())).status).toBe(503);
    expect(fixture.journal.get(FIRST_DAY)).toMatchObject({ status: "running" });
    expect(await (await GET(request())).json()).toMatchObject({ status: "skipped" });
    expect(fixture.inference).toHaveBeenCalledOnce();

    fixture.options.finishUnavailable = false;
    vi.setSystemTime(new Date("2026-11-17T03:17:00.000Z"));
    expect((await GET(request())).status).toBe(200);
    expect(fixture.journal.get("2026-11-17")).toMatchObject({ status: "succeeded" });
    expect(fixture.inference).toHaveBeenCalledTimes(2);
  });

  it("separates an exhausted run deadline from a temporary model failure", async () => {
    const fixture = createFixture();
    const deadline = new AbortController();
    const originalTimeout = AbortSignal.timeout.bind(AbortSignal);
    vi.spyOn(AbortSignal, "timeout").mockImplementation((ms) =>
      ms === 46_000 ? deadline.signal : originalTimeout(ms)
    );
    fixture.inference.mockImplementation(() => {
      deadline.abort();
      throw deadline.signal.reason;
    });

    const result = await GET(request());

    expect(result.status).toBe(503);
    expect(fixture.journal.get(FIRST_DAY)).toMatchObject({
      status: "failed", error_code: "MODEL_HEALTH_DEADLINE_EXCEEDED", checked: 0, inference_calls: 1,
    });
    expect(fixture.models[0].raw_metadata).toEqual({});
  });
});

describe("model lifecycles across distinct runs", () => {
  it("keeps a temporary 429 neutral, hides after two hard failures and restores the same UUID", async () => {
    const fixture = createFixture();
    const expected = [
      { day: "16", providerStatus: 404, visible: true, hidden: 0, restored: 0 },
      { day: "17", providerStatus: 429, visible: true, hidden: 0, restored: 0 },
      { day: "18", providerStatus: 404, visible: false, hidden: 1, restored: 0 },
      { day: "19", providerStatus: 200, visible: false, hidden: 0, restored: 0 },
      { day: "20", providerStatus: 200, visible: true, hidden: 0, restored: 1 },
    ];

    for (const event of expected) {
      const runDate = "2026-11-" + event.day;
      vi.setSystemTime(new Date(runDate + "T03:17:00.000Z"));
      if (event.providerStatus !== 200) {
        fixture.inference.mockReturnValueOnce(new Response(null, { status: event.providerStatus }));
      }
      expect((await GET(request())).status).toBe(200);
      expect(fixture.models[0]).toMatchObject({
        id: MODEL_ID, is_public: event.visible, is_active: event.visible,
      });
      expect(fixture.journal.get(runDate)).toMatchObject({
        status: "succeeded", hidden: event.hidden, restored: event.restored,
      });
    }
    expect(fixture.models).toHaveLength(1);
  });

  it("records discovery and publication as different events", async () => {
    const fixture = createFixture();
    fixture.models.length = 0;

    expect((await GET(request())).status).toBe(200);
    expect(fixture.journal.get(FIRST_DAY)).toMatchObject({ discovered: 1, published: 0, restored: 0 });
    expect(fixture.models[0].is_public).toBe(false);
    const id = fixture.models[0].id;

    vi.setSystemTime(new Date("2026-11-17T03:17:00.000Z"));
    expect((await GET(request())).status).toBe(200);
    expect(fixture.journal.get("2026-11-17")).toMatchObject({ discovered: 0, published: 1, restored: 0 });
    expect(fixture.models[0]).toMatchObject({ id, is_public: true, is_active: true });
  });
});
