"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { CodeDiffView } from "@/components/code-arena/code-diff-view";
import type { ArenaResponseView } from "@/types/arena";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";

// ---------------------------------------------------------------------------
// Types from API
// ---------------------------------------------------------------------------
type TaskResponse = {
  id: string;
  modelKey: string;
  modelName: string;
  status: string;
  answerText: string | null;
  latencyMs?: number;
  errorCode?: string;
  errorMessage?: string;
};

type TaskDetail = {
  id: string;
  modeSlug: string;
  prompt: string;
  title: string | null;
  status: string;
  createdAt: string;
  settings: Record<string, unknown>;
  winnerResponseId: string | null;
  responses: TaskResponse[];
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function toArenaView(r: TaskResponse): ArenaResponseView {
  return {
    id: r.id,
    modelId: r.modelKey,
    modelName: r.modelName,
    modelRole: r.modelKey,
    status: r.status === "success" ? "success" : "error",
    answerText: r.answerText ?? null,
    latencyMs: r.latencyMs,
    errorCode: r.errorCode,
    errorMessage: r.errorMessage,
    isStreaming: false,
  };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const MODE_LABELS: Record<string, string> = {
  "prompt-arena": "Prompt Arena",
  "code-arena": "Code Arena",
};

// ---------------------------------------------------------------------------
// Response card (read-only)
// ---------------------------------------------------------------------------
function ShareResponseCard({ response, isWinner }: { response: TaskResponse; isWinner: boolean }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!response.answerText) return;
    await navigator.clipboard.writeText(response.answerText).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const border = isWinner
    ? "rounded-3xl border border-emerald-400/40 bg-emerald-500/5 p-5"
    : "rounded-3xl border border-white/10 bg-white/[0.04] p-5";

  return (
    <div className={border}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {isWinner && (
            <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-200">
              ✓ Победитель
            </span>
          )}
          <span className="font-semibold text-white">{response.modelName}</span>
        </div>
        <div className="flex items-center gap-2">
          {response.latencyMs !== undefined && (
            <span className="text-xs tabular-nums text-slate-500">
              {(response.latencyMs / 1000).toFixed(1)}s
            </span>
          )}
          {response.answerText && (
            <button
              onClick={handleCopy}
              className="rounded-full border border-white/15 px-2.5 py-0.5 text-xs text-slate-400 transition hover:border-white/30 hover:text-white"
            >
              {copied ? "Скопировано" : "Копировать"}
            </button>
          )}
        </div>
      </div>

      {response.status === "error" ? (
        <p className="text-sm text-red-300">{response.errorMessage ?? "Ошибка"}</p>
      ) : (
        <div className="rounded-2xl border border-white/5 bg-slate-950/60 p-4 text-sm">
          {response.answerText ? (
            <MarkdownRenderer content={response.answerText} />
          ) : (
            <p className="leading-relaxed text-slate-200"></p>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main share view (client component — fetches task on mount)
// ---------------------------------------------------------------------------
export function ShareView({ taskId }: { taskId: string }) {
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/tasks/${taskId}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json()) as { error?: { code?: string } };
          throw new Error(body.error?.code === "NOT_FOUND" ? "Сравнение не найдено." : "Ошибка загрузки.");
        }
        return res.json() as Promise<{ task: TaskDetail }>;
      })
      .then(({ task: t }) => setTask(t))
      .catch((e) => setError(e instanceof Error ? e.message : "Ошибка"))
      .finally(() => setIsLoading(false));
  }, [taskId]);

  async function handleCopyLink() {
    await navigator.clipboard.writeText(window.location.href).catch(() => undefined);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 1500);
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 px-4 py-12">
        <div className="mx-auto max-w-3xl space-y-4 animate-pulse">
          <div className="h-8 w-48 rounded-xl bg-white/5" />
          <div className="h-20 rounded-2xl bg-white/5" />
          <div className="h-40 rounded-2xl bg-white/5" />
          <div className="h-40 rounded-2xl bg-white/5" />
        </div>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4">
        <h1 className="mb-3 text-2xl font-black text-white">
          {error ?? "Сравнение не найдено"}
        </h1>
        <Link href="/" className="text-sm text-violet-300 hover:underline">
          На главную
        </Link>
      </div>
    );
  }

  const isCode = task.modeSlug === "code-arena";
  const modeLabel = MODE_LABELS[task.modeSlug] ?? task.modeSlug;

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-10 text-white">
      <div className="mx-auto max-w-3xl">
        {/* Nav */}
        <div className="mb-8 flex items-center justify-between gap-4">
          <Link href="/" className="text-sm text-slate-400 hover:text-white">← Главная</Link>
          <div className="flex gap-2">
            <Link href="/history" className="rounded-xl border border-white/15 px-3 py-1.5 text-sm text-slate-300 hover:text-white">История</Link>
            <button
              onClick={handleCopyLink}
              className="rounded-xl border border-white/15 px-3 py-1.5 text-sm text-slate-300 hover:text-white"
              type="button"
            >
              {linkCopied ? "Скопировано!" : "Поделиться"}
            </button>
          </div>
        </div>

        {/* Meta */}
        <div className="mb-6">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-violet-500/20 px-2.5 py-0.5 text-xs font-semibold text-violet-200">
              {modeLabel}
            </span>
            {task.settings && typeof task.settings.language === "string" && (
              <span className="rounded-full bg-blue-500/15 px-2.5 py-0.5 text-xs text-blue-200">
                {task.settings.language as string}
              </span>
            )}
            <span className="text-xs text-slate-500">{formatDate(task.createdAt)}</span>
          </div>
          <h1 className="text-xl font-bold text-white">
            {task.title ?? "Сравнение AI-моделей"}
          </h1>
        </div>

        {/* Prompt */}
        <div className="mb-6 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">Задача</p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">{task.prompt}</p>
        </div>

        {/* Responses */}
        <div className="space-y-4">
          {task.responses.map((r) => (
            <ShareResponseCard
              key={r.id}
              response={r}
              isWinner={task.winnerResponseId === r.id}
            />
          ))}
        </div>

        {/* Code diff (code-arena only) */}
        {isCode && task.responses.length >= 2 && (
          <CodeDiffView
            responses={task.responses.map(toArenaView)}
            blindMode={false}
          />
        )}

        {/* Footer CTA */}
        <div className="mt-10 flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
          <p className="text-sm text-slate-300">
            Хотите сравнить AI-модели самостоятельно?
          </p>
          <div className="flex gap-3">
            <Link
              href="/arena"
              className="rounded-xl border border-violet-400/40 bg-violet-600/20 px-5 py-2 text-sm font-semibold text-violet-100 transition hover:bg-violet-600/30"
            >
              Prompt Arena
            </Link>
            <Link
              href="/code"
              className="rounded-xl border border-blue-400/40 bg-blue-600/20 px-5 py-2 text-sm font-semibold text-blue-100 transition hover:bg-blue-600/30"
            >
              Code Arena
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
