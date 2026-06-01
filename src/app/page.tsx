import Link from "next/link";

const modes = [
  "Prompt Arena",
  "Code Arena",
  "Multi Model Battle",
  "Judge Mode",
  "Leaderboard",
  "AI Team Mode",
];

const stack = ["Next.js", "TypeScript", "Supabase", "OpenRouter", "Vercel"];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8 sm:px-8 lg:px-10">
      <header className="flex items-center justify-between gap-4 border-b border-white/10 pb-6">
        <Link href="/" className="text-lg font-bold tracking-tight">
          Новая эпоха
        </Link>
        <nav className="flex items-center gap-4 text-sm text-slate-300">
          <Link className="transition hover:text-white" href="/arena">
            Prompt Arena
          </Link>
          <a className="transition hover:text-white" href="https://github.com/Bellialys/new-era-ai-platform">
            GitHub
          </a>
        </nav>
      </header>

      <section className="grid flex-1 items-center gap-10 py-16 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="mb-4 inline-flex rounded-full border border-violet-300/30 bg-violet-500/10 px-4 py-2 text-sm text-violet-100">
            MVP сначала - сложные режимы позже
          </p>
          <h1 className="max-w-3xl text-4xl font-black tracking-tight text-white sm:text-6xl">
            AI-платформа для сравнения нескольких моделей на одной задаче
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            Пользователь вводит задачу, выбирает несколько AI-моделей, получает ответы рядом,
            сравнивает результат и выбирает лучший вариант. Первый рабочий режим - Prompt Arena.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/arena"
              className="rounded-full bg-white px-6 py-3 text-center text-sm font-bold text-slate-950 transition hover:bg-violet-100"
            >
              Открыть Prompt Arena
            </Link>
            <Link
              href="/README.md"
              className="rounded-full border border-white/15 px-6 py-3 text-center text-sm font-bold text-white transition hover:bg-white/10"
            >
              Читать документацию
            </Link>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-violet-950/30 backdrop-blur">
          <h2 className="text-xl font-bold text-white">Режимы проекта</h2>
          <div className="mt-5 grid gap-3">
            {modes.map((mode, index) => (
              <div key={mode} className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="font-semibold text-white">{mode}</span>
                  <span className="rounded-full bg-violet-500/15 px-3 py-1 text-xs text-violet-100">
                    {index === 0 ? "MVP" : "Later"}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 border-t border-white/10 pt-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">Stack</h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {stack.map((item) => (
                <span key={item} className="rounded-full bg-white/10 px-3 py-1 text-sm text-slate-200">
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
