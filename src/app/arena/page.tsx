import Link from "next/link";

const mockModels = [
  {
    name: "Model A",
    role: "Balanced answer",
    text: "Эта карточка показывает будущий ответ первой AI-модели. На этапе v0.3 здесь будут mock-ответы, а после v0.4 - реальные ответы через OpenRouter.",
  },
  {
    name: "Model B",
    role: "Creative answer",
    text: "Вторая модель сможет дать альтернативный вариант ответа. Главная ценность проекта - видеть разные подходы рядом и выбирать лучший результат.",
  },
  {
    name: "Model C",
    role: "Critical answer",
    text: "Третья модель может быть более строгой, технической или аналитической. Позже это поможет развить Judge Mode и Leaderboard.",
  },
];

export default function ArenaPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-6 py-8 sm:px-8 lg:px-10">
      <header className="mb-8 flex flex-col justify-between gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-violet-200">Prompt Arena</p>
          <h1 className="mt-2 text-3xl font-black text-white sm:text-4xl">Сравнение AI-моделей</h1>
        </div>
        <Link className="text-sm text-slate-300 transition hover:text-white" href="/">
          Вернуться на главную
        </Link>
      </header>

      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur">
          <h2 className="text-xl font-bold text-white">Задача</h2>
          <label className="mt-5 block text-sm font-medium text-slate-200" htmlFor="prompt">
            Введите prompt
          </label>
          <textarea
            id="prompt"
            className="mt-2 min-h-40 w-full rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-sm text-white outline-none ring-0 transition placeholder:text-slate-500 focus:border-violet-300/60"
            placeholder="Например: сравни Next.js и Nuxt для MVP AI-платформы"
          />

          <div className="mt-6">
            <h3 className="text-sm font-semibold text-slate-200">Выбор моделей</h3>
            <div className="mt-3 grid gap-3">
              {mockModels.map((model, index) => (
                <label
                  key={model.name}
                  className="flex cursor-pointer items-center justify-between rounded-2xl border border-white/10 bg-slate-950/45 p-4"
                >
                  <span>
                    <span className="block font-semibold text-white">{model.name}</span>
                    <span className="block text-sm text-slate-400">{model.role}</span>
                  </span>
                  <input defaultChecked={index < 2} type="checkbox" className="h-5 w-5" />
                </label>
              ))}
            </div>
          </div>

          <button className="mt-6 w-full rounded-full bg-white px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-violet-100">
            Запустить сравнение
          </button>

          <p className="mt-4 text-sm leading-6 text-slate-400">
            Сейчас это статическая заготовка для v0.2-v0.3. Реальный backend, OpenRouter и Supabase будут добавлены на следующих этапах.
          </p>
        </div>

        <div className="grid gap-4">
          {mockModels.map((model) => (
            <article key={model.name} className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <h2 className="text-xl font-bold text-white">{model.name}</h2>
                  <p className="text-sm text-violet-200">{model.role}</p>
                </div>
                <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-100">
                  Mock response
                </span>
              </div>
              <p className="mt-4 leading-7 text-slate-300">{model.text}</p>
              <button className="mt-5 rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10">
                Выбрать лучшим
              </button>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
