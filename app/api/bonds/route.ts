import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb, timed } from "@/lib/db";
import { isErrorResponse, requireRole } from "@/lib/auth";
import { marketPriceCents, termFor, ytmBps } from "@/lib/finance";
import type { Bond, CouponType, Issuer, PaymentFrequency, Rating, Sector } from "@/lib/types";

const FREQUENCIES: PaymentFrequency[] = ["annual", "semiannual", "quarterly"];
const COUPON_TYPES: CouponType[] = ["fixed", "variable"];

// RF-05: screener con filtros por rating, YTM, vencimiento y sector.
// Devuelve cada bono con su emisor, precio de mercado derivado y YTM.
export async function GET(req: NextRequest) {
  const auth = await requireRole();
  if (isErrorResponse(auth)) return auth;

  const q = req.nextUrl.searchParams;
  const issuerMatch: Record<string, unknown> = {};
  if (q.get("rating")) issuerMatch["issuer.rating"] = q.get("rating");
  if (q.get("sector")) issuerMatch["issuer.sector"] = q.get("sector");

  const bondMatch: Record<string, unknown> = {};
  if (q.get("status")) bondMatch.status = q.get("status");
  if (q.get("term")) bondMatch.term = q.get("term");
  if (q.get("maturityBefore")) bondMatch.maturity = { $lte: new Date(q.get("maturityBefore")!) };

  const db = await getDb();
  const rows = await timed("bonds.screener", () =>
    db
      .collection<Bond>("bonds")
      .aggregate([
        { $match: bondMatch },
        { $lookup: { from: "issuers", localField: "issuerId", foreignField: "_id", as: "issuer" } },
        { $unwind: "$issuer" },
        { $match: issuerMatch },
        { $sort: { maturity: 1 } },
      ])
      .toArray()
  );

  const now = new Date();
  const minYtm = q.get("minYtmBps") ? Number(q.get("minYtmBps")) : null;
  const enriched = rows
    .map((row) => {
      const bond = row as Bond & { issuer: Issuer };
      const price = marketPriceCents({ ...bond, rating: bond.issuer.rating, asOf: now });
      const ytm = ytmBps({ ...bond, priceCents: price, asOf: now });
      return { ...bond, marketPriceCents: price, ytmBps: ytm };
    })
    .filter((b) => (minYtm === null ? true : b.ytmBps >= minYtm));

  return NextResponse.json(enriched);
}

// RF-01: estructuración de la emisión (solo admin).
export async function POST(req: NextRequest) {
  const auth = await requireRole("admin");
  if (isErrorResponse(auth)) return auth;

  const body = await req.json().catch(() => ({}));
  const { name, issuerId, faceValueCents, couponType, couponBps, frequency, issueDate, maturity, totalUnits } = body;

  if (
    typeof name !== "string" || !name.trim() ||
    !ObjectId.isValid(issuerId) ||
    !Number.isInteger(faceValueCents) || faceValueCents <= 0 ||
    !COUPON_TYPES.includes(couponType) ||
    !Number.isInteger(couponBps) || couponBps < 0 ||
    !FREQUENCIES.includes(frequency) ||
    !Number.isInteger(totalUnits) || totalUnits <= 0
  ) {
    return NextResponse.json({ error: "Campos de la emisión inválidos" }, { status: 400 });
  }
  const issue = new Date(issueDate);
  const mat = new Date(maturity);
  if (isNaN(issue.getTime()) || isNaN(mat.getTime()) || mat <= issue) {
    return NextResponse.json({ error: "Fechas inválidas (vencimiento debe ser posterior a emisión)" }, { status: 400 });
  }

  const db = await getDb();
  const issuer = await db.collection<Issuer>("issuers").findOne({ _id: new ObjectId(issuerId) });
  if (!issuer) return NextResponse.json({ error: "Emisor no encontrado" }, { status: 404 });

  const bond: Bond = {
    name: name.trim(),
    issuerId: issuer._id!,
    faceValueCents,
    couponType,
    couponBps,
    frequency,
    issueDate: issue,
    maturity: mat,
    term: termFor(issue, mat),
    status: "offering",
    totalUnits,
    createdAt: new Date(),
  };
  const { insertedId } = await timed("bonds.insert", () =>
    db.collection<Bond>("bonds").insertOne(bond)
  );
  return NextResponse.json({ ...bond, _id: insertedId }, { status: 201 });
}

export type ScreenerFilters = {
  rating?: Rating;
  sector?: Sector;
  minYtmBps?: number;
  maturityBefore?: string;
};
