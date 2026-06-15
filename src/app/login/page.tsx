import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-8">
        <Link className="text-sm text-slate-300 transition hover:text-white" href="/">
          Back to home
        </Link>
        <h1 className="mt-6 text-3xl font-black text-white">Login</h1>
      </div>

      <section className="rounded-3xl border border-slate-500/30 bg-slate-900/90 p-6 shadow-2xl shadow-slate-950/50 backdrop-blur">
        <LoginForm />
        <p className="mt-5 text-sm text-slate-400">
          No account?{" "}
          <Link className="font-semibold text-white transition hover:text-violet-100" href="/signup">
            Sign up
          </Link>
        </p>
      </section>
    </main>
  );
}
