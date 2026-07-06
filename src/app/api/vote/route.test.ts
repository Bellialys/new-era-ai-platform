import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Hoist mocks before any module import is evaluated.
// ---------------------------------------------------------------------------

const {
  resolveIdentityMock,
  checkRateLimitMock,
  saveBestVoteMock,
  getBlindRevealMock,
} = vi.hoisted(() => ({
  resolveIdentityMock: vi.fn(),
  checkRateLimitMock: vi.fn(),
  saveBestVoteMock: vi.fn(),
  getBlindRevealMock: vi.fn(),
}));

vi.mock("@/lib/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server")>();
  return {
    ...actual,
    resolveRequestIdentity: resolveIdentityMock,
    checkRateLimit: checkRateLimitMock,
    saveBestVote: saveBestVoteMock,
    getBlindReveal: getBlindRevealMock,
    applyGuestCookie: vi.fn(),
    logApiRequest: vi.fn(),
  };
});

import { POST } from "./route";
import { ApiError } from "@/lib/server";
import {
  VOTE_RATE_LIMIT_MAX_REQUESTS,
  VOTE_RATE_LIMIT_WINDOW_MS,
} from "@/lib/arena/constants";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TASK_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const RESPONSE_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const VALID_BODY = { taskId: TASK_ID, responseId: RESPONSE_ID, voteType: "best" };

function makeRequest(body?: unknown): NextRequest {
  if (body === undefined) {
    return new NextRequest("http://localhost/api/vote", { method: "POST" });
  }
  return new NextRequest("http://localhost/api/vote", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const NOT_LIMITED = {
  limited: false,
  remaining: VOTE_RATE_LIMIT_MAX_REQUESTS - 1,
  resetAt: Date.now() + VOTE_RATE_LIMIT_WINDOW_MS,
};

beforeEach(() => {
  resolveIdentityMock.mockReset();
  checkRateLimitMock.mockReset();
  saveBestVoteMock.mockReset();
  getBlindRevealMock.mockReset();

  resolveIdentityMock.mockResolvedValue({ kind: "user", userId: USER_ID, guestId: null });
  checkRateLimitMock.mockResolvedValue(NOT_LIMITED);
  saveBestVoteMock.mockResolvedValue({
    voteId: "vote-uuid",
    taskId: TASK_ID,
    responseId: RESPONSE_ID,
    voteType: "best",
  });
  getBlindRevealMock.mockResolvedValue(null);
});

// ---------------------------------------------------------------------------
// Auth guard
// ---------------------------------------------------------------------------

describe("POST /api/vote — auth guard", () => {
  it("returns 401 AUTH_REQUIRED when the caller has no identity", async () => {
    resolveIdentityMock.mockResolvedValue({ kind: "none", userId: null, guestId: null });

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(401);
    const body = await res.json() as { errorCode?: string };
    expect(body.errorCode).toBe("AUTH_REQUIRED");
    expect(checkRateLimitMock).not.toHaveBeenCalled();
    expect(saveBestVoteMock).not.toHaveBeenCalled();
  });

  it("allows guest callers to vote", async () => {
    const GUEST_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    resolveIdentityMock.mockResolvedValue({ kind: "guest", userId: null, guestId: GUEST_ID });

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

describe("POST /api/vote — input validation", () => {
  it("returns 400 VALIDATION_ERROR for an unsupported voteType", async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, voteType: "worst" }));

    expect(res.status).toBe(400);
    const body = await res.json() as { errorCode?: string };
    expect(body.errorCode).toBe("VALIDATION_ERROR");
    expect(saveBestVoteMock).not.toHaveBeenCalled();
  });

  it("returns 400 VALIDATION_ERROR when taskId is missing", async () => {
    const res = await POST(makeRequest({ responseId: RESPONSE_ID, voteType: "best" }));

    expect(res.status).toBe(400);
    const body = await res.json() as { errorCode?: string };
    expect(body.errorCode).toBe("VALIDATION_ERROR");
  });

  it("returns 400 VALIDATION_ERROR when taskId is not a UUID", async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, taskId: "not-a-uuid" }));

    expect(res.status).toBe(400);
    const body = await res.json() as { errorCode?: string };
    expect(body.errorCode).toBe("VALIDATION_ERROR");
  });

  it("returns 400 VALIDATION_ERROR when responseId is missing", async () => {
    const res = await POST(makeRequest({ taskId: TASK_ID, voteType: "best" }));

    expect(res.status).toBe(400);
    const body = await res.json() as { errorCode?: string };
    expect(body.errorCode).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when body is not valid JSON", async () => {
    const res = await POST(makeRequest("bad json {{"));

    expect(res.status).toBe(400);
    const body = await res.json() as { errorCode?: string };
    expect(body.errorCode).toBe("INVALID_JSON");
  });
});

