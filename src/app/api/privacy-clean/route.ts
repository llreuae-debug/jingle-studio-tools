import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { getExtension, validateMediaFile } from "@/lib/media-metadata";
import {
  cleanMediaPrivacy,
  DEFAULT_CLEAN_OPTIONS,
  ImageValidationError,
  type PrivacyCleanOptions,
  type ProcessingStageUpdate,
} from "@/lib/privacy-cleaner";
import {
  attachPrivacyCookie,
  checkDailyPlanLimit,
  generateSafeImageThumbnail,
  resolvePrivacyActor,
} from "@/lib/privacy-session";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifySameOrigin } from "@/lib/security";
import {
  buildPrivacyDownloadUrl,
  deletePrivateObject,
  getPrivateObject,
  purgeExpiredPrivacyFiles,
  putPrivateObject,
} from "@/lib/storage";
import { recordSystemLog } from "@/lib/system-logs";

export const runtime = "nodejs";

function parseCleanOptions(raw: unknown): PrivacyCleanOptions {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_CLEAN_OPTIONS };
  const obj = raw as Record<string, unknown>;
  return {
    removeGps: obj.removeGps !== false,
    removeCameraInfo: obj.removeCameraInfo !== false,
    removeExif: obj.removeExif !== false,
    removePersonalMetadata: obj.removePersonalMetadata !== false,
    preserveQuality: obj.preserveQuality !== false,
    preserveC2pa: true,
  };
}

