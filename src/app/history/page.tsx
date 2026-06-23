"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AuthStatus } from "@/components/auth/auth-status";
import { HistoryList } from "@/components/history/history-list";
import type { HistoryListApiResponse, HistoryListItemView } from "@/types/history";

type PageState = "loading" | "empty" | "ready" | "unauthorized" | "error";

function HistoryHeader() {
  return (
    <header className="mb-8 flex items-center justify-between gap-4 border-b border-white/10 pb-6">
      <div>
        <Link className="text-sm text-slate-400 transition hover:text-white" href="/">
          ← На главную
        </Link>
        <h1 className="mt-3 text-3xl font-black text-white">История сравнений</h1>
      </div>
      <AuthStatus />
    </header>
  );
}

export default function HistoryPage() {
  const [state, setState] = useState<PageState>("loading");
  const [items, setItems] = useState<HistoryListItemView[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  // Bumping this re-runs the initial-load effect (used by the retry button).
  const [reloadKey, setReloadKey] = useState(0);

  const loadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMore) {
      return;
    }
    setIsLoadingMore(true);
    try {
      const res = await fetch(`/api/history?cursor=${encodeURIComponent(nextCursor)}`);
      if (res.ok) {
        const json = (await res.json()) as HistoryListApiResponse;
        setItems((prev) => [...prev, ...json.items]);
        setNextCursor(json.nextCursor);
      }
    } catch {
      // Keep the already-loaded page; the "Загрузить ещё" button stays available.
    } finally {
      setIsLoadingMore(false);
    }
  }, [nextCursor, isLoadingMore]);

  // Defined inline (async, setState only after the first await) so the
  // react-hooks/set-state-in-effect rule is satisfied; reloadKey re-triggers it.
  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const res = await fetch("/api/history");
        if (!active) {
          return;
        }
        if (res.status === 401) {
          setState("unauthorized");
          return;
        }
        if (!res.ok) {
          setState("error");
          return;
        }
        const json = (await res.json()) as HistoryListApiResponse;
        if (!active) {
          return;
        }
        setItems(json.items);
        setNextCursor(json.nextCursor);
        setState(json.items.length === 0 ? "empty" : "ready");
      } catch {
        if (active) {
          setState("error");
        }
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [reloadKey]);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8 sm:px-8">
      <HistoryHeader />

      {state === "loading" ? (
        <p className="py-16 text-center text-sm text-slate-400">Загружаем историю…</p>
      ) : null}

      {state === "unauthorized" ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-8 text-center">
          <p className="text-slate-300">
            Войдите или продолжите как гость, чтобы видеть свои прошлые сравнения.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link
              href="/login"
              className="inline-flex h-11 items-center justify-center rounded-full bg-violet-600 px-6 text-sm font-bold text-white transition hover:bg-violet-500"
            >
              Войти
            </Link>
            <Link
              href="/arena"
              className="inline-flex h-11 items-center justify-center rounded-full border border-violet-300/30 bg-violet-500/15 px-6 text-sm font-bold text-violet-100 transition hover:bg-violet-500/30"
            >
              Начать в Arena
            </Link>
          </div>
        </div>
      ) : null}

      {state === "empty" ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-8 text-center">
          <p className="text-slate-300">Пока нет ни одного сравнения.</p>
          <p className="mt-1 text-sm text-slate-500">
            Запустите сравнение моделей — оно появится здесь.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link
              href="/arena"
              className="inline-flex h-11 items-center justify-center rounded-full bg-violet-600 px-6 text-sm font-bold text-white transition hover:bg-violet-500"
            >
              Prompt Arena →
            </Link>
            <Link
              href="/code"
              className="inline-flex h-11 items-center justify-center rounded-full border border-violet-300/30 bg-violet-500/15 px-6 text-sm font-bold text-violet-100 transition hover:bg-violet-500/30"
            >
              Code Arena →
            </Link>
          </div>
        </div>
      ) : null}

      {state === "error" ? (
        <div className="rounded-3xl border border-red-400/20 bg-red-500/10 p-8 text-center">
          <p className="text-red-200">Не удалось загрузить историю.</p>
          <button
            type="button"
            onClick={() => {
              setState("loading");
              setReloadKey((key) => key + 1);
            }}
            className="mt-4 rounded-full border border-white/15 px-5 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Повторить
          </button>
        </div>
      ) : null}

      {state === "ready" ? (
        <>
          <HistoryList items={items} />
          {nextCursor ? (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={loadMore}
                disabled={isLoadingMore}
                className="rounded-full border border-white/15 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoadingMore ? "Загружаем…" : "Загрузить ещё"}
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
