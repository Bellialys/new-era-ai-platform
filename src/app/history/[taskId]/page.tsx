"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthStatus } from "@/components/auth/auth-status";
import { HistoryDetail } from "@/components/history/history-detail";
import type {
  HistoryDetailApiResponse,
  HistoryResponseView,
  HistoryTaskView,
} from "@/types/history";

type PageState = "loading" | "ready" | "unauthorized" | "not_found" | "error";

export default function HistoryDetailPage() {
  const params = useParams<{ taskId: string }>();
  const taskId = params?.taskId;

  const [state, setState] = useState<PageState>("loading");
  const [task, setTask] = useState<HistoryTaskView | null>(null);
  const [responses, setResponses] = useState<HistoryResponseView[]>([]);

  useEffect(() => {
    if (!taskId) {
      return;
    }
    let active = true;

    async function load() {
      try {
        const res = await fetch(`/api/history/${taskId}`);
        if (!active) {
          return;
        }
        if (res.status === 401) {
          setState("unauthorized");
          return;
        }
        if (res.status === 404) {
          setState("not_found");
          return;
        }
        if (!res.ok) {
          setState("error");
          return;
        }
        const json = (await res.json()) as HistoryDetailApiResponse;
        setTask(json.task);
        setResponses(json.responses);
        setState("ready");
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
  }, [taskId]);

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-8 sm:px-8">
      <header className="mb-8 flex items-center justify-between gap-4 border-b border-white/10 pb-6">
        <Link className="text-sm text-slate-400 transition hover:text-white" href="/history">
          ← К истории
        </Link>
        <AuthStatus />
      </header>

      {state === "loading" ? (
        <p className="py-16 text-center text-sm text-slate-400">Загружаем сравнение…</p>
      ) : null}

      {state === "unauthorized" ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-8 text-center">
          <p className="text-slate-300">Войдите или продолжите как гость, чтобы открыть сравнение.</p>
          <Link
            href="/login"
            className="mt-5 inline-flex h-11 items-center justify-center rounded-full bg-violet-600 px-6 text-sm font-bold text-white transition hover:bg-violet-500"
          >
            Войти
          </Link>
        </div>
      ) : null}

      {state === "not_found" ? (
        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-8 text-center">
          <p className="text-slate-300">Сравнение не найдено.</p>
          <Link className="mt-4 inline-block text-sm text-slate-400 transition hover:text-white" href="/history">
            ← Вернуться к истории
          </Link>
        </div>
      ) : null}

      {state === "error" ? (
        <div className="rounded-3xl border border-red-400/20 bg-red-500/10 p-8 text-center">
          <p className="text-red-200">Не удалось загрузить сравнение.</p>
        </div>
      ) : null}

      {state === "ready" && task ? <HistoryDetail task={task} responses={responses} /> : null}
    </main>
  );
}
