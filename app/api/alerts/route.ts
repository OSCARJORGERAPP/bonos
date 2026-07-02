import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb, timed } from "@/lib/db";
import { isErrorResponse, requireRole } from "@/lib/auth";
import type { Alert } from "@/lib/types";

// RF-07: el inversor consulta SUS alertas (RF-09).
export async function GET() {
  const auth = await requireRole("investor");
  if (isErrorResponse(auth)) return auth;

  const db = await getDb();
  const alerts = await timed("alerts.byInvestor", () =>
    db
      .collection<Alert>("alerts")
      .find({ investorId: new ObjectId(auth.userId) })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray()
  );
  return NextResponse.json(alerts);
}
