import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb, timed } from "@/lib/db";
import { isErrorResponse, requireRole } from "@/lib/auth";
import { marketPriceCents, ytmBps } from "@/lib/finance";
import type { Bond, Issuer } from "@/lib/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole();
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: "id inválido" }, { status: 400 });

  const db = await getDb();
  const bond = await timed("bonds.findOne", () =>
    db.collection<Bond>("bonds").findOne({ _id: new ObjectId(id) })
  );
  if (!bond) return NextResponse.json({ error: "Bono no encontrado" }, { status: 404 });

  const issuer = await db.collection<Issuer>("issuers").findOne({ _id: bond.issuerId });
  const now = new Date();
  const price = issuer ? marketPriceCents({ ...bond, rating: issuer.rating, asOf: now }) : null;
  const ytm = price !== null ? ytmBps({ ...bond, priceCents: price, asOf: now }) : null;

  return NextResponse.json({ ...bond, issuer, marketPriceCents: price, ytmBps: ytm });
}
