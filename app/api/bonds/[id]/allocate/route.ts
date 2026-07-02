import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb, timed } from "@/lib/db";
import { isErrorResponse, requireRole } from "@/lib/auth";
import { allocateOrders } from "@/lib/allocation";
import { buildSchedule } from "@/lib/finance";
import type { Bond, Order, Payment, Position, ReferenceRate } from "@/lib/types";

// RF-02 (cierre) + RF-03: el admin fija el precio final, se adjudican las
// órdenes (prorrateo proporcional si la demanda supera la oferta) y se
// generan y PERSISTEN los flujos de pago de cada inversor.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole("admin");
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: "id inválido" }, { status: 400 });
  const bondId = new ObjectId(id);

  const { finalPriceCents } = await req.json().catch(() => ({}));
  if (!Number.isInteger(finalPriceCents) || finalPriceCents <= 0) {
    return NextResponse.json({ error: "finalPriceCents debe ser un entero positivo" }, { status: 400 });
  }

  const db = await getDb();
  const bond = await db.collection<Bond>("bonds").findOne({ _id: bondId });
  if (!bond) return NextResponse.json({ error: "Bono no encontrado" }, { status: 404 });
  if (bond.status !== "offering") {
    return NextResponse.json({ error: "El bono ya fue adjudicado" }, { status: 409 });
  }

  const orders = await db
    .collection<Order>("orders")
    .find({ bondId, status: "pending" })
    .toArray();

  const byId = new Map(orders.map((o) => [o._id!.toString(), o]));
  const result = allocateOrders(
    orders.map((o) => ({ id: o._id!.toString(), priceCents: o.priceCents, units: o.units })),
    finalPriceCents,
    bond.totalUnits
  );
  const allocations = result.allocations.map((a) => ({ order: byId.get(a.id)!, units: a.units }));

  // Cupón efectivo: fijo = couponBps; variable = referencia vigente + spread
  let effectiveCouponBps = bond.couponBps;
  if (bond.couponType === "variable") {
    const ref = await db.collection<ReferenceRate>("rates").findOne({ name: "EURIBOR-SIM" });
    effectiveCouponBps = (ref?.bps ?? 0) + bond.couponBps;
  }

  const positions: Position[] = [];
  const payments: Payment[] = [];
  const now = new Date();
  for (const { order, units } of allocations) {
    positions.push({
      bondId,
      investorId: order.investorId,
      units,
      costCents: units * finalPriceCents,
      createdAt: now,
    });
    for (const flow of buildSchedule({ ...bond, couponBps: effectiveCouponBps, units })) {
      payments.push({
        bondId,
        investorId: order.investorId,
        dueDate: flow.dueDate,
        type: flow.type,
        amountCents: flow.amountCents,
        status: "scheduled",
      });
    }
  }

  await timed("allocate.writes", async () => {
    if (positions.length > 0) {
      await db.collection<Position>("positions").insertMany(positions);
      await db.collection<Payment>("payments").insertMany(payments);
    }
    for (const { order, units } of allocations) {
      await db.collection<Order>("orders").updateOne(
        { _id: order._id },
        { $set: { status: "allocated", allocatedUnits: units } }
      );
    }
    if (result.rejectedIds.length > 0) {
      await db.collection<Order>("orders").updateMany(
        { _id: { $in: result.rejectedIds.map((id) => byId.get(id)!._id!) } },
        { $set: { status: "rejected" } }
      );
    }
    await db.collection<Bond>("bonds").updateOne(
      { _id: bondId },
      { $set: { status: "allocated", finalPriceCents, couponBps: effectiveCouponBps } }
    );
  });

  return NextResponse.json({
    ok: true,
    finalPriceCents,
    allocatedOrders: allocations.length,
    rejectedOrders: result.rejectedIds.length,
    unitsAllocated: result.unitsAllocated,
    paymentsScheduled: payments.length,
  });
}
