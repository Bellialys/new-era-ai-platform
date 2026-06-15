import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <p className="inline-flex rounded-full border border-violet-300/30 bg-violet-500/10 px-4 py-2 text-sm text-violet-100">
        Ошибка 404
      </p>
      <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
        Страница не найдена
      </h1>
      <p className="max-w-lg text-sm leading-6 text-slate-400">
        Такой страницы нет или она была перемещена. Проверьте адрес или вернитесь на главную.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-violet-300/60 bg-violet-600 px-6 py-3 text-sm font-extrabold text-white shadow-lg shadow-violet-950/35 transition hover:border-violet-200 hover:bg-violet-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-200"
        >
          На главную
        </Link>
        <Link
          href="/arena"
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/15 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/10"
        >
          Открыть Prompt Arena
        </Link>
      </div>
    </main>
  );
}
