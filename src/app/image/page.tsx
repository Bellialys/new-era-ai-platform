import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/layout/site-header";
import { ImageArena } from "@/components/arena/image-arena";

export const metadata: Metadata = {
  title: "Image Arena — Новая эпоха",
  description: "Сравни изображения от нескольких AI-моделей по одному запросу",
};

export default function ImagePage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <SiteHeader>
        <span className="hidden text-sm text-slate-500 sm:inline">/ Image Arena</span>
      </SiteHeader>
      <div className="mb-10 mt-6">
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-violet-500/20 px-3 py-1 text-xs font-bold text-violet-200">
            Image Arena
          </span>
          <span className="text-xs text-slate-500">Alpha · v2.0</span>
        </div>
        <h1 className="mt-4 text-3xl font-black text-white sm:text-4xl">
          Сравни, кто рисует лучше
        </h1>
        <p className="mt-3 text-base leading-7 text-slate-400">
          Задай описание изображения, выбери несколько AI-моделей — и получи
          изображения одновременно, чтобы выбрать лучшее.
        </p>
        <div className="mt-3 flex gap-4 text-sm text-slate-400">
          <Link className="transition hover:text-white" href="/">На главную</Link>
          <Link className="transition hover:text-white" href="/arena">Prompt Arena</Link>
          <Link className="transition hover:text-white" href="/code">Code Arena</Link>
        </div>
      </div>

      <ImageArena />

      <footer className="mt-12 border-t border-white/5 pt-6 text-center text-xs text-slate-600">
        <p>
          Новая эпоха AI Platform &nbsp;·&nbsp;
          <a href="/privacy" className="transition hover:text-slate-400">Политика конфиденциальности</a>
          &nbsp;·&nbsp;
          <a href="/terms" className="transition hover:text-slate-400">Условия использования</a>
        </p>
      </footer>
    </main>
  );
}
