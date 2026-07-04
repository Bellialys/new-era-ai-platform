import { describe, it, expect, beforeEach, vi } from "vitest";

const { getClientMock } = vi.hoisted(() => ({ getClientMock: vi.fn() }));

vi.mock("./supabase", () => ({
  getSupabaseServerClient: getClientMock,
}));

import { listHistory, getHistoryTask } from "./history";

const USER_ID = "33333333-3333-4333-8333-333333333333";
const ANON_ID = "44444444-4444-4444-8444-444444444444";
const TASK_ID = "11111111-1111-4111-8111-111111111111";

type QueryResult = { data: unknown; error: unknown };

type QueryBuilder = {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  lt: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  then: (
    onFulfilled: (value: QueryResult) => unknown,
    onRejected?: (reason: unknown) => unknown
  ) => Promise<unknown>;
};

/**
 * A chainable Supabase query stub. Filter/transform methods return the builder
 * so chains compose; terminal `.limit`/`.maybeSingle` resolve to `result`, and
 * the builder itself is awaitable (thenable) for chains that end on `.eq`/`.order`.
 */
function createQuery(result: QueryResult): QueryBuilder {
  const builder = {} as QueryBuilder;
  builder.select = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.lt = vi.fn(() => builder);
  builder.in = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.limit = vi.fn(() => Promise.resolve(result));
  builder.maybeSingle = vi.fn(() => Promise.resolve(result));
  builder.then = (onFulfilled, onRejected) =>
    Promise.resolve(result).then(onFulfilled, onRejected);
  return builder;
}

type ClientMock = {
  from: ReturnType<typeof vi.fn>;
  builders: Record<string, QueryBuilder>;
};

function createClient(tables: Record<string, QueryResult>): ClientMock {
  const builders: Record<string, QueryBuilder> = {};
  for (const [table, result] of Object.entries(tables)) {
    builders[table] = createQuery(result);
  }
  const from = vi.fn(
    (table: string) => builders[table] ?? createQuery({ data: [], error: null })
  );
  return { from, builders };
}

function taskRow(id: string, createdAt: string, modeSlug = "prompt-arena") {
  return {
    id,
    mode_slug: modeSlug,
    task_text: `task ${id}`,
    status: "completed",
    selected_models: ["a", "b"],
    created_at: createdAt,
  };
}

function respRow(id: string) {
  return {
    id,
    model_key: `key-${id}`,
    display_name: `Model ${id}`,
    status: "success",
    response_text: `answer ${id}`,
    error_code: null,
    error_message: null,
    latency_ms: 100,
    created_at: `2026-06-20T10:00:0${id === "R1" ? "1" : "2"}.000Z`,
  };
}

const userIdentity = { userId: USER_ID, anonymousSessionId: null } as const;
const guestIdentity = { userId: null, anonymousSessionId: ANON_ID } as const;

beforeEach(() => {
  getClientMock.mockReset();
});

describe("listHistory", () => {
  it("returns an empty result when Supabase is not configured", async () => {
    getClientMock.mockReturnValue(null);
    await expect(listHistory({ identity: userIdentity })).resolves.toEqual({
      items: [],
      nextCursor: null,
    });
  });

  it("scopes the query to the user and orders by created_at desc", async () => {
    const client = createClient({
      tasks: { data: [taskRow("T1", "2026-06-20T12:00:00.000Z")], error: null },
      votes: { data: [], error: null },
    });
    getClientMock.mockReturnValue(client);

    await listHistory({ identity: userIdentity });

    expect(client.builders.tasks.eq).toHaveBeenCalledWith("user_id", USER_ID);
    expect(client.builders.tasks.eq).not.toHaveBeenCalledWith(
      "anonymous_session_id",
      expect.anything()
    );
    expect(client.builders.tasks.order).toHaveBeenCalledWith("created_at", { ascending: false });
  });

  it("scopes the query to the guest session", async () => {
    const client = createClient({
      tasks: { data: [], error: null },
      votes: { data: [], error: null },
    });
    getClientMock.mockReturnValue(client);

    await listHistory({ identity: guestIdentity });

    expect(client.builders.tasks.eq).toHaveBeenCalledWith("anonymous_session_id", ANON_ID);
    expect(client.builders.tasks.eq).not.toHaveBeenCalledWith("user_id", expect.anything());
  });

  it("paginates with limit+1 and exposes the next cursor", async () => {
    const rows = [
      taskRow("T1", "2026-06-20T12:00:00.000Z"),
      taskRow("T2", "2026-06-20T11:00:00.000Z"),
      taskRow("T3", "2026-06-20T10:00:00.000Z"),
    ];
    const client = createClient({
      tasks: { data: rows, error: null },
      votes: { data: [], error: null },
    });
    getClientMock.mockReturnValue(client);

    const result = await listHistory({ identity: userIdentity, limit: 2 });

    expect(client.builders.tasks.limit).toHaveBeenCalledWith(3);
    expect(result.items.map((item) => item.taskId)).toEqual(["T1", "T2"]);
    expect(result.nextCursor).toBe("2026-06-20T11:00:00.000Z");
  });

  it("returns a null cursor when there are no more rows", async () => {
    const client = createClient({
      tasks: { data: [taskRow("T1", "2026-06-20T12:00:00.000Z")], error: null },
      votes: { data: [], error: null },
    });
    getClientMock.mockReturnValue(client);

    const result = await listHistory({ identity: userIdentity, limit: 2 });

    expect(result.nextCursor).toBeNull();
  });

  it("applies the cursor as a created_at upper bound", async () => {
    const client = createClient({
      tasks: { data: [], error: null },
      votes: { data: [], error: null },
    });
    getClientMock.mockReturnValue(client);

    await listHistory({ identity: userIdentity, cursor: "2026-06-20T11:00:00.000Z" });

    expect(client.builders.tasks.lt).toHaveBeenCalledWith("created_at", "2026-06-20T11:00:00.000Z");
  });

  it("filters by a valid mode slug and ignores invalid ones", async () => {
    const valid = createClient({
      tasks: { data: [], error: null },
      votes: { data: [], error: null },
    });
    getClientMock.mockReturnValue(valid);
    await listHistory({ identity: userIdentity, modeSlug: "code-arena" });
    expect(valid.builders.tasks.eq).toHaveBeenCalledWith("mode_slug", "code-arena");

    const invalid = createClient({
      tasks: { data: [], error: null },
      votes: { data: [], error: null },
    });
    getClientMock.mockReturnValue(invalid);
    await listHistory({ identity: userIdentity, modeSlug: "not-a-mode" });
    expect(invalid.builders.tasks.eq).not.toHaveBeenCalledWith("mode_slug", expect.anything());
  });

  it("marks tasks that have a best vote by the owner", async () => {
    const rows = [
      taskRow("T1", "2026-06-20T12:00:00.000Z"),
      taskRow("T2", "2026-06-20T11:00:00.000Z"),
    ];
    const client = createClient({
      tasks: { data: rows, error: null },
      votes: { data: [{ task_id: "T1" }], error: null },
    });
    getClientMock.mockReturnValue(client);

    const result = await listHistory({ identity: userIdentity });

    expect(result.items.find((item) => item.taskId === "T1")?.hasWinner).toBe(true);
    expect(result.items.find((item) => item.taskId === "T2")?.hasWinner).toBe(false);
    expect(client.builders.votes.eq).toHaveBeenCalledWith("vote_type", "best");
    expect(client.builders.votes.in).toHaveBeenCalledWith("task_id", ["T1", "T2"]);
    expect(client.builders.votes.eq).toHaveBeenCalledWith("user_id", USER_ID);
  });
});

