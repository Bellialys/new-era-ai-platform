import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import {
  disconnectOpenRouterCredential,
  persistOpenRouterOAuthCredential,
} from "./openrouter-credentials";

type QueryResult = {
  data?: unknown;
  error?: unknown;
};

function chain(result: QueryResult) {
  const query: Record<string, unknown> = {};
  const same = vi.fn(() => query);

  for (const method of [
    "select",
    "insert",
    "update",
    "delete",
    "upsert",
    "eq",
    "lte",
    "in",
    "order",
    "limit",
  ]) {
    query[method] = same;
  }

  query.maybeSingle = vi.fn(async () => result);
  query.then = (
    onFulfilled: (value: QueryResult) => unknown,
    onRejected?: (reason: unknown) => unknown
  ) => Promise.resolve(result).then(onFulfilled, onRejected);

  return query as {
    [key: string]: ReturnType<typeof vi.fn> | unknown;
    maybeSingle: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
  };
}

function dataKeyProvider() {
  return {
    async generateDataKey() {
      return {
        plaintextKey: new Uint8Array(32).fill(7),
        encryptedKey: new Uint8Array([1, 2, 3, 4]),
        kmsKeyId: "kms-test-key",
      };
    },
    async decryptDataKey() {
      return new Uint8Array(32).fill(7);
    },
  };
}

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("OpenRouter credential lifecycle races", () => {
  it("never activates a row that stopped being pending while encryption was running", async () => {
    const staleCleanup = chain({ error: null });
    const statusQuery = chain({ data: null, error: null });
    const fundingQuery = chain({
      data: { funding_source: "platform" },
      error: null,
    });
    const pendingInsert = chain({ error: null });
    const pendingCleanup = chain({ error: null });

    const queries = [
      staleCleanup,
      statusQuery,
      fundingQuery,
      pendingInsert,
      pendingCleanup,
    ];
    const from = vi.fn((table: string) => {
      void table;
      const next = queries.shift();
      if (!next) throw new Error("unexpected Supabase query");
      return next;
    });

    const rpc = vi.fn(async () => ({ data: null, error: null }));
    const supabase = { from, rpc } as unknown as SupabaseClient;

    await expect(
      persistOpenRouterOAuthCredential({
        supabase,
        userId: USER_ID,
        apiKey: "sk-or-v1-race-regression-secret",
        dataKeyProvider: dataKeyProvider(),
      })
    ).rejects.toMatchObject({
      code: "OPENROUTER_CREDENTIAL_STORE_FAILED",
    });

    expect(rpc).toHaveBeenCalledWith(
      "activate_openrouter_oauth_credential",
      expect.objectContaining({
        p_user_id: USER_ID,
        p_secret_ciphertext: expect.stringMatching(/^\\x/),
        p_encrypted_dek: expect.stringMatching(/^\\x/),
        p_kms_key_id: "kms-test-key",
      })
    );
    expect(pendingCleanup.eq).toHaveBeenCalledWith("status", "pending");

    expect(pendingInsert.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "pending",
        reconcile_after: expect.any(String),
      })
    );

    // The application does not perform a second funding write. Credential
    // activation and user_openrouter selection happen inside one DB transaction.
    expect(
      from.mock.calls.filter(([table]) => table === "ai_funding_preferences")
    ).toHaveLength(1);
  });

  it("revokes the credential before resetting funding during disconnect", async () => {
    const revoke = chain({ error: null });
    const fundingReset = chain({ error: null });
    const disconnectQueries = [revoke, fundingReset];
    const from = vi.fn((table: string) => {
      void table;
      const next = disconnectQueries.shift();
      if (!next) throw new Error("unexpected Supabase query");
      return next;
    });

    await disconnectOpenRouterCredential({
      supabase: { from } as unknown as SupabaseClient,
      userId: USER_ID,
    });

    expect(from.mock.calls.map(([table]) => table)).toEqual([
      "provider_credentials",
      "ai_funding_preferences",
    ]);
  });
});
