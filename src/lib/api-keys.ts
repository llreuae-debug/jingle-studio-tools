import crypto from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { checkRateLimit } from "./rate-limit";

export function hashApiKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

export async function createWorkspaceApiKey(workspaceId: string, label: string) {
  const db = await getDb();
  const rawKey = `jst_${crypto.randomBytes(24).toString("hex")}`;
  const keyHash = hashApiKey(rawKey);
  const keyPrefix = rawKey.slice(0, 12);
  const id = crypto.randomUUID();

  await db.insert(schema.apiKeys).values({
    id,
    workspaceId,
    keyHash,
    keyPrefix,
    label: label.trim() || "API Key",
  });

  return { id, rawKey, keyPrefix, label };
}

export async function authenticateApiKey(authHeader: string | null): Promise<
  | { ok: true; workspaceId: string; apiKeyId: string }
  | { ok: false; status: number; error: string }
> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { ok: false, status: 401, error: "Missing Bearer API key." };
  }

  const rawKey = authHeader.slice("Bearer ".length).trim();
  if (!rawKey.startsWith("jst_")) {
    return { ok: false, status: 401, error: "Invalid API key format." };
  }

  const keyHash = hashApiKey(rawKey);
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.apiKeys)
    .where(and(eq(schema.apiKeys.keyHash, keyHash), isNull(schema.apiKeys.revokedAt)));

  if (rows.length === 0) {
    return { ok: false, status: 401, error: "Invalid or revoked API key." };
  }

  const keyRow = rows[0];
  const rl = checkRateLimit(`apikey:${keyRow.id}`, 60, 60_000);
  if (!rl.allowed) {
    return {
      ok: false,
      status: 429,
      error: `Rate limit exceeded. Retry after ${rl.retryAfterSeconds}s.`,
    };
  }

  await db
    .update(schema.apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(schema.apiKeys.id, keyRow.id));

  return { ok: true, workspaceId: keyRow.workspaceId, apiKeyId: keyRow.id };
}
