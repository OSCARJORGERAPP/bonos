"use client";

import { useEffect, useState } from "react";
import { eur, fecha, pct } from "@/lib/format";

interface PortfolioRow {
  _id: string;
  bond: { name: string; couponBps: number; maturity: string };
  issuer: { name: string; rating: string };
  units: number;
  costCents: number;
  marketValueCents: number;
}

interface UpcomingPayment {
  _id: string;
  dueDate: string;
  type: "coupon" | "principal";
  amountCents: number;
  bond: { name: string };
}

interface Portfolio {
  positions: PortfolioRow[];
  upcomingPayments: UpcomingPayment[];
  totals: {
    totalCost: number;
    totalMarketValue: number;
    totalCollected: number;
    historicalReturnBps: number;
  };
}

export default function InvestorDashboard() {
  const [data, setData] = useState<Portfolio | null>(null);

  useEffect(() => {
    fetch("/api/portfolio").then(async (r) => r.ok && setData(await r.json()));
  }, []);

  if (!data) return <p className="text-zinc-500">Cargando cartera…</p>;
  const { totals } = data;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Mi cartera</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          ["Valor de mercado", eur(totals.totalMarketValue)],
          ["Coste de adquisición", eur(totals.totalCost)],
          ["Cobrado (cupones y principal)", eur(totals.totalCollected)],
          ["Rendimiento histórico", pct(totals.historicalReturnBps)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
            <p className="text-xs text-zinc-500">{label}</p>
            <p className="text-xl font-semibold mt-1">{value}</p>
          </div>
        ))}
      </div>

      <section>
        <h2 className="font-medium mb-3">Posiciones</h2>
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-900 text-left">
              <tr>
                {["Bono", "Emisor", "Rating", "Títulos", "Coste", "Valor de mercado", "Vencimiento"].map((h) => (
                  <th key={h} className="px-4 py-2 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.positions.map((p) => (
                <tr key={p._id} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="px-4 py-2">{p.bond.name}</td>
                  <td className="px-4 py-2">{p.issuer.name}</td>
                  <td className="px-4 py-2">{p.issuer.rating}</td>
                  <td className="px-4 py-2">{p.units}</td>
                  <td className="px-4 py-2">{eur(p.costCents)}</td>
                  <td className="px-4 py-2">{eur(p.marketValueCents)}</td>
                  <td className="px-4 py-2">{fecha(p.bond.maturity)}</td>
                </tr>
              ))}
              {data.positions.length === 0 && (
                <tr><td className="px-4 py-6 text-zinc-500" colSpan={7}>Sin posiciones. Explora el screener para comprar bonos.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="font-medium mb-3">Próximos cobros</h2>
        <ul className="space-y-2">
          {data.upcomingPayments.map((p) => (
            <li key={p._id} className="flex justify-between rounded-lg border border-zinc-200 dark:border-zinc-800 px-4 py-2 text-sm">
              <span>
                {p.type === "coupon" ? "Cupón" : "Principal"} · {p.bond.name}
              </span>
              <span className="tabular-nums">{fecha(p.dueDate)} — <strong>{eur(p.amountCents)}</strong></span>
            </li>
          ))}
          {data.upcomingPayments.length === 0 && <li className="text-zinc-500 text-sm">Sin cobros programados.</li>}
        </ul>
      </section>
    </div>
  );
}
