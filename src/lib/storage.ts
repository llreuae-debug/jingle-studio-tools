import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { resolvePersistentDataDir } from "@/lib/data-dir";

function getLocalStorageDir(): string {
  return process.env.LOCAL_STORAGE_DIR || path.join(resolvePersistentDataDir(), ".storage");
}

function useS3(): boolean {
  return Boolean(process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID);
}

function getS3Client(): S3Client {
  return new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint: process.env.S3_ENDPOINT || undefined,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
    },
    forcePathStyle: Boolean(process.env.S3_ENDPOINT),
  });
}

function getSigningSecret(): string {
  return process.env.AUTH_SECRET || "dev-local-storage-signing-secret";
}

export async function putPrivateObject(
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  if (useS3()) {
    const client = getS3Client();
    await client.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET!,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    );
    return;
  }

  const fullPath = path.join(getLocalStorageDir(), key);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, body);
}

export async function getPrivateObject(key: string): Promise<Buffer | null> {
  if (useS3()) {
    try {
      const client = getS3Client();
      const res = await client.send(
        new GetObjectCommand({
          Bucket: process.env.S3_BUCKET!,
          Key: key,
        })
      );
      if (!res.Body) return null;
      const chunks: Uint8Array[] = [];
      for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    } catch {
      return null;
    }
  }

  try {
    const fullPath = path.join(getLocalStorageDir(), key);
    return await fs.readFile(fullPath);
  } catch {
    return null;
  }
}

export async function deletePrivateObject(key: string): Promise<void> {
  if (useS3()) {
    try {
      const client = getS3Client();
      await client.send(
        new DeleteObjectCommand({
          Bucket: process.env.S3_BUCKET!,
          Key: key,
        })
      );
    } catch {
      // ignore missing
    }
    return;
  }

  try {
    const fullPath = path.join(getLocalStorageDir(), key);
    await fs.unlink(fullPath);
  } catch {
    // ignore missing
  }
}

export function createSignedToken(payload: {
  key: string;
  workspaceId: string;
  fileName: string;
  exp: number;
}): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto
    .createHmac("sha256", getSigningSecret())
    .update(data)
    .digest("base64url");
  return `${data}.${sig}`;
}

export function verifySignedToken(token: string): {
  key: string;
  workspaceId: string;
  fileName: string;
  exp: number;
} | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  const expected = crypto
    .createHmac("sha256", getSigningSecret())
    .update(data)
    .digest("base64url");
  if (sig !== expected) return null;
  try {
    const parsed = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
    if (typeof parsed.exp !== "number" || Date.now() > parsed.exp) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function getPrivateDownloadUrl(
  key: string,
  workspaceId: string,
  fileName: string,
  ttlSeconds = 300
): Promise<string> {
  if (useS3()) {
    const client = getS3Client();
    const cmd = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${fileName.replace(/"/g, "")}"`,
    });
    return getSignedUrl(client, cmd, { expiresIn: ttlSeconds });
  }

  const token = createSignedToken({
    key,
    workspaceId,
    fileName,
    exp: Date.now() + ttlSeconds * 1000,
  });
  return `/api/files/download?token=${encodeURIComponent(token)}`;
}

export interface PrivacyDownloadTokenPayload {
  recordId: string;
  kind: "original" | "cleaned";
  ownerScope: string;
  fileName: string;
  exp: number;
}

export function createPrivacyDownloadToken(
  payload: PrivacyDownloadTokenPayload
): string {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto
    .createHmac("sha256", getSigningSecret())
    .update(`privacy:${data}`)
    .digest("base64url");
  return `${data}.${sig}`;
}

export function verifyPrivacyDownloadToken(
  token: string
): PrivacyDownloadTokenPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  const expected = crypto
    .createHmac("sha256", getSigningSecret())
    .update(`privacy:${data}`)
    .digest("base64url");
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return null;
  }
  try {
    const parsed = JSON.parse(
      Buffer.from(data, "base64url").toString("utf8")
    ) as PrivacyDownloadTokenPayload;
    if (
      typeof parsed.recordId !== "string" ||
      (parsed.kind !== "original" && parsed.kind !== "cleaned") ||
      typeof parsed.ownerScope !== "string" ||
      typeof parsed.fileName !== "string" ||
      typeof parsed.exp !== "number" ||
      Date.now() > parsed.exp
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function buildPrivacyDownloadUrl(params: {
  recordId: string;
  kind: "original" | "cleaned";
  ownerScope: string;
  fileName: string;
  ttlSeconds?: number;
}): string {
  const token = createPrivacyDownloadToken({
    recordId: params.recordId,
    kind: params.kind,
    ownerScope: params.ownerScope,
    fileName: params.fileName,
    exp: Date.now() + (params.ttlSeconds ?? 900) * 1000,
  });
  return `/api/privacy-clean/download?token=${encodeURIComponent(token)}`;
}

export async function purgeStaleUploadChunks(
  maxAgeMs = 60 * 60 * 1000
): Promise<number> {
  if (useS3()) return 0;
  try {
    const chunksRoot = path.join(getLocalStorageDir(), "chunks");
    const entries = await fs.readdir(chunksRoot, { withFileTypes: true }).catch(() => []);
    const cutoff = Date.now() - maxAgeMs;
    let removed = 0;

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dirPath = path.join(chunksRoot, entry.name);
      try {
        const stat = await fs.stat(dirPath);
        if (stat.mtimeMs < cutoff) {
          await fs.rm(dirPath, { recursive: true, force: true });
          removed++;
        }
      } catch {
        // ignore concurrent deletion
      }
    }
    return removed;
  } catch {
    return 0;
  }
}

export async function purgeExpiredPrivacyFiles(): Promise<number> {
  try {
    const { and, lt, ne, isNotNull } = await import("drizzle-orm");
    const { getDb, schema } = await import("@/db");
    const db = await getDb();
    const now = new Date();
    const expiredRows = await db
      .select({
        id: schema.mediaProcessingRecords.id,
        originalKey: schema.mediaProcessingRecords.originalKey,
        cleanedKey: schema.mediaProcessingRecords.cleanedKey,
      })
      .from(schema.mediaProcessingRecords)
      .where(
        and(
          ne(schema.mediaProcessingRecords.status, "expired"),
          isNotNull(schema.mediaProcessingRecords.expiresAt),
          lt(schema.mediaProcessingRecords.expiresAt, now)
        )
      )
      .limit(100);

    for (const row of expiredRows) {
      if (row.originalKey) await deletePrivateObject(row.originalKey);
      if (row.cleanedKey) await deletePrivateObject(row.cleanedKey);
      const { eq } = await import("drizzle-orm");
      await db
        .update(schema.mediaProcessingRecords)
        .set({
          status: "expired",
          originalKey: null,
          cleanedKey: null,
        })
        .where(eq(schema.mediaProcessingRecords.id, row.id));
    }

    await purgeStaleUploadChunks();
    return expiredRows.length;
  } catch {
    return 0;
  }
}
