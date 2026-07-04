import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";

const modes = [
  {
    name: "Prompt Arena",
    status: "live",
    href: "/arena",
    description: "Один prompt, несколько моделей и выбор лучшего ответа.",
  },
  {
    name: "Code Arena",
    status: "live",
    href: "/code",
    description: "Сравнение кодовых решений через внешний runner.",
  },
  {
    name: "Multi Model Battle",
    status: "live",
    href: "/arena",
    description: "Формальное соревнование моделей на одной задаче.",
  },
  {
    name: "Judge Mode",
    status: "live",
    href: "/arena",
    description: "Отдельная модель оценивает ответы участников.",
  },
  {
    name: "Leaderboard",
    status: "live",
    href: "/leaderboard",
    description: "Рейтинг моделей по сохранённым best-голосам.",
  },
  {
    name: "Image Arena",
    status: "live",
    href: "/image",
    description: "Сравнение изображений от AI-моделей.",
  },
  {
    name: "AI Team Mode",
    status: "soon",
    href: "/team",
    description: "Planner -> Researcher -> Critic -> Finalizer.",
  },
];

const stack = ["Next.js", "TypeScript", "Supabase", "OpenRouter", "Vercel"];

const workflow = [
  {
    step: "01",
    title: "Введите задачу",
    description: "Один prompt становится единым входом для сравнения моделей.",
  },
  {
    step: "02",
    title: "Ответы стримятся рядом",
    description: "Каждый результат виден в собственной панели без переключения контекста.",
  },
  {
    step: "03",
    title: "Выберите лучший",
    description: "Best vote фиксирует победителя и помогает собрать честный рейтинг.",
  },
];

const trustItems = [
  {
    title: "Ключи не в браузере",
    description: "AI-запросы проходят через backend route handlers; провайдерские ключи не утекают во frontend.",
  },
  {
    title: "Гости и аккаунты",
    description: "Гостевой режим и Supabase-auth работают через серверную identity-модель.",
  },
  {
    title: "Открытый стек",
    description: "Next.js, TypeScript, Supabase, OpenRouter и Vercel без закрытой магии.",
  },
];

