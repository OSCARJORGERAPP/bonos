import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb, timed } from "@/lib/db";
import { isErrorResponse, requireRole } from "@/lib/auth";
import { buildRatingChangeAlerts } from "@/lib/alerts";
import { sendMail } from "@/lib/mail";
import type { Alert, Bond, Issuer, Position, Rating, User } from "@/lib/types";

const RATINGS: Rating[] = ["AAA", "AA", "A", "BBB", "BB", "B", "CCC"];

// RF-07: el cambio de rating dispara alertas (rating, precio y rebalanceo)
// para los inversores con posiciones en bonos del emisor, con email vía MailHog.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole("admin");
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: "id inválido" }, { status: 400 });
  const { rating } = await req.json().catch(() => ({}));
  if (!RATINGS.includes(rating)) {
    return NextResponse.json({ error: "rating inválido" }, { status: 400 });
  }

  const db = await getDb();
  const issuerId = new ObjectId(id);
  const issuer = await db.collection<Issuer>("issuers").findOne({ _id: issuerId });
  if (!issuer) return NextResponse.json({ error: "Emisor no encontrado" }, { status: 404 });
  if (issuer.rating === rating) return NextResponse.json({ ok: true, unchanged: true });

  const oldRating = issuer.rating;
  await timed("issuers.updateRating", () =>
    db.collection<Issuer>("issuers").updateOne({ _id: issuerId }, { $set: { rating } })
  );

  // Inversores afectados: con posiciones en bonos de este emisor
  const bonds = await db.collection<Bond>("bonds").find({ issuerId }).toArray();
  const positions = await timed("positions.byBonds", () =>
    db.collection<Position>("positions").find({ bondId: { $in: bonds.map((b) => b._id!) } }).toArray()
  );

  const now = new Date();
  const alerts = buildRatingChangeAlerts({
    issuer, oldRating, newRating: rating, bonds, positions, now,
  });

  if (alerts.length > 0) {
    await timed("alerts.insertMany", () => db.collection<Alert>("alerts").insertMany(alerts));

    // Email por inversor con el resumen de sus alertas
    const investorIds = [...new Set(alerts.map((a) => a.investorId.toString()))];
    const users = await db
      .collection<User>("users")
      .find({ _id: { $in: investorIds.map((s) => new ObjectId(s)) } })
      .toArray();
    await Promise.all(
      users.map((u) => {
        const own = alerts.filter((a) => a.investorId.equals(u._id!));
        return sendMail(
          u.email,
          `Alertas: cambio de rating de ${issuer.name}`,
          `<ul>${own.map((a) => `<li>${a.message}</li>`).join("")}</ul>`
        ).catch((err) => console.error("email alert failed", err));
      })
    );
    await db
      .collection<Alert>("alerts")
      .updateMany({ issuerId, createdAt: now }, { $set: { sent: true } });
  }

  return NextResponse.json({ ok: true, alertsCreated: alerts.length });
}
