"use client";

import { useCallback, useEffect, useState } from "react";
import {
  clearGuestInfo,
  createOrRefreshGuestSession,
  readGuestInfo,
  type GuestInfo,
} from "@/lib/guest";
import { getSupabaseClient } from "@/lib/supabase";

export type ArenaIdentityMode = "loading" | "gate" | "guest" | "user";

export function useArenaIdentity() {
  const [identityMode, setIdentityMode] = useState<ArenaIdentityMode>("loading");
  const [guestInfo, setGuestInfo] = useState<GuestInfo | null>(null);
  const [guestCreateError, setGuestCreateError] = useState<string | null>(null);
  const [isCreatingGuest, setIsCreatingGuest] = useState(false);

  const resolveStoredGuest = useCallback(() => {
    const stored = readGuestInfo();
    if (!stored) {
      setGuestInfo(null);
      setIdentityMode("gate");
      return;
    }

    setGuestInfo(stored);
    setIdentityMode("guest");
    void createOrRefreshGuestSession()
      .then((info) => setGuestInfo(info))
      .catch(() => setGuestInfo(stored));
  }, []);

  useEffect(() => {
    let mounted = true;

    async function resolveIdentity() {
      const supabase = getSupabaseClient();
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        if (data.session?.user) {
          setGuestInfo(null);
          setIdentityMode("user");
          return;
        }
      }

      if (!mounted) return;
      resolveStoredGuest();
    }

    const supabase = getSupabaseClient();
    const { data: { subscription } } = supabase
      ? supabase.auth.onAuthStateChange((_event, session) => {
          if (!mounted) return;
          if (session?.user) {
            setGuestInfo(null);
            setIdentityMode("user");
          } else {
            resolveStoredGuest();
          }
        })
      : { data: { subscription: null } };

    void resolveIdentity();

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [resolveStoredGuest]);

  async function continueAsGuest() {
    setIsCreatingGuest(true);
    setGuestCreateError(null);
    try {
      const info = await createOrRefreshGuestSession();
      setGuestInfo(info);
      setIdentityMode("guest");
    } catch (error) {
      setGuestCreateError(
        error instanceof Error
          ? error.message
          : "Не удалось создать гостевой профиль. Попробуйте ещё раз."
      );
    } finally {
      setIsCreatingGuest(false);
    }
  }

  function signIn() {
    window.location.href = "/login";
  }

  function resetToGate() {
    clearGuestInfo();
    setGuestInfo(null);
    setIdentityMode("gate");
  }

  return {
    identityMode,
    guestInfo,
    isCreatingGuest,
    guestCreateError,
    continueAsGuest,
    signIn,
    resetToGate,
  };
}
