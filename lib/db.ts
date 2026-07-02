import { Db, MongoClient } from "mongodb";

// Singleton del driver nativo (AGENTS.md §Convenciones).
// Acepta tanto la variable local (MONGODB_URI) como las que inyecta la
// plataforma de la academia en runtime (MONGO_HOST/PORT/USER/PASSWORD/DB).
function buildUri(): { uri: string; dbName: string } {
  if (process.env.MONGODB_URI) {
    const uri = process.env.MONGODB_URI;
    const dbName = new URL(uri).pathname.replace(/^\//, "") || "bonos";
    return { uri, dbName };
  }
  const host = process.env.MONGO_HOST ?? "localhost";
  const port = process.env.MONGO_PORT ?? "27017";
  const user = process.env.MONGO_USER;
  const password = process.env.MONGO_PASSWORD;
  const dbName = process.env.MONGO_DB ?? "bonos";
  const auth = user && password ? `${encodeURIComponent(user)}:${encodeURIComponent(password)}@` : "";
  const authSource = auth ? "?authSource=admin" : "";
  return { uri: `mongodb://${auth}${host}:${port}/${dbName}${authSource}`, dbName };
}

declare global {
  // Sobrevive a los hot-reloads de `next dev`
  var _mongo: { client: MongoClient; db: Db } | undefined;
}

export async function getDb(): Promise<Db> {
  if (!global._mongo) {
    const { uri, dbName } = buildUri();
    const client = new MongoClient(uri);
    await client.connect();
    global._mongo = { client, db: client.db(dbName) };
  }
  return global._mongo.db;
}

// Instrumentación: envuelve una operación de BD con un timer y log estructurado
// (métricas de PROMPT.md §5/§8: tiempo de respuesta MongoDB por operación).
export async function timed<T>(op: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    const ms = Math.round((performance.now() - start) * 100) / 100;
    console.log(JSON.stringify({ kind: "db", op, ms }));
  }
}
