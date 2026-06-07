import Link from "next/link";
import { SignupForm } from "@/components/auth/signup-form";

export default function SignupPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-10">
      <div className="mb-8">
        <Link className="text-sm text-slate-300 transition hover:text-white" href="/">
          Back to home
        </Link>
        <h1 className="mt-6 text-3xl font-black text-white">Sign up</h1>
      </div>

      <section className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-violet-950/30 backdrop-blur">
        <SignupForm />
        <p className="mt-5 text-sm text-slate-400">
          Already have an account?{" "}
          <Link className="font-semibold text-white transition hover:text-violet-100" href="/login">
            Login
          </Link>
        </p>
      </section>
    </main>
  );
}
