import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { ALLOWED_EXTENSIONS, getExtension } from "@/lib/media-metadata";
import { attachPrivacyCookie, resolvePrivacyActor } from "@/lib/privacy-session";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifySameOrigin } from "@/lib/security";
import { putPrivateObject } from "@/lib/storage";

export const runtime = "nodejs";

const CHUNK_SIZE = 2 * 1024 * 1024; // 2 MB

export async function POST(req: NextRequest) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const actor = await resolvePrivacyActor(req);
  const rl = checkRateLimit(`upload-init:${actor.ownerScope}`, 30, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many upload requests. Please retry shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  const body = await req.json().catch(() => null);
  const fileName = typeof body?.fileName === "string" ? body.fileName.trim() : "";
  const mimeType = typeof body?.mimeType === "string" ? body.mimeType.trim() : "";
  const fileSizeBytes = Number(body?.fileSizeBytes);

  if (!fileName || !Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0) {
    return NextResponse.json(
      { error: "Invalid file metadata for upload initialization." },
      { status: 400 }
    );
  }

  const ext = getExtension(fileName);
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return NextResponse.json(
      {
        error: `Unsupported extension "${ext || "none"}". Allowed: PNG, JPG, JPEG, WEBP, MP4, MOV, WEBM.`,
      },
      { status: 400 }
    );
  }

  const isVideo = [".mp4", ".mov", ".webm"].includes(ext) || mimeType.startsWith("video/");
  const maxBytes = (isVideo ? actor.plan.maxVideoMb : actor.plan.maxImageMb) * 1024 * 1024;
  if (fileSizeBytes > maxBytes) {
    return NextResponse.json(
      {
        error: `File exceeds ${isVideo ? actor.plan.maxVideoMb : actor.plan.maxImageMb} MB limit for your plan.`,
      },
      { status: 413 }
    );
  }

  const uploadId = crypto.randomUUID();
  const totalChunks = Math.max(1, Math.ceil(fileSizeBytes / CHUNK_SIZE));
  await putPrivateObject(
    `chunks/${uploadId}/meta.json`,
    Buffer.from(
      JSON.stringify({
        ownerScope: actor.ownerScope,
        fileName,
        mimeType,
        fileSizeBytes,
        totalChunks,
        createdAt: Date.now(),
      }),
      "utf8"
    ),
    "application/json"
  );

  const res = NextResponse.json({
    ok: true,
    uploadId,
    chunkSize: CHUNK_SIZE,
    totalChunks,
  });
  return attachPrivacyCookie(res, actor, req);
}
