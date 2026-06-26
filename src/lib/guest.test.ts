import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  readGuestInfo,
  saveGuestInfo,
  clearGuestInfo,
  createOrRefreshGuestSession,
  type GuestInfo,
} from "./guest";

const INFO: GuestInfo = {
  sessionId: "44444444-4444-4444-8444-444444444444",
  displayName: "Анонимус #4827",
  avatarSeed: "avatar-seed",
  colorSeed: "color-seed",
};

/** Minimal in-memory Storage so the browser helpers run under the node env. */
function createStorage(): Storage {
  const store = new Map<string, string>();
  const storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => (store.has(key) ? (store.get(key) as string) : null),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => store.delete(key),
    setItem: (key: string, value: string) => store.set(key, String(value)),
  };
  return storage as unknown as Storage;
}

beforeEach(() => {
  vi.stubGlobal("window", {});
  vi.stubGlobal("localStorage", createStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("readGuestInfo / saveGuestInfo / clearGuestInfo", () => {
  it("round-trips guest display info through localStorage", () => {
    saveGuestInfo(INFO);
    expect(readGuestInfo()).toEqual(INFO);
  });

  it("returns null when any field is missing (partial data is not trusted)", () => {
    localStorage.setItem("new-era-anonymous-session-id", INFO.sessionId);
    expect(readGuestInfo()).toBeNull();
  });

  it("clears all guest keys", () => {
    saveGuestInfo(INFO);
    clearGuestInfo();
    expect(readGuestInfo()).toBeNull();
  });

  it("is a no-op on the server (no window), without throwing", () => {
    vi.stubGlobal("window", undefined);
    expect(readGuestInfo()).toBeNull();
    expect(() => saveGuestInfo(INFO)).not.toThrow();
  });
});

describe("createOrRefreshGuestSession", () => {
  it("returns and persists the guest info on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => INFO })
    );

    const result = await createOrRefreshGuestSession();

    expect(result).toEqual(INFO);
    expect(readGuestInfo()).toEqual(INFO);
  });

  it("throws with the server message when the request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ message: "rate limited" }) })
    );

    await expect(createOrRefreshGuestSession()).rejects.toThrow("rate limited");
  });
});
