import { NextRequest, NextResponse } from "next/server";
import { getDb, timed } from "@/lib/db";
import { isErrorResponse, requireRole } from "@/lib/auth";
import type { Issuer, Rating, Sector } from "@/lib/types";

const RATINGS: Rating[] = ["AAA", "AA", "A", "BBB", "BB", "B", "CCC"];
const SECTORS: Sector[] = ["energia", "financiero", "industrial", "tecnologia", "consumo", "salud", "telecomunicaciones"];

export async function GET() {
  const auth = await requireRole();
  if (isErrorResponse(auth)) return auth;
  const db = await getDb();
  const issuers = await timed("issuers.find", () =>
    db.collection<Issuer>("issuers").find().sort({ name: 1 }).toArray()
  );
  return NextResponse.json(issuers);
}

export async function POST(req: NextRequest) {
  const auth = await requireRole("admin");
  if (isErrorResponse(auth)) return auth;

  const body = await req.json().catch(() => ({}));
  const { name, sector, rating } = body;
  if (typeof name !== "string" || !name.trim() || !SECTORS.includes(sector) || !RATINGS.includes(rating)) {
    return NextResponse.json({ error: "name, sector o rating inválidos" }, { status: 400 });
  }

  const db = await getDb();
  const doc: Issuer = { name: name.trim(), sector, rating };
  const { insertedId } = await timed("issuers.insert", () =>
    db.collection<Issuer>("issuers").insertOne(doc)
  );
  return NextResponse.json({ ...doc, _id: insertedId }, { status: 201 });
}
