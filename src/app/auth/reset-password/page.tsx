import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-8">
        <Link className="text-sm text-slate-300 transition hover:text-white" href="/login">
          ← Войти
        </Link>
        <h1 className="mt-6 text-3xl font-black text-white">Сброс пароля</h1>
        <p className="mt-2 text-sm text-slate-400">
          Введите email — мы отправим ссылку для сброса пароля.
        </p>
      </div>

      <section className="rounded-3xl border border-slate-500/30 bg-slate-900/90 p-6 shadow-2xl shadow-slate-950/50 backdrop-blur">
        <ResetPasswordForm />
      </section>
    </main>
  );
}
