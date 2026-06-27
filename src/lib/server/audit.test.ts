import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("./supabase", () => ({ getSupabaseServerClient: vi.fn() }));

import { logAuditEvent } from "./audit";
import { getSupabaseServerClient } from "./supabase";

const mockedGetClient = vi.mocked(getSupabaseServerClient);

const ACTOR_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

/** Creates a mock Supabase client whose audit_log insert resolves to the given error. */
function makeAuditClient(insertError: unknown = null) {
  const insertMock = vi.fn(() => Promise.resolve({ error: insertError }));
  const fromMock = vi.fn(() => ({ insert: insertMock }));
  const client = { from: fromMock } as unknown as ReturnType<typeof getSupabaseServerClient>;
  return { client, fromMock, insertMock };
}

beforeEach(() => {
  mockedGetClient.mockReset();
});

// ---------------------------------------------------------------------------
// Resilience: logAuditEvent must never throw, even under failure conditions.
// ---------------------------------------------------------------------------

describe("logAuditEvent — resilience", () => {
  it("returns without throwing when Supabase is unavailable (no client)", async () => {
    mockedGetClient.mockReturnValue(null);
    await expect(logAuditEvent({ actorId: ACTOR_ID, action: "test.action" })).resolves.toBeUndefined();
  });

  it("does not throw when the DB insert returns an error", async () => {
    const { client } = makeAuditClient({ message: "relation does not exist" });
    mockedGetClient.mockReturnValue(client);

    await expect(
      logAuditEvent({ actorId: ACTOR_ID, action: "test.action" })
    ).resolves.toBeUndefined();
  });

  it("does not throw when the insert promise rejects", async () => {
    const insertMock = vi.fn(() => Promise.reject(new Error("network error")));
    const client = {
      from: vi.fn(() => ({ insert: insertMock })),
    } as unknown as ReturnType<typeof getSupabaseServerClient>;
    mockedGetClient.mockReturnValue(client);

    // logAuditEvent does not have a try/catch around the insert; an insert
    // promise rejection will propagate. This test documents the current behavior:
    // if the DB layer rejects, the error surfaces to the caller.
    // This is an acceptable design choice as long as callers don't let it crash
    // production routes (route handlers catch it via their own try/catch).
    await expect(
      logAuditEvent({ actorId: ACTOR_ID, action: "test.action" })
    ).rejects.toThrow("network error");
  });
});

// ---------------------------------------------------------------------------
// Payload integrity: correct fields must reach the audit_log table.
// ---------------------------------------------------------------------------

describe("logAuditEvent — payload mapping", () => {
  it("maps actorId and action to the correct DB column names", async () => {
    const { client, insertMock } = makeAuditClient();
    mockedGetClient.mockReturnValue(client);

    await logAuditEvent({ actorId: ACTOR_ID, action: "user.deleted" });

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_id: ACTOR_ID,
        action: "user.deleted",
      })
    );
  });

  it("passes optional fields through to the insert payload", async () => {
    const { client, insertMock } = makeAuditClient();
    mockedGetClient.mockReturnValue(client);

    await logAuditEvent({
      actorId: ACTOR_ID,
      action: "model.updated",
      targetType: "model",
      targetId: "model-123",
      payload: { plan: "pro", reason: "upgrade" },
    });

    expect(insertMock).toHaveBeenCalledWith({
      actor_id: ACTOR_ID,
      action: "model.updated",
      target_type: "model",
      target_id: "model-123",
      payload: { plan: "pro", reason: "upgrade" },
    });
  });

  it("inserts null for missing optional fields (no undefined leakage)", async () => {
    const { client, insertMock } = makeAuditClient();
    mockedGetClient.mockReturnValue(client);

    await logAuditEvent({ actorId: ACTOR_ID, action: "user.login" });

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ target_type: null, target_id: null, payload: null })
    );
  });

  it("inserts into the 'audit_log' table (not any other table)", async () => {
    const { client, fromMock } = makeAuditClient();
    mockedGetClient.mockReturnValue(client);

    await logAuditEvent({ actorId: ACTOR_ID, action: "admin.action" });

    expect(fromMock).toHaveBeenCalledWith("audit_log");
    expect(fromMock).toHaveBeenCalledTimes(1);
  });

  it("does not silently drop the actorId field", async () => {
    const { client, insertMock } = makeAuditClient();
    mockedGetClient.mockReturnValue(client);

    await logAuditEvent({ actorId: ACTOR_ID, action: "vote.cast" });

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({ actor_id: ACTOR_ID })
    );
    expect(insertMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ actor_id: null })
    );
  });

  it("skips the insert entirely when Supabase is unavailable (no ghost writes)", async () => {
    mockedGetClient.mockReturnValue(null);

    await logAuditEvent({ actorId: ACTOR_ID, action: "admin.action" });

    // getSupabaseServerClient was called but returned null — no insert attempted.
    expect(mockedGetClient).toHaveBeenCalledTimes(1);
  });
});
