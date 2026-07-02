import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb, timed } from "@/lib/db";
import { isErrorResponse, requireRole } from "@/lib/auth";
import { marketPriceCents } from "@/lib/finance";
import type { Bond, Issuer, Payment, Position } from "@/lib/types";

// RF-06: tablero de posición del inversor — valor de mercado de la cartera,
// próximos cupones a cobrar y rendimiento histórico. Solo SUS posiciones (RF-09).
export async function GET() {
  const auth = await requireRole("investor");
  if (isErrorResponse(auth)) return auth;
  const investorId = new ObjectId(auth.userId);

  const db = await getDb();
  const positions = await timed("positions.byInvestor", () =>
    db
      .collection<Position>("positions")
      .aggregate([
        { $match: { investorId } },
        { $lookup: { from: "bonds", localField: "bondId", foreignField: "_id", as: "bond" } },
        { $unwind: "$bond" },
        { $lookup: { from: "issuers", localField: "bond.issuerId", foreignField: "_id", as: "issuer" } },
        { $unwind: "$issuer" },
      ])
      .toArray()
  );

  const now = new Date();
  const rows = positions.map((p) => {
    const pos = p as Position & { bond: Bond; issuer: Issuer };
    const unitPrice = marketPriceCents({ ...pos.bond, rating: pos.issuer.rating, asOf: now });
    return {
      _id: pos._id,
      bond: pos.bond,
      issuer: pos.issuer,
      units: pos.units,
      costCents: pos.costCents,
      marketValueCents: unitPrice * pos.units,
    };
  });

  const upcoming = await timed("payments.upcoming", () =>
    db
      .collection<Payment>("payments")
      .aggregate([
        { $match: { investorId, status: "scheduled", dueDate: { $gte: now } } },
        { $sort: { dueDate: 1 } },
        { $limit: 10 },
        { $lookup: { from: "bonds", localField: "bondId", foreignField: "_id", as: "bond" } },
        { $unwind: "$bond" },
        { $project: { dueDate: 1, type: 1, amountCents: 1, "bond.name": 1 } },
      ])
      .toArray()
  );

  // Rendimiento histórico: cobros ya vencidos/pagados sobre el coste total
  const collected = await timed("payments.collected", () =>
    db
      .collection<Payment>("payments")
      .aggregate([
        {
          $match: {
            investorId,
            $or: [{ status: "paid" }, { dueDate: { $lt: now } }],
          },
        },
        { $group: { _id: null, total: { $sum: "$amountCents" } } },
      ])
      .toArray()
  );

  const totalCost = rows.reduce((s, r) => s + r.costCents, 0);
  const totalMarketValue = rows.reduce((s, r) => s + r.marketValueCents, 0);
  const totalCollected = (collected[0]?.total as number) ?? 0;
  const historicalReturnBps =
    totalCost > 0
      ? Math.round(((totalMarketValue + totalCollected - totalCost) / totalCost) * 10_000)
      : 0;

  return NextResponse.json({
    positions: rows,
    upcomingPayments: upcoming,
    totals: { totalCost, totalMarketValue, totalCollected, historicalReturnBps },
  });
}
