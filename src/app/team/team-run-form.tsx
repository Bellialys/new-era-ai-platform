"use client";

import { useState } from "react";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import {
  TEAM_RUN_TASK_MIN_LENGTH,
  TEAM_RUN_TASK_MAX_LENGTH,
} from "@/lib/arena/team-mode";

// ---------------------------------------------------------------------------
// Types matching /api/team-run response shape
// ---------------------------------------------------------------------------

interface TeamStep {
  roleId: string;
  output: string;
  latencyMs: number;
}

interface TeamResult {
  taskId: string | null;
  steps: TeamStep[];
  finalAnswer: string;
}

type FormState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; result: TeamResult }
  | { status: "error"; errorCode: string; message: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function roleLabel(roleId: string): string {
  return roleId.charAt(0).toUpperCase() + roleId.slice(1);
}

function formatLatency(ms: number): string {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StepCard({ step, index }: { step: TeamStep; index: number }) {
  return (
    <article className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-500/25 text-xs font-bold text-violet-200">
            {index + 1}
          </span>
          <h3 className="text-lg font-bold text-white">{roleLabel(step.roleId)}</h3>
        </div>
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-300">
          {formatLatency(step.latencyMs)}
        </span>
      </div>
      <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/45 p-4 text-sm">
        <MarkdownRenderer content={step.output} />
      </div>
    </article>
  );
}

function FinalAnswerCard({ finalAnswer }: { finalAnswer: string }) {
  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(finalAnswer);
    } catch {
      // clipboard not available
    }
  }

  return (
    <article className="rounded-3xl border border-emerald-300/40 bg-emerald-500/10 p-6 shadow-2xl shadow-emerald-950/30 backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-bold text-white">Финальный ответ</h3>
        <button
          onClick={handleCopy}
          type="button"
          className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-slate-300 transition hover:border-white/30 hover:text-white"
        >
          Копировать
        </button>
      </div>
      <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/45 p-4 text-sm">
        <MarkdownRenderer content={finalAnswer} />
      </div>
    </article>
  );
}

function LoadingSkeleton() {
  return (
    <div className="mt-8 grid gap-6" aria-label="Загрузка ответов команды">
      {["Planner", "Researcher", "Critic", "Finalizer"].map((label) => (
        <div
          key={label}
          className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur"
        >
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 animate-pulse rounded-full bg-white/15" />
            <div className="h-5 w-28 animate-pulse rounded-lg bg-white/15" />
            <span className="text-sm text-slate-500">{label}…</span>
          </div>
          <div className="mt-4 space-y-2">
            <div className="h-4 w-full animate-pulse rounded-lg bg-white/10" />
            <div className="h-4 w-5/6 animate-pulse rounded-lg bg-white/10" />
            <div className="h-4 w-4/6 animate-pulse rounded-lg bg-white/10" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main form
// ---------------------------------------------------------------------------

export function TeamRunForm() {
  const [task, setTask] = useState("");
  const [state, setState] = useState<FormState>({ status: "idle" });

  const trimmedLength = task.trim().length;
  const canSubmit =
    trimmedLength >= TEAM_RUN_TASK_MIN_LENGTH &&
    trimmedLength <= TEAM_RUN_TASK_MAX_LENGTH &&
    state.status !== "loading";

  async function handleSubmit() {
    if (!canSubmit) return;

    setState({ status: "loading" });

    try {
      const res = await fetch("/api/team-run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task: task.trim() }),
        // systemPrompt intentionally not sent — defined server-side
      });

      if (!res.ok) {
        const err = (await res.json()) as { errorCode?: string; message?: string };
        setState({
          status: "error",
          errorCode: err.errorCode ?? "UNKNOWN_ERROR",
          message: err.message ?? "Произошла ошибка. Попробуйте позже.",
        });
        return;
      }

      const result = (await res.json()) as TeamResult;
      setState({ status: "success", result });
    } catch {
      setState({
        status: "error",
        errorCode: "NETWORK_ERROR",
        message: "Не удалось подключиться к серверу. Проверьте соединение и попробуйте снова.",
      });
    }
  }

  function handleReset() {
    setState({ status: "idle" });
    setTask("");
  }

  const isLoading = state.status === "loading";

  return (
    <div className="grid gap-8">
      {/* Input form — always visible so the user can re-run after seeing results */}
      <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-xl font-bold text-white">Задача для команды</h2>
          <span className="text-xs text-slate-500">Planner → Researcher → Critic → Finalizer</span>
        </div>

        <div className="mt-5 flex items-baseline justify-between gap-4">
          <label className="block text-sm font-medium text-slate-200" htmlFor="team-task">
            Описание задачи
          </label>
          <span
            className={`text-xs tabular-nums transition-colors ${
              trimmedLength >= TEAM_RUN_TASK_MAX_LENGTH
                ? "text-red-400"
                : trimmedLength >= TEAM_RUN_TASK_MAX_LENGTH * 0.85
                  ? "text-amber-400"
                  : "text-slate-500"
            }`}
          >
            {task.length} / {TEAM_RUN_TASK_MAX_LENGTH.toLocaleString()}
          </span>
        </div>

        <textarea
          id="team-task"
          value={task}
          maxLength={TEAM_RUN_TASK_MAX_LENGTH}
          onChange={(e) => setTask(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && canSubmit) {
              void handleSubmit();
            }
          }}
          disabled={isLoading}
          className="mt-2 min-h-36 w-full rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-sm text-white outline-none ring-0 transition placeholder:text-slate-500 focus:border-violet-300/60 disabled:opacity-60"
          placeholder="Например: разработай архитектуру системы аутентификации для SaaS-приложения"
        />
        <p className="mt-1.5 text-xs text-slate-500">
          Ctrl+Enter для отправки · минимум {TEAM_RUN_TASK_MIN_LENGTH} символов
        </p>

        <div className="mt-6 flex gap-3">
          <button
            disabled={!canSubmit}
            onClick={() => void handleSubmit()}
            type="button"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-violet-300/60 bg-violet-600 px-6 py-3 text-center text-sm font-extrabold leading-5 text-white shadow-lg shadow-violet-950/35 transition hover:border-violet-200 hover:bg-violet-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200 disabled:cursor-not-allowed disabled:border-slate-500/30 disabled:bg-slate-700 disabled:text-slate-200 disabled:shadow-none"
          >
            {isLoading ? "Команда работает…" : "Запустить команду"}
          </button>
          {(state.status === "success" || state.status === "error") && (
            <button
              onClick={handleReset}
              type="button"
              className="rounded-full border border-white/15 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/10"
            >
              Сбросить
            </button>
          )}
        </div>
      </section>

      {/* Loading state */}
      {isLoading && <LoadingSkeleton />}

      {/* Error state */}
      {state.status === "error" && (
        <div className="rounded-2xl border border-red-300/20 bg-red-500/10 p-4 text-sm leading-6 text-red-100">
          {state.errorCode === "AUTH_REQUIRED"
            ? "Team Mode доступен только после входа в аккаунт."
            : state.message}
        </div>
      )}

      {/* Success state */}
      {state.status === "success" && (
        <div className="grid gap-6">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">
            Шаги команды
          </h2>
          {state.result.steps.map((step, i) => (
            <StepCard key={step.roleId} step={step} index={i} />
          ))}
          <FinalAnswerCard finalAnswer={state.result.finalAnswer} />
        </div>
      )}
    </div>
  );
}
