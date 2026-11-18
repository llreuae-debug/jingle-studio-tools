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

const LOCAL_STORAGE_DIR = path.join(process.cwd(), ".storage");

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

  const fullPath = path.join(LOCAL_STORAGE_DIR, key);
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
    const fullPath = path.join(LOCAL_STORAGE_DIR, key);
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
    const fullPath = path.join(LOCAL_STORAGE_DIR, key);
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
