import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  getAvailableCodeModels,
  getAvailableModels,
  resolveSelectedCodeModels,
  resolveSelectedModels,
} from "./model-catalog";
import { getSupabaseServerClient } from "./supabase";
import { ALLOWED_MODELS } from "./models";
import { ApiError } from "./utils";

vi.mock("./supabase", () => ({
  getSupabaseServerClient: vi.fn(),
}));

const mockedGetSupabaseServerClient = vi.mocked(getSupabaseServerClient);

beforeEach(() => {
  vi.stubEnv("ENABLE_MODEL_HEALTH_CRON", undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const EXPECTED_FALLBACK_CODE_MODEL_IDS = [
  "cohere/north-mini-code:free",
  "dots-studio/dots-3-note-preview:free",
  "xingchen-agi/xing4.0-29b-a4b:free",
  "recursive/flint-v1.0:free",
] as const;

const dbRows = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    model_key: "google/gemma-4-26b-a4b-it:free",
    display_name: "Gemma 4 26B A4B",
    description: "DB model",
    role_tags: ["general", "default"],
    price_label: "free",
    access_level: "anonymous",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    model_key: "google/gemma-4-31b-it:free",
    display_name: "Gemma 4 31B",
    description: null,
    role_tags: ["general", "reasoning"],
    price_label: "free",
    access_level: "anonymous",
  },
];

type MockQueryResult = {
  data: typeof dbRows | null;
  error: { code?: string; message?: string } | null;
};

function createMockSupabase(result: MockQueryResult) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    in: vi.fn((column: string) => (column === "id" ? Promise.resolve(result) : query)),
    order: vi.fn(async () => result),
  };
  const client = {
    from: vi.fn(() => query),
  };

  return { client, query };
}

describe("model catalog (fallback mode)", () => {
  beforeEach(() => {
    mockedGetSupabaseServerClient.mockReset();
    mockedGetSupabaseServerClient.mockReturnValue(null);
  });

  it("getAvailableModels returns the hardcoded list without adding modelKey", async () => {
    const models = await getAvailableModels();
    expect(models).toHaveLength(ALLOWED_MODELS.length);
    expect(models[0].id).toBe(ALLOWED_MODELS[0].id);
    // ArenaModel must not leak any server-only fields.
    expect(models[0]).not.toHaveProperty("modelKey");
    expect(models[0]).not.toHaveProperty("supportsCode");
  });

  it("returns the exact approved code-capable fallback catalog", async () => {
    const models = await getAvailableCodeModels();

    expect(models.map((model) => model.id)).toEqual(EXPECTED_FALLBACK_CODE_MODEL_IDS);
    models.forEach((model) => expect(model).not.toHaveProperty("supportsCode"));
  });

  it("resolves every approved fallback coding model for Code Arena", async () => {
    const resolved = await resolveSelectedCodeModels([...EXPECTED_FALLBACK_CODE_MODEL_IDS]);

    expect(resolved.map((model) => model.modelKey)).toEqual(EXPECTED_FALLBACK_CODE_MODEL_IDS);
    expect(resolved.every((model) => model.supportsCode)).toBe(true);
  });

  it("rejects a fallback model without explicit code capability", async () => {
    const generalModelId = "liquid/lfm-2.5-2.6b:free";
    await expect(resolveSelectedCodeModels([generalModelId])).rejects.toMatchObject({
      statusCode: 400,
      errorCode: "MODEL_NOT_CODE_CAPABLE",
    });
  });

  it("resolveSelectedModels maps selection ids to OpenRouter keys", async () => {
    const ids = [ALLOWED_MODELS[0].id, ALLOWED_MODELS[1].id];
    const resolved = await resolveSelectedModels(ids);

    expect(resolved.map((m) => m.selectionId)).toEqual(ids);
    expect(resolved[0].modelKey).toBe(ALLOWED_MODELS[0].id);
    expect(resolved[0].modelId).toBeNull();
  });

  it("resolveSelectedModels throws 403 for an unknown id", async () => {
    await expect(resolveSelectedModels(["evil/model"])).rejects.toMatchObject({
      statusCode: 403,
    });
    await expect(resolveSelectedModels(["evil/model"])).rejects.toBeInstanceOf(ApiError);
  });
});

