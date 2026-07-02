import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb, timed } from "@/lib/db";
import { isErrorResponse, requireRole } from "@/lib/auth";
import { putObject } from "@/lib/s3";
import type { Bond, BondDocument } from "@/lib/types";

const KINDS = ["fiscal", "uso-fondos", "covenants", "reporte"] as const;

// RF-04: listar documentos de una emisión (cualquier usuario autenticado).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole();
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: "id inválido" }, { status: 400 });

  const db = await getDb();
  const docs = await timed("documents.byBond", () =>
    db.collection<BondDocument>("documents").find({ bondId: new ObjectId(id) }).sort({ uploadedAt: -1 }).toArray()
  );
  return NextResponse.json(docs);
}

// RF-04: subir un documento (fiscal, uso de fondos, covenants, reporte) a S3/RustFS.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRole("admin");
  if (isErrorResponse(auth)) return auth;

  const { id } = await params;
  if (!ObjectId.isValid(id)) return NextResponse.json({ error: "id inválido" }, { status: 400 });
  const bondId = new ObjectId(id);

  const db = await getDb();
  const bond = await db.collection<Bond>("bonds").findOne({ _id: bondId });
  if (!bond) return NextResponse.json({ error: "Bono no encontrado" }, { status: 404 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const kind = form?.get("kind");
  if (!(file instanceof File) || typeof kind !== "string" || !KINDS.includes(kind as (typeof KINDS)[number])) {
    return NextResponse.json({ error: "Se requiere file y kind válido" }, { status: 400 });
  }

  const s3Key = `${bondId.toString()}/${Date.now()}-${file.name}`;
  const body = Buffer.from(await file.arrayBuffer());
  await putObject(s3Key, body, file.type || "application/octet-stream");

  const doc: BondDocument = {
    bondId,
    kind: kind as BondDocument["kind"],
    filename: file.name,
    s3Key,
    contentType: file.type || "application/octet-stream",
    sizeBytes: body.length,
    uploadedAt: new Date(),
  };
  const { insertedId } = await timed("documents.insert", () =>
    db.collection<BondDocument>("documents").insertOne(doc)
  );
  return NextResponse.json({ ...doc, _id: insertedId }, { status: 201 });
}
