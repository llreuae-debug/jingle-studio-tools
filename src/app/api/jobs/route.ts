import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getSessionContext } from "@/lib/auth";
import type { AiUseChoice } from "@/lib/c2pa-server";
import { reserveCreditsForJob } from "@/lib/credits";
import { processSignJob } from "@/lib/job-runner";
import { checkRateLimit } from "@/lib/rate-limit";
import { detectRealMimeType, logStructured, verifySameOrigin } from "@/lib/security";
import { putPrivateObject } from "@/lib/storage";

const MAX_FILES_PER_BATCH = 50;
const MAX_FILE_BYTES = 25 * 1024 * 1024;

const VALID_AI_USES = new Set<AiUseChoice>([
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

export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  const jobs = await db
    .select()
    .from(schema.signJobs)
    .where(eq(schema.signJobs.workspaceId, ctx.workspace.id))
    .orderBy(desc(schema.signJobs.createdAt))
    .limit(50);

  return NextResponse.json({ jobs });
}

export async function POST(req: NextRequest) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
  for (const [scope, limit] of [
    [`ip:${ip}`, 30],
    [`user:${ctx.user.id}`, 20],
    [`ws:${ctx.workspace.id}`, 40],
  ] as const) {
    const rl = checkRateLimit(scope, limit, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please wait before submitting another batch." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
      );
    }
  }

  const formData = await req.formData();
  const files = formData.getAll("files").filter((v): v is File => v instanceof File);
  const creatorName = String(formData.get("creatorName") || "").trim();
  const creatorWebsite = String(formData.get("creatorWebsite") || "").trim();
  const aiUse = String(formData.get("aiUse") || "") as AiUseChoice;
  const modelType = String(formData.get("modelType") || "").trim();
  const modelName = String(formData.get("modelName") || "").trim();
  const doNotTrain = String(formData.get("doNotTrain") || "true") !== "false";
  const idempotencyKey =
    req.headers.get("idempotency-key") ||
    String(formData.get("idempotencyKey") || "").trim() ||
    crypto.randomUUID();

  if (files.length === 0 || files.length > MAX_FILES_PER_BATCH) {
    return NextResponse.json(
      { error: `Upload between 1 and ${MAX_FILES_PER_BATCH} JPG or PNG files.` },
      { status: 400 }
    );
  }

  if (!creatorName) {
    return NextResponse.json({ error: "Creator name is required." }, { status: 400 });
  }

  if (!VALID_AI_USES.has(aiUse)) {
    return NextResponse.json({ error: "Invalid AI disclosure option." }, { status: 400 });
  }

  const requiresModelType =
    aiUse === "full_ai" || aiUse === "original_edited_ai" || aiUse === "composite_ai";
  if (requiresModelType && !modelType) {
    return NextResponse.json(
      { error: "Model type is required when AI use is declared." },
      { status: 400 }
    );
  }

  const db = await getDb();

  // Idempotent duplicate submission check
  const existingJobs = await db
    .select()
    .from(schema.signJobs)
    .where(
      and(
        eq(schema.signJobs.workspaceId, ctx.workspace.id),
        eq(schema.signJobs.idempotencyKey, idempotencyKey)
      )
    );
  if (existingJobs.length > 0) {
    return NextResponse.json({ jobId: existingJobs[0].id, duplicate: true }, { status: 200 });
  }

  // Validate real file types and sizes before reserving credits
  const validatedFiles: Array<{
    file: File;
    buffer: Buffer;
    mimeType: "image/jpeg" | "image/png";
    sha256: string;
  }> = [];

  for (const file of files) {
    if (file.size === 0 || file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `File "${file.name}" exceeds the 25 MB limit or is empty.` },
        { status: 400 }
      );
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const realMime = detectRealMimeType(buffer);
    if (realMime !== "image/jpeg" && realMime !== "image/png") {
      return NextResponse.json(
        { error: `File "${file.name}" is not a valid JPG or PNG image.` },
        { status: 400 }
      );
    }
    const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
    validatedFiles.push({ file, buffer, mimeType: realMime, sha256 });
  }

  const jobId = crypto.randomUUID();

  // Reserve credits atomically
  const reservation = await reserveCreditsForJob({
    workspaceId: ctx.workspace.id,
    jobId,
    fileCount: validatedFiles.length,
    idempotencyKey,
  });

  if (!reservation.ok) {
    return NextResponse.json(
      {
        error: `Insufficient credits. Need ${reservation.required}, available ${reservation.balance}.`,
        code: "ERR_INSUFFICIENT_CREDITS",
      },
      { status: 402 }
    );
  }

  await db.insert(schema.signJobs).values({
    id: jobId,
    workspaceId: ctx.workspace.id,
    createdBy: ctx.user.id,
    status: "queued",
    fileCount: validatedFiles.length,
    creditsReserved: reservation.reserved,
    idempotencyKey,
    creatorName,
    creatorWebsite: creatorWebsite || null,
    doNotTrain,
  });

  const dst = mapDigitalSourceType(aiUse);

  for (const vf of validatedFiles) {
    const itemId = crypto.randomUUID();
    const safeName = vf.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const inputKey = `inputs/${ctx.workspace.id}/${jobId}/${itemId}-${safeName}`;
    await putPrivateObject(inputKey, vf.buffer, vf.mimeType);

    await db.insert(schema.signJobItems).values({
      id: itemId,
      jobId,
      originalName: vf.file.name,
      mimeType: vf.mimeType,
      inputKey,
      inputSha256: vf.sha256,
      status: "queued",
    });

    await db.insert(schema.disclosures).values({
      id: crypto.randomUUID(),
      jobItemId: itemId,
      aiUse,
      digitalSourceType: dst,
      modelType: modelType || null,
      modelName: modelName || null,
      declaredBy: creatorName,
    });
  }

  logStructured("info", "sign_job_created", {
    jobId,
    workspaceId: ctx.workspace.id,
    fileCount: validatedFiles.length,
  });

  // Trigger background worker execution
  void processSignJob(jobId).catch((err) => {
    logStructured("error", "sign_job_worker_error", {
      jobId,
      message: err instanceof Error ? err.message : "unknown",
    });
  });

  return NextResponse.json({ jobId }, { status: 202 });
}
