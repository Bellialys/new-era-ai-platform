import { createClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSupabaseServerClient } from "./supabase";
import { saveArenaRun } from "./arena-persistence";
import { ApiError } from "./utils";

vi.mock("./supabase", () => ({ getSupabaseServerClient: vi.fn() }));

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TASK_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const MODEL = "cohere/north-mini-code:free";
const ROLES = ["planner", "researcher", "critic", "finalizer"] as const;
const seen: Array<{ route: string; inserted: unknown }> = [];
let failResponseInsert = false;

// Uses the actual supabase-js PostgREST client against an in-memory fetch
// fixture. No network, production authentication, OpenRouter inference, or
// application data is touched. This does NOT replace a live signed-in E2E.
beforeEach(() => {
  seen.length = 0;
  failResponseInsert = false;
  const rest = vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(String(input));
    const body: unknown = JSON.parse(String(init?.body));
    seen.push({ route: url.pathname, inserted: body });
    if (url.pathname === "/rest/v1/tasks") {
      return Response.json({ id: TASK_ID }, { status: 201 });
    }
    if (url.pathname === "/rest/v1/model_responses") {
      if (failResponseInsert) {
        return Response.json({ code: "23514", message: "fixture rejection" }, { status: 400 });
      }
      const rows = body as Array<{ model_key: string }>;
      return Response.json(rows.map((row, index) => ({
        id: "00000000-0000-4000-8000-" + String(index + 1).padStart(12, "0"),
        model_key: row.model_key,
      })), { status: 201 });
    }
    throw new Error("Unexpected PostgREST endpoint " + url.pathname);
  });
  const client = createClient("https://fixture.supabase.co", "fixture-service-role", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: rest },
  });
  vi.mocked(getSupabaseServerClient).mockReset().mockReturnValue(client);
});

function teamRunInput() {
  return {
    prompt: "Create a secure prototype with an implementation plan.",
    modeSlug: "ai-team-mode",
    modelKeys: [MODEL],
    owner: { userId: USER_ID, anonymousSessionId: null },
    settings: { preset: "balanced", finalAnswer: "Final synthesized answer" },
    responses: ROLES.map((roleId, index) => ({
      id: "10000000-0000-4000-8000-" + String(index + 1).padStart(12, "0"),
      modelId: roleId,
      modelKey: MODEL,
      dbModelId: null,
      modelName: roleId,
      status: "success" as const,
      answerText: roleId === "finalizer" ? "Final synthesized answer" : roleId + " output",
      latencyMs: 100 + index,
    })),
  };
}

describe("AI Team persistence — full four-step PostgREST contract (fixture)", () => {
  it("saves the owner-bound task and four role answers even with one shared model key", async () => {
    const result = await saveArenaRun(teamRunInput());
    expect(result.taskId).toBe(TASK_ID);
    expect(seen).toHaveLength(2);
    expect(seen[0]?.route).toBe("/rest/v1/tasks");
    expect(seen[0]?.inserted).toMatchObject({
      user_id: USER_ID,
      anonymous_session_id: null,
      mode_slug: "ai-team-mode",
      status: "completed",
      selected_models: [MODEL],
      settings: { preset: "balanced", finalAnswer: "Final synthesized answer" },
    });
    expect(seen[1]?.route).toBe("/rest/v1/model_responses");
    const rows = seen[1]?.inserted as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(4);
    expect(rows.map(x => x.display_name)).toEqual([...ROLES]);
    expect(rows.map(x => x.model_key)).toEqual(Array(4).fill(MODEL));
    expect(rows.map(x => x.status)).toEqual(Array(4).fill("success"));
    expect(rows.map(x => x.response_text)).toEqual([
      "planner output", "researcher output", "critic output", "Final synthesized answer",
    ]);
    expect(rows.every(x => x.model_id === null)).toBe(true);
    expect(rows.every(x => x.task_id === TASK_ID)).toBe(true);
    expect(rows.every(x => !("user_id" in x))).toBe(true);
  });

  it("returns a controlled persistence error when the four model response inserts fail", async () => {
    failResponseInsert = true;
    await expect(saveArenaRun(teamRunInput())).rejects.toMatchObject({
      statusCode: 500,
      errorCode: "DATABASE_SAVE_FAILED",
    } satisfies Partial<ApiError>);
    expect(seen.map(x => x.route)).toEqual([
      "/rest/v1/tasks", "/rest/v1/model_responses",
    ]);
  });
});
