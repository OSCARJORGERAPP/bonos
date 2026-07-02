"use client";

import { useEffect, useState } from "react";
import { fecha } from "@/lib/format";

interface AlertRow {
  _id: string;
  type: "rating" | "price" | "rebalance";
  message: string;
  createdAt: string;
}

const LABEL: Record<AlertRow["type"], string> = {
  rating: "Rating",
  price: "Precio",
  rebalance: "Rebalanceo",
};

const COLOR: Record<AlertRow["type"], string> = {
  rating: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  price: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  rebalance: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertRow[] | null>(null);

  useEffect(() => {
    fetch("/api/alerts").then(async (r) => r.ok && setAlerts(await r.json()));
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Alertas</h1>
      {!alerts ? (
        <p className="text-zinc-500">Cargando…</p>
      ) : alerts.length === 0 ? (
        <p className="text-zinc-500">No tienes alertas.</p>
      ) : (
        <ul className="space-y-2">
          {alerts.map((a) => (
            <li key={a._id} className="rounded-lg border border-zinc-200 dark:border-zinc-800 px-4 py-3 text-sm flex items-start gap-3">
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${COLOR[a.type]}`}>
                {LABEL[a.type]}
              </span>
              <span className="flex-1">{a.message}</span>
              <span className="text-zinc-400 text-xs whitespace-nowrap">{fecha(a.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
