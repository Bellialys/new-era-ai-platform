import { describe, it, expect, vi, beforeEach } from "vitest";
import { getLeaderboard } from "./leaderboard";
import { getSupabaseServerClient } from "./supabase";

vi.mock("./supabase", () => ({
  getSupabaseServerClient: vi.fn(),
}));

const mockedGetSupabase = vi.mocked(getSupabaseServerClient);

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

type QueryResult = { data: unknown[] | null; error: { message: string } | null };

function makeChain(result: QueryResult) {
  const chain = {
    then(
      onFulfilled: (v: QueryResult) => void,
      onRejected?: (e: unknown) => void
    ) {
      return Promise.resolve(result).then(onFulfilled, onRejected);
    },
    catch(onRejected: (e: unknown) => void) {
      return Promise.resolve(result).catch(onRejected);
    },
    finally(onFinally: () => void) {
      return Promise.resolve(result).finally(onFinally);
    },
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
  };
  return chain;
}

function createMockSupabase(opts: {
  responsesResult: QueryResult;
  votesResult: QueryResult;
  modelsResult: QueryResult;
}) {
  const responsesChain = makeChain(opts.responsesResult);
  const votesChain = makeChain(opts.votesResult);
  const modelsChain = makeChain(opts.modelsResult);

  return {
    from: vi.fn((table: string) => {
      if (table === "model_responses") return responsesChain;
      if (table === "votes") return votesChain;
      if (table === "models") return modelsChain;
      throw new Error(`Unexpected table: ${table}`);
    }),
    responsesChain,
    votesChain,
    modelsChain,
  };
}

// Fixture data using the REAL schema column names.
const RESPONSE_ROWS = [
  { id: "res-1", model_id: "model-uuid-a" },
  { id: "res-2", model_id: "model-uuid-a" },
  { id: "res-3", model_id: "model-uuid-b" },
];

const VOTE_ROWS = [
  { model_response_id: "res-1" }, // win for model-a
  { model_response_id: "res-3" }, // win for model-b
];

