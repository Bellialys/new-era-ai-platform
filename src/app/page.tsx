import Link from "next/link";
import { AuthStatus } from "@/components/auth/auth-status";

const modes = [
  { name: "Prompt Arena", status: "live", href: "/arena", description: "Сравнение ответов нескольких AI на одну задачу" },
  { name: "Code Arena", status: "live", href: "/code", description: "Сравнение кодовых решений без выполнения кода" },
  { name: "Multi Model Battle", status: "soon", href: null, description: "Формальное соревнование моделей" },
  { name: "Judge Mode", status: "soon", href: null, description: "Одна модель оценивает ответы других" },
  { name: "Leaderboard", status: "soon", href: null, description: "Рейтинг моделей по голосам" },
  { name: "AI Team Mode", status: "later", href: null, description: "Несколько моделей с ролями работают вместе" },
];

const stack = ["Next.js", "TypeScript", "Supabase", "OpenRouter", "Vercel"];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-8 sm:px-8 lg:px-10">
      <header className="flex items-center justify-between gap-4 border-b border-white/10 pb-6">
        <Link href="/" className="text-lg font-bold tracking-tight text-white">
          Новая эпоха
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-4 text-sm text-slate-300">
          <Link className="transition hover:text-white" href="/arena">
            Prompt Arena
          </Link>
          <Link className="rounded-full bg-violet-500/20 px-4 py-1.5 font-semibold text-violet-100 transition hover:bg-violet-500/30" href="/code">
            Code Arena
          </Link>
          <Link className="transition hover:text-white" href="/history">
            История
          </Link>
          <a className="transition hover:text-white" href="https://github.com/Bellialys/new-era-ai-platform">
            GitHub
          </a>
          <AuthStatus />
        </nav>
      </header>

      <section className="grid flex-1 items-center gap-10 py-16 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="mb-4 inline-flex rounded-full border border-violet-300/30 bg-violet-500/10 px-4 py-2 text-sm text-violet-100">
            v0.7 — Code Arena теперь доступен
          </p>
          <h1 className="max-w-3xl text-4xl font-black tracking-tight text-white sm:text-6xl">
            AI-платформа для сравнения нескольких моделей на одной задаче
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
            Введите задачу, выберите несколько AI-моделей, получите ответы рядом и выберите лучший.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/arena"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-violet-300/60 bg-violet-600 px-6 py-3 text-center text-sm font-extrabold leading-5 text-white shadow-lg shadow-violet-950/35 transition hover:border-violet-200 hover:bg-violet-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200"
            >
              Prompt Arena →
            </Link>
            <Link
              href="/code"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-violet-300/30 bg-violet-500/15 px-6 py-3 text-center text-sm font-extrabold leading-5 text-violet-100 transition hover:border-violet-300/60 hover:bg-violet-500/30"
            >
              Code Arena →
            </Link>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-violet-950/30 backdrop-blur">
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Режимы платформы</h2>
          <div className="mt-4 grid gap-2">
            {modes.map((mode) => (
              <div
                key={mode.name}
                className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-3"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    {mode.href ? (
                      <Link href={mode.href} className="font-semibold text-white transition hover:text-violet-200">
                        {mode.name}
                      </Link>
                    ) : (
                      <span className="font-semibold text-white">{mode.name}</span>
                    )}
                    <span className="mt-0.5 block text-xs text-slate-500">{mode.description}</span>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      mode.status === "live"
                        ? "bg-emerald-500/20 text-emerald-300"
                        : mode.status === "soon"
                        ? "bg-violet-500/15 text-violet-300"
                        : "bg-white/10 text-slate-400"
                    }`}
                  >
                    {mode.status === "live" ? "Доступно" : mode.status === "soon" ? "Скоро" : "Позже"}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 border-t border-white/10 pt-5">
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Стек</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {stack.map((item) => (
                <span key={item} className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-300">
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
