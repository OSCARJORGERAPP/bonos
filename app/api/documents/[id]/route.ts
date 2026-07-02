import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb, timed } from "@/lib/db";
import { isErrorResponse, requireRole } from "@/lib/auth";
import { getObject } from "@/lib/s3";
import type { BondDocument } from "@/lib/types";

// RF-04: descargar un documento almacenado en S3/RustFS.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole();
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: "id inválido" }, { status: 400 });

  const db = await getDb();
  const doc = await timed("documents.findOne", () =>
    db.collection<BondDocument>("documents").findOne({ _id: new ObjectId(id) })
  );
  if (!doc) return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });

  const { body, contentType } = await getObject(doc.s3Key);
  return new NextResponse(Buffer.from(body), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(doc.filename)}"`,
    },
  });
}
