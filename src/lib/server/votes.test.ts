import { describe, it, expect, beforeEach, vi } from "vitest";
import { ApiError } from "./utils";

const { rpcMock, getClientMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  getClientMock: vi.fn(),
}));

vi.mock("./supabase", () => ({
  getSupabaseServerClient: getClientMock,
}));

import { getBlindReveal, saveBestVote, validateVoteIds } from "./votes";

const TASK_ID = "11111111-1111-4111-8111-111111111111";
const RESPONSE_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const ANON_ID = "44444444-4444-4444-8444-444444444444";
const VOTE_ID = "55555555-5555-4555-8555-555555555555";

beforeEach(() => {
  rpcMock.mockReset();
  getClientMock.mockReset();
  getClientMock.mockReturnValue({ rpc: rpcMock });
});

function createVoteLookupClient(row: unknown) {
  const query = {
    select: vi.fn(function (this: typeof query) { return this; }),
    eq: vi.fn(function (this: typeof query) { return this; }),
    maybeSingle: vi.fn().mockResolvedValue({
      data: row,
      error: null,
    }),
  };

  return {
    rpc: rpcMock,
    from: vi.fn(() => query),
    query,
  };
}

describe("validateVoteIds", () => {
  it("accepts valid uuids", () => {
    expect(validateVoteIds(TASK_ID, RESPONSE_ID)).toEqual({
      taskId: TASK_ID,
      responseId: RESPONSE_ID,
    });
  });

  it("rejects non-uuid values", () => {
    expect(() => validateVoteIds("not-a-uuid", RESPONSE_ID)).toThrow(ApiError);
    expect(() => validateVoteIds(TASK_ID, 42)).toThrow(ApiError);
  });
});

describe("saveBestVote", () => {
  it("throws when Supabase is not configured", async () => {
    getClientMock.mockReturnValue(null);
    await expect(
      saveBestVote({ taskId: TASK_ID, responseId: RESPONSE_ID, anonymousSessionId: ANON_ID })
    ).rejects.toMatchObject({ statusCode: 503, errorCode: "DATABASE_NOT_CONFIGURED" });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("requires a voter identity", async () => {
    await expect(
      saveBestVote({ taskId: TASK_ID, responseId: RESPONSE_ID })
    ).rejects.toMatchObject({ errorCode: "VOTER_REQUIRED" });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("calls the atomic RPC with the resolved identity", async () => {
    rpcMock.mockResolvedValue({
      data: { id: VOTE_ID, task_id: TASK_ID, model_response_id: RESPONSE_ID },
      error: null,
    });

    const result = await saveBestVote({
      taskId: TASK_ID,
      responseId: RESPONSE_ID,
      userId: USER_ID,
    });

    expect(rpcMock).toHaveBeenCalledWith("cast_best_vote", {
      p_task_id: TASK_ID,
      p_response_id: RESPONSE_ID,
      p_user_id: USER_ID,
      p_anon_id: null,
    });
    expect(result).toEqual({
      voteId: VOTE_ID,
      taskId: TASK_ID,
      responseId: RESPONSE_ID,
      voteType: "best",
    });
  });

  it("maps RESPONSE_NOT_FOUND to a 404", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "RESPONSE_NOT_FOUND" } });
    await expect(
      saveBestVote({ taskId: TASK_ID, responseId: RESPONSE_ID, anonymousSessionId: ANON_ID })
    ).rejects.toMatchObject({ statusCode: 404, errorCode: "RESPONSE_NOT_FOUND" });
  });

  it("maps TASK_NOT_FOUND to a 404", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "TASK_NOT_FOUND" } });
    await expect(
      saveBestVote({ taskId: TASK_ID, responseId: RESPONSE_ID, anonymousSessionId: ANON_ID })
    ).rejects.toMatchObject({ statusCode: 404, errorCode: "TASK_NOT_FOUND" });
  });

  it("maps TASK_STILL_RUNNING to a 409", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "TASK_STILL_RUNNING" },
    });
    await expect(
      saveBestVote({ taskId: TASK_ID, responseId: RESPONSE_ID, userId: USER_ID })
    ).rejects.toMatchObject({
      statusCode: 409,
      errorCode: "TASK_STILL_RUNNING",
      message: "Voting opens when all models finish. Please wait.",
    });
  });

  it("maps INVALID_VOTE_TARGET to a 400", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: 'new row ... INVALID_VOTE_TARGET' },
    });
    await expect(
      saveBestVote({ taskId: TASK_ID, responseId: RESPONSE_ID, anonymousSessionId: ANON_ID })
    ).rejects.toMatchObject({ statusCode: 400, errorCode: "INVALID_VOTE_TARGET" });
  });

  it("returns the existing best vote when a duplicate request already saved the same response", async () => {
    const client = createVoteLookupClient({
      id: VOTE_ID,
      task_id: TASK_ID,
      model_response_id: RESPONSE_ID,
    });
    getClientMock.mockReturnValue(client);
    rpcMock.mockResolvedValue({
      data: null,
      error: {
        code: "23505",
        message: 'duplicate key value violates unique constraint "votes_best_per_anon_uniq"',
      },
    });

    await expect(
      saveBestVote({ taskId: TASK_ID, responseId: RESPONSE_ID, anonymousSessionId: ANON_ID })
    ).resolves.toEqual({
      voteId: VOTE_ID,
      taskId: TASK_ID,
      responseId: RESPONSE_ID,
      voteType: "best",
    });

    expect(client.from).toHaveBeenCalledWith("votes");
    expect(client.query.eq).toHaveBeenCalledWith("task_id", TASK_ID);
    expect(client.query.eq).toHaveBeenCalledWith("vote_type", "best");
    expect(client.query.eq).toHaveBeenCalledWith("anonymous_session_id", ANON_ID);
  });

  it("maps an unknown RPC error to VOTE_SAVE_FAILED", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "deadlock detected" } });
    await expect(
      saveBestVote({ taskId: TASK_ID, responseId: RESPONSE_ID, userId: USER_ID })
    ).rejects.toMatchObject({ statusCode: 500, errorCode: "VOTE_SAVE_FAILED" });
  });
});

