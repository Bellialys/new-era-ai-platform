import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { authMock, dbMock, limitMock, revalidateMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  dbMock: vi.fn(),
  limitMock: vi.fn(),
  revalidateMock: vi.fn(),
}));

vi.mock("@/lib/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server")>();
  return {
    ...actual,
    getAuthenticatedUserId: authMock,
    getSupabaseServerClient: dbMock,
    checkRateLimit: limitMock,
    logApiRequest: vi.fn(),
  };
});
vi.mock("next/cache", () => ({ revalidatePath: revalidateMock }));

import { GET as list, POST as create } from "./route";
import { GET as read, PATCH as update, DELETE as remove } from "./[id]/route";

const USER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ID = "11111111-1111-4111-8111-111111111111";
const ROW = {
  id: ID, title: "Saved", prompt_text: "Prompt text",
  created_at: "2026-11-09T00:00:00Z", updated_at: "2026-11-09T00:00:00Z",
};
const context = { params: Promise.resolve({ id: ID }) };

function request(path: string, method = "GET", body?: unknown, origin = "http://localhost") {
  return new NextRequest("http://localhost" + path, {
    method,
    headers: { Origin: origin, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
function query(result: { data: unknown; error: unknown }) {
  const q = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(result),
    single: vi.fn().mockResolvedValue(result),
    maybeSingle: vi.fn().mockResolvedValue(result),
  };
  dbMock.mockReturnValue({ from: vi.fn().mockReturnValue(q) });
  return q;
}

beforeEach(() => {
  authMock.mockReset().mockResolvedValue(USER);
  dbMock.mockReset();
  limitMock.mockReset().mockResolvedValue({ limited: false, remaining: 9, resetAt: Date.now() + 60000 });
  revalidateMock.mockReset();
});

describe("saved prompt CRUD API", () => {
  it("requires a verified account before listing", async () => {
    authMock.mockResolvedValue(null);
    const res = await list(request("/api/saved-prompts"));
    expect(res.status).toBe(401);
    expect(dbMock).not.toHaveBeenCalled();
  });

  it("lists only caller-owned prompts with a minimal DTO", async () => {
    const q = query({ data: [ROW], error: null });
    const res = await list(request("/api/saved-prompts"));
    expect(res.status).toBe(200);
    expect(q.eq).toHaveBeenCalledWith("user_id", USER);
    expect(res.headers.get("cache-control")).toContain("no-store");
    const body = await res.json() as { items: Array<Record<string, unknown>> };
    expect(body.items).toHaveLength(1);
    expect(body.items[0].promptText).toBe("Prompt text");
    expect(body.items[0]).not.toHaveProperty("user_id");
  });

  it("rejects cross-origin mutations before touching the DB", async () => {
    const res = await create(request("/api/saved-prompts", "POST", {
      title: "New", promptText: "New text",
    }, "https://attacker.example"));
    expect(res.status).toBe(403);
    expect(dbMock).not.toHaveBeenCalled();
  });

  it("rejects unexpected fields and validates JSON before writing", async () => {
    const res = await create(request("/api/saved-prompts", "POST", {
      title: "New", promptText: "New text", user_id: USER,
    }));
    expect(res.status).toBe(400);
    expect(dbMock).not.toHaveBeenCalled();
  });

  it("creates the row with the verified user id, never an input id", async () => {
    const q = query({ data: ROW, error: null });
    const res = await create(request("/api/saved-prompts", "POST", {
      title: "Saved", promptText: "Prompt text",
    }));
    expect(res.status).toBe(201);
    expect(q.insert).toHaveBeenCalledWith({
      user_id: USER, title: "Saved", prompt_text: "Prompt text",
    });
    expect(revalidateMock).toHaveBeenCalledWith("/saved-prompts");
  });

  it("returns 404 for unowned or absent rows without leaking existence", async () => {
    const q = query({ data: null, error: null });
    const res = await read(request("/api/saved-prompts/" + ID), context);
    expect(res.status).toBe(404);
    expect(q.eq).toHaveBeenCalledWith("user_id", USER);
  });

  it("updates only the authenticated user's row", async () => {
    const q = query({ data: ROW, error: null });
    const res = await update(request("/api/saved-prompts/" + ID, "PATCH", {
      title: " Renamed ",
    }), context);
    expect(res.status).toBe(200);
    expect(q.update).toHaveBeenCalledWith(expect.objectContaining({
      title: "Renamed", updated_at: expect.any(String),
    }));
    expect(q.eq).toHaveBeenCalledWith("user_id", USER);
    expect(revalidateMock).toHaveBeenCalledWith("/saved-prompts");
  });

  it("deletes only the authenticated user's row with two filters", async () => {
    const q = query({ data: { id: ID }, error: null });
    const res = await remove(request("/api/saved-prompts/" + ID, "DELETE"), context);
    expect(res.status).toBe(200);
    expect(q.eq).toHaveBeenCalledWith("id", ID);
    expect(q.eq).toHaveBeenCalledWith("user_id", USER);
    expect(revalidateMock).toHaveBeenCalledWith("/saved-prompts");
  });

  it("rejects invalid id and empty patch", async () => {
    const bad = await remove(request("/api/saved-prompts/not-an-id", "DELETE"), {
      params: Promise.resolve({ id: "not-an-id" }),
    });
    expect(bad.status).toBe(400);
    const empty = await update(request("/api/saved-prompts/" + ID, "PATCH", {}), context);
    expect(empty.status).toBe(400);
  });

  it("returns 429 when rate limit is exceeded", async () => {
    limitMock.mockResolvedValue({ limited: true, remaining: 0, resetAt: Date.now() + 5000 });
    const res = await list(request("/api/saved-prompts"));
    expect(res.status).toBe(429);
    expect(dbMock).not.toHaveBeenCalled();
  });

  it("reports persistence unavailability without exposing internals", async () => {
    dbMock.mockReturnValue(null);
    const res = await list(request("/api/saved-prompts"));
    expect(res.status).toBe(503);
    const body = await res.json() as { errorCode?: string };
    expect(body.errorCode).toBe("PERSISTENCE_UNAVAILABLE");
  });
});
