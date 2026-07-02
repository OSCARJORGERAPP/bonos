"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { eur, fecha, pct } from "@/lib/format";

interface Issuer { _id: string; name: string; sector: string; rating: string }
interface BondRow {
  _id: string; name: string; status: string; couponType: string; couponBps: number;
  frequency: string; maturity: string; term: string; totalUnits: number;
  finalPriceCents?: number; issuer: Issuer;
}

const RATINGS = ["AAA", "AA", "A", "BBB", "BB", "B", "CCC"];
const SECTORS = ["energia", "financiero", "industrial", "tecnologia", "consumo", "salud", "telecomunicaciones"];

export default function AdminPage() {
  const [bonds, setBonds] = useState<BondRow[]>([]);
  const [issuers, setIssuers] = useState<Issuer[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  // formulario nueva emisión (RF-01)
  const [f, setF] = useState({
    name: "", issuerId: "", faceValueEur: "1000", couponType: "fixed",
    couponPct: "4.0", frequency: "annual", issueDate: "", maturity: "", totalUnits: "10000",
  });
  // formulario nuevo emisor
  const [ni, setNi] = useState({ name: "", sector: "industrial", rating: "BBB" });

  const fetchAll = useCallback(async () => {
    const [b, i] = await Promise.all([fetch("/api/bonds"), fetch("/api/issuers")]);
    return {
      bonds: b.ok ? ((await b.json()) as BondRow[]) : null,
      issuers: i.ok ? ((await i.json()) as Issuer[]) : null,
    };
  }, []);

  const apply = (d: { bonds: BondRow[] | null; issuers: Issuer[] | null }) => {
    if (d.bonds) setBonds(d.bonds);
    if (d.issuers) setIssuers(d.issuers);
  };

  const load = useCallback(() => fetchAll().then(apply), [fetchAll]);

  useEffect(() => {
    fetchAll().then(apply);
  }, [fetchAll]);

  async function createBond(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const res = await fetch("/api/bonds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: f.name,
        issuerId: f.issuerId,
        faceValueCents: Math.round(Number(f.faceValueEur) * 100),
        couponType: f.couponType,
        couponBps: Math.round(Number(f.couponPct) * 100),
        frequency: f.frequency,
        issueDate: f.issueDate,
        maturity: f.maturity,
        totalUnits: Number(f.totalUnits),
      }),
    });
    const body = await res.json();
    setMsg(res.ok ? `Emisión creada: ${body.name} (plazo ${body.term})` : `Error: ${body.error}`);
    if (res.ok) load();
  }

  async function createIssuer(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/issuers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ni),
    });
    if (res.ok) { setNi({ name: "", sector: "industrial", rating: "BBB" }); load(); }
  }

  async function changeRating(issuerId: string, rating: string) {
    const res = await fetch(`/api/issuers/${issuerId}/rating`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating }),
    });
    const body = await res.json();
    setMsg(res.ok ? `Rating actualizado (${body.alertsCreated ?? 0} alertas generadas)` : `Error: ${body.error}`);
    if (res.ok) load();
  }

  const inputCls = "rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1.5";

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Emisiones</h1>
      {msg && <p className="text-sm rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-900 px-3 py-2">{msg}</p>}

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 dark:bg-zinc-900 text-left">
            <tr>
              {["Bono", "Emisor", "Cupón", "Vencimiento", "Plazo", "Títulos", "Precio final", "Estado", ""].map((h, i) => (
                <th key={i} className="px-4 py-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bonds.map((b) => (
              <tr key={b._id} className="border-t border-zinc-100 dark:border-zinc-800">
                <td className="px-4 py-2">{b.name}</td>
                <td className="px-4 py-2">{b.issuer.name} ({b.issuer.rating})</td>
                <td className="px-4 py-2">{pct(b.couponBps)}{b.couponType === "variable" && " (var)"}</td>
                <td className="px-4 py-2">{fecha(b.maturity)}</td>
                <td className="px-4 py-2">{b.term}</td>
                <td className="px-4 py-2">{b.totalUnits.toLocaleString("es-ES")}</td>
                <td className="px-4 py-2">{b.finalPriceCents ? eur(b.finalPriceCents) : "—"}</td>
                <td className="px-4 py-2">{b.status === "offering" ? "En oferta" : "Adjudicado"}</td>
                <td className="px-4 py-2">
                  <Link href={`/admin/bonds/${b._id}`} className="text-blue-600 hover:underline">
                    {b.status === "offering" ? "Libro de órdenes" : "Detalle"}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
          <h2 className="font-medium mb-4">Nueva emisión (RF-01)</h2>
          <form onSubmit={createBond} className="grid grid-cols-2 gap-3 text-sm">
            <label className="col-span-2 flex flex-col gap-1">Nombre
              <input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={inputCls} />
            </label>
            <label className="flex flex-col gap-1">Emisor
              <select required value={f.issuerId} onChange={(e) => setF({ ...f, issuerId: e.target.value })} className={inputCls}>
                <option value="">— elegir —</option>
                {issuers.map((i) => <option key={i._id} value={i._id}>{i.name}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">Nominal (€)
              <input type="number" min="1" required value={f.faceValueEur} onChange={(e) => setF({ ...f, faceValueEur: e.target.value })} className={inputCls} />
            </label>
            <label className="flex flex-col gap-1">Tipo de cupón
              <select value={f.couponType} onChange={(e) => setF({ ...f, couponType: e.target.value })} className={inputCls}>
                <option value="fixed">Fijo</option>
                <option value="variable">Variable (spread)</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">{f.couponType === "fixed" ? "Cupón (%)" : "Spread (%)"}
              <input type="number" step="0.01" min="0" required value={f.couponPct} onChange={(e) => setF({ ...f, couponPct: e.target.value })} className={inputCls} />
            </label>
            <label className="flex flex-col gap-1">Frecuencia
              <select value={f.frequency} onChange={(e) => setF({ ...f, frequency: e.target.value })} className={inputCls}>
                <option value="annual">Anual</option>
                <option value="semiannual">Semestral</option>
                <option value="quarterly">Trimestral</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">Títulos
              <input type="number" min="1" required value={f.totalUnits} onChange={(e) => setF({ ...f, totalUnits: e.target.value })} className={inputCls} />
            </label>
            <label className="flex flex-col gap-1">Emisión
              <input type="date" required value={f.issueDate} onChange={(e) => setF({ ...f, issueDate: e.target.value })} className={inputCls} />
            </label>
            <label className="flex flex-col gap-1">Vencimiento
              <input type="date" required value={f.maturity} onChange={(e) => setF({ ...f, maturity: e.target.value })} className={inputCls} />
            </label>
            <button className="col-span-2 rounded-md bg-blue-600 text-white py-2 hover:bg-blue-700">Crear emisión</button>
          </form>
        </section>

        <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-6">
          <div>
            <h2 className="font-medium mb-4">Nuevo emisor</h2>
            <form onSubmit={createIssuer} className="flex flex-wrap gap-3 text-sm items-end">
              <label className="flex flex-col gap-1">Nombre
                <input required value={ni.name} onChange={(e) => setNi({ ...ni, name: e.target.value })} className={inputCls} />
              </label>
              <label className="flex flex-col gap-1">Sector
                <select value={ni.sector} onChange={(e) => setNi({ ...ni, sector: e.target.value })} className={inputCls}>
                  {SECTORS.map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1">Rating
                <select value={ni.rating} onChange={(e) => setNi({ ...ni, rating: e.target.value })} className={inputCls}>
                  {RATINGS.map((r) => <option key={r}>{r}</option>)}
                </select>
              </label>
              <button className="rounded-md bg-blue-600 text-white px-4 py-1.5 hover:bg-blue-700">Crear</button>
            </form>
          </div>

          <div>
            <h2 className="font-medium mb-3">Ratings de emisores (dispara alertas, RF-07)</h2>
            <ul className="space-y-2 text-sm">
              {issuers.map((i) => (
                <li key={i._id} className="flex items-center justify-between gap-3">
                  <span>{i.name} <span className="text-zinc-400">({i.sector})</span></span>
                  <select
                    value={i.rating}
                    onChange={(e) => changeRating(i._id, e.target.value)}
                    className={inputCls}
                  >
                    {RATINGS.map((r) => <option key={r}>{r}</option>)}
                  </select>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
