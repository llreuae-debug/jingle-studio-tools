import crypto from "node:crypto";
import { getDb, schema } from "@/db";
import { logStructured } from "@/lib/security";

export async function recordSystemLog(params: {
  level?: "info" | "warn" | "error";
  event: string;
  userId?: string | null;
  message: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const level = params.level || "info";
  logStructured(level, params.event, {
    userId: params.userId || undefined,
    message: params.message,
    ...params.metadata,
  });

  try {
    const db = await getDb();
    await db.insert(schema.systemLogs).values({
      id: crypto.randomUUID(),
      level,
      event: params.event,
      userId: params.userId || null,
      message: params.message,
      metadata: params.metadata || null,
    });
  } catch {
    // Logging should never crash request handling
  }
}
