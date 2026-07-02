import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb, timed } from "@/lib/db";
import { isErrorResponse, requireRole } from "@/lib/auth";
import type { Order } from "@/lib/types";

// Órdenes del inversor autenticado (solo las suyas, RF-09).
export async function GET() {
  const auth = await requireRole("investor");
  if (isErrorResponse(auth)) return auth;

  const db = await getDb();
  const orders = await timed("orders.byInvestor", () =>
    db
      .collection<Order>("orders")
      .aggregate([
        { $match: { investorId: new ObjectId(auth.userId) } },
        { $sort: { createdAt: -1 } },
        { $lookup: { from: "bonds", localField: "bondId", foreignField: "_id", as: "bond" } },
        { $unwind: "$bond" },
      ])
      .toArray()
  );
  return NextResponse.json(orders);
}
