import crypto from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { CREDIT_PACKS, getCreditCostPerFile, type CreditPack } from "@/config/pricing";
import { getDb, schema } from "@/db";

export { CREDIT_PACKS, getCreditCostPerFile, type CreditPack };

export async function getWorkspaceBalance(workspaceId: string): Promise<number> {
  const db = await getDb();
  const rows = await db
    .select({
      total: sql<number>`COALESCE(SUM(${schema.creditLedgerEntries.delta}), 0)`,
    })
    .from(schema.creditLedgerEntries)
    .where(eq(schema.creditLedgerEntries.workspaceId, workspaceId));

  return Number(rows[0]?.total ?? 0);
}

export async function grantWelcomeCredits(workspaceId: string, credits = 10): Promise<void> {
  const db = await getDb();
  const idemKey = `welcome:${workspaceId}`;
  const existing = await db
    .select({ id: schema.creditLedgerEntries.id })
    .from(schema.creditLedgerEntries)
    .where(eq(schema.creditLedgerEntries.idempotencyKey, idemKey));
  if (existing.length > 0) return;

  await db.insert(schema.creditLedgerEntries).values({
    id: crypto.randomUUID(),
    workspaceId,
    delta: credits,
    reason: "welcome_bonus",
    idempotencyKey: idemKey,
  });
}

export async function reserveCreditsForJob(params: {
  workspaceId: string;
  jobId: string;
  fileCount: number;
  idempotencyKey: string;
}): Promise<{ ok: true; reserved: number } | { ok: false; balance: number; required: number }> {
  const db = await getDb();
  const cost = params.fileCount * getCreditCostPerFile();
  const ledgerIdemKey = `job_reserve:${params.workspaceId}:${params.idempotencyKey}`;

  return await db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: schema.creditLedgerEntries.id, delta: schema.creditLedgerEntries.delta })
      .from(schema.creditLedgerEntries)
      .where(eq(schema.creditLedgerEntries.idempotencyKey, ledgerIdemKey));

    if (existing.length > 0) {
      return { ok: true, reserved: Math.abs(existing[0].delta) };
    }

    const balRows = await tx
      .select({
        total: sql<number>`COALESCE(SUM(${schema.creditLedgerEntries.delta}), 0)`,
      })
      .from(schema.creditLedgerEntries)
      .where(eq(schema.creditLedgerEntries.workspaceId, params.workspaceId));

    const balance = Number(balRows[0]?.total ?? 0);
    if (balance < cost) {
      return { ok: false, balance, required: cost };
    }

    await tx.insert(schema.creditLedgerEntries).values({
      id: crypto.randomUUID(),
      workspaceId: params.workspaceId,
      delta: -cost,
      reason: "job_reserve",
      jobId: params.jobId,
      idempotencyKey: ledgerIdemKey,
    });

    return { ok: true, reserved: cost };
  });
}

export async function refundFailedItems(params: {
  workspaceId: string;
  jobId: string;
  failedCount: number;
}): Promise<number> {
  if (params.failedCount <= 0) return 0;
  const db = await getDb();
  const refundAmount = params.failedCount * getCreditCostPerFile();
  const ledgerIdemKey = `job_refund:${params.jobId}`;

  const existing = await db
    .select({ id: schema.creditLedgerEntries.id })
    .from(schema.creditLedgerEntries)
    .where(eq(schema.creditLedgerEntries.idempotencyKey, ledgerIdemKey));

  if (existing.length > 0) return 0;

  await db.insert(schema.creditLedgerEntries).values({
    id: crypto.randomUUID(),
    workspaceId: params.workspaceId,
    delta: refundAmount,
    reason: "item_refund",
    jobId: params.jobId,
    idempotencyKey: ledgerIdemKey,
  });

  return refundAmount;
}

export async function applyPurchaseCredits(params: {
  workspaceId: string;
  purchaseId: string;
  credits: number;
}): Promise<boolean> {
  const db = await getDb();
  const ledgerIdemKey = `purchase:${params.purchaseId}`;

  return await db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: schema.creditLedgerEntries.id })
      .from(schema.creditLedgerEntries)
      .where(eq(schema.creditLedgerEntries.idempotencyKey, ledgerIdemKey));

    if (existing.length > 0) {
      return false; // Already credited
    }

    await tx
      .update(schema.purchases)
      .set({ status: "paid", updatedAt: new Date() })
      .where(eq(schema.purchases.id, params.purchaseId));

    await tx.insert(schema.creditLedgerEntries).values({
      id: crypto.randomUUID(),
      workspaceId: params.workspaceId,
      delta: params.credits,
      reason: "purchase",
      purchaseId: params.purchaseId,
      idempotencyKey: ledgerIdemKey,
    });

    return true;
  });
}
