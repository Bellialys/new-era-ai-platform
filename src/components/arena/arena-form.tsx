import type { ArenaModel } from "@/types/arena";

type ArenaFormProps = {
  prompt: string;
  maxPromptLength: number;
  selectedModelIds: string[];
  models: ArenaModel[];
  modelsLoading: boolean;
  isLoading: boolean;
  errorMessage: string | null;
  onPromptChange: (value: string) => void;
  onToggleModel: (modelId: string) => void;
  onSubmit: () => void;
  onReset: () => void;
};

export function ArenaForm({
  prompt,
  maxPromptLength,
  selectedModelIds,
  models,
  modelsLoading,
  isLoading,
  errorMessage,
  onPromptChange,
  onToggleModel,
  onSubmit,
  onReset,
}: ArenaFormProps) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Задача</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Введите prompt, выберите минимум две модели и запустите сравнение.
          </p>
        </div>
        <span className="rounded-full bg-violet-500/15 px-3 py-1 text-xs font-semibold text-violet-100">
          v0.4
        </span>
      </div>

      <div className="mt-5 flex items-baseline justify-between gap-4">
        <label className="block text-sm font-medium text-slate-200" htmlFor="prompt">
          Prompt
        </label>
        <span
          className={`text-xs tabular-nums transition-colors ${
            prompt.length >= maxPromptLength
              ? "text-red-400"
              : prompt.length >= maxPromptLength * 0.85
              ? "text-amber-400"
              : "text-slate-500"
          }`}
        >
          {prompt.length} / {maxPromptLength.toLocaleString()}
        </span>
      </div>
      <textarea
        id="prompt"
        value={prompt}
        maxLength={maxPromptLength}
        onChange={(event) => onPromptChange(event.target.value)}
        className="mt-2 min-h-40 w-full rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-sm text-white outline-none ring-0 transition placeholder:text-slate-500 focus:border-violet-300/60"
        placeholder="Например: сравни Next.js и Nuxt для MVP AI-платформы"
      />

      <div className="mt-6">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-sm font-semibold text-slate-200">Выбор моделей</h3>
          <span className="text-xs text-slate-400">
            {modelsLoading ? "Загрузка..." : `Выбрано: ${selectedModelIds.length}`}
          </span>
        </div>
        <div className="mt-3 grid gap-3">
          {modelsLoading ? (
            <>
              <div className="h-16 animate-pulse rounded-2xl bg-white/10" />
              <div className="h-16 animate-pulse rounded-2xl bg-white/10" />
              <div className="h-16 animate-pulse rounded-2xl bg-white/10" />
            </>
          ) : (
            models.map((model) => {
              const isSelected = selectedModelIds.includes(model.id);

              return (
                <label
                  key={model.id}
                  className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-white/10 bg-slate-950/45 p-4 transition hover:border-violet-300/40"
                >
                  <span>
                    <span className="flex flex-wrap items-center gap-2 font-semibold text-white">
                      {model.name}
                      {model.badge ? (
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-slate-300">
                          {model.badge}
                        </span>
                      ) : null}
                    </span>
                    {model.description ? (
                      <span className="mt-1 block text-sm text-slate-400">{model.description}</span>
                    ) : null}
                  </span>
                  <input
                    checked={isSelected}
                    onChange={() => onToggleModel(model.id)}
                    type="checkbox"
                    className="h-5 w-5 shrink-0 accent-violet-500"
                  />
                </label>
              );
            })
          )}
        </div>
      </div>

      {errorMessage ? (
        <div className="mt-5 rounded-2xl border border-red-300/20 bg-red-500/10 p-4 text-sm leading-6 text-red-100">
          {errorMessage}
        </div>
      ) : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button
          disabled={isLoading || modelsLoading}
          onClick={onSubmit}
          className="rounded-full bg-white px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
        >
          {isLoading ? "Получаем ответы..." : "Запустить сравнение"}
        </button>
        <button
          disabled={isLoading || modelsLoading}
          onClick={onReset}
          className="rounded-full border border-white/15 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
        >
          Очистить
        </button>
      </div>
    </section>
  );
}