const liveModes = modes.filter((mode) => mode.status === "live");
const teamMode = modes.find((mode) => mode.name === "AI Team Mode");

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-7 sm:px-8 lg:px-10">
      <SiteHeader />

      <section
        aria-labelledby="hero-title"
        className="grid items-center gap-10 py-14 sm:py-[4.5rem] lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.82fr)] lg:py-20"
      >
        <div>
          <p className="font-mono-ui mb-5 inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#a2a6b8]">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#34d399] opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#34d399]" />
            </span>
            Мультимодельная AI-платформа
          </p>

          <h1
            id="hero-title"
            className="font-display max-w-3xl text-4xl font-extrabold leading-[1.05] text-[#f4f5fa] sm:text-5xl lg:text-[58px]"
          >
            <span className="block">Один запрос.</span>
            <span className="block">Несколько моделей.</span>
            <span className="block bg-[linear-gradient(105deg,#a99bff,#78d7e8)] bg-clip-text text-transparent">
              Один победитель.
            </span>
          </h1>

          <p className="font-mono-ui mt-5 text-xs uppercase tracking-[0.18em] text-[#71748a]">
            One prompt · many models · one winner
          </p>

          <p className="mt-6 max-w-2xl text-base leading-8 text-[#a2a6b8] sm:text-lg">
            «Новая эпоха» превращает сравнение AI-моделей в управляемую лабораторию: один prompt,
            параллельные ответы, blind-голосование и понятный победитель без ручного копирования
            между вкладками.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/arena"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#a99bff]/40 bg-[linear-gradient(105deg,#816ef6,#6f8cf8)] px-6 py-3 text-center text-sm font-extrabold text-white shadow-[0_20px_70px_rgba(129,110,246,.35)] transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#78d7e8]"
            >
              Открыть Prompt Arena →
            </Link>
            <Link
              href="/code"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.04] px-6 py-3 text-center text-sm font-extrabold text-[#f4f5fa] transition hover:border-[#78d7e8]/40 hover:bg-white/[0.07] hover:brightness-110"
            >
              Code Arena
            </Link>
          </div>

          <dl className="mt-8 grid gap-3 text-sm text-[#a2a6b8] sm:grid-cols-3">
            <div className="rounded-[18px] border border-white/10 bg-white/[0.035] px-4 py-3">
              <dt className="font-display text-xl font-bold text-[#f4f5fa]">7</dt>
              <dd>режимов</dd>
            </div>
            <div className="rounded-[18px] border border-white/10 bg-white/[0.035] px-4 py-3">
              <dt className="font-display text-xl font-bold text-[#f4f5fa]">20+</dt>
              <dd>моделей · OpenRouter</dd>
            </div>
            <div className="rounded-[18px] border border-white/10 bg-white/[0.035] px-4 py-3">
              <dt className="font-display text-xl font-bold text-[#f4f5fa]">Blind</dt>
              <dd>голосование</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-[22px] border border-white/10 bg-white/[0.045] p-4 shadow-[0_24px_90px_rgba(0,0,0,.38)] backdrop-blur">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <p className="font-mono-ui text-[11px] font-semibold uppercase tracking-[0.18em] text-[#78d7e8]">
                Prompt Arena · Live
              </p>
              <p className="mt-1 text-sm text-[#8b8fa3]">control room session</p>
            </div>
            <span className="font-mono-ui rounded-full border border-[#816ef6]/45 bg-[#816ef6]/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#c7c0ff]">
              Blind
            </span>
          </div>

          <div className="mt-4 rounded-[18px] border border-white/10 bg-[#08090f]/80 p-4">
            <p className="font-mono-ui text-[10px] font-semibold uppercase tracking-[0.18em] text-[#71748a]">
              Prompt
            </p>
            <p className="mt-3 text-sm leading-6 text-[#f4f5fa]">
              Сравни стратегию запуска AI-продукта для B2B-аудитории и выбери самый практичный план.
            </p>
          </div>

          <div className="mt-4 grid gap-3">
            <article className="rounded-[18px] border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-base font-bold text-[#f4f5fa]">Модель A</h2>
                <span className="font-mono-ui rounded-full bg-white/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-[#a2a6b8]">
                  420 ms
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-[#a2a6b8]">
                Начинает с ICP, каналов продаж и измеримого пилота на 30 дней.
              </p>
            </article>

            <article className="rounded-[18px] border border-[#34d399]/45 bg-[#34d399]/10 p-4 shadow-[0_0_34px_rgba(52,211,153,.16)]">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-base font-bold text-[#f4f5fa]">Модель B</h2>
                <span className="rounded-full bg-[#34d399] px-2.5 py-1 text-xs font-bold text-[#062017]">
                  ★ Победитель
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-[#d8fff0]">
                Разбивает запуск на discovery, onboarding, security review и retention-сигналы.
              </p>
            </article>

            <article className="rounded-[18px] border border-[#816ef6]/35 bg-[#816ef6]/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-base font-bold text-[#f4f5fa]">Модель C</h2>
                <span className="font-mono-ui rounded-full bg-[#78d7e8]/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-[#78d7e8]">
                  streaming
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-[#a2a6b8]">
                Формирует варианты позиционирования<span className="ml-1 inline-block h-4 w-1 animate-pulse bg-[#78d7e8] align-[-2px]" />
              </p>
            </article>
          </div>
        </div>
      </section>

      <section aria-label="Построено на" className="border-y border-white/10 py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-mono-ui text-[11px] font-semibold uppercase tracking-[0.18em] text-[#71748a]">
            Построено на
          </p>
          <div className="flex flex-wrap gap-2">
            {stack.map((item) => (
              <span
                key={item}
                className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-sm text-[#a2a6b8]"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="workflow-title" className="py-16">
        <div className="max-w-2xl">
          <p className="font-mono-ui text-[11px] font-semibold uppercase tracking-[0.18em] text-[#78d7e8]">
            Как это работает
          </p>
          <h2 id="workflow-title" className="font-display mt-3 text-3xl font-bold text-[#f4f5fa] sm:text-4xl">
            От prompt до решения за один проход
          </h2>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {workflow.map((item) => (
            <article key={item.step} className="rounded-[22px] border border-white/10 bg-white/[0.04] p-5">
              <span className="font-display bg-[linear-gradient(105deg,#a99bff,#78d7e8)] bg-clip-text text-4xl font-extrabold text-transparent">
                {item.step}
              </span>
              <h3 className="font-display mt-5 text-xl font-bold text-[#f4f5fa]">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-[#a2a6b8]">{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="modes" aria-labelledby="modes-title" className="pb-16">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-mono-ui text-[11px] font-semibold uppercase tracking-[0.18em] text-[#78d7e8]">
              Режимы
            </p>
            <h2 id="modes-title" className="font-display mt-3 text-3xl font-bold text-[#f4f5fa] sm:text-4xl">
              Рабочие контуры платформы
            </h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-[#8b8fa3]">
            Все ссылки ведут в существующие рабочие разделы; маршруты и API не менялись.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {liveModes.map((mode) => (
            <Link
              key={mode.name}
              href={mode.href}
              className="group min-h-44 rounded-[22px] border border-white/10 bg-white/[0.04] p-5 transition duration-200 hover:-translate-y-[3px] hover:border-[rgba(129,110,246,0.5)] hover:bg-white/[0.055] hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#78d7e8]"
            >
              <div className="flex items-start justify-between gap-4">
                <h3 className="font-display text-xl font-bold text-[#f4f5fa]">{mode.name}</h3>
                <span className="rounded-full bg-[#34d399]/15 px-3 py-1 text-xs font-bold text-[#34d399]">
                  Доступно
                </span>
              </div>
              <p className="mt-5 text-sm leading-6 text-[#a2a6b8]">{mode.description}</p>
              <span className="font-mono-ui mt-6 inline-flex text-[11px] font-semibold uppercase tracking-[0.16em] text-[#78d7e8]">
                Открыть →
              </span>
            </Link>
          ))}
        </div>

        {teamMode ? (
          <Link
            href={teamMode.href}
            className="mt-4 grid min-h-32 gap-5 rounded-[22px] border border-[#816ef6]/35 bg-[radial-gradient(circle_at_18%_0%,rgba(129,110,246,.22),rgba(255,255,255,.04)_45%,rgba(255,255,255,.03))] p-5 transition duration-200 hover:-translate-y-[3px] hover:border-[rgba(129,110,246,0.5)] hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#78d7e8] md:grid-cols-[1fr_auto]"
          >
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="font-display text-2xl font-bold text-[#f4f5fa]">{teamMode.name}</h3>
                <span className="rounded-full border border-[#78d7e8]/30 bg-[#78d7e8]/10 px-3 py-1 text-xs font-bold text-[#78d7e8]">
                  Скоро · Alpha
                </span>
              </div>
              <p className="mt-4 text-sm leading-6 text-[#a2a6b8]">{teamMode.description}</p>
            </div>
            <div className="font-mono-ui flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#a2a6b8] md:justify-end">
              <span>Planner</span>
              <span className="text-[#78d7e8]">→</span>
              <span>Researcher</span>
              <span className="text-[#78d7e8]">→</span>
              <span>Critic</span>
              <span className="text-[#78d7e8]">→</span>
              <span>Finalizer</span>
            </div>
          </Link>
        ) : null}
      </section>

      <section aria-labelledby="trust-title" className="pb-16">
        <h2 id="trust-title" className="font-display text-3xl font-bold text-[#f4f5fa] sm:text-4xl">
          Контроль данных и решений
        </h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {trustItems.map((item) => (
            <article key={item.title} className="rounded-[22px] border border-white/10 bg-white/[0.04] p-5">
              <h3 className="font-display text-lg font-bold text-[#f4f5fa]">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-[#a2a6b8]">{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[22px] border border-white/10 bg-[radial-gradient(circle_at_22%_0%,rgba(120,215,232,.18),rgba(129,110,246,.14)_36%,rgba(255,255,255,.04)_72%)] p-6 shadow-[0_24px_90px_rgba(0,0,0,.35)] sm:p-8">
        <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="font-mono-ui text-[11px] font-semibold uppercase tracking-[0.18em] text-[#78d7e8]">
              Decision layer
            </p>
            <h2 className="font-display mt-3 text-3xl font-bold text-[#f4f5fa] sm:text-4xl">
              Перестаньте гадать, какая модель лучше
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-[#a2a6b8]">
              Запустите один запрос в Prompt Arena и сравните ответы в одном контрольном контуре.
            </p>
          </div>
          <Link
            href="/arena"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#f4f5fa] px-6 py-3 text-sm font-extrabold text-[#08090f] transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#78d7e8]"
          >
            В Arena →
          </Link>
        </div>
      </section>

      <footer className="mt-12 border-t border-white/10 py-6 text-center text-xs text-[#71748a]">
        <p>
          Новая эпоха AI Platform &nbsp;·&nbsp;
          <a href="/privacy" className="inline-flex min-h-11 items-center transition hover:text-[#a2a6b8]">
            Политика конфиденциальности
          </a>
          &nbsp;·&nbsp;
          <a href="/terms" className="inline-flex min-h-11 items-center transition hover:text-[#a2a6b8]">
            Условия использования
          </a>
        </p>
      </footer>
    </main>
  );
}