describe("getBlindReveal", () => {
  function createRevealClient({
    isBlind,
    responses = [],
  }: {
    isBlind: boolean;
    responses?: Array<{ id: string; display_name: string | null; model_key: string }>;
  }) {
    const taskQuery = {
      select: vi.fn(function (this: typeof taskQuery) { return this; }),
      eq: vi.fn(function (this: typeof taskQuery) { return this; }),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { is_blind: isBlind },
        error: null,
      }),
    };
    const responsesQuery = {
      select: vi.fn(function (this: typeof responsesQuery) { return this; }),
      eq: vi.fn(function (this: typeof responsesQuery) { return this; }),
      order: vi.fn().mockResolvedValue({
        data: responses,
        error: null,
      }),
    };

    return {
      from: vi.fn((table: string) => (table === "tasks" ? taskQuery : responsesQuery)),
      builders: { taskQuery, responsesQuery },
    };
  }

  it("returns null when Supabase is not configured", async () => {
    getClientMock.mockReturnValue(null);

    await expect(getBlindReveal(TASK_ID)).resolves.toBeNull();
  });

  it("returns null for a non-blind task", async () => {
    const client = createRevealClient({ isBlind: false });
    getClientMock.mockReturnValue(client);

    await expect(getBlindReveal(TASK_ID)).resolves.toBeNull();
    expect(client.from).toHaveBeenCalledWith("tasks");
    expect(client.from).not.toHaveBeenCalledWith("model_responses");
  });

  it("returns response reveal details for a blind task", async () => {
    const client = createRevealClient({
      isBlind: true,
      responses: [
        { id: RESPONSE_ID, display_name: "Real Model", model_key: "provider/real" },
        { id: "66666666-6666-4666-8666-666666666666", display_name: null, model_key: "provider/fallback" },
      ],
    });
    getClientMock.mockReturnValue(client);

    await expect(getBlindReveal(TASK_ID)).resolves.toEqual([
      {
        responseId: RESPONSE_ID,
        modelName: "Real Model",
        modelKey: "provider/real",
      },
      {
        responseId: "66666666-6666-4666-8666-666666666666",
        modelName: "provider/fallback",
        modelKey: "provider/fallback",
      },
    ]);
    expect(client.builders.responsesQuery.order).toHaveBeenCalledWith("created_at", {
      ascending: true,
    });
  });
});
