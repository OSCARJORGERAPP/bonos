import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { Role } from "./types";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "dev-secret-inseguro"
);

export const SESSION_COOKIE = "bonos_session";

export interface Session {
  email: string;
  role: Role;
  userId: string;
}

/** Token de un solo uso para el magic link (15 min). */
export async function signMagicToken(email: string): Promise<string> {
  return new SignJWT({ email, purpose: "magic" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("15m")
    .sign(SECRET);
}

export async function verifyMagicToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    if (payload.purpose !== "magic" || typeof payload.email !== "string") return null;
    return payload.email;
  } catch {
    return null;
  }
}

/** Sesión de 8h en cookie httpOnly. */
export async function signSessionToken(session: Session): Promise<string> {
  return new SignJWT({ ...session, purpose: "session" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("8h")
    .sign(SECRET);
}

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    if (payload.purpose !== "session") return null;
    return {
      email: payload.email as string,
      role: payload.role as Role,
      userId: payload.userId as string,
    };
  } catch {
    return null;
  }
}

/**
 * Comprobación de rol EN SERVIDOR (RF-09). Devuelve la sesión o una
 * NextResponse de error lista para retornar desde la route handler.
 */
export async function requireRole(
  role?: Role
): Promise<Session | NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }
  if (role && session.role !== role) {
    return NextResponse.json({ error: "Prohibido" }, { status: 403 });
  }
  return session;
}

export function isErrorResponse(
  value: Session | NextResponse
): value is NextResponse {
  return value instanceof NextResponse;
}