describe("getHistoryTask", () => {
  it("returns null when Supabase is not configured", async () => {
    getClientMock.mockReturnValue(null);
    await expect(
      getHistoryTask({ identity: userIdentity, taskId: TASK_ID })
    ).resolves.toBeNull();
  });

  it("returns null and scopes by owner when the task is not found or not owned", async () => {
    const client = createClient({ tasks: { data: null, error: null } });
    getClientMock.mockReturnValue(client);

    const result = await getHistoryTask({ identity: userIdentity, taskId: TASK_ID });

    expect(result).toBeNull();
    expect(client.builders.tasks.eq).toHaveBeenCalledWith("id", TASK_ID);
    expect(client.builders.tasks.eq).toHaveBeenCalledWith("user_id", USER_ID);
  });

  it("returns the task with its responses and the winner marked", async () => {
    const client = createClient({
      tasks: {
        data: {
          id: TASK_ID,
          mode_slug: "prompt-arena",
          task_text: "compare these",
          status: "completed",
          selected_models: ["a", "b"],
          settings: {},
          created_at: "2026-06-20T10:00:00.000Z",
          error_message: null,
          judge_verdict: null,
          is_blind: false,
        },
        error: null,
      },
      model_responses: { data: [respRow("R1"), respRow("R2")], error: null },
      votes: { data: { model_response_id: "R1" }, error: null },
    });
    getClientMock.mockReturnValue(client);

    const result = await getHistoryTask({ identity: userIdentity, taskId: TASK_ID });

    expect(result?.winnerResponseId).toBe("R1");
    expect(result?.responses.find((r) => r.responseId === "R1")?.isWinner).toBe(true);
    expect(result?.responses.find((r) => r.responseId === "R2")?.isWinner).toBe(false);
    expect(result?.selectedModels).toEqual(["a", "b"]);
  });

  it("masks response model identity for a blind task without a winner vote", async () => {
    const client = createClient({
      tasks: {
        data: {
          id: TASK_ID,
          mode_slug: "prompt-arena",
          task_text: "compare these",
          status: "completed",
          selected_models: ["a", "b"],
          settings: {},
          created_at: "2026-06-20T10:00:00.000Z",
          error_message: null,
          judge_verdict: null,
          is_blind: true,
        },
        error: null,
      },
      model_responses: { data: [respRow("R1"), respRow("R2")], error: null },
      votes: { data: null, error: null },
    });
    getClientMock.mockReturnValue(client);

    const result = await getHistoryTask({ identity: userIdentity, taskId: TASK_ID });

    expect(result?.winnerResponseId).toBeNull();
    expect(result?.responses[0]?.displayName).toBe("Модель A");
    expect(result?.responses[0]?.modelKey).toBeNull();
    expect(JSON.stringify(result)).not.toContain("key-R1");
    expect(JSON.stringify(result)).not.toContain("Model R1");
  });

  it("reveals response model identity for a blind task after a winner vote", async () => {
    const client = createClient({
      tasks: {
        data: {
          id: TASK_ID,
          mode_slug: "prompt-arena",
          task_text: "compare these",
          status: "completed",
          selected_models: ["a", "b"],
          settings: {},
          created_at: "2026-06-20T10:00:00.000Z",
          error_message: null,
          judge_verdict: null,
          is_blind: true,
        },
        error: null,
      },
      model_responses: { data: [respRow("R1"), respRow("R2")], error: null },
      votes: { data: { model_response_id: "R1" }, error: null },
    });
    getClientMock.mockReturnValue(client);

    const result = await getHistoryTask({ identity: userIdentity, taskId: TASK_ID });

    expect(result?.winnerResponseId).toBe("R1");
    expect(result?.responses[0]?.displayName).toBe("Model R1");
    expect(result?.responses[0]?.modelKey).toBe("key-R1");
  });
});