export async function POST(req: NextRequest) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const startedAt = Date.now();
  const actor = await resolvePrivacyActor(req);
  const rl = checkRateLimit(`privacy:${actor.ownerScope}`, 30, 60_000);
  if (!rl.allowed) {
    const res = NextResponse.json(
      { error: "Rate limit exceeded. Please wait before submitting another file." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
    return attachPrivacyCookie(res, actor, req);
  }

  const daily = await checkDailyPlanLimit(actor);
  if (!daily.allowed) {
    const res = NextResponse.json(
      {
        error: `Daily processing limit (${daily.limit} files) reached on the ${actor.plan.name} plan.${
          !actor.isAuthenticated
            ? " Create a free account to increase your daily limit to 20 files."
            : ""
        }`,
        code: "ERR_DAILY_LIMIT",
      },
      { status: 429 }
    );
    return attachPrivacyCookie(res, actor, req);
  }

  let fileName = "upload.bin";
  let declaredMime = "";
  let fileBuffer: Buffer | null = null;
  let options: PrivacyCleanOptions = { ...DEFAULT_CLEAN_OPTIONS };

  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = await req.json().catch(() => null);
    const uploadId =
      typeof body?.uploadId === "string" ? body.uploadId.trim() : "";
    if (!/^[0-9a-f-]{36}$/i.test(uploadId)) {
      return NextResponse.json(
        { error: "Invalid uploadId supplied.", code: "ERR_INVALID_UPLOAD_ID" },
        { status: 400 }
      );
    }

    const metaRaw = await getPrivateObject(`chunks/${uploadId}/meta.json`);
    if (!metaRaw) {
      return NextResponse.json(
        { error: "Upload session expired or not found.", code: "ERR_UPLOAD_EXPIRED" },
        { status: 404 }
      );
    }

    const meta = JSON.parse(metaRaw.toString("utf8")) as {
      ownerScope: string;
      fileName: string;
      mimeType: string;
      totalChunks: number;
    };
    if (meta.ownerScope !== actor.ownerScope) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    fileName = meta.fileName;
    declaredMime = meta.mimeType;
    options = parseCleanOptions(body?.options);

    const chunkBufs: Buffer[] = [];
    for (let i = 0; i < meta.totalChunks; i++) {
      const part = await getPrivateObject(`chunks/${uploadId}/${i}.part`);
      if (!part) {
        return NextResponse.json(
          {
            error: `Missing upload chunk ${i + 1} of ${meta.totalChunks}. Please retry.`,
            code: "ERR_MISSING_CHUNK",
          },
          { status: 400 }
        );
      }
      chunkBufs.push(part);
    }
    fileBuffer = Buffer.concat(chunkBufs);

    // Clean up temporary upload chunks promptly
    await deletePrivateObject(`chunks/${uploadId}/meta.json`);
    for (let i = 0; i < meta.totalChunks; i++) {
      await deletePrivateObject(`chunks/${uploadId}/${i}.part`);
    }
  } else {
    const fd = await req.formData().catch(() => null);
    if (!fd) {
      return NextResponse.json(
        { error: "Invalid multipart form request.", code: "ERR_INVALID_FORM" },
        { status: 400 }
      );
    }
    const fileField = fd.get("file");
    if (!(fileField instanceof Blob)) {
      return NextResponse.json(
        { error: "No media file uploaded.", code: "ERR_NO_FILE" },
        { status: 400 }
      );
    }
    fileName =
      fileField instanceof File && fileField.name ? fileField.name : "media-file";
    declaredMime = fileField.type || "";
    fileBuffer = Buffer.from(await fileField.arrayBuffer());

    const rawOpts = fd.get("options");
    if (typeof rawOpts === "string" && rawOpts.trim()) {
      try {
        options = parseCleanOptions(JSON.parse(rawOpts));
      } catch {
        options = { ...DEFAULT_CLEAN_OPTIONS };
      }
    }
  }

  const maxImageBytes = actor.plan.maxImageMb * 1024 * 1024;
  const maxVideoBytes = actor.plan.maxVideoMb * 1024 * 1024;

  const db = await getDb();
  const recordId = crypto.randomUUID();
  const validation = validateMediaFile({
    buffer: fileBuffer,
    fileName,
    declaredMime,
    maxImageBytes,
    maxVideoBytes,
  });

  if (!validation.ok) {
    await db
      .insert(schema.mediaProcessingRecords)
      .values({
        id: recordId,
        workspaceId: actor.workspaceId,
        userId: actor.userId,
        ownerTokenHash: actor.ownerTokenHash,
        originalName: fileName,
        mimeType: declaredMime || "application/octet-stream",
        mediaKind: (declaredMime || "").startsWith("video/") ? "video" : "image",
        fileSizeBytes: fileBuffer.length,
        status: "failed",
        errorMessage: validation.error,
        cleaningOptions: options,
      })
      .catch(() => {});

    await recordSystemLog({
      level: "warn",
      event: "privacy_clean_validation_failed",
      userId: actor.userId,
      message: validation.error,
      metadata: { code: validation.code, fileName },
    });

    const errMsg =
      !actor.isAuthenticated && validation.code === "ERR_FILE_TOO_LARGE"
        ? `${validation.error} Sign up free to upload larger files (up to 25 MB images / 100 MB videos).`
        : validation.error;

    const res = NextResponse.json(
      { error: errMsg, code: validation.code },
      { status: validation.statusCode }
    );
    return attachPrivacyCookie(res, actor, req);
  }

  const uploadStage: ProcessingStageUpdate = {
    step: 1,
    key: "uploaded",
    label: "File uploaded",
    status: "completed",
    detail: `${fileBuffer.length} bytes received`,
    durationMs: Date.now() - startedAt,
    timestamp: new Date().toISOString(),
  };

  const executePipeline = async (
    onStage?: (stage: ProcessingStageUpdate) => void
  ) => {
    onStage?.(uploadStage);

    const cleaned = await cleanMediaPrivacy({
      buffer: fileBuffer,
      fileName,
      mimeType: validation.mimeType,
      options,
      onStage,
      signal: req.signal,
      initialStages: [uploadStage],
    });

    const stage10Start = Date.now();
    const prepRunning: ProcessingStageUpdate = {
      step: 10,
      key: "download_prepared",
      label: "Download prepared",
      status: "running",
      timestamp: new Date().toISOString(),
    };
    onStage?.(prepRunning);

    const ext =
      getExtension(fileName) || `.${cleaned.beforeMetadata.format.toLowerCase()}`;
    const originalKey = `privacy/${recordId}/original${ext}`;
    const cleanedKey = `privacy/${recordId}/cleaned${ext}`;

    await Promise.all([
      putPrivateObject(originalKey, fileBuffer, validation.mimeType),
      putPrivateObject(cleanedKey, cleaned.cleanedBuffer, validation.mimeType),
    ]);

    const thumbnailDataUrl = await generateSafeImageThumbnail(
      cleaned.cleanedBuffer,
      validation.mimeType
    );

    const ttlHours = actor.isAuthenticated ? 7 * 24 : 24;
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

    const baseName = fileName.includes(".")
      ? fileName.slice(0, fileName.lastIndexOf("."))
      : fileName;
    const cleanFileName = `${baseName}-privacy-cleaned${ext}`;

    const cleanDownloadUrl = buildPrivacyDownloadUrl({
      recordId,
      kind: "cleaned",
      ownerScope: actor.ownerScope,
      fileName: cleanFileName,
      ttlSeconds: 900,
    });
    const originalDownloadUrl = buildPrivacyDownloadUrl({
      recordId,
      kind: "original",
      ownerScope: actor.ownerScope,
      fileName,
      ttlSeconds: 900,
    });

    const totalMs = Date.now() - startedAt;
    const prepDone: ProcessingStageUpdate = {
      step: 10,
      key: "download_prepared",
      label: "Download prepared",
      status: "completed",
      detail: `Signed download ready (${ttlHours}h retention)`,
      durationMs: Date.now() - stage10Start,
      timestamp: new Date().toISOString(),
    };
    const allStages = [...cleaned.stages, prepDone];
    onStage?.(prepDone);

    await db.insert(schema.mediaProcessingRecords).values({
      id: recordId,
      workspaceId: actor.workspaceId,
      userId: actor.userId,
      ownerTokenHash: actor.ownerTokenHash,
      originalName: fileName,
      mimeType: validation.mimeType,
      mediaKind: cleaned.mediaKind,
      fileSizeBytes: fileBuffer.length,
      cleanedSizeBytes: cleaned.cleanedBuffer.length,
      width: cleaned.afterMetadata.width ?? null,
      height: cleaned.afterMetadata.height ?? null,
      durationMs:
        cleaned.afterMetadata.durationSec !== undefined
          ? Math.round(cleaned.afterMetadata.durationSec * 1000)
          : null,
      codec: cleaned.afterMetadata.codec ?? null,
      frameRate: cleaned.afterMetadata.frameRate ?? null,
      status: "done",
      c2paStatus: cleaned.c2pa.status,
      c2paResultStatus: cleaned.c2paResultStatus,
      c2paIssuer: cleaned.c2pa.issuer,
      c2paCredentialStatus: cleaned.c2pa.credentialStatus,
      synthIdStatus: cleaned.synthId.status,
      synthIdProvider: cleaned.synthId.provider,
      synthIdDetail: cleaned.synthId.explanation,
      personalMetadataStatus: cleaned.personalMetadataStatus,
      removedFields: cleaned.removedFields,
      beforeMetadata: cleaned.beforeMetadata,
      afterMetadata: cleaned.afterMetadata,
      cleaningOptions: options,
      processingTimeMs: totalMs,
      processingStages: allStages,
      originalKey,
      cleanedKey,
      thumbnailDataUrl,
      inputSha256: cleaned.inputSha256,
      outputSha256: cleaned.outputSha256,
      expiresAt,
      completedAt: new Date(),
    });

    await recordSystemLog({
      level: "info",
      event: "privacy_clean_completed",
      userId: actor.userId,
      message: `Processed ${fileName} (${cleaned.mimeType}) in ${totalMs}ms`,
      metadata: {
        recordId,
        personalMetadataStatus: cleaned.personalMetadataStatus,
        c2paResultStatus: cleaned.c2paResultStatus,
        synthIdStatus: cleaned.synthId.status,
        removedCount: cleaned.removedFields.length,
        processingTimeMs: totalMs,
      },
    });

    // Opportunistic expired-file and stale chunk purge
    void purgeExpiredPrivacyFiles();

    return {
      ok: true as const,
      recordId,
      fileName,
      cleanFileName,
      mimeType: cleaned.mimeType,
      mediaKind: cleaned.mediaKind,
      fileSizeBytes: fileBuffer.length,
      cleanedSizeBytes: cleaned.cleanedBuffer.length,
      inputSha256: cleaned.inputSha256,
      outputSha256: cleaned.outputSha256,
      c2pa: cleaned.c2pa,
      c2paResultStatus: cleaned.c2paResultStatus,
      c2paNotice: cleaned.c2paNotice,
      synthId: cleaned.synthId,
      personalMetadataStatus: cleaned.personalMetadataStatus,
      personalMetadataLabel: cleaned.personalMetadataLabel,
      removedFields: cleaned.removedFields,
      preservedOriginalBytes: cleaned.preservedOriginalBytes,
      outputVerified: cleaned.outputVerified,
      dimensionsPreserved: cleaned.dimensionsPreserved,
      processingTimeMs: totalMs,
      stages: allStages,
      beforeMetadata: cleaned.beforeMetadata,
      afterMetadata: cleaned.afterMetadata,
      cleanDownloadUrl,
      originalDownloadUrl,
      expiresAt: expiresAt.toISOString(),
      isAuthenticated: actor.isAuthenticated,
      recordUrl: actor.isAuthenticated ? `/app/media/${recordId}` : null,
    };
  };

  const recordPipelineFailure = async (err: unknown) => {
    const isAbort =
      req.signal.aborted ||
      (err instanceof Error && err.name === "AbortError");
    if (isAbort) {
      await recordSystemLog({
        level: "info",
        event: "privacy_clean_cancelled",
        userId: actor.userId,
        message: `Cancelled processing for ${fileName}`,
        metadata: { recordId, fileName },
      });
      return {
        isAbort: true,
        statusCode: 499,
        code: "ERR_CANCELLED",
        error: "Processing cancelled.",
      };
    }

    const statusCode =
      err instanceof ImageValidationError ? err.statusCode : 500;
    const code =
      err instanceof ImageValidationError ? err.code : "ERR_PROCESSING_FAILED";
    const errMsg =
      err instanceof Error ? err.message : "Failed to process media file.";

    await db
      .insert(schema.mediaProcessingRecords)
      .values({
        id: recordId,
        workspaceId: actor.workspaceId,
        userId: actor.userId,
        ownerTokenHash: actor.ownerTokenHash,
        originalName: fileName,
        mimeType: validation.mimeType,
        mediaKind: validation.mediaKind,
        fileSizeBytes: fileBuffer.length,
        status: "failed",
        errorMessage: errMsg,
        cleaningOptions: options,
      })
      .catch(() => {});

    await recordSystemLog({
      level: "error",
      event: "privacy_clean_failed",
      userId: actor.userId,
      message: errMsg,
      metadata: { recordId, fileName, code },
    });

    return { isAbort: false, statusCode, code, error: errMsg };
  };

  const wantsStream =
    req.headers.get("accept")?.includes("application/x-ndjson") ?? false;

  if (wantsStream) {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (payload: unknown) => {
          if (req.signal.aborted) return;
          try {
            controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
          } catch {
            // Stream already closed by client abort
          }
        };

        try {
          const resultPayload = await executePipeline((stage) => {
            send({ type: "stage", stage });
          });
          send({ type: "result", data: resultPayload });
        } catch (err) {
          const info = await recordPipelineFailure(err);
          if (!info.isAbort) {
            send({
              type: "error",
              statusCode: info.statusCode,
              code: info.code,
              error: info.error,
            });
          }
        } finally {
          try {
            controller.close();
          } catch {
            // already closed
          }
        }
      },
    });

    const res = new NextResponse(stream, {
      status: 200,
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store, no-transform",
        "X-Content-Type-Options": "nosniff",
      },
    });
    return attachPrivacyCookie(res, actor, req);
  }

  try {
    const resultPayload = await executePipeline();
    const res = NextResponse.json(resultPayload);
    return attachPrivacyCookie(res, actor, req);
  } catch (err) {
    const info = await recordPipelineFailure(err);
    const res = NextResponse.json(
      { error: info.error, code: info.code },
      { status: info.statusCode === 499 ? 400 : info.statusCode }
    );
    return attachPrivacyCookie(res, actor, req);
  }
}
