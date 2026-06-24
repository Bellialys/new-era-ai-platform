"use client";

import { useState } from "react";
import type { ArenaResponseView, JudgeVerdict } from "@/types/arena";

const BLIND_LABELS = ["A", "B", "C", "D", "E"];

type JudgeStatus = "idle" | "loading" | "ready" | "error";

type JudgePanelProps = {
  taskId: string | null;
  prompt: string;
  responses: ArenaResponseView[];
  blindMode: boolean;
  winnerResponseId: string | null;
};

export function JudgePanel({
  taskId,
  prompt,
  responses,
  blindMode,
  winnerResponseId,
}: JudgePanelProps) {
  const [status, setStatus] = useState<JudgeStatus>("idle");
  const [verdict, setVerdict] = useState<JudgeVerdict | null>(null);
  const [error, setError] = useState<string | null>(null);

  const judgeableResponses = responses.filter(
    (r) => r.status === "success" && r.answerText && !r.isStreaming
  );

  if (judgeableResponses.length < 2) return null;

  const isBlind = blindMode && !winnerResponseId;

  function getDisplayName(response: ArenaResponseView): string {
    if (isBlind) {
      const idx = judgeableResponses.findIndex((r) => r.id === response.id);
      return `Модель ${BLIND_LABELS[idx] ?? idx + 1}`;
    }
    return response.modelName;
  }

  async function handleJudge() {
    setStatus("loading");
    setError(null);
    setVerdict(null);

    try {
      const res = await fetch("/api/judge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          prompt,
          responses: judgeableResponses.map((r) => ({
            modelId: r.modelId,
            modelName: r.modelName,
            answerText: r.answerText ?? "",
          })),
        }),
      });

      const data = (await res.json()) as { status: string; verdict?: JudgeVerdict; message?: string };

      if (!res.ok || data.status !== "ok" || !data.verdict) {
        setError(data.message ?? "Судья не смог оценить ответы. Попробуйте ещё раз.");
        setStatus("error");
        return;
      }

      setVerdict(data.verdict);
      setStatus("ready");
    } catch {
      setError("Не удалось связаться с судьёй. Проверьте соединение.");
      setStatus("error");
    }
  }

  function getWinnerDisplayName(): string {
    if (!verdict) return "";
    if (isBlind) return `Модель ${verdict.winnerLabel}`;
    return verdict.winnerModelName;
  }

  return (
    <div className="rounded-3xl border border-amber-400/20 bg-amber-500/5 p-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🏛️</span>
          <h3 className="text-sm font-bold text-amber-200">Режим судьи</h3>
          <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-semibold text-amber-300">
            v1.3
          </span>
        </div>
        {status === "idle" && (
          <button
            type="button"
            onClick={handleJudge}
            className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-amber-400/40 bg-amber-500/15 px-4 text-xs font-semibold text-amber-200 transition hover:border-amber-400/70 hover:bg-amber-500/25"
          >
            Оценить ответы
          </button>
        )}
        {status === "ready" && (
          <button
            type="button"
            onClick={() => { setStatus("idle"); setVerdict(null); }}
            className="text-xs text-slate-500 transition hover:text-slate-300"
          >
            Сбросить
          </button>
        )}
      </div>

      {/* Idle state */}
      {status === "idle" && (
        <p className="mt-3 text-xs text-slate-500">
          AI-судья (Nemotron 3 Ultra) оценит все ответы и выберет лучший с обоснованием.
          {isBlind ? " Имена моделей раскроются после голосования." : ""}
        </p>
      )}

      {/* Loading */}
      {status === "loading" && (
        <div className="mt-4 flex items-center gap-3">
          <svg className="h-5 w-5 animate-spin text-amber-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span className="text-sm text-amber-300">Судья анализирует {judgeableResponses.length} ответа…</span>
        </div>
      )}

      {/* Error */}
      {status === "error" && (
        <div className="mt-3">
          <p className="text-sm text-red-300">{error}</p>
          <button
            type="button"
            onClick={handleJudge}
            className="mt-2 text-xs text-amber-400 transition hover:text-amber-200"
          >
            Попробовать снова
          </button>
        </div>
      )}

      {/* Verdict */}
      {status === "ready" && verdict && (
        <div className="mt-4 space-y-4">
          {/* Winner */}
          <div className="flex items-center gap-3 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-3">
            <span className="text-2xl">🏆</span>
            <div>
              <p className="text-xs font-semibold text-amber-400">Победитель по мнению судьи</p>
              <p className="text-base font-black text-white">{getWinnerDisplayName()}</p>
            </div>
          </div>

          {/* Reasoning */}
          <div>
            <p className="mb-1 text-xs font-semibold text-amber-400">Обоснование</p>
            <p className="text-sm leading-6 text-slate-300">{verdict.reasoning}</p>
          </div>

          {/* Scores */}
          {Object.keys(verdict.scores).length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold text-amber-400">Оценки (из 10)</p>
              <div className="space-y-2">
                {judgeableResponses.map((r) => {
                  const score = verdict.scores[r.modelId] ?? null;
                  if (score === null) return null;
                  const displayName = getDisplayName(r);
                  const isWinner = verdict.winnerModelId === r.modelId;
                  return (
                    <div key={r.id} className="flex items-center gap-3">
                      <span className={`w-32 truncate text-xs ${isWinner ? "font-bold text-amber-200" : "text-slate-400"}`}>
                        {displayName}
                      </span>
                      <div className="flex-1 overflow-hidden rounded-full bg-white/5">
                        <div
                          className={`h-1.5 rounded-full transition-all ${isWinner ? "bg-amber-400" : "bg-slate-600"}`}
                          style={{ width: `${score * 10}%` }}
                        />
                      </div>
                      <span className={`w-6 text-right text-xs font-semibold ${isWinner ? "text-amber-300" : "text-slate-500"}`}>
                        {score}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <p className="text-xs text-slate-600">
            Оценка судьи не заменяет ваш голос — это независимое мнение AI-модели.
          </p>
        </div>
      )}
    </div>
  );
}
