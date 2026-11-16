import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// Integration-style, deterministic mock of the Supabase query builder.
// The backend route (not the fixture) must always append the verified user's
// user_id filter; otherwise the cross-account access assertions fail.
const { authMock, dbMock, rateMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  dbMock: vi.fn(),
  rateMock: vi.fn(),
}));

vi.mock("@/lib/server", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/server")>();
  return {
    ...original,
    getAuthenticatedUserId: authMock,
    getSupabaseServerClient: dbMock,
    checkRateLimit: rateMock,
    logApiRequest: vi.fn(),
  };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { GET as list, POST as create } from "./route";
import { GET as read, PATCH as update, DELETE as remove } from "./[id]/route";

const ALICE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BOB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ALICE_DRAFT = "11111111-1111-4111-8111-111111111111";
const BOB_DRAFT = "22222222-2222-4222-8222-222222222222";

type Draft = {
  id: string;
  user_id: string;
  title: string;
  prompt_text: string;
  created_at: string;
  updated_at: string;
};

const now = "2026-11-16T12:00:00.000Z";
let drafts: Draft[];

function makeRequest(path: string, method = "GET", body?: unknown, origin = "http://localhost") {
  return new NextRequest("http://localhost" + path, {
    method,
    headers: {
      Origin: origin,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function idContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

function simulatedSupabase() {
  return {
    from(table: string) {
      if (table !== "saved_prompts") throw new Error("unexpected table");
      let operation: "select" | "create" | "update" | "delete" = "select";
      let changed: Partial<Draft> | null = null;
      let match: Record<string, unknown> = {};
      let sortField: keyof Draft | null = null;
      let sortAscending = false;

      const selected = () => drafts.filter(draft =>
        Object.entries(match).every(([key, value]) => draft[key as keyof Draft] === value)
      );
      const publicRows = (rows: Draft[]) => rows.map(({ user_id: _owner, ...draft }) => draft);
      const builder = {
        select(_fields?: string) {
          return this;
        },
        eq(field: string, value: unknown) {
          match[field] = value;
          return this;
        },
        order(field: keyof Draft, options?: { ascending?: boolean }) {
          // The route orders by updated_at, then id. This fixture only needs
          // deterministic sort order, not a complete PostgREST implementation.
          if (!sortField) {
            sortField = field;
            sortAscending = options?.ascending === true;
          }
          return this;
        },
        insert(row: Partial<Draft>) {
          operation = "create";
          changed = row;
          return this;
        },
        update(row: Partial<Draft>) {
          operation = "update";
          changed = row;
          return this;
        },
        delete() {
          operation = "delete";
          return this;
        },
        async limit(max: number) {
          const filtered = selected();
          if (sortField) {
            const key = sortField;
            filtered.sort((a, b) => String(a[key]).localeCompare(String(b[key])) * (sortAscending ? 1 : -1));
          }
          return { data: publicRows(filtered.slice(0, max)), error: null };
        },
        async maybeSingle() {
          const record = selected()[0];
          if (!record) return { data: null, error: null };
          if (operation === "update" && changed) Object.assign(record, changed);
          const output = { ...record };
          if (operation === "delete") drafts = drafts.filter(row => row.id !== record.id);
          return { data: publicRows([output])[0], error: null };
        },
        async single() {
          if (operation !== "create" || !changed) throw new Error("unexpected insert");
          const record: Draft = {
            id: "33333333-3333-4333-8333-333333333333",
            user_id: changed.user_id ?? "",
            title: changed.title ?? "",
            prompt_text: changed.prompt_text ?? "",
            created_at: now,
            updated_at: now,
          };
          drafts.push(record);
          return { data: publicRows([record])[0], error: null };
        },
      };
      return builder;
    },
  };
}

beforeEach(() => {
  drafts = [
    { id: ALICE_DRAFT, user_id: ALICE, title: "Alice private", prompt_text: "Alice secret prompt", created_at: now, updated_at: now },
    { id: BOB_DRAFT, user_id: BOB, title: "Bob private", prompt_text: "Bob private text", created_at: now, updated_at: now },
  ];
  authMock.mockReset().mockResolvedValue(ALICE);
  dbMock.mockReset().mockReturnValue(simulatedSupabase());
  rateMock.mockReset().mockResolvedValue({ limited: false, remaining: 10, resetAt: Date.now() + 60_000 });
});

describe("saved prompts — simulated two-account end-to-end ownership", () => {
  it("lists only the authenticated user's rows in both directions", async () => {
    const a = await list(makeRequest("/api/saved-prompts"));
    expect(a.status).toBe(200);
    const aliceBody = await a.json();
    expect(aliceBody.items.map((x: { title: string }) => x.title)).toEqual(["Alice private"]);
    expect(JSON.stringify(aliceBody)).not.toContain("Bob private");

    authMock.mockResolvedValue(BOB);
    const b = await list(makeRequest("/api/saved-prompts"));
    const bobBody = await b.json();
    expect(b.status).toBe(200);
    expect(bobBody.items.map((x: { title: string }) => x.title)).toEqual(["Bob private"]);
    expect(JSON.stringify(bobBody)).not.toContain("Alice private");
  });

  it("returns the same 404 for a different user's draft and nonexistent UUID", async () => {
    for (const id of [BOB_DRAFT, "44444444-4444-4444-8444-444444444444"]) {
      const r = await read(makeRequest("/api/saved-prompts/" + id), idContext(id));
      expect(r.status).toBe(404);
      expect(await r.json()).toMatchObject({ errorCode: "NOT_FOUND" });
    }
    const own = await read(makeRequest("/api/saved-prompts/" + ALICE_DRAFT), idContext(ALICE_DRAFT));
    expect(own.status).toBe(200);
  });

  it("cannot update someone else's draft while retaining own update permissions", async () => {
    const denied = await update(
      makeRequest("/api/saved-prompts/" + BOB_DRAFT, "PATCH", { title: "Taken over" }),
      idContext(BOB_DRAFT)
    );
    expect(denied.status).toBe(404);
    expect(drafts.find(x => x.id === BOB_DRAFT)?.title).toBe("Bob private");

    const own = await update(
      makeRequest("/api/saved-prompts/" + ALICE_DRAFT, "PATCH", { title: "My edited draft" }),
      idContext(ALICE_DRAFT)
    );
    expect(own.status).toBe(200);
    expect(drafts.find(x => x.id === ALICE_DRAFT)?.title).toBe("My edited draft");
  });

  it("cannot delete someone else's draft while retaining own delete permissions", async () => {
    const denied = await remove(makeRequest("/api/saved-prompts/" + BOB_DRAFT, "DELETE"), idContext(BOB_DRAFT));
    expect(denied.status).toBe(404);
    expect(drafts).toHaveLength(2);

    const own = await remove(makeRequest("/api/saved-prompts/" + ALICE_DRAFT, "DELETE"), idContext(ALICE_DRAFT));
    expect(own.status).toBe(200);
    expect(drafts.map(x => x.id)).toEqual([BOB_DRAFT]);
  });

  it("creates a prompt owned by the verified session, not by untrusted input", async () => {
    const attempt = await create(makeRequest("/api/saved-prompts", "POST", {
      title: "Spoof", promptText: "Some prompt", user_id: BOB,
    }));
    expect(attempt.status).toBe(400);
    expect(drafts).toHaveLength(2);

    const valid = await create(makeRequest("/api/saved-prompts", "POST", {
      title: "Alice created", promptText: "My example prompt",
    }));
    expect(valid.status).toBe(201);
    expect(drafts).toHaveLength(3);
    expect(drafts[2]?.user_id).toBe(ALICE);
    expect((await valid.json()).item).not.toHaveProperty("user_id");
  });

  it("blocks cross-origin PATCH and DELETE regardless of target ownership", async () => {
    const patch = await update(
      makeRequest("/api/saved-prompts/" + ALICE_DRAFT, "PATCH", { title: "Hijacked" }, "https://malicious.example"),
      idContext(ALICE_DRAFT)
    );
    const deletion = await remove(
      makeRequest("/api/saved-prompts/" + ALICE_DRAFT, "DELETE", undefined, "https://malicious.example"),
      idContext(ALICE_DRAFT)
    );
    expect(patch.status).toBe(403);
    expect(deletion.status).toBe(403);
    expect(drafts).toHaveLength(2);
    expect(drafts[0]?.title).toBe("Alice private");
  });
});
