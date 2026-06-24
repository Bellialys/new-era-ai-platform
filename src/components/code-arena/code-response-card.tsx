import type { ArenaResponseView } from "@/types/arena";
import { RunPanel } from "@/components/arena/run-panel";

type CodeResponseCardProps = {
  response: ArenaResponseView;
  isWinner: boolean;
  canSaveWinner: boolean;
  isSavingWinner: boolean;
  isVoteLocked: boolean;
  blindLabel?: string;
  language: string;
  isAuthenticated: boolean;
  onSelectWinner: (responseId: string) => void | Promise<void>;
};

export function CodeResponseCard({
  response,
  isWinner,
  canSaveWinner,
  isSavingWinner,
  isVoteLocked,
  blindLabel,
  language,
  isAuthenticated,
  onSelectWinner,
}: CodeResponseCardProps) {
  const displayName = blindLabel ?? response.modelName;
  const displayRole = blindLabel ? undefined : response.modelRole;

  const winnerBorder = "rounded-3xl border border-emerald-400/40 bg-emerald-500/5 p-6 shadow-lg shadow-emerald-950/20";
  const normalBorder = "rounded-3xl border border-white/10 bg-white/[0.04] p-6 transition hover:border-white/20";

  async function handleCopy() {
    if (!response.answerText) return;
    try { await navigator.clipboard.writeText(response.answerText); } catch { /* ignore */ }
  }

  if (response.status === "error") {
    return (
      <div className={normalBorder}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <span className="font-semibold text-white">{displayName}</span>
            {displayRole ? <span className="ml-2 text-xs text-slate-500">{displayRole}</span> : null}
          </div>
          <span className="rounded-full bg-red-500/15 px-2.5 py-1 text-xs font-semibold text-red-300">
            Ошибка
          </span>
        </div>
        <p className="text-sm text-slate-400">
          {response.errorMessage ?? "Не удалось получить ответ от модели."}
        </p>
      </div>
    );
  }

  return (
    <div className={isWinner ? winnerBorder : normalBorder}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {isWinner ? (
            <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-200">
              ✓ Лучшее решение
            </span>
          ) : null}
          <div>
            <span className="font-semibold text-white">{displayName}</span>
            {displayRole ? <span className="ml-2 text-xs text-slate-500">{displayRole}</span> : null}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {response.latencyMs !== undefined ? (
            <span className="text-xs tabular-nums text-slate-500">
              {(response.latencyMs / 1000).toFixed(1)}s
            </span>
          ) : null}
          {/* Copy button */}
          {response.answerText ? (
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1 rounded-full border border-white/15 px-2.5 py-1 text-xs text-slate-400 transition hover:border-white/30 hover:text-white"
              type="button"
            >
              Копировать
            </button>
          ) : null}
          {canSaveWinner && !isWinner ? (
            <button
              disabled={isVoteLocked}
              onClick={() => onSelectWinner(response.id)}
              className="inline-flex items-center gap-1.5 rounded-full border border-violet-300/40 bg-violet-600/20 px-3 py-1.5 text-xs font-semibold text-violet-100 transition hover:border-violet-300/70 hover:bg-violet-600/40 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSavingWinner ? "Сохраняем..." : "Лучшее решение"}
            </button>
          ) : null}
          {isWinner && canSaveWinner ? (
            <span className="rounded-full bg-emerald-500/20 px-3 py-1.5 text-xs font-semibold text-emerald-200">
              Победитель сохранён
            </span>
          ) : null}
        </div>
      </div>

      {/* Code block */}
      <div className="rounded-2xl border border-white/5 bg-slate-950/80 p-4">
        <pre className="overflow-x-auto whitespace-pre-wrap text-sm leading-relaxed text-slate-200">
          {response.answerText ?? (response.isStreaming ? "Генерируем..." : "")}
        </pre>
      </div>

      <RunPanel
        code={response.answerText ?? ""}
        language={language}
        responseId={response.id}
        isAuthenticated={isAuthenticated}
      />
    </div>
  );
}
