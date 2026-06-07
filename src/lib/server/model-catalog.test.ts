import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getAvailableModels, resolveSelectedModels } from "./model-catalog";
import { ALLOWED_MODELS } from "./models";
import { ApiError } from "./utils";

// With no Supabase env configured the catalog falls back to ALLOWED_MODELS,
// so these tests exercise the fallback path without touching a database.
describe("model catalog (fallback mode)", () => {
  const savedUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const savedKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  afterEach(() => {
    if (savedUrl !== undefined) process.env.NEXT_PUBLIC_SUPABASE_URL = savedUrl;
    if (savedKey !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = savedKey;
  });

  it("getAvailableModels returns the hardcoded list without exposing model keys", async () => {
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
