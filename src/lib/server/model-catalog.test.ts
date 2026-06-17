import { describe, it, expect, beforeEach, vi } from "vitest";
import { getAvailableModels, resolveSelectedModels } from "./model-catalog";
import { getSupabaseServerClient } from "./supabase";
import { ALLOWED_MODELS } from "./models";
import { ApiError } from "./utils";

vi.mock("./supabase", () => ({
  getSupabaseServerClient: vi.fn(),
}));

const mockedGetSupabaseServerClient = vi.mocked(getSupabaseServerClient);

const dbRows = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    model_key: "openai/gpt-oss-120b:free",
    display_name: "GPT-OSS 120B",
    description: "DB model",
    role_tags: ["general", "fast"],
    price_label: "free",
    access_level: "anonymous",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    model_key: "meta-llama/llama-3.3-70b-instruct:free",
    display_name: "Llama 3.3 70B",
    description: null,
    role_tags: ["balanced"],
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
    // ArenaModel must not leak any server-only key field
    expect(models[0]).not.toHaveProperty("modelKey");
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
      badge: "Free Fast",
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
