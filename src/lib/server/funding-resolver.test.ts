import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { resolveAiFunding } from "./funding-resolver";

function query(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  const same = () => chain;
  chain.select = vi.fn(same);
  chain.eq = vi.fn(same);
  chain.limit = vi.fn(same);
  chain.maybeSingle = vi.fn(async () => result);
  return chain;
}

function supabaseFixture(input: {
  preference: { data: unknown; error: unknown };
  credential?: { data: unknown; error: unknown };
}): { client: SupabaseClient; from: ReturnType<typeof vi.fn> } {
  const preferenceQuery = query(input.preference);
  const credentialQuery = query(
    input.credential ?? { data: null, error: null }
  );
  const from = vi.fn((table: string) =>
    table === "ai_funding_preferences" ? preferenceQuery : credentialQuery
  );

  return {
    client: { from } as unknown as SupabaseClient,
    from,
  };
}

describe("AI funding resolver", () => {
  it("keeps platform funding without reading a provider credential", async () => {
    const { client, from } = supabaseFixture({
      preference: {
        data: { funding_source: "platform" },
        error: null,
      },
    });

    await expect(
      resolveAiFunding(client, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
    ).resolves.toEqual({
      billingSource: "platform",
      credentialId: null,
    });

    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("ai_funding_preferences");
  });

  it("returns only an opaque credential id for user_openrouter funding", async () => {
    const { client } = supabaseFixture({
      preference: {
        data: { funding_source: "user_openrouter" },
        error: null,
      },
      credential: {
        data: {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          secret_ciphertext: "\\xdeadbeef",
          encrypted_dek: "\\x010203",
          kms_key_id: "kms-key-ref",
        },
        error: null,
      },
    });

    const resolved = await resolveAiFunding(
      client,
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    );

    expect(resolved).toEqual({
      billingSource: "user_openrouter",
      credentialId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    });
    expect(JSON.stringify(resolved)).not.toContain("deadbeef");
    expect(JSON.stringify(resolved)).not.toContain("kms-key-ref");
  });

  it("fails closed when user_openrouter is selected without a complete active credential", async () => {
    const { client } = supabaseFixture({
      preference: {
        data: { funding_source: "user_openrouter" },
        error: null,
      },
      credential: {
        data: {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          secret_ciphertext: null,
          encrypted_dek: null,
          kms_key_id: null,
        },
        error: null,
      },
    });

    await expect(
      resolveAiFunding(client, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
    ).rejects.toMatchObject({
      code: "OPENROUTER_CONNECTION_REQUIRED",
    });
  });
});
