import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Новая эпоха - AI Platform",
  description: "AI-платформа для сравнения, оценки и совместной работы нескольких AI-моделей.",
  openGraph: {
    title: "Новая эпоха — AI-платформа",
    description: "Введите задачу, выберите несколько AI-моделей, получите ответы рядом и выберите лучший.",
    type: "website",
    siteName: "Новая эпоха",
    locale: "ru_RU",
  },
  twitter: {
    card: "summary",
    title: "Новая эпоха — AI-платформа",
    description: "Сравни несколько AI-моделей на одной задаче.",
  },
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