const MODEL_ROWS = [
  {
    id: "model-uuid-a",
    display_name: "Llama 3.3 70B",
    role_tags: ["balanced"],
    price_label: "free",
  },
  {
    id: "model-uuid-b",
    display_name: "GPT-OSS 120B",
    role_tags: ["fast"],
    price_label: "free",
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getLeaderboard", () => {
  beforeEach(() => {
    mockedGetSupabase.mockReset();
  });

  it("returns [] when supabase client is null (no config)", async () => {
    mockedGetSupabase.mockReturnValue(null);
    expect(await getLeaderboard()).toEqual([]);
  });

  it("returns [] when model_responses query errors", async () => {
    const mock = createMockSupabase({
      responsesResult: { data: null, error: { message: "DB error" } },
      votesResult: { data: [], error: null },
      modelsResult: { data: [], error: null },
    });
    mockedGetSupabase.mockReturnValue(mock as unknown as ReturnType<typeof getSupabaseServerClient>);

    expect(await getLeaderboard()).toEqual([]);
  });

  it("returns [] when there are no model_responses (no battles yet)", async () => {
    const mock = createMockSupabase({
      responsesResult: { data: [], error: null },
      votesResult: { data: [], error: null },
      modelsResult: { data: [], error: null },
    });
    mockedGetSupabase.mockReturnValue(mock as unknown as ReturnType<typeof getSupabaseServerClient>);

    expect(await getLeaderboard()).toEqual([]);
  });

  it("returns [] when the models query errors (graceful degradation)", async () => {
    const mock = createMockSupabase({
      responsesResult: { data: RESPONSE_ROWS, error: null },
      votesResult: { data: VOTE_ROWS, error: null },
      modelsResult: { data: null, error: { message: "column models.name does not exist" } },
    });
    mockedGetSupabase.mockReturnValue(mock as unknown as ReturnType<typeof getSupabaseServerClient>);

    expect(await getLeaderboard()).toEqual([]);
  });

  // The core regression test: leaderboard used to query non-existent columns name and badge.
  it("queries models with display_name, role_tags, price_label — not name or badge", async () => {
    const mock = createMockSupabase({
      responsesResult: { data: RESPONSE_ROWS, error: null },
      votesResult: { data: VOTE_ROWS, error: null },
      modelsResult: { data: MODEL_ROWS, error: null },
    });
    mockedGetSupabase.mockReturnValue(mock as unknown as ReturnType<typeof getSupabaseServerClient>);

    await getLeaderboard();

    const selectArgs = mock.modelsChain.select.mock.calls[0][0] as string;
    expect(selectArgs).toContain("display_name");
    expect(selectArgs).toContain("role_tags");
    expect(selectArgs).toContain("price_label");
    expect(selectArgs).not.toContain(", name");
    expect(selectArgs).not.toContain("badge");
  });

  it("maps display_name to modelName in the returned entry", async () => {
    const mock = createMockSupabase({
      responsesResult: { data: RESPONSE_ROWS, error: null },
      votesResult: { data: VOTE_ROWS, error: null },
      modelsResult: { data: MODEL_ROWS, error: null },
    });
    mockedGetSupabase.mockReturnValue(mock as unknown as ReturnType<typeof getSupabaseServerClient>);

    const entries = await getLeaderboard();

    const names = entries.map((e) => e.modelName);
    expect(names).toContain("Llama 3.3 70B");
    expect(names).toContain("GPT-OSS 120B");
  });

  it("computes badge from role_tags (fast tag → 'Free Fast')", async () => {
    const mock = createMockSupabase({
      responsesResult: { data: [{ id: "r1", model_id: "m1" }], error: null },
      votesResult: { data: [{ model_response_id: "r1" }], error: null },
      modelsResult: {
        data: [{ id: "m1", display_name: "GPT-OSS 120B", role_tags: ["fast"], price_label: "free" }],
        error: null,
      },
    });
    mockedGetSupabase.mockReturnValue(mock as unknown as ReturnType<typeof getSupabaseServerClient>);

    const [entry] = await getLeaderboard();
    expect(entry.badge).toContain("Free Fast");
  });

  it("computes badge as [] for models with unrecognized tags", async () => {
    const mock = createMockSupabase({
      responsesResult: { data: [{ id: "r1", model_id: "m1" }], error: null },
      votesResult: { data: [], error: null },
      modelsResult: {
        data: [{ id: "m1", display_name: "Unknown", role_tags: ["obscure"], price_label: "unknown" }],
        error: null,
      },
    });
    mockedGetSupabase.mockReturnValue(mock as unknown as ReturnType<typeof getSupabaseServerClient>);

    const [entry] = await getLeaderboard();
    expect(entry.badge).toEqual([]);
  });

  it("sorts entries by win rate descending and assigns rank from 1", async () => {
    const mock = createMockSupabase({
      responsesResult: { data: RESPONSE_ROWS, error: null },
      votesResult: { data: VOTE_ROWS, error: null },
      modelsResult: { data: MODEL_ROWS, error: null },
    });
    mockedGetSupabase.mockReturnValue(mock as unknown as ReturnType<typeof getSupabaseServerClient>);

    const entries = await getLeaderboard();
    expect(entries[0].rank).toBe(1);
    if (entries.length > 1) {
      expect(entries[0].winRate).toBeGreaterThanOrEqual(entries[1].winRate);
      expect(entries[1].rank).toBe(2);
    }
  });

  it("computes totalBattles and winRate correctly", async () => {
    const mock = createMockSupabase({
      responsesResult: { data: RESPONSE_ROWS, error: null },
      votesResult: { data: VOTE_ROWS, error: null },
      modelsResult: { data: MODEL_ROWS, error: null },
    });
    mockedGetSupabase.mockReturnValue(mock as unknown as ReturnType<typeof getSupabaseServerClient>);

    const entries = await getLeaderboard();
    const a = entries.find((e) => e.modelId === "model-uuid-a")!;
    const b = entries.find((e) => e.modelId === "model-uuid-b")!;

    // model-a: 2 responses (battles), 1 win → 50%
    expect(a.totalBattles).toBe(2);
    expect(a.wins).toBe(1);
    expect(a.winRate).toBeCloseTo(0.5);

    // model-b: 1 response, 1 win → 100%
    expect(b.totalBattles).toBe(1);
    expect(b.wins).toBe(1);
    expect(b.winRate).toBeCloseTo(1.0);
  });
});
