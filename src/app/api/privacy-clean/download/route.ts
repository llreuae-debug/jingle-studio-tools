import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { resolvePrivacyActor } from "@/lib/privacy-session";
import {
  deletePrivateObject,
  getPrivateObject,
  verifyPrivacyDownloadToken,
} from "@/lib/storage";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json(
      { error: "Missing download token", code: "ERR_MISSING_TOKEN" },
      { status: 400 }
    );
  }

  const payload = verifyPrivacyDownloadToken(token);
  if (!payload) {
    return NextResponse.json(
      {
        error: "Download link has expired or is invalid. Please refresh the download link.",
        code: "ERR_LINK_EXPIRED",
      },
      { status: 403 }
    );
  }

  const actor = await resolvePrivacyActor(req);
  if (actor.ownerScope !== payload.ownerScope) {
    return NextResponse.json(
      { error: "Forbidden", code: "ERR_FORBIDDEN" },
      { status: 403 }
    );
  }

  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.mediaProcessingRecords)
    .where(eq(schema.mediaProcessingRecords.id, payload.recordId));

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "Record not found", code: "ERR_NOT_FOUND" },
      { status: 404 }
    );
  }

  const rec = rows[0];
  if (
    rec.status === "expired" ||
    (rec.expiresAt && rec.expiresAt.getTime() < Date.now())
  ) {
    if (rec.originalKey) await deletePrivateObject(rec.originalKey);
    if (rec.cleanedKey) await deletePrivateObject(rec.cleanedKey);
    await db
      .update(schema.mediaProcessingRecords)
      .set({ status: "expired", originalKey: null, cleanedKey: null })
      .where(eq(schema.mediaProcessingRecords.id, rec.id));
    return NextResponse.json(
      {
        error: "Processed file has expired and was deleted.",
        code: "ERR_FILE_EXPIRED",
      },
      { status: 410 }
    );
  }

  const storageKey =
    payload.kind === "original" ? rec.originalKey : rec.cleanedKey;
  if (!storageKey) {
    return NextResponse.json(
      { error: "File is no longer available", code: "ERR_NOT_FOUND" },
      { status: 404 }
    );
  }

  const fileBuf = await getPrivateObject(storageKey);
  if (!fileBuf || fileBuf.length === 0) {
    return NextResponse.json(
      { error: "File not found or empty in storage", code: "ERR_STORAGE_MISSING" },
      { status: 404 }
    );
  }

  const safeName = payload.fileName.replace(/["\r\n]/g, "");

  await db
    .insert(schema.mediaDownloadRecords)
    .values({
      id: crypto.randomUUID(),
      recordId: rec.id,
      workspaceId: actor.workspaceId,
      userId: actor.userId,
      ownerScope: actor.ownerScope,
      kind: payload.kind,
      fileName: safeName,
      bytesSent: fileBuf.length,
    })
    .catch(() => {});

  return new NextResponse(new Uint8Array(fileBuf), {
    status: 200,
    headers: {
      "Content-Type": rec.mimeType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${safeName}"`,
      "Content-Length": String(fileBuf.length),
      "Cache-Control": "private, no-store",
    },
  });
}
