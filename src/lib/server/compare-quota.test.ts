import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSupabaseServerClient } from "./supabase";
import {
  CompareIdempotencyMismatchError,
  CompareInProgressError,
  CompareResultExpiredError,
  CompareQuotaAuthorityError,
  completeCompareQuota,
  createCompareFingerprint,
  getCompareRetryAfterSeconds,
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
        reservation_id: null,
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

  it("returns 409 and Retry-After while original reservation is still pending", async () => {
    const { client } = createClient({
      data: [{ reservation_id: "res-1", outcome: "in_progress", retry_after_seconds: 5 }],
      error: null,
    });
    getClientMock.mockReturnValue(client);

    const promise = reserveCompareQuota({ identity, fingerprint: "same", idempotencyKey: "same-key" });
    await expect(promise).rejects.toBeInstanceOf(CompareInProgressError);
    await expect(promise).rejects.toMatchObject({
      statusCode: 409, errorCode: "COMPARE_IN_PROGRESS", retryAfterSeconds: 5,
    });
    expect(getCompareRetryAfterSeconds(new CompareInProgressError(5))).toBe(5);
  });

  it("rejects a previously abandoned or scrubbed reservation without extra inference", async () => {
    const { client } = createClient({
      data: [{ reservation_id: "res-1", outcome: "result_expired" }],
      error: null,
    });
    getClientMock.mockReturnValue(client);

    await expect(reserveCompareQuota({ identity, fingerprint: "same", idempotencyKey: "old-key" }))
      .rejects.toBeInstanceOf(CompareResultExpiredError);
  });

  it("maps a NULL-ID authority_error to 503 rather than opening provider access", async () => {
    const { client } = createClient({
      data: [{ reservation_id: null, outcome: "authority_error" }],
      error: null,
    });
    getClientMock.mockReturnValue(client);
    await expect(reserveCompareQuota({ identity, fingerprint: "same" }))
      .rejects.toBeInstanceOf(CompareQuotaAuthorityError);
  });

  it("requires a reservation ID before accepting a quota reservation", async () => {
    const { client } = createClient({
      data: [{ reservation_id: null, outcome: "accepted" }],
      error: null,
    });
    getClientMock.mockReturnValue(client);
    await expect(reserveCompareQuota({ identity, fingerprint: "same" }))
      .rejects.toBeInstanceOf(CompareQuotaAuthorityError);
  });

  it("fails closed on unrecognized RPC outcomes", async () => {
    const { client } = createClient({
      data: [{ reservation_id: "res-1", outcome: "mystery_state" }],
      error: null,
    });
    getClientMock.mockReturnValue(client);
    await expect(reserveCompareQuota({ identity, fingerprint: "same" }))
      .rejects.toBeInstanceOf(CompareQuotaAuthorityError);
  });

  it("fails closed when the quota authority is unavailable", async () => {
    getClientMock.mockReturnValue(null);
    await expect(reserveCompareQuota({ identity, fingerprint: "same" }))
      .rejects.toBeInstanceOf(CompareQuotaAuthorityError);
  });
});

describe("completeCompareQuota", () => {
  it("retries a lost completion acknowledgement without invoking a model", async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: null, error: { code: "PGRST000" } })
      .mockResolvedValueOnce({ data: null, error: null });
    getClientMock.mockReturnValue({ rpc } as never);

    await completeCompareQuota({
      reservationId: "res-1", responsePayload: { status: "success" }, responseStatus: 200,
    });
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[0]).toEqual(rpc.mock.calls[1]);
  });

  it("does not repeat a completion rejected by PostgreSQL as invalid/abandoned", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: "P0001" } });
    getClientMock.mockReturnValue({ rpc } as never);
    await expect(completeCompareQuota({
      reservationId: "res-1", responsePayload: { status: "success" }, responseStatus: 200,
    })).rejects.toBeInstanceOf(CompareQuotaAuthorityError);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("limits completion retries to two attempts on repeated transient errors", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST000" } });
    getClientMock.mockReturnValue({ rpc } as never);
    await expect(completeCompareQuota({
      reservationId: "res-1", responsePayload: { status: "error" }, responseStatus: 200,
    })).rejects.toBeInstanceOf(CompareQuotaAuthorityError);
    expect(rpc).toHaveBeenCalledTimes(2);
  });

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

describe("Compare quota migration — orphan fencing and privacy retention", () => {
  const migration = readFileSync(
    new URL("../../../supabase/migrations/20261008090000_unified_compare_quota_hardening.sql", import.meta.url),
    "utf8"
  );

  it("keeps all four PostgreSQL function bodies dollar-quoted and balanced", () => {
    // A prior draft accidentally committed AS $ ... $ instead of AS $ ... $.
    // TypeScript/Next.js builds cannot detect a broken PL/pgSQL delimiter.
    const opens = migration.match(/\\bas \\$\\$(?:\\r?\\n)/g) ?? [];
    const closes = migration.match(/(?:\\r?\\n)\\$\\$;/g) ?? [];
    expect(opens).toHaveLength(4);
    expect(closes).toHaveLength(4);
    expect(migration).not.toMatch(/\\bas \\$(?:\\r?\\n)/);
    expect(migration).not.toMatch(/(?:\\r?\\n)\\$;/);
  });

  it("distinguishes pending and abandoned idempotency states without charging again", () => {
    expect(migration).toContain("check (status in ('reserved', 'completed', 'abandoned'))");
    expect(migration).toContain("'in_progress'::text");
    expect(migration).toContain("'result_expired'::text");
    expect(migration).toContain("interval '15 minutes'");
    expect(migration).toMatch(/if found then[\s\S]*?v_existing\.fingerprint <> p_fingerprint/);
  });

  it("accepts an exact duplicated completion but rejects a changed or missing terminal answer", () => {
    expect(migration).toContain("v_existing.response_payload = p_response_payload");
    expect(migration).toContain("v_existing.response_status = p_response_status");
    expect(migration).toContain("raise exception 'quota reservation is not completable'");
  });

  it("applies fixed 24h payload, 30d metadata, 3d bucket retention without a quota refund", () => {
    const maintenance = migration.split("create or replace function public.maintain_compare_quota()")[1];
    expect(maintenance).toBeDefined();
    expect(maintenance).toContain("interval '24 hours'");
    expect(maintenance).toContain("interval '30 days'");
    expect(maintenance).toContain("interval '3 days'");
    expect(maintenance).toContain("set response_payload = null");
    expect(maintenance).not.toMatch(/set\s+units\s*=\s*units\s*-/);
    expect(migration).toContain("revoke all on function public.maintain_compare_quota() from public, anon, authenticated");
    expect(migration).toContain("grant execute on function public.maintain_compare_quota() to service_role");
  });
});

describe("Compare quota migration — legacy backfill scope", () => {
  it("only counts Prompt Arena tasks, not Code Arena or AI Team Mode", () => {
    const migration = readFileSync(
      new URL("../../../supabase/migrations/20261008090000_unified_compare_quota_hardening.sql", import.meta.url),
      "utf8"
    );
    const backfill = migration.split("create or replace function public.backfill_compare_quota_current_day()")[1];
    expect(backfill).toBeDefined();
    expect(backfill).toMatch(
      /from public\.tasks\s+where created_at >= v_day_bucket[\s\S]*?and mode_slug = 'prompt-arena'[\s\S]*?group by 1/
    );
    expect(backfill).not.toMatch(/mode_slug\s+in\s*\([^)]*'ai-team-mode'/);
  });
});
