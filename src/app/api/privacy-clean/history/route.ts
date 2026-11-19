import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { getSessionContext } from "@/lib/auth";
import { getWorkspaceBalance } from "@/lib/credits";
import { getEffectivePlanForWorkspace } from "@/lib/plans";
import { buildPrivacyDownloadUrl } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  const [records, balance, plan] = await Promise.all([
    db
      .select()
      .from(schema.mediaProcessingRecords)
      .where(eq(schema.mediaProcessingRecords.workspaceId, ctx.workspace.id))
      .orderBy(desc(schema.mediaProcessingRecords.createdAt))
      .limit(50),
    getWorkspaceBalance(ctx.workspace.id),
    getEffectivePlanForWorkspace(ctx.workspace.id),
  ]);

  const ownerScope = `ws:${ctx.workspace.id}`;
  const now = Date.now();

  const items = records.map((r) => {
    const expired =
      r.status === "expired" ||
      (r.expiresAt ? r.expiresAt.getTime() < now : false);
    const dot = r.originalName.lastIndexOf(".");
    const base = dot > 0 ? r.originalName.slice(0, dot) : r.originalName;
    const ext = dot > 0 ? r.originalName.slice(dot) : "";
    const cleanFileName = `${base}-privacy-cleaned${ext}`;

    return {
      id: r.id,
      originalName: r.originalName,
      mimeType: r.mimeType,
      mediaKind: r.mediaKind,
      fileSizeBytes: r.fileSizeBytes,
      cleanedSizeBytes: r.cleanedSizeBytes,
      width: r.width,
      height: r.height,
      durationMs: r.durationMs,
      codec: r.codec,
      frameRate: r.frameRate,
      status: expired ? "expired" : r.status,
      c2paStatus: r.c2paStatus,
      c2paResultStatus: r.c2paResultStatus,
      c2paIssuer: r.c2paIssuer,
      synthIdStatus: r.synthIdStatus,
      personalMetadataStatus: r.personalMetadataStatus,
      removedFields: Array.isArray(r.removedFields) ? r.removedFields : [],
      thumbnailDataUrl: r.thumbnailDataUrl,
      createdAt: r.createdAt.toISOString(),
      expiresAt: r.expiresAt?.toISOString() || null,
      cleanDownloadUrl:
        !expired && r.status === "done" && r.cleanedKey
          ? buildPrivacyDownloadUrl({
              recordId: r.id,
              kind: "cleaned",
              ownerScope,
              fileName: cleanFileName,
              ttlSeconds: 900,
            })
          : null,
      originalDownloadUrl:
        !expired && r.status === "done" && r.originalKey
          ? buildPrivacyDownloadUrl({
              recordId: r.id,
              kind: "original",
              ownerScope,
              fileName: r.originalName,
              ttlSeconds: 900,
            })
          : null,
    };
  });

  const stats = {
    totalProcessed: records.filter((r) => r.status === "done" || r.status === "expired").length,
    imagesInspected: records.filter((r) => r.mediaKind === "image").length,
    videosInspected: records.filter((r) => r.mediaKind === "video").length,
    privacyCleaned: records.filter((r) => r.personalMetadataStatus === "removed").length,
    remainingCredits: balance,
    planName: plan.name,
  };

  return NextResponse.json({ stats, items });
}
