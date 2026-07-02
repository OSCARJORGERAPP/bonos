"use client";

import { useCallback, useEffect, useState } from "react";
import { eur, fecha, pct } from "@/lib/format";

interface ScreenerBond {
  _id: string;
  name: string;
  status: "offering" | "allocated" | "matured";
  couponType: "fixed" | "variable";
  couponBps: number;
  frequency: string;
  maturity: string;
  term: string;
  marketPriceCents: number;
  ytmBps: number;
  issuer: { name: string; rating: string; sector: string };
}

const RATINGS = ["", "AAA", "AA", "A", "BBB", "BB", "B", "CCC"];
const SECTORS = ["", "energia", "financiero", "industrial", "tecnologia", "consumo", "salud", "telecomunicaciones"];

export default function ScreenerPage() {
  const [bonds, setBonds] = useState<ScreenerBond[]>([]);
  const [rating, setRating] = useState("");
  const [sector, setSector] = useState("");
  const [minYtm, setMinYtm] = useState("");
  const [maturityBefore, setMaturityBefore] = useState("");
  const [buying, setBuying] = useState<ScreenerBond | null>(null);
  const [units, setUnits] = useState("10");
  const [price, setPrice] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const fetchBonds = useCallback(async (): Promise<ScreenerBond[] | null> => {
    const q = new URLSearchParams();
    if (rating) q.set("rating", rating);
    if (sector) q.set("sector", sector);
    if (minYtm) q.set("minYtmBps", String(Math.round(Number(minYtm) * 100)));
    if (maturityBefore) q.set("maturityBefore", maturityBefore);
    const res = await fetch(`/api/bonds?${q}`);
    return res.ok ? res.json() : null;
  }, [rating, sector, minYtm, maturityBefore]);

  useEffect(() => {
    fetchBonds().then((d) => d && setBonds(d));
  }, [fetchBonds]);

  async function buy(e: React.FormEvent) {
    e.preventDefault();
    if (!buying) return;
    setMsg(null);
    const res = await fetch(`/api/bonds/${buying._id}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        priceCents: Math.round(Number(price) * 100),
        units: Number(units),
      }),
    });
    const body = await res.json();
    if (res.ok) {
      setMsg(`Orden creada: ${units} títulos de ${buying.name}`);
      setBuying(null);
      fetchBonds().then((d) => d && setBonds(d));
    } else {
      setMsg(`Error: ${body.error}`);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Screener de bonos</h1>

      <div className="flex flex-wrap gap-3 items-end text-sm">
        <label className="flex flex-col gap-1">
          Rating
          <select value={rating} onChange={(e) => setRating(e.target.value)} className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1.5">
            {RATINGS.map((r) => <option key={r} value={r}>{r || "Todos"}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Sector
          <select value={sector} onChange={(e) => setSector(e.target.value)} className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1.5">
            {SECTORS.map((s) => <option key={s} value={s}>{s || "Todos"}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          YTM mínima (%)
          <input value={minYtm} onChange={(e) => setMinYtm(e.target.value)} type="number" step="0.1" className="w-28 rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1.5" />
        </label>
        <label className="flex flex-col gap-1">
          Vence antes de
          <input value={maturityBefore} onChange={(e) => setMaturityBefore(e.target.value)} type="date" className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1.5" />
        </label>
      </div>

      {msg && <p className="text-sm rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-900 px-3 py-2">{msg}</p>}

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-900 text-left">
            <tr>
              {["Bono", "Emisor", "Sector", "Rating", "Cupón", "Vencimiento", "Precio est.", "YTM", "Estado", ""].map((h, i) => (
                <th key={i} className="px-4 py-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bonds.map((b) => (
              <tr key={b._id} className="border-t border-zinc-100 dark:border-zinc-800">
                <td className="px-4 py-2">{b.name}</td>
                <td className="px-4 py-2">{b.issuer.name}</td>
                <td className="px-4 py-2">{b.issuer.sector}</td>
                <td className="px-4 py-2">{b.issuer.rating}</td>
                <td className="px-4 py-2">
                  {pct(b.couponBps)}{b.couponType === "variable" && " (var)"}
                </td>
                <td className="px-4 py-2">{fecha(b.maturity)}</td>
                <td className="px-4 py-2 tabular-nums">{eur(b.marketPriceCents)}</td>
                <td className="px-4 py-2 tabular-nums">{pct(b.ytmBps)}</td>
                <td className="px-4 py-2">{b.status === "offering" ? "En oferta" : b.status === "allocated" ? "Adjudicado" : "Vencido"}</td>
                <td className="px-4 py-2">
                  {b.status === "offering" && (
                    <button
                      onClick={() => {
                        setBuying(b);
                        setPrice((b.marketPriceCents / 100).toFixed(2));
                      }}
                      className="rounded-md bg-blue-600 text-white px-3 py-1 hover:bg-blue-700"
                    >
                      Comprar
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {bonds.length === 0 && (
              <tr><td colSpan={10} className="px-4 py-6 text-zinc-500">Ningún bono cumple los filtros.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {buying && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4">
          <form onSubmit={buy} className="bg-white dark:bg-zinc-900 rounded-xl p-6 w-full max-w-sm space-y-4">
            <h2 className="font-semibold">Orden de compra — {buying.name}</h2>
            <label className="block text-sm">
              Títulos
              <input value={units} onChange={(e) => setUnits(e.target.value)} type="number" min="1" required className="mt-1 w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1.5" />
            </label>
            <label className="block text-sm">
              Precio por título (€)
              <input value={price} onChange={(e) => setPrice(e.target.value)} type="number" step="0.01" min="0.01" required className="mt-1 w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1.5" />
            </label>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setBuying(null)} className="rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-1.5">Cancelar</button>
              <button className="rounded-md bg-blue-600 text-white px-3 py-1.5 hover:bg-blue-700">Enviar orden</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
