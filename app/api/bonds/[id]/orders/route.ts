import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb, timed } from "@/lib/db";
import { isErrorResponse, requireRole } from "@/lib/auth";
import type { Bond, Order } from "@/lib/types";

// RF-02: libro de órdenes. El admin ve la demanda agregada en tiempo real.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole("admin");
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: "id inválido" }, { status: 400 });
  const bondId = new ObjectId(id);

  const db = await getDb();
  const orders = await timed("orders.byBond", () =>
    db.collection<Order>("orders").find({ bondId }).sort({ priceCents: -1 }).toArray()
  );

  // Demanda agregada por nivel de precio (bookbuilding)
  const byPrice = new Map<number, number>();
  for (const o of orders.filter((o) => o.status === "pending")) {
    byPrice.set(o.priceCents, (byPrice.get(o.priceCents) ?? 0) + o.units);
  }
  const demand = [...byPrice.entries()]
    .map(([priceCents, units]) => ({ priceCents, units }))
    .sort((a, b) => b.priceCents - a.priceCents);

  const totalUnitsDemanded = orders
    .filter((o) => o.status === "pending")
    .reduce((sum, o) => sum + o.units, 0);

  return NextResponse.json({ orders, demand, totalUnitsDemanded });
}

// RF-05 (compra): el inversor coloca una orden durante la oferta.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole("investor");
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: "id inválido" }, { status: 400 });
  const bondId = new ObjectId(id);

  const { priceCents, units } = await req.json().catch(() => ({}));
  if (!Number.isInteger(priceCents) || priceCents <= 0 || !Number.isInteger(units) || units <= 0) {
    return NextResponse.json({ error: "priceCents y units deben ser enteros positivos" }, { status: 400 });
  }

  const db = await getDb();
  const bond = await db.collection<Bond>("bonds").findOne({ _id: bondId });
  if (!bond) return NextResponse.json({ error: "Bono no encontrado" }, { status: 404 });
  if (bond.status !== "offering") {
    return NextResponse.json({ error: "El periodo de oferta está cerrado" }, { status: 409 });
  }

  const order: Order = {
    bondId,
    investorId: new ObjectId(auth.userId),
    priceCents,
    units,
    status: "pending",
    createdAt: new Date(),
  };
  const { insertedId } = await timed("orders.insert", () =>
    db.collection<Order>("orders").insertOne(order)
  );
  return NextResponse.json({ ...order, _id: insertedId }, { status: 201 });
}
