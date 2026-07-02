import { NextRequest, NextResponse } from "next/server";
import { getDb, timed } from "@/lib/db";
import { signMagicToken } from "@/lib/auth";
import { sendMagicLink } from "@/lib/mail";
import type { User } from "@/lib/types";

// RF-08: solicitar magic link. Si el email no existe, se registra como inversor.
export async function POST(req: NextRequest) {
  const { email } = await req.json().catch(() => ({}));
  if (typeof email !== "string" || !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: "Email inválido" }, { status: 400 });
  }

  const db = await getDb();
  const normalized = email.trim().toLowerCase();
  await timed("users.upsert-login", () =>
    db.collection<User>("users").updateOne(
      { email: normalized },
      { $setOnInsert: { email: normalized, role: "investor", createdAt: new Date() } },
      { upsert: true }
    )
  );

  const token = await signMagicToken(normalized);
  const url = `${process.env.APP_URL ?? "http://localhost:3000"}/api/auth/verify?token=${encodeURIComponent(token)}`;
  await sendMagicLink(normalized, url);

  return NextResponse.json({ ok: true, message: "Enlace enviado (ver MailHog en dev)" });
}
