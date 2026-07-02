import {
  CreateBucketCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

// Acepta variables locales (S3_*) o las que inyecta la plataforma de la
// academia (RUSTFS_*, BUCKET_NAME) — ver AGENTS.md §CI.
function endpoint(): string {
  if (process.env.S3_ENDPOINT) return process.env.S3_ENDPOINT;
  const host = process.env.RUSTFS_HOST ?? "localhost";
  const port = process.env.RUSTFS_PORT ?? "9000";
  return `http://${host}:${port}`;
}

export const BUCKET =
  process.env.S3_BUCKET ?? process.env.BUCKET_NAME ?? "bonos-docs";

const client = new S3Client({
  endpoint: endpoint(),
  region: "us-east-1",
  forcePathStyle: true, // requerido por RustFS/MinIO
  credentials: {
    accessKeyId:
      process.env.S3_ACCESS_KEY ?? process.env.RUSTFS_ACCESS_KEY ?? "rustfsadmin",
    secretAccessKey:
      process.env.S3_SECRET_KEY ?? process.env.RUSTFS_SECRET_KEY ?? "rustfsadmin",
  },
});

export async function ensureBucket() {
  try {
    await client.send(new CreateBucketCommand({ Bucket: BUCKET }));
  } catch (err: unknown) {
    const name = (err as { name?: string }).name ?? "";
    if (!["BucketAlreadyOwnedByYou", "BucketAlreadyExists"].includes(name)) throw err;
  }
}

export async function putObject(key: string, body: Buffer, contentType: string) {
  await ensureBucket();
  await client.send(
    new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType })
  );
}

export async function getObject(
  key: string
): Promise<{ body: Uint8Array; contentType: string }> {
  const res = await client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  const body = await res.Body!.transformToByteArray();
  return { body, contentType: res.ContentType ?? "application/octet-stream" };
}
