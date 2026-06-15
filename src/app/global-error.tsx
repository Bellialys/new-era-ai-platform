"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error boundary:", error);
  }, [error]);

  return (
    <html lang="ru">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "4rem 1.5rem",
          textAlign: "center",
          color: "#f8fafc",
          background: "linear-gradient(135deg, #020617 0%, #0f172a 52%, #111827 100%)",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        <h1 style={{ fontSize: "1.75rem", fontWeight: 800 }}>Критическая ошибка</h1>
        <p style={{ maxWidth: "32rem", color: "#94a3b8", lineHeight: 1.6 }}>
          Приложение не смогло загрузиться. Попробуйте обновить страницу.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            minHeight: "2.75rem",
            padding: "0.75rem 1.5rem",
            borderRadius: "9999px",
            border: "1px solid rgba(196, 181, 253, 0.6)",
            background: "#7c3aed",
            color: "#ffffff",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          Обновить
        </button>
      </body>
    </html>
  );
}
