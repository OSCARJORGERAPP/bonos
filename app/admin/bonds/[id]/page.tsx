"use client";

import { use, useCallback, useEffect, useState } from "react";
import { eur, fecha, pct } from "@/lib/format";

interface BondDetail {
  _id: string; name: string; status: string; couponBps: number; couponType: string;
  frequency: string; issueDate: string; maturity: string; totalUnits: number;
  finalPriceCents?: number;
  issuer: { name: string; rating: string; sector: string };
}
interface OrderRow {
  _id: string; priceCents: number; units: number; status: string; allocatedUnits?: number;
}
interface Book {
  orders: OrderRow[];
  demand: { priceCents: number; units: number }[];
  totalUnitsDemanded: number;
}
interface DocRow {
  _id: string; kind: string; filename: string; sizeBytes: number; uploadedAt: string;
}

export default function BondAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [bond, setBond] = useState<BondDetail | null>(null);
  const [book, setBook] = useState<Book | null>(null);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [finalPrice, setFinalPrice] = useState("");
  const [kind, setKind] = useState("fiscal");
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    const [b, o, d] = await Promise.all([
      fetch(`/api/bonds/${id}`),
      fetch(`/api/bonds/${id}/orders`),
      fetch(`/api/bonds/${id}/documents`),
    ]);
    return {
      bond: b.ok ? ((await b.json()) as BondDetail) : null,
      book: o.ok ? ((await o.json()) as Book) : null,
      docs: d.ok ? ((await d.json()) as DocRow[]) : null,
    };
  }, [id]);

  const apply = (d: { bond: BondDetail | null; book: Book | null; docs: DocRow[] | null }) => {
    if (d.bond) setBond(d.bond);
    if (d.book) setBook(d.book);
    if (d.docs) setDocs(d.docs);
  };

  const load = useCallback(() => fetchAll().then(apply), [fetchAll]);

  useEffect(() => {
    fetchAll().then(apply);
  }, [fetchAll]);

  async function allocate(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const res = await fetch(`/api/bonds/${id}/allocate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ finalPriceCents: Math.round(Number(finalPrice) * 100) }),
    });
    const body = await res.json();
    setMsg(
      res.ok
        ? `Adjudicado: ${body.allocatedOrders} órdenes, ${body.unitsAllocated} títulos, ${body.paymentsScheduled} pagos programados`
        : `Error: ${body.error}`
    );
    if (res.ok) load();
  }

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    fd.set("kind", kind);
    const res = await fetch(`/api/bonds/${id}/documents`, { method: "POST", body: fd });
    const body = await res.json();
    setMsg(res.ok ? `Documento subido: ${body.filename}` : `Error: ${body.error}`);
    if (res.ok) { setFile(null); load(); }
  }

  if (!bond) return <p className="text-zinc-500">Cargando…</p>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">{bond.name}</h1>
        <p className="text-sm text-zinc-500 mt-1">
          {bond.issuer.name} ({bond.issuer.rating}, {bond.issuer.sector}) · cupón {pct(bond.couponBps)}
          {bond.couponType === "variable" && " variable"} · vence {fecha(bond.maturity)} ·{" "}
          {bond.totalUnits.toLocaleString("es-ES")} títulos ·{" "}
          {bond.status === "offering" ? "En oferta" : `Adjudicado a ${eur(bond.finalPriceCents!)}`}
        </p>
      </div>

      {msg && <p className="text-sm rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-900 px-3 py-2">{msg}</p>}

      {book && (
        <section>
          <h2 className="font-medium mb-3">
            Libro de órdenes — demanda total: {book.totalUnitsDemanded.toLocaleString("es-ES")} títulos
            {book.totalUnitsDemanded > bond.totalUnits && " (sobredemanda → prorrateo)"}
          </h2>
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-900 text-left">
                  <tr>
                    <th className="px-4 py-2 font-medium">Precio</th>
                    <th className="px-4 py-2 font-medium">Demanda agregada</th>
                  </tr>
                </thead>
                <tbody>
                  {book.demand.map((d) => (
                    <tr key={d.priceCents} className="border-t border-zinc-100 dark:border-zinc-800">
                      <td className="px-4 py-2 tabular-nums">{eur(d.priceCents)}</td>
                      <td className="px-4 py-2 tabular-nums">{d.units.toLocaleString("es-ES")}</td>
                    </tr>
                  ))}
                  {book.demand.length === 0 && (
                    <tr><td colSpan={2} className="px-4 py-4 text-zinc-500">Sin órdenes pendientes.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {bond.status === "offering" ? (
              <form onSubmit={allocate} className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 space-y-3 self-start">
                <h3 className="font-medium">Cerrar oferta y adjudicar (RF-02/03)</h3>
                <p className="text-xs text-zinc-500">
                  Solo participan órdenes con precio ≥ precio final; si la demanda supera los títulos, se prorratea.
                  Al adjudicar se generan los flujos de pago de cada inversor.
                </p>
                <label className="block text-sm">Precio final por título (€)
                  <input value={finalPrice} onChange={(e) => setFinalPrice(e.target.value)} type="number" step="0.01" min="0.01" required className="mt-1 w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1.5" />
                </label>
                <button className="rounded-md bg-blue-600 text-white px-4 py-2 hover:bg-blue-700">Adjudicar</button>
              </form>
            ) : (
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 text-sm text-zinc-500 self-start">
                Oferta cerrada. Órdenes: {book.orders.filter((o) => o.status === "allocated").length} adjudicadas,{" "}
                {book.orders.filter((o) => o.status === "rejected").length} rechazadas.
              </div>
            )}
          </div>
        </section>
      )}

      <section>
        <h2 className="font-medium mb-3">Documentos (RF-04) — fiscales, uso de fondos, covenants, reportes</h2>
        <form onSubmit={upload} className="flex flex-wrap items-end gap-3 text-sm mb-4">
          <label className="flex flex-col gap-1">Tipo
            <select value={kind} onChange={(e) => setKind(e.target.value)} className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-transparent px-2 py-1.5">
              <option value="fiscal">Fiscal</option>
              <option value="uso-fondos">Uso de fondos</option>
              <option value="covenants">Covenants</option>
              <option value="reporte">Reporte</option>
            </select>
          </label>
          <input type="file" required onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
          <button className="rounded-md bg-blue-600 text-white px-4 py-1.5 hover:bg-blue-700">Subir</button>
        </form>
        <ul className="space-y-2 text-sm">
          {docs.map((d) => (
            <li key={d._id} className="flex justify-between rounded-lg border border-zinc-200 dark:border-zinc-800 px-4 py-2">
              <span>
                <span className="text-zinc-400 mr-2">[{d.kind}]</span>
                <a href={`/api/documents/${d._id}`} className="text-blue-600 hover:underline">{d.filename}</a>
              </span>
              <span className="text-zinc-400">{(d.sizeBytes / 1024).toFixed(1)} KB · {fecha(d.uploadedAt)}</span>
            </li>
          ))}
          {docs.length === 0 && <li className="text-zinc-500">Sin documentos.</li>}
        </ul>
      </section>
    </div>
  );
}
