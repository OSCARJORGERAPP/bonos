import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "dev-secret-inseguro"
);

// Next 16: proxy.ts (antes middleware.ts). Protege las zonas /admin e
// /investor redirigiendo a /login; la comprobación de rol fina la hacen
// además las API routes en servidor (RF-09).
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const needsAuth = pathname.startsWith("/admin") || pathname.startsWith("/investor");
  if (!needsAuth) return NextResponse.next();

  const token = req.cookies.get("bonos_session")?.value;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, SECRET);
      const role = payload.role as string;
      if (pathname.startsWith("/admin") && role !== "admin") {
        return NextResponse.redirect(new URL("/investor", req.url));
      }
      if (pathname.startsWith("/investor") && role !== "investor") {
        return NextResponse.redirect(new URL("/admin", req.url));
      }
      return NextResponse.next();
    } catch {
      // token inválido/caducado → login
    }
  }
  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = {
  matcher: ["/admin/:path*", "/investor/:path*"],
};