// ---------------------------------------------------------------------------
// Success path
// ---------------------------------------------------------------------------

describe("POST /api/vote — success", () => {
  it("returns 200 with vote details when the vote is saved", async () => {
    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(200);
    const body = await res.json() as {
      status?: string;
      voteId?: string;
      taskId?: string;
      responseId?: string;
      voteType?: string;
      reveal?: unknown;
    };
    expect(body.status).toBe("success");
    expect(body.voteId).toBe("vote-uuid");
    expect(body.taskId).toBe(TASK_ID);
    expect(body.responseId).toBe(RESPONSE_ID);
    expect(body.voteType).toBe("best");
    expect(body.reveal).toBeUndefined();
  });

  it("calls saveBestVote with the correct IDs", async () => {
    await POST(makeRequest(VALID_BODY));

    expect(saveBestVoteMock).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: TASK_ID,
        responseId: RESPONSE_ID,
        userId: USER_ID,
      })
    );
  });

  it("returns blind reveal details when the saved task is blind", async () => {
    getBlindRevealMock.mockResolvedValue([
      {
        responseId: RESPONSE_ID,
        modelName: "Real Model",
        modelKey: "provider/real-model",
      },
    ]);

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(200);
    const body = await res.json() as {
      reveal?: Array<{ responseId?: string; modelName?: string; modelKey?: string }>;
    };
    expect(getBlindRevealMock).toHaveBeenCalledWith({
      taskId: TASK_ID,
      userId: USER_ID,
      anonymousSessionId: null,
    });
    expect(body.reveal).toEqual([
      {
        responseId: RESPONSE_ID,
        modelName: "Real Model",
        modelKey: "provider/real-model",
      },
    ]);
  });

  it("passes the guest identity to blind reveal lookup", async () => {
    const GUEST_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    resolveIdentityMock.mockResolvedValue({ kind: "guest", userId: null, guestId: GUEST_ID });

    const res = await POST(makeRequest(VALID_BODY));

    expect(res.status).toBe(200);
    expect(getBlindRevealMock).toHaveBeenCalledWith({
      taskId: TASK_ID,
      userId: null,
      anonymousSessionId: GUEST_ID,
    });
  });
});

// ---------------------------------------------------------------------------
// Save errors
// ---------------------------------------------------------------------------

describe("POST /api/vote — save errors", () => {
  it("returns 409 TASK_STILL_RUNNING when the vote gate rejects a running task", async () => {
    saveBestVoteMock.mockRejectedValue(
      new ApiError(409, "TASK_STILL_RUNNING", "Voting opens when all models finish. Please wait.")
    );

    const res = await POST(makeRequest(VALID_BODY));
    const body = await res.json() as { errorCode?: string; message?: string };

    expect(res.status).toBe(409);
    expect(body.errorCode).toBe("TASK_STILL_RUNNING");
    expect(body.message).toBe("Voting opens when all models finish. Please wait.");
    expect(getBlindRevealMock).not.toHaveBeenCalled();
  });

  it("does not attempt blind reveal when task ownership is rejected", async () => {
    saveBestVoteMock.mockRejectedValue(
      new ApiError(404, "TASK_NOT_FOUND", "Task was not found.")
    );

    const res = await POST(makeRequest(VALID_BODY));
    const body = await res.json() as { errorCode?: string };

    expect(res.status).toBe(404);
    expect(body.errorCode).toBe("TASK_NOT_FOUND");
    expect(getBlindRevealMock).not.toHaveBeenCalled();
  });
});
