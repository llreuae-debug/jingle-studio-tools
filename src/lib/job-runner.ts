import crypto from "node:crypto";
import { and, eq, lt } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { signImageWithC2pa, SigningError, type AiUseChoice } from "./c2pa-server";
import { refundFailedItems } from "./credits";
import { logStructured } from "./security";
import {
  deletePrivateObject,
  getPrivateObject,
  putPrivateObject,
} from "./storage";

function getOutputTtlMs(): number {
  const hours = Number.parseInt(process.env.SIGNED_OUTPUT_TTL_HOURS || "24", 10);
  const safeHours = Number.isFinite(hours) && hours > 0 ? hours : 24;
  return safeHours * 60 * 60 * 1000;
}

export async function processSignJob(jobId: string): Promise<void> {
  const db = await getDb();
  const jobRows = await db
    .select()
    .from(schema.signJobs)
    .where(eq(schema.signJobs.id, jobId));

  if (jobRows.length === 0) return;
  const job = jobRows[0];

  await db
    .update(schema.signJobs)
    .set({ status: "running" })
    .where(eq(schema.signJobs.id, jobId));

  const items = await db
    .select()
    .from(schema.signJobItems)
    .where(eq(schema.signJobItems.jobId, jobId));

  let doneCount = 0;
  let failedCount = 0;

  for (const item of items) {
    if (item.status === "done") {
      doneCount++;
      continue;
    }

    await db
      .update(schema.signJobItems)
      .set({ status: "running", errorCode: null, errorMessage: null })
      .where(eq(schema.signJobItems.id, item.id));

    const disclosureRows = await db
      .select()
      .from(schema.disclosures)
      .where(eq(schema.disclosures.jobItemId, item.id));
    const disc = disclosureRows[0];

    try {
      if (!item.inputKey) {
        throw new SigningError("ERR_MISSING_INPUT", "Input file is no longer available.");
      }
      const inputBuf = await getPrivateObject(item.inputKey);
      if (!inputBuf) {
        throw new SigningError("ERR_MISSING_INPUT", "Could not read input file from storage.");
      }

      const mimeType =
        item.mimeType === "image/png" ? "image/png" : "image/jpeg";

      const result = await signImageWithC2pa({
        buffer: inputBuf,
        mimeType,
        fileName: item.originalName,
        creatorName: job.creatorName,
        creatorWebsite: job.creatorWebsite || undefined,
        aiUse: (disc?.aiUse as AiUseChoice) || "no_ai",
        modelType: disc?.modelType || undefined,
        modelName: disc?.modelName || undefined,
        doNotTrain: job.doNotTrain,
      });

      const outputKey = `outputs/${job.workspaceId}/${job.id}/${item.id}-${item.originalName}`;
      await putPrivateObject(outputKey, result.signedBuffer, mimeType);

      const expiresAt = new Date(Date.now() + getOutputTtlMs());

      await db
        .update(schema.signJobItems)
        .set({
          status: "done",
          outputKey,
          outputSha256: result.outputSha256,
          expiresAt,
          inputKey: null,
        })
        .where(eq(schema.signJobItems.id, item.id));

      // Delete raw input immediately after signing
      await deletePrivateObject(item.inputKey);
      doneCount++;
    } catch (err) {
      const code = err instanceof SigningError ? err.code : "ERR_SIGNING_FAILED";
      const message = err instanceof Error ? err.message : "Signing failed.";

      await db
        .update(schema.signJobItems)
        .set({
          status: "failed",
          errorCode: code,
          errorMessage: message,
          inputKey: null,
        })
        .where(eq(schema.signJobItems.id, item.id));

      if (item.inputKey) {
        await deletePrivateObject(item.inputKey);
      }
      failedCount++;
      logStructured("warn", "sign_item_failed", {
        jobId,
        itemId: item.id,
        errorCode: code,
      });
    }
  }

  const finalStatus =
    failedCount === 0
      ? "done"
      : doneCount === 0
      ? "failed"
      : "partial_failure";

  await db
    .update(schema.signJobs)
    .set({ status: finalStatus, completedAt: new Date() })
    .where(eq(schema.signJobs.id, jobId));

  if (failedCount > 0) {
    await refundFailedItems({
      workspaceId: job.workspaceId,
      jobId: job.id,
      failedCount,
    });
  }
}

export async function cleanupExpiredOutputs(): Promise<number> {
  const db = await getDb();
  const now = new Date();
  const expired = await db
    .select()
    .from(schema.signJobItems)
    .where(
      and(
        eq(schema.signJobItems.status, "done"),
        lt(schema.signJobItems.expiresAt, now)
      )
    );

  let count = 0;
  for (const item of expired) {
    if (item.outputKey) {
      await deletePrivateObject(item.outputKey);
    }
    await db
      .update(schema.signJobItems)
      .set({ status: "expired", outputKey: null })
      .where(eq(schema.signJobItems.id, item.id));
    count++;
  }
  return count;
}

export function generateJobId(): string {
  return crypto.randomUUID();
}
