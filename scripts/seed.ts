// Seed (RF-10): emisores con distintos ratings/sectores, bonos en oferta y
// adjudicados con distintos plazos, órdenes, carteras con pagos (algunos ya
// cobrados para el rendimiento histórico) e índices de PROMPT.md §6.
// Ejecutar: npx tsx scripts/seed.ts   (añade --reset para limpiar antes)
import { MongoClient } from "mongodb";
import { buildSchedule, termFor } from "../lib/finance";
import type {
  Alert, Bond, Issuer, Order, Payment, Position, ReferenceRate, User,
} from "../lib/types";

const URI = process.env.MONGODB_URI ?? "mongodb://localhost:27017/bonos";

async function main() {
  const reset = process.argv.includes("--reset");
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db();

  if (reset) {
    await db.dropDatabase();
    console.log("BD limpiada (--reset)");
  }

  // --- Índices (PROMPT.md §6) ---
  await db.collection("users").createIndex({ email: 1 }, { unique: true });
  await db.collection("issuers").createIndexes([{ key: { rating: 1 } }, { key: { sector: 1 } }]);
  await db.collection("bonds").createIndexes([
    { key: { status: 1 } }, { key: { maturity: 1 } }, { key: { term: 1 } }, { key: { issuerId: 1 } },
  ]);
  await db.collection("orders").createIndexes([
    { key: { bondId: 1, status: 1 } }, { key: { investorId: 1 } },
  ]);
  await db.collection("positions").createIndex({ investorId: 1 });
  await db.collection("payments").createIndexes([
    { key: { investorId: 1, dueDate: 1 } }, { key: { bondId: 1 } },
  ]);
  await db.collection("alerts").createIndexes([{ key: { investorId: 1 } }, { key: { sent: 1 } }]);

  const existing = await db.collection("bonds").countDocuments();
  if (existing > 0) {
    console.log(`La BD ya tiene ${existing} bonos; usa --reset para re-sembrar. Solo se aseguraron los índices.`);
    await client.close();
    return;
  }

  const now = new Date();
  const yearsFromNow = (y: number) =>
    new Date(Date.UTC(now.getUTCFullYear() + y, now.getUTCMonth(), 15));
  const yearsAgo = (y: number) =>
    new Date(Date.UTC(now.getUTCFullYear() - y, now.getUTCMonth(), 15));

  // --- Usuarios ---
  const users: User[] = [
    { email: "admin@bonos.local", role: "admin", createdAt: now },
    { email: "ana@inversores.local", role: "investor", createdAt: now },
    { email: "bruno@inversores.local", role: "investor", createdAt: now },
    { email: "carla@inversores.local", role: "investor", createdAt: now },
  ];
  await db.collection<User>("users").insertMany(users);
  const [, ana, bruno, carla] = users;

  // --- Tasa de referencia para cupones variables ---
  await db.collection<ReferenceRate>("rates").insertOne({
    name: "EURIBOR-SIM", bps: 250, updatedAt: now,
  });

  // --- Emisores ---
  const issuers: Issuer[] = [
    { name: "Iberia Energía SA", sector: "energia", rating: "A" },
    { name: "Banco Meridional", sector: "financiero", rating: "AA" },
    { name: "Industrias Vulcano", sector: "industrial", rating: "BBB" },
    { name: "NubeTech Systems", sector: "tecnologia", rating: "BB" },
    { name: "Alimentos del Sur", sector: "consumo", rating: "A" },
    { name: "BioSalud Labs", sector: "salud", rating: "AAA" },
    { name: "TeleConecta", sector: "telecomunicaciones", rating: "B" },
  ];
  await db.collection<Issuer>("issuers").insertMany(issuers);

  // --- Bonos ---
  const mkBond = (
    name: string, issuer: Issuer, faceEur: number, couponType: Bond["couponType"],
    couponBps: number, frequency: Bond["frequency"], issueDate: Date, maturity: Date,
    totalUnits: number, status: Bond["status"], finalPriceCents?: number
  ): Bond => ({
    name, issuerId: issuer._id!, faceValueCents: faceEur * 100, couponType, couponBps,
    frequency, issueDate, maturity, term: termFor(issueDate, maturity),
    status, totalUnits, finalPriceCents, createdAt: now,
  });

  const bonds: Bond[] = [
    // Adjudicados (con cartera y pagos): emitidos hace 1-2 años
    mkBond("Iberia Energía 4.2% 2030", issuers[0], 1000, "fixed", 420, "semiannual", yearsAgo(1), yearsFromNow(4), 10_000, "allocated", 98_500),
    mkBond("Banco Meridional 3.1% 2028", issuers[1], 1000, "fixed", 310, "annual", yearsAgo(2), yearsFromNow(2), 20_000, "allocated", 99_800),
    mkBond("NubeTech VAR+380 2031", issuers[3], 1000, "variable", 630, "quarterly", yearsAgo(1), yearsFromNow(5), 5_000, "allocated", 96_000),
    // En oferta (bookbuilding activo)
    mkBond("Vulcano 5.0% 2033", issuers[2], 1000, "fixed", 500, "annual", yearsFromNow(0), yearsFromNow(7), 15_000, "offering"),
    mkBond("Alimentos del Sur 3.8% 2029", issuers[4], 500, "fixed", 380, "semiannual", yearsFromNow(0), yearsFromNow(3), 30_000, "offering"),
    mkBond("BioSalud 2.9% 2036", issuers[5], 1000, "fixed", 290, "annual", yearsFromNow(0), yearsFromNow(10), 25_000, "offering"),
    mkBond("TeleConecta VAR+520 2027", issuers[6], 500, "variable", 520, "quarterly", yearsFromNow(0), yearsFromNow(1), 8_000, "offering"),
  ];
  await db.collection<Bond>("bonds").insertMany(bonds);

  // --- Carteras + pagos de los bonos adjudicados ---
  const holdings: Array<[Bond, User, number]> = [
    [bonds[0], ana, 50],
    [bonds[0], bruno, 30],
    [bonds[1], ana, 100],
    [bonds[1], carla, 60],
    [bonds[2], bruno, 40],
    [bonds[2], carla, 25],
  ];
  const positions: Position[] = [];
  const payments: Payment[] = [];
  for (const [bond, user, units] of holdings) {
    positions.push({
      bondId: bond._id!, investorId: user._id!, units,
      costCents: units * bond.finalPriceCents!, createdAt: bond.issueDate,
    });
    for (const flow of buildSchedule({ ...bond, units })) {
      payments.push({
        bondId: bond._id!, investorId: user._id!, dueDate: flow.dueDate,
        type: flow.type, amountCents: flow.amountCents,
        status: flow.dueDate < now ? "paid" : "scheduled",
      });
    }
  }
  await db.collection<Position>("positions").insertMany(positions);
  await db.collection<Payment>("payments").insertMany(payments);

  // --- Órdenes de ejemplo en los bonos en oferta (libro con demanda) ---
  const orders: Order[] = [
    { bondId: bonds[3]._id!, investorId: ana._id!, priceCents: 99_000, units: 200, status: "pending", createdAt: now },
    { bondId: bonds[3]._id!, investorId: bruno._id!, priceCents: 98_500, units: 150, status: "pending", createdAt: now },
    { bondId: bonds[3]._id!, investorId: carla._id!, priceCents: 99_500, units: 100, status: "pending", createdAt: now },
    { bondId: bonds[4]._id!, investorId: ana._id!, priceCents: 49_800, units: 300, status: "pending", createdAt: now },
    { bondId: bonds[5]._id!, investorId: carla._id!, priceCents: 97_000, units: 500, status: "pending", createdAt: now },
  ];
  await db.collection<Order>("orders").insertMany(orders);

  // --- Alertas de ejemplo ---
  await db.collection<Alert>("alerts").insertOne({
    investorId: bruno._id!, type: "rating", issuerId: issuers[3]._id!,
    bondId: bonds[2]._id!, message: "El rating de NubeTech Systems cambió de BBB a BB.",
    sent: true, createdAt: yearsAgo(0),
  });

  console.log(`Seed completado:
  ${users.length} usuarios (admin@bonos.local + 3 inversores)
  ${issuers.length} emisores | ${bonds.length} bonos (3 adjudicados, 4 en oferta)
  ${positions.length} posiciones | ${payments.length} pagos programados | ${orders.length} órdenes`);
  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
