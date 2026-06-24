import { getSupabaseServerClient } from "@/lib/server/supabase";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Дашборд — Администрация",
};

type StatCardProps = {
  label: string;
  value: number;
};

function StatCard({ label, value }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-6 py-5 backdrop-blur">
      <p className="text-4xl font-black tabular-nums text-white">{value.toLocaleString("ru-RU")}</p>
      <p className="mt-1.5 text-sm text-slate-400">{label}</p>
    </div>
  );
}

export default async function AdminDashboardPage() {
  let totalUsers = 0;
  let totalTasks = 0;
  let totalVotes = 0;
  let activeModels = 0;

  const supabase = getSupabaseServerClient();
  if (supabase) {
    const [usersRes, tasksRes, votesRes, modelsRes] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("tasks").select("*", { count: "exact", head: true }),
      supabase.from("votes").select("*", { count: "exact", head: true }),
      supabase.from("models").select("*", { count: "exact", head: true }).eq("is_active", true),
    ]);
    totalUsers = usersRes.count ?? 0;
    totalTasks = tasksRes.count ?? 0;
    totalVotes = votesRes.count ?? 0;
    activeModels = modelsRes.count ?? 0;
  }

  return (
    <div>
      <h1 className="text-3xl font-black text-white">Дашборд</h1>
      <p className="mt-1 text-sm text-slate-400">Обзор платформы</p>

      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Пользователи" value={totalUsers} />
        <StatCard label="Задачи" value={totalTasks} />
        <StatCard label="Голоса" value={totalVotes} />
        <StatCard label="Активных моделей" value={activeModels} />
      </div>
    </div>
  );
}
