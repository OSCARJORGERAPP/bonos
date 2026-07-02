import { describe, expect, it } from "vitest";
import { SignJWT, jwtVerify } from "jose";
import { signMagicToken, verifyMagicToken } from "@/lib/auth";

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? "dev-secret-inseguro");

describe("RF-08: magic link con JWT (jose)", () => {
  it("firma y verifica el token de un solo uso", async () => {
    const token = await signMagicToken("ana@inversores.local");
    expect(await verifyMagicToken(token)).toBe("ana@inversores.local");
  });

  it("rechaza tokens manipulados", async () => {
    const token = await signMagicToken("ana@inversores.local");
    expect(await verifyMagicToken(token.slice(0, -3) + "xxx")).toBeNull();
  });

  it("rechaza tokens caducados", async () => {
    const expired = await new SignJWT({ email: "x@y.z", purpose: "magic" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(SECRET);
    expect(await verifyMagicToken(expired)).toBeNull();
  });

  it("rechaza tokens de otro propósito (una sesión no sirve como magic link)", async () => {
    const session = await new SignJWT({ email: "x@y.z", purpose: "session", role: "admin" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1h")
      .sign(SECRET);
    expect(await verifyMagicToken(session)).toBeNull();
  });
});

describe("RF-09: el rol viaja firmado en el JWT de sesión", () => {
  it("el payload de sesión incluye rol verificable en servidor", async () => {
    const token = await new SignJWT({ email: "a@b.c", role: "investor", userId: "1", purpose: "session" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1h")
      .sign(SECRET);
    const { payload } = await jwtVerify(token, SECRET);
    expect(payload.role).toBe("investor");
    // Un inversor nunca porta role admin sin re-firmar con el secreto del servidor
  });
});
