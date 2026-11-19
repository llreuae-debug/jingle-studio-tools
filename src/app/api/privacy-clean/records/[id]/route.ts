import { eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { attachPrivacyCookie, resolvePrivacyActor } from "@/lib/privacy-session";
import { buildPrivacyDownloadUrl } from "@/lib/storage";

export const runtime = "nodejs";

function labelForMetadataStatus(
  status: string
): "Cleaned" | "Already Clean" | "Not Processed" {
  if (status === "removed") return "Cleaned";
  if (status === "preserved") return "Not Processed";
  return "Already Clean";
}

function labelForSynthIdStatus(status: string): string {
  if (status === "verified_no_signal") return "Verified No Detectable SynthID Signal";
  if (status === "signal_detected") return "Signal Detected";
  if (status === "inconclusive") return "Inconclusive";
  return "Verification Unavailable";
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid record ID" }, { status: 400 });
  }

  const actor = await resolvePrivacyActor(req);
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.mediaProcessingRecords)
    .where(eq(schema.mediaProcessingRecords.id, id));

  if (rows.length === 0) {
    return NextResponse.json({ error: "Record not found" }, { status: 404 });
  }

  const rec = rows[0];
  const ownsWorkspace = Boolean(
    rec.workspaceId && actor.workspaceId && rec.workspaceId === actor.workspaceId
  );
  const ownsGuest = Boolean(
    rec.ownerTokenHash &&
      actor.ownerTokenHash &&
      rec.ownerTokenHash === actor.ownerTokenHash
  );
  if (!ownsWorkspace && !ownsGuest) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const dlCountRows = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(schema.mediaDownloadRecords)
    .where(eq(schema.mediaDownloadRecords.recordId, rec.id));
  const downloadCount = Number(dlCountRows[0]?.count ?? 0);

  const expired =
    rec.status === "expired" ||
    (rec.expiresAt ? rec.expiresAt.getTime() < Date.now() : false);

  const dot = rec.originalName.lastIndexOf(".");
  const base = dot > 0 ? rec.originalName.slice(0, dot) : rec.originalName;
  const ext = dot > 0 ? rec.originalName.slice(dot) : "";
  const cleanFileName = `${base}-privacy-cleaned${ext}`;

  const cleanDownloadUrl =
    !expired && rec.status === "done" && rec.cleanedKey
      ? buildPrivacyDownloadUrl({
          recordId: rec.id,
          kind: "cleaned",
          ownerScope: actor.ownerScope,
          fileName: cleanFileName,
          ttlSeconds: 900,
        })
      : null;

  const originalDownloadUrl =
    !expired && rec.status === "done" && rec.originalKey
      ? buildPrivacyDownloadUrl({
          recordId: rec.id,
          kind: "original",
          ownerScope: actor.ownerScope,
          fileName: rec.originalName,
          ttlSeconds: 900,
        })
      : null;

  const res = NextResponse.json({
    ok: true,
    record: {
      id: rec.id,
      originalName: rec.originalName,
      cleanFileName,
      mimeType: rec.mimeType,
      mediaKind: rec.mediaKind,
      fileSizeBytes: rec.fileSizeBytes,
      cleanedSizeBytes: rec.cleanedSizeBytes,
      width: rec.width,
      height: rec.height,
      status: expired ? "expired" : rec.status,
      inputSha256: rec.inputSha256,
      outputSha256: rec.outputSha256,
      c2pa: {
        status: rec.c2paStatus,
        resultStatus: rec.c2paResultStatus,
        issuer: rec.c2paIssuer,
        credentialStatus:
          rec.c2paCredentialStatus ||
          (rec.c2paStatus === "not_detected" ? "Not detected" : "Unable to verify"),
      },
      synthId: {
        status: rec.synthIdStatus,
        label: labelForSynthIdStatus(rec.synthIdStatus),
        available: rec.synthIdStatus !== "verification_unavailable",
        provider: rec.synthIdProvider ?? null,
        explanation:
          rec.synthIdDetail ||
          "SynthID verification unavailable unless a supported external detector is configured.",
        originalSignalModified: false,
      },
      personalMetadataStatus: rec.personalMetadataStatus,
      personalMetadataLabel: labelForMetadataStatus(rec.personalMetadataStatus),
      removedFields: Array.isArray(rec.removedFields) ? rec.removedFields : [],
      beforeMetadata: rec.beforeMetadata,
      afterMetadata: rec.afterMetadata,
      processingTimeMs: rec.processingTimeMs,
      stages: Array.isArray(rec.processingStages) ? rec.processingStages : [],
      thumbnailDataUrl: rec.thumbnailDataUrl,
      downloadCount,
      cleanDownloadUrl,
      originalDownloadUrl,
      createdAt: rec.createdAt.toISOString(),
      expiresAt: rec.expiresAt?.toISOString() ?? null,
    },
  });

  return attachPrivacyCookie(res, actor, req);
}
