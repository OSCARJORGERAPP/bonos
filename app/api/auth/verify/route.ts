import { NextRequest, NextResponse } from "next/server";
import { getDb, timed } from "@/lib/db";
import { SESSION_COOKIE, signSessionToken, verifyMagicToken } from "@/lib/auth";
import type { User } from "@/lib/types";

// RF-08: canjear el magic link por una sesión y redirigir según rol.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const email = await verifyMagicToken(token);
  if (!email) {
    return NextResponse.redirect(new URL("/login?error=enlace-invalido", req.url));
  }

  const db = await getDb();
  const user = await timed("users.find", () =>
    db.collection<User>("users").findOne({ email })
  );
  if (!user) {
    return NextResponse.redirect(new URL("/login?error=usuario-no-encontrado", req.url));
  }

  const session = await signSessionToken({
    email: user.email,
    role: user.role,
    userId: user._id!.toString(),
  });

  const dest = user.role === "admin" ? "/admin" : "/investor";
  const res = NextResponse.redirect(new URL(dest, req.url));
  res.cookies.set(SESSION_COOKIE, session, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 8 * 3600,
  });
  return res;
}
