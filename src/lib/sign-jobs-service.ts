import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { AiUseChoice } from "./c2pa-server";
import { reserveCreditsForJob } from "./credits";
import { processSignJob } from "./job-runner";
import { detectRealMimeType, logStructured } from "./security";
import { getPrivateDownloadUrl, putPrivateObject } from "./storage";

const MAX_FILES_PER_BATCH = 50;
const MAX_FILE_BYTES = 25 * 1024 * 1024;

export const VALID_AI_USES = new Set<AiUseChoice>([
  "full_ai",
  "original_edited_ai",
  "composite_ai",
  "human_edits_ai",
  "no_ai",
]);

function mapDigitalSourceType(aiUse: AiUseChoice): string {
  switch (aiUse) {
    case "full_ai":
      return "trainedAlgorithmicMedia";
    case "original_edited_ai":
      return "compositeWithTrainedAlgorithmicMedia";
    case "composite_ai":
      return "compositeSynthetic";
    case "human_edits_ai":
    case "no_ai":
      return "humanEdits";
  }
}

export async function createSignJobForWorkspace(params: {
  workspaceId: string;
  createdByUserId: string;
  files: Array<{ name: string; buffer: Buffer }>;
  creatorName: string;
  creatorWebsite?: string;
  aiUse: AiUseChoice;
  modelType?: string;
  modelName?: string;
  doNotTrain?: boolean;
  idempotencyKey?: string;
}): Promise<
  | { ok: true; jobId: string; duplicate: boolean }
  | { ok: false; status: number; error: string; code?: string }
> {
  if (params.files.length === 0 || params.files.length > MAX_FILES_PER_BATCH) {
    return {
      ok: false,
      status: 400,
      error: `Provide between 1 and ${MAX_FILES_PER_BATCH} JPG or PNG files.`,
    };
  }

  if (!params.creatorName.trim()) {
    return { ok: false, status: 400, error: "creatorName is required." };
  }

  if (!VALID_AI_USES.has(params.aiUse)) {
    return { ok: false, status: 400, error: "Invalid aiUse disclosure option." };
  }

  const requiresModelType =
    params.aiUse === "full_ai" ||
    params.aiUse === "original_edited_ai" ||
    params.aiUse === "composite_ai";
  if (requiresModelType && !params.modelType?.trim()) {
    return {
      ok: false,
      status: 400,
      error: "modelType is required when AI use is declared.",
    };
  }

  const db = await getDb();
  const idempotencyKey = params.idempotencyKey || crypto.randomUUID();

  const existingJobs = await db
    .select()
    .from(schema.signJobs)
    .where(
      and(
        eq(schema.signJobs.workspaceId, params.workspaceId),
        eq(schema.signJobs.idempotencyKey, idempotencyKey)
      )
    );
  if (existingJobs.length > 0) {
    return { ok: true, jobId: existingJobs[0].id, duplicate: true };
  }

  const validatedFiles: Array<{
    name: string;
    buffer: Buffer;
    mimeType: "image/jpeg" | "image/png";
    sha256: string;
  }> = [];

  for (const f of params.files) {
    if (f.buffer.length === 0 || f.buffer.length > MAX_FILE_BYTES) {
      return {
        ok: false,
        status: 400,
        error: `File "${f.name}" is empty or exceeds 25 MB.`,
      };
    }
    const realMime = detectRealMimeType(f.buffer);
    if (realMime !== "image/jpeg" && realMime !== "image/png") {
      return {
        ok: false,
        status: 400,
        error: `File "${f.name}" is not a valid JPG or PNG image.`,
      };
    }
    validatedFiles.push({
      name: f.name,
      buffer: f.buffer,
      mimeType: realMime,
      sha256: crypto.createHash("sha256").update(f.buffer).digest("hex"),
    });
  }

  const jobId = crypto.randomUUID();
  const reservation = await reserveCreditsForJob({
    workspaceId: params.workspaceId,
    jobId,
    fileCount: validatedFiles.length,
    idempotencyKey,
  });

  if (!reservation.ok) {
    return {
      ok: false,
      status: 402,
      code: "ERR_INSUFFICIENT_CREDITS",
      error: `Insufficient credits. Need ${reservation.required}, available ${reservation.balance}.`,
    };
  }

  await db.insert(schema.signJobs).values({
    id: jobId,
    workspaceId: params.workspaceId,
    createdBy: params.createdByUserId,
    status: "queued",
    fileCount: validatedFiles.length,
    creditsReserved: reservation.reserved,
    idempotencyKey,
    creatorName: params.creatorName.trim(),
    creatorWebsite: params.creatorWebsite?.trim() || null,
    doNotTrain: params.doNotTrain ?? true,
  });

  const dst = mapDigitalSourceType(params.aiUse);
  for (const vf of validatedFiles) {
    const itemId = crypto.randomUUID();
    const safeName = vf.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const inputKey = `inputs/${params.workspaceId}/${jobId}/${itemId}-${safeName}`;
    await putPrivateObject(inputKey, vf.buffer, vf.mimeType);

    await db.insert(schema.signJobItems).values({
      id: itemId,
      jobId,
      originalName: vf.name,
      mimeType: vf.mimeType,
      inputKey,
      inputSha256: vf.sha256,
      status: "queued",
    });

    await db.insert(schema.disclosures).values({
      id: crypto.randomUUID(),
      jobItemId: itemId,
      aiUse: params.aiUse,
      digitalSourceType: dst,
      modelType: params.modelType?.trim() || null,
      modelName: params.modelName?.trim() || null,
      declaredBy: params.creatorName.trim(),
    });
  }

  logStructured("info", "sign_job_created", {
    jobId,
    workspaceId: params.workspaceId,
    fileCount: validatedFiles.length,
  });

  void processSignJob(jobId).catch((err) => {
    logStructured("error", "sign_job_worker_error", {
      jobId,
      message: err instanceof Error ? err.message : "unknown",
    });
  });

  return { ok: true, jobId, duplicate: false };
}

export async function getSignJobForWorkspace(workspaceId: string, jobId: string) {
  const db = await getDb();
  const jobs = await db
    .select()
    .from(schema.signJobs)
    .where(
      and(eq(schema.signJobs.id, jobId), eq(schema.signJobs.workspaceId, workspaceId))
    );

  if (jobs.length === 0) return null;
  const job = jobs[0];

  const items = await db
    .select()
    .from(schema.signJobItems)
    .where(eq(schema.signJobItems.jobId, job.id));

  const enriched = await Promise.all(
    items.map(async (item) => {
      const isExpired =
        item.status === "expired" ||
        (item.expiresAt ? item.expiresAt.getTime() < Date.now() : false);

      let downloadUrl: string | null = null;
      if (item.status === "done" && item.outputKey && !isExpired) {
        downloadUrl = await getPrivateDownloadUrl(
          item.outputKey,
          workspaceId,
          `signed-${item.originalName}`
        );
      }

      return {
        id: item.id,
        originalName: item.originalName,
        mimeType: item.mimeType,
        status: isExpired && item.status === "done" ? "expired" : item.status,
        errorCode: item.errorCode,
        errorMessage: item.errorMessage,
        expiresAt: item.expiresAt,
        downloadUrl,
      };
    })
  );

  return { job, items: enriched };
}
