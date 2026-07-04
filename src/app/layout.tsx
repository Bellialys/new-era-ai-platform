import type { Metadata } from "next";
import { JetBrains_Mono, Manrope, Unbounded } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const displayFont = Unbounded({
  subsets: ["cyrillic", "latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["cyrillic", "latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-manrope",
  display: "swap",
});

const monoFont = JetBrains_Mono({
  subsets: ["cyrillic", "latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Новая эпоха - AI Platform",
  description: "AI-платформа для сравнения, оценки и совместной работы нескольких AI-моделей.",
  openGraph: {
    title: "Новая эпоха - AI-платформа",
    description: "Введите задачу, выберите несколько AI-моделей, получите ответы рядом и выберите лучший.",
    type: "website",
    siteName: "Новая эпоха",
    locale: "ru_RU",
  },
  twitter: {
    card: "summary",
    title: "Новая эпоха - AI-платформа",
    description: "Сравни несколько AI-моделей на одной задаче.",
  },
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ru">
      <body className={`${displayFont.variable} ${manrope.variable} ${monoFont.variable}`}>
        {children}
      </body>
    </html>
  );
}
