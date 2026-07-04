"use client";

import { useState } from "react";
import type { ArenaResponseView } from "@/types/arena";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";

const COLLAPSE_THRESHOLD = 800;

type ResponseCardProps = {
  response: ArenaResponseView;
  isWinner: boolean;
  canSaveWinner: boolean;
  isSavingWinner: boolean;
  isVoteLocked: boolean;
  /** When set, hides the real model name and shows this label instead (e.g. "Модель A"). */
  blindLabel?: string;
  onSelectWinner: (responseId: string) => void | Promise<void>;
};

export function ResponseCard({
  response,
  isWinner,
  canSaveWinner,
  isSavingWinner,
  isVoteLocked,
  blindLabel,
  onSelectWinner,
}: ResponseCardProps) {
  const [expanded, setExpanded] = useState(false);

  const displayName = blindLabel ?? response.modelName;
  const displayRole = blindLabel ? undefined : response.modelRole;

  const responseText =
    response.answerText ??
    response.errorMessage ??
    (response.isStreaming ? "Модель начала отвечать..." : "Модель не вернула ответ.");

  const canSelectWinner = response.status === "success" && !response.isStreaming && canSaveWinner;
  const isDisabled = !canSelectWinner || isVoteLocked || isWinner;

  const winnerButtonLabel = isSavingWinner
    ? "Сохраняем..."
    : isWinner
      ? "Победитель сохранён"
      : "Выбрать победителя";

  async function handleCopy() {
    if (!response.answerText) return;
    try {
      await navigator.clipboard.writeText(response.answerText);
    } catch {
      // clipboard not available — silently ignore
    }
  }

  return (
    <article
      className={
        isWinner
          ? "self-start rounded-[22px] border border-emerald-300/50 bg-emerald-500/10 p-5 shadow-2xl shadow-emerald-950/30 backdrop-blur"
          : "self-start rounded-[22px] border border-white/10 bg-white/[0.06] p-5 backdrop-blur"
      }
    >
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h2 className="text-xl font-bold text-white">{displayName}</h2>
          {displayRole ? <p className="text-sm text-violet-200">{displayRole}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <span
            className={
              response.status === "success"
                ? "rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-100"
                : "rounded-full bg-red-500/15 px-3 py-1 text-xs font-semibold text-red-100"
            }
          >
            {response.isStreaming ? "Генерация..." : response.status === "success" ? "Успех" : "Ошибка"}
          </span>
          {response.latencyMs !== undefined ? (
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-200">
              {response.latencyMs} ms
            </span>
          ) : null}
          {response.errorCode ? (
            <span className="rounded-full bg-red-500/15 px-3 py-1 text-xs font-semibold text-red-100">
              {response.errorCode}
            </span>
          ) : null}
          {isWinner ? (
            <span className="rounded-full bg-emerald-400 px-3 py-1 text-xs font-bold text-emerald-950">
              Победитель
            </span>
          ) : null}
        </div>
      </div>

      <div className="relative mt-5">
        <div className="max-h-[28rem] overflow-auto rounded-[18px] border border-white/10 bg-slate-950/45 p-4 text-sm">
          {response.status === "success" && response.answerText ? (
            <>
              {!expanded && responseText.length > COLLAPSE_THRESHOLD ? (
                <div className="line-clamp-6 text-slate-200 leading-7">
                  {responseText}
                </div>
              ) : (
                <MarkdownRenderer content={responseText} />
              )}
              {responseText.length > COLLAPSE_THRESHOLD && (
                <button
                  onClick={() => setExpanded((v) => !v)}
                  className="mt-3 text-xs font-semibold text-violet-300 transition hover:text-violet-100"
                  type="button"
                >
                  {expanded ? "Свернуть" : "Показать полностью"}
                </button>
              )}
            </>
          ) : (
            <p className="leading-7 text-slate-200">{responseText}</p>
          )}
        </div>
        {response.status === "success" && !response.isStreaming && response.answerText ? (
          <button
            onClick={handleCopy}
            title="Скопировать ответ"
            className="absolute right-3 top-3 rounded-lg border border-white/10 bg-slate-900/60 px-2 py-1 text-xs text-slate-400 transition hover:border-white/25 hover:text-white"
            type="button"
          >
            Копировать
          </button>
        ) : null}
      </div>

      <button
        disabled={isDisabled}
        onClick={() => onSelectWinner(response.id)}
        className="mt-5 min-h-[44px] rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
        type="button"
      >
        {winnerButtonLabel}
      </button>
    </article>
  );
}
