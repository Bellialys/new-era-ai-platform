import Link from "next/link";
import { SignupForm } from "@/components/auth/signup-form";

export default function SignupPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-8">
        <Link className="text-sm text-slate-300 transition hover:text-white" href="/">
          На главную
        </Link>
        <h1 className="mt-6 text-3xl font-black text-white">Регистрация</h1>
      </div>

      <section className="rounded-3xl border border-slate-500/30 bg-slate-900/90 p-6 shadow-2xl shadow-slate-950/50 backdrop-blur">
        <SignupForm />
        <p className="mt-5 text-sm text-slate-400">
          Уже есть аккаунт?{" "}
          <Link className="font-semibold text-white transition hover:text-violet-100" href="/login">
            Войти
          </Link>
        </p>
      </section>
    </main>
  );
}
