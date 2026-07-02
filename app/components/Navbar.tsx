"use client";

import Link from "next/link";
import { useGlobal } from "@/app/context/GlobalContext";

export default function Navbar() {
  const { session, logout } = useGlobal();

  return (
    <nav className="border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="font-semibold tracking-tight">
          💰 Bonos Corporativos
        </Link>
        <div className="flex items-center gap-4 text-sm">
          {session?.role === "admin" && (
            <Link href="/admin" className="hover:underline">Emisiones</Link>
          )}
          {session?.role === "investor" && (
            <>
              <Link href="/investor" className="hover:underline">Mi cartera</Link>
              <Link href="/investor/screener" className="hover:underline">Screener</Link>
              <Link href="/investor/alerts" className="hover:underline">Alertas</Link>
            </>
          )}
          {session ? (
            <>
              <span className="text-zinc-500">{session.email}</span>
              <button
                onClick={logout}
                className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Salir
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-md bg-blue-600 text-white px-3 py-1 hover:bg-blue-700"
            >
              Entrar
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
