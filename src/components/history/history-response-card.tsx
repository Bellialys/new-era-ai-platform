import type { HistoryResponseView } from "@/types/history";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";

/**
 * Read-only counterpart of components/arena/response-card.tsx. Shows a stored
 * model response from history with a static "Победитель" badge, and no voting
 * interaction (history is not editable).
 */
export function HistoryResponseCard({ response }: { response: HistoryResponseView }) {
  const title = response.displayName ?? response.modelKey ?? "Модель";
  const isSuccess = response.status === "success";
  const bodyText = response.responseText ?? response.errorMessage ?? "Модель не вернула ответ.";

  return (
    <article
      className={
        response.isWinner
          ? "rounded-3xl border border-emerald-300/50 bg-emerald-500/10 p-6 shadow-2xl shadow-emerald-950/30 backdrop-blur"
          : "rounded-3xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur"
      }
    >
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-bold text-white">{title}</h2>
          {response.modelKey ? (
            <p className="truncate text-sm text-violet-200">{response.modelKey}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <span
            className={
              isSuccess
                ? "rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-100"
                : "rounded-full bg-red-500/15 px-3 py-1 text-xs font-semibold text-red-100"
            }
          >
            {isSuccess ? "Успех" : "Ошибка"}
          </span>
          {response.latencyMs !== null ? (
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-200">
              {response.latencyMs} ms
            </span>
          ) : null}
          {response.errorCode ? (
            <span className="rounded-full bg-red-500/15 px-3 py-1 text-xs font-semibold text-red-100">
              {response.errorCode}
            </span>
          ) : null}
          {response.isWinner ? (
            <span className="rounded-full bg-emerald-400 px-3 py-1 text-xs font-bold text-emerald-950">
              Победитель
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/45 p-4 text-sm">
        {isSuccess && response.responseText ? (
          <MarkdownRenderer content={bodyText} />
        ) : (
          <p className="leading-7 text-slate-200">{bodyText}</p>
        )}
      </div>
    </article>
  );
}
