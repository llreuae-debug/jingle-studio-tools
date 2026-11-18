import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getSessionContext } from "@/lib/auth";
import { getPrivateDownloadUrl } from "@/lib/storage";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const db = await getDb();

  const jobs = await db
    .select()
    .from(schema.signJobs)
    .where(
      and(
        eq(schema.signJobs.id, id),
        eq(schema.signJobs.workspaceId, ctx.workspace.id)
      )
    );

  if (jobs.length === 0) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const job = jobs[0];
  const items = await db
    .select()
    .from(schema.signJobItems)
    .where(eq(schema.signJobItems.jobId, job.id));

  const enrichedItems = await Promise.all(
    items.map(async (item) => {
      const isExpired =
        item.status === "expired" ||
        (item.expiresAt ? item.expiresAt.getTime() < Date.now() : false);

      let downloadUrl: string | null = null;
      if (item.status === "done" && item.outputKey && !isExpired) {
        downloadUrl = await getPrivateDownloadUrl(
          item.outputKey,
          ctx.workspace.id,
          `signed-${item.originalName}`
        );
      }

      const proofRows = await db
        .select({ slug: schema.publicCredentials.slug, status: schema.publicCredentials.status })
        .from(schema.publicCredentials)
        .where(eq(schema.publicCredentials.jobItemId, item.id));

      return {
        id: item.id,
        originalName: item.originalName,
        mimeType: item.mimeType,
        status: isExpired && item.status === "done" ? "expired" : item.status,
        errorCode: item.errorCode,
        errorMessage: item.errorMessage,
        expiresAt: item.expiresAt,
        downloadUrl,
        publicProof: proofRows[0] || null,
      };
    })
  );

  return NextResponse.json({ job, items: enrichedItems });
}
