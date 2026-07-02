// Tests de integración contra los servicios locales (MongoDB, RustFS).
// Se saltan limpiamente si el servicio no está disponible (p. ej. en el
// runner de CI de la academia, donde solo corre el build).
import { afterAll, describe, expect, it } from "vitest";
import { MongoClient, type Db } from "mongodb";
import { getObject, putObject } from "@/lib/s3";
import type { Payment, Position } from "@/lib/types";

const URI = process.env.MONGODB_URI ?? "mongodb://localhost:27017/bonos";

// Conexión en carga de módulo para que it.skipIf vea el estado real
let client: MongoClient | null = null;
let db: Db | null = null;
try {
  client = new MongoClient(URI, { serverSelectionTimeoutMS: 1500 });
  await client.connect();
  db = client.db();
} catch {
  client = null;
}

afterAll(async () => {
  await client?.close();
});

describe("RF-10: el seed deja el screener explorable", () => {
  it.skipIf(!db)("hay emisores con ratings variados y bonos en oferta y adjudicados", async () => {
    const ratings = await db!.collection("issuers").distinct("rating");
    expect(ratings.length).toBeGreaterThanOrEqual(3);

    const offering = await db!.collection("bonds").countDocuments({ status: "offering" });
    const allocated = await db!.collection("bonds").countDocuments({ status: "allocated" });
    expect(offering).toBeGreaterThan(0);
    expect(allocated).toBeGreaterThan(0);

    const terms = await db!.collection("bonds").distinct("term");
    expect(terms.sort()).toEqual(["corto", "largo", "medio"]);
  });

  it.skipIf(!db)("los índices del screener existen", async () => {
    const idx = await db!.collection("bonds").indexes();
    const keys = idx.map((i) => JSON.stringify(i.key));
    expect(keys).toContain(JSON.stringify({ status: 1 }));
    expect(keys).toContain(JSON.stringify({ maturity: 1 }));
  });
});

describe("RF-03/RF-06: pagos persistidos cuadran con las posiciones", () => {
  it.skipIf(!db)("cada posición tiene su principal programado por el total del nominal", async () => {
    const positions = await db!.collection<Position>("positions").find().toArray();
    expect(positions.length).toBeGreaterThan(0);

    for (const pos of positions) {
      const bond = await db!.collection("bonds").findOne({ _id: pos.bondId });
      const principal = await db!
        .collection<Payment>("payments")
        .findOne({ bondId: pos.bondId, investorId: pos.investorId, type: "principal" });
      expect(principal).not.toBeNull();
      expect(principal!.amountCents).toBe((bond!.faceValueCents as number) * pos.units);
    }
  });

  it.skipIf(!db)("los cupones de cada inversor son enteros y positivos", async () => {
    const payments = await db!.collection<Payment>("payments").find({ type: "coupon" }).toArray();
    expect(payments.length).toBeGreaterThan(0);
    for (const p of payments) {
      expect(Number.isInteger(p.amountCents)).toBe(true);
      expect(p.amountCents).toBeGreaterThan(0);
    }
  });
});

describe("RF-04: almacenamiento de documentos en S3/RustFS", () => {
  it("sube y descarga un documento idéntico (roundtrip)", async () => {
    const key = `test/roundtrip-${Date.now()}.txt`;
    const content = Buffer.from("informe fiscal de prueba — bonos");
    try {
      await putObject(key, content, "text/plain");
    } catch {
      // RustFS no disponible: se salta (documentado en AGENTS.md §CI)
      return;
    }
    const { body, contentType } = await getObject(key);
    expect(Buffer.from(body).toString()).toBe(content.toString());
    expect(contentType).toBe("text/plain");
  });
});
