import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSupabaseServerClient } from "./supabase";
import {
  CompareIdempotencyMismatchError,
  CompareQuotaAuthorityError,
  completeCompareQuota,
  createCompareFingerprint,
  reserveCompareQuota,
} from "./compare-quota";

vi.mock("./supabase", () => ({
  getSupabaseServerClient: vi.fn(),
}));

const getClientMock = vi.mocked(getSupabaseServerClient);
const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const GUEST_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function createClient(result: { data?: unknown; error?: unknown }) {
  const rpc = vi.fn().mockResolvedValue(result);
  return { client: { rpc } as never, rpc };
}

const identity = { kind: "user" as const, userId: USER_ID, guestId: null };

beforeEach(() => getClientMock.mockReset());

describe("reserveCompareQuota", () => {
  it.each([
    ["guest", { kind: "guest" as const, userId: null, guestId: GUEST_ID }],
    ["free/pro/admin user", identity],
  ])("passes only server-resolved identity for %s", async (_label, caller) => {
    const { client, rpc } = createClient({
      data: [{
        reservation_id: "res-1",
        outcome: "accepted",
        retry_after_seconds: null,
        response_payload: null,
        response_status: null,
      }],
      error: null,
    });
    getClientMock.mockReturnValue(client);

    await reserveCompareQuota({
      identity: caller,
      idempotencyKey: "request-1",
      fingerprint: createCompareFingerprint({
        prompt: "hello",
        modelIds: ["m1", "m2"],
        modeSlug: "prompt-arena",
        blind: false,
      }),
    });

    expect(rpc).toHaveBeenCalledWith("reserve_compare_quota", expect.objectContaining({
      p_user_id: caller.userId,
      p_guest_id: caller.guestId,
      p_idempotency_key: "request-1",
    }));
  });

  it("maps quota rejection to 429 metadata", async () => {
    const { client } = createClient({
      data: [{
        reservation_id: "res-1",
        outcome: "quota_exceeded",
        retry_after_seconds: 37,
      }],
      error: null,
    });
    getClientMock.mockReturnValue(client);

    await expect(reserveCompareQuota({ identity, fingerprint: "same" }))
      .rejects.toMatchObject({
        statusCode: 429,
        errorCode: "QUOTA_EXCEEDED",
        retryAfterSeconds: 37,
      });
  });

  it("rejects idempotency fingerprint mismatch without reserving", async () => {
    const { client } = createClient({
      data: [{ reservation_id: "res-1", outcome: "idempotency_mismatch" }],
      error: null,
    });
    getClientMock.mockReturnValue(client);

    await expect(reserveCompareQuota({ identity, fingerprint: "different" }))
      .rejects.toBeInstanceOf(CompareIdempotencyMismatchError);
  });

  it("fails closed when the quota authority is unavailable", async () => {
    getClientMock.mockReturnValue(null);
    await expect(reserveCompareQuota({ identity, fingerprint: "same" }))
      .rejects.toBeInstanceOf(CompareQuotaAuthorityError);
  });
});

describe("completeCompareQuota", () => {
  it("does not release a reservation and stores the terminal response", async () => {
    const { client, rpc } = createClient({ data: null, error: null });
    getClientMock.mockReturnValue(client);

    await completeCompareQuota({
      reservationId: "res-1",
      responsePayload: { status: "error" },
      responseStatus: 200,
    });

    expect(rpc).toHaveBeenCalledWith("complete_compare_quota", {
      p_reservation_id: "res-1",
      p_response_payload: { status: "error" },
      p_response_status: 200,
    });
  });
});
