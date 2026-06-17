/**
 * Client-side guest session helpers.
 *
 * The actual session ID lives in an httpOnly cookie (set by POST /api/guest),
 * so the backend can verify it without trusting the client. This module stores
 * only the *display* information (name, seeds) in localStorage, so the guest
 * card can be shown without a round-trip on every page load.
 *
 * localStorage keys are prefixed with "new-era-" to avoid collisions.
 */

const STORAGE_KEYS = {
  SESSION_ID: "new-era-anonymous-session-id",
  DISPLAY_NAME: "new-era-anonymous-display-name",
  AVATAR_SEED: "new-era-anonymous-avatar-seed",
  COLOR_SEED: "new-era-anonymous-color-seed",
} as const;

export type GuestInfo = {
  sessionId: string;
  displayName: string;
  avatarSeed: string;
  colorSeed: string;
};

/** Read guest display info from localStorage, or null if not present. */
export function readGuestInfo(): GuestInfo | null {
  if (typeof window === "undefined") return null;

  const sessionId = localStorage.getItem(STORAGE_KEYS.SESSION_ID);
  const displayName = localStorage.getItem(STORAGE_KEYS.DISPLAY_NAME);
  const avatarSeed = localStorage.getItem(STORAGE_KEYS.AVATAR_SEED);
  const colorSeed = localStorage.getItem(STORAGE_KEYS.COLOR_SEED);

  if (!sessionId || !displayName || !avatarSeed || !colorSeed) return null;

  return { sessionId, displayName, avatarSeed, colorSeed };
}

/** Persist guest display info to localStorage. */
export function saveGuestInfo(info: GuestInfo): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEYS.SESSION_ID, info.sessionId);
  localStorage.setItem(STORAGE_KEYS.DISPLAY_NAME, info.displayName);
  localStorage.setItem(STORAGE_KEYS.AVATAR_SEED, info.avatarSeed);
  localStorage.setItem(STORAGE_KEYS.COLOR_SEED, info.colorSeed);
}

/** Remove all guest display info from localStorage (e.g. after signing in). */
export function clearGuestInfo(): void {
  if (typeof window === "undefined") return;
  Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
}

/**
 * Call POST /api/guest to create or refresh a guest session.
 * Saves the returned display info to localStorage and returns it.
 */
export async function createOrRefreshGuestSession(): Promise<GuestInfo> {
  const response = await fetch("/api/guest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? "Failed to create guest session.");
  }

  const data = (await response.json()) as {
    sessionId: string;
    displayName: string;
    avatarSeed: string;
    colorSeed: string;
  };

  const info: GuestInfo = {
    sessionId: data.sessionId,
    displayName: data.displayName,
    avatarSeed: data.avatarSeed,
    colorSeed: data.colorSeed,
  };

  saveGuestInfo(info);
  return info;
}
