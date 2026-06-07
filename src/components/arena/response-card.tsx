import type { ArenaResponseView } from "@/types/arena";

type ResponseCardProps = {
  response: ArenaResponseView;
  isWinner: boolean;
  onSelectWinner: (responseId: string) => void;
};

export function ResponseCard({ response, isWinner, onSelectWinner }: ResponseCardProps) {
  const responseText = response.answerText ?? response.errorMessage ?? "Модель не вернула ответ.";
  const canSelectWinner = response.status === "success";

  return (
    <article
      className={
        isWinner
          ? "rounded-3xl border border-emerald-300/50 bg-emerald-500/10 p-6 shadow-2xl shadow-emerald-950/30 backdrop-blur"
          : "rounded-3xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur"
      }
    >
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h2 className="text-xl font-bold text-white">{response.modelName}</h2>
          <p className="text-sm text-violet-200">{response.modelRole}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span
            className={
              response.status === "success"
                ? "rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-100"
                : "rounded-full bg-red-500/15 px-3 py-1 text-xs font-semibold text-red-100"
            }
          >
            {response.status === "success" ? "Успех" : "Ошибка"}
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

      <div className="mt-5 whitespace-pre-line rounded-2xl border border-white/10 bg-slate-950/45 p-4 text-sm leading-7 text-slate-200">
        {responseText}
      </div>

      <button
        disabled={!canSelectWinner}
        onClick={() => onSelectWinner(response.id)}
        className="mt-5 rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
        type="button"
      >
        {isWinner ? "Выбрано победителем" : "Выбрать победителем"}
      </button>
    </article>
  );
}
