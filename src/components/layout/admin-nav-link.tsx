"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function AdminNavLink() {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => {
        if (!r.ok) return null;
        return r.json() as Promise<{ profile?: { role?: string } }>;
      })
      .then((data) => {
        if (data?.profile?.role === "admin") setIsAdmin(true);
      })
      .catch(() => {});
  }, []);

  if (!isAdmin) return null;

  return (
    <Link
      href="/admin"
      className="rounded-full px-3 py-1.5 text-sm text-violet-400 transition hover:bg-white/[0.06] hover:text-violet-300"
    >
      Админ
    </Link>
  );
}
