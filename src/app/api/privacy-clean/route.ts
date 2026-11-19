import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { getExtension, validateMediaFile } from "@/lib/media-metadata";
import {
  cleanMediaPrivacy,
  DEFAULT_CLEAN_OPTIONS,
  type PrivacyCleanOptions,
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
        error: `Daily processing limit (${daily.limit} files) reached on the ${actor.plan.name} plan.`,
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
        { error: "Invalid uploadId supplied." },
        { status: 400 }
      );
    }

    const metaRaw = await getPrivateObject(`chunks/${uploadId}/meta.json`);
    if (!metaRaw) {
      return NextResponse.json(
        { error: "Upload session expired or not found." },
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
          { error: `Missing upload chunk ${i + 1} of ${meta.totalChunks}. Please retry.` },
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
        { error: "Invalid multipart form request." },
        { status: 400 }
      );
    }
    const fileField = fd.get("file");
    if (!(fileField instanceof Blob)) {
      return NextResponse.json({ error: "No media file uploaded." }, { status: 400 });
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

    const res = NextResponse.json(
      { error: validation.error, code: validation.code },
      { status: validation.statusCode }
    );
    return attachPrivacyCookie(res, actor, req);
  }

  try {
    const cleaned = await cleanMediaPrivacy({
      buffer: fileBuffer,
      fileName,
      mimeType: validation.mimeType,
      options,
    });

    const ext = getExtension(fileName) || `.${cleaned.beforeMetadata.format.toLowerCase()}`;
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
      synthIdStatus: cleaned.synthId.status,
      personalMetadataStatus: cleaned.personalMetadataStatus,
      removedFields: cleaned.removedFields,
      beforeMetadata: cleaned.beforeMetadata,
      afterMetadata: cleaned.afterMetadata,
      cleaningOptions: options,
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
      message: `Processed ${fileName} (${cleaned.mimeType})`,
      metadata: {
        recordId,
        personalMetadataStatus: cleaned.personalMetadataStatus,
        c2paResultStatus: cleaned.c2paResultStatus,
        removedCount: cleaned.removedFields.length,
      },
    });

    // Opportunistic expired-file purge
    void purgeExpiredPrivacyFiles();

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

    const res = NextResponse.json({
      ok: true,
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
      removedFields: cleaned.removedFields,
      preservedOriginalBytes: cleaned.preservedOriginalBytes,
      beforeMetadata: cleaned.beforeMetadata,
      afterMetadata: cleaned.afterMetadata,
      cleanDownloadUrl,
      originalDownloadUrl,
      expiresAt: expiresAt.toISOString(),
    });
    return attachPrivacyCookie(res, actor, req);
  } catch (err) {
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
      metadata: { recordId, fileName },
    });

    const res = NextResponse.json(
      { error: errMsg, code: "ERR_PROCESSING_FAILED" },
      { status: 500 }
    );
    return attachPrivacyCookie(res, actor, req);
  }
}
