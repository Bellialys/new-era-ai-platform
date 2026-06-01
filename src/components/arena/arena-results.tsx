import type { ArenaResponse } from "@/types/arena";
import { ResponseCard } from "./response-card";

type ArenaResultsProps = {
  responses: ArenaResponse[];
  isLoading: boolean;
  winnerResponseId: string | null;
  onSelectWinner: (responseId: string) => void;
};

export function ArenaResults({ responses, isLoading, winnerResponseId, onSelectWinner }: ArenaResultsProps) {
  if (isLoading) {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur">
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-40 rounded-full bg-white/20" />
          <div className="h-28 rounded-2xl bg-white/10" />
          <div className="h-28 rounded-2xl bg-white/10" />
          <div className="h-28 rounded-2xl bg-white/10" />
        </div>
      </section>
    );
  }

  if (responses.length === 0) {
    return (
      <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 text-center backdrop-blur">
        <div className="mx-auto flex min-h-80 max-w-xl flex-col items-center justify-center">
          <span className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-slate-200">
            Empty state
          </span>
          <h2 className="mt-5 text-2xl font-black text-white">Ответов пока нет</h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Введите задачу, выберите минимум две модели и нажмите кнопку запуска сравнения.
            После этого здесь появятся mock-ответы моделей.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="grid gap-4">
      {responses.map((response) => (
        <ResponseCard
          key={response.id}
          response={response}
          isWinner={winnerResponseId === response.id}
          onSelectWinner={onSelectWinner}
        />
      ))}
    </section>
  );
}
