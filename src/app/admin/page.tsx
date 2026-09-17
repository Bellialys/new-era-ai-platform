import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/server/supabase";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Дашборд — Администрация",
};

type StatCardProps = {
  label: string;
  value: number;
  description: string;
  accent: string;
};

type ActionCardProps = {
  href: string;
  title: string;
  description: string;
};

function StatCard({ label, value, description, accent }: StatCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.055] px-6 py-5 shadow-2xl shadow-black/20 backdrop-blur transition hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.075]">
      <div className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${accent}`} />
      <p className="text-4xl font-black tabular-nums tracking-tight text-white">
        {value.toLocaleString("ru-RU")}
      </p>
      <p className="mt-1.5 text-sm font-medium text-slate-300">{label}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{description}</p>
    </div>
  );
}

function ActionCard({ href, title, description }: ActionCardProps) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition hover:-translate-y-0.5 hover:border-violet-400/40 hover:bg-violet-500/10"
    >
      <p className="text-sm font-bold text-white">{title}</p>
      <p className="mt-2 text-xs leading-5 text-slate-500">{description}</p>
    </Link>
  );
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span
      className={`h-2.5 w-2.5 rounded-full ${ok ? "bg-emerald-400 shadow-emerald-400/40" : "bg-red-400 shadow-red-400/40"} shadow-lg`}
      aria-hidden="true"
    />
  );
}

export default async function AdminDashboardPage() {
  let totalUsers = 0;
  let totalTasks = 0;
  let totalVotes = 0;
  let totalModels = 0;
  let activeModels = 0;

  const supabase = getSupabaseServerClient();
  if (supabase) {
    const [usersRes, tasksRes, votesRes, modelsRes, activeModelsRes] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("tasks").select("*", { count: "exact", head: true }),
      supabase.from("votes").select("*", { count: "exact", head: true }),
      supabase.from("models").select("*", { count: "exact", head: true }),
      supabase.from("models").select("*", { count: "exact", head: true }).eq("is_active", true),
    ]);

    totalUsers = usersRes.count ?? 0;
    totalTasks = tasksRes.count ?? 0;
    totalVotes = votesRes.count ?? 0;
    totalModels = modelsRes.count ?? 0;
    activeModels = activeModelsRes.count ?? 0;
  }

  const inactiveModels = Math.max(totalModels - activeModels, 0);

  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,0.22),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.95),rgba(2,6,23,0.96))] px-7 py-7 shadow-2xl shadow-black/30">
        <div className="absolute right-8 top-8 h-24 w-24 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-violet-300">
              New Era Admin Control
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">
              Дашборд платформы
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
              Быстрый центр контроля пользователей, задач, голосов и каталога AI-моделей. MVP-фокус: видеть состояние системы без опасных destructive-действий.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:border-violet-300/40 hover:bg-violet-500/20"
          >
            Открыть сайт
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Пользователи"
          value={totalUsers}
          description="Профили Supabase, доступные admin layer."
          accent="from-violet-400/0 via-violet-400/80 to-violet-400/0"
        />
        <StatCard
          label="Задачи"
          value={totalTasks}
          description="Сохранённые prompt/code/team задачи платформы."
          accent="from-cyan-400/0 via-cyan-400/80 to-cyan-400/0"
        />
        <StatCard
          label="Голоса"
          value={totalVotes}
          description="Winner/like/dislike сигналы качества ответов."
          accent="from-emerald-400/0 via-emerald-400/80 to-emerald-400/0"
        />
        <StatCard
          label="Активные модели"
          value={activeModels}
          description={`${inactiveModels.toLocaleString("ru-RU")} моделей сейчас выключено.`}
          accent="from-fuchsia-400/0 via-fuchsia-400/80 to-fuchsia-400/0"
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-white">System status</h2>
              <p className="mt-1 text-sm text-slate-500">Минимальная проверка окружения админки.</p>
            </div>
            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
              MVP online
            </span>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
              <div className="flex items-center gap-3">
                <StatusDot ok={Boolean(supabase)} />
                <p className="text-sm font-semibold text-white">Supabase client</p>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                {supabase ? "Серверный клиент сконфигурирован." : "База не сконфигурирована для server runtime."}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
              <div className="flex items-center gap-3">
                <StatusDot ok={totalModels > 0 || activeModels > 0} />
                <p className="text-sm font-semibold text-white">Models catalog</p>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                {totalModels.toLocaleString("ru-RU")} моделей в каталоге, {activeModels.toLocaleString("ru-RU")} активны.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <h2 className="text-lg font-black text-white">Quick actions</h2>
          <p className="mt-1 text-sm text-slate-500">Быстрые переходы к рабочим разделам.</p>
          <div className="mt-5 grid gap-3">
            <ActionCard href="/admin/models" title="Управлять моделями" description="Включить/выключить модель и изменить уровень доступа." />
            <ActionCard href="/admin/users" title="Проверить пользователей" description="Просмотреть роли, тарифы и базовую активность аккаунтов." />
            <ActionCard href="/admin/audit" title="Открыть аудит" description="Посмотреть последние изменения и действия администраторов." />
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
        <h2 className="text-lg font-black text-white">Следующий уровень админки</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
            <p className="text-sm font-bold text-white">1. Live metrics</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">Добавить графики по дням, ошибкам и активности режимов.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
            <p className="text-sm font-bold text-white">2. Safe actions</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">Все опасные изменения делать только через confirm + audit event.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
            <p className="text-sm font-bold text-white">3. Health checks</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">Вынести OpenRouter, Vercel и Supabase проверки в отдельный admin status блок.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