describe("model catalog (DB mode)", () => {
  beforeEach(() => {
    mockedGetSupabaseServerClient.mockReset();
  });

  it("getAvailableModels returns Supabase UUID selection ids without exposing model keys", async () => {
    const { client, query } = createMockSupabase({ data: dbRows, error: null });
    mockedGetSupabaseServerClient.mockReturnValue(
      client as unknown as ReturnType<typeof getSupabaseServerClient>
    );

    const models = await getAvailableModels();

    expect(client.from).toHaveBeenCalledWith("models");
    expect(query.select).toHaveBeenCalledWith(
      "id, model_key, display_name, description, role_tags, price_label, access_level"
    );
    expect(query.eq).toHaveBeenNthCalledWith(1, "is_active", true);
    expect(query.eq).toHaveBeenNthCalledWith(2, "is_public", true);
    expect(query.order).toHaveBeenCalledWith("sort_order", { ascending: true });
    expect(models[0]).toMatchObject({
      id: dbRows[0].id,
      name: dbRows[0].display_name,
      provider: "openrouter",
      badge: "Free",
      description: dbRows[0].description,
    });
    expect(models[0].id).not.toBe(dbRows[0].model_key);
    expect(models[0]).not.toHaveProperty("modelKey");
  });

  it("resolveSelectedModels maps UUID selection ids to server-only model keys", async () => {
    const { client } = createMockSupabase({ data: dbRows, error: null });
    mockedGetSupabaseServerClient.mockReturnValue(
      client as unknown as ReturnType<typeof getSupabaseServerClient>
    );

    const resolved = await resolveSelectedModels([dbRows[0].id, dbRows[1].id]);

    expect(resolved).toEqual([
      expect.objectContaining({
        selectionId: dbRows[0].id,
        modelId: dbRows[0].id,
        modelKey: dbRows[0].model_key,
      }),
      expect.objectContaining({
        selectionId: dbRows[1].id,
        modelId: dbRows[1].id,
        modelKey: dbRows[1].model_key,
      }),
    ]);
  });

  it("falls back when a configured models query fails", async () => {
    const { client } = createMockSupabase({
      data: null,
      error: { code: "42501", message: "permission denied for table models" },
    });
    mockedGetSupabaseServerClient.mockReturnValue(
      client as unknown as ReturnType<typeof getSupabaseServerClient>
    );

    const models = await getAvailableModels();

    expect(models).toHaveLength(ALLOWED_MODELS.length);
    expect(models[0].id).toBe(ALLOWED_MODELS[0].id);
  });

  it("falls back when the configured catalog is empty", async () => {
    const { client } = createMockSupabase({ data: [], error: null });
    mockedGetSupabaseServerClient.mockReturnValue(
      client as unknown as ReturnType<typeof getSupabaseServerClient>
    );

    const models = await getAvailableModels();

    expect(models).toHaveLength(ALLOWED_MODELS.length);
    expect(models[0].id).toBe(ALLOWED_MODELS[0].id);
  });
});

describe("model catalog with automatic health checks enabled", () => {
  const catalogs = [
    { name: "Prompt Arena", list: getAvailableModels, resolve: resolveSelectedModels },
    { name: "Code Arena", list: getAvailableCodeModels, resolve: resolveSelectedCodeModels },
  ];
  const unavailable = {
    statusCode: 503,
    errorCode: "MODEL_CATALOG_UNAVAILABLE",
  };

  beforeEach(() => {
    vi.stubEnv("ENABLE_MODEL_HEALTH_CRON", "true");
    mockedGetSupabaseServerClient.mockReset();
  });

  it.each(catalogs)("$name fails closed when Supabase is unconfigured", async ({ list, resolve }) => {
    mockedGetSupabaseServerClient.mockReturnValue(null);

    await expect(list()).rejects.toMatchObject(unavailable);
    await expect(resolve([ALLOWED_MODELS[0].id])).rejects.toMatchObject(unavailable);
  });

  it.each(catalogs)("$name fails closed when the configured catalog query fails", async ({ list, resolve }) => {
    const { client } = createMockSupabase({
      data: null,
      error: { message: "Supabase unavailable" },
    });
    mockedGetSupabaseServerClient.mockReturnValue(
      client as unknown as ReturnType<typeof getSupabaseServerClient>
    );

    await expect(list()).rejects.toMatchObject(unavailable);
    await expect(resolve([dbRows[0].id])).rejects.toMatchObject(unavailable);
  });

  it.each(catalogs)("$name treats an empty catalog as authoritative", async ({ list, resolve }) => {
    const { client } = createMockSupabase({ data: [], error: null });
    mockedGetSupabaseServerClient.mockReturnValue(
      client as unknown as ReturnType<typeof getSupabaseServerClient>
    );

    await expect(list()).resolves.toEqual([]);
    await expect(resolve([dbRows[0].id])).rejects.toMatchObject({
      statusCode: 403,
      errorCode: "MODEL_NOT_ALLOWED",
    });
  });

  it.each(catalogs)("$name reads the live catalog again after a rejected query", async ({ list }) => {
    const { client, query } = createMockSupabase({
      data: [{ ...dbRows[0], role_tags: ["coding"] }],
      error: null,
    });
    mockedGetSupabaseServerClient.mockReturnValue(
      client as unknown as ReturnType<typeof getSupabaseServerClient>
    );
    query.order.mockRejectedValueOnce(new Error("Supabase connection closed"));

    await expect(list()).rejects.toMatchObject(unavailable);
    await expect(list()).resolves.toEqual([expect.objectContaining({ id: dbRows[0].id })]);
  });
});
