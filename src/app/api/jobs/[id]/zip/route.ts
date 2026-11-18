import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import JSZip from "jszip";
import { getDb, schema } from "@/db";
import { getSessionContext } from "@/lib/auth";
import { getPrivateObject } from "@/lib/storage";

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

  const items = await db
    .select()
    .from(schema.signJobItems)
    .where(eq(schema.signJobItems.jobId, id));

  const zip = new JSZip();
  let added = 0;

  for (const item of items) {
    if (item.status !== "done" || !item.outputKey) continue;
    if (item.expiresAt && item.expiresAt.getTime() < Date.now()) continue;
    const buf = await getPrivateObject(item.outputKey);
    if (buf) {
      zip.file(`signed-${item.originalName}`, buf);
      added++;
    }
  }

  if (added === 0) {
    return NextResponse.json(
      { error: "No downloadable signed files available for this job." },
      { status: 404 }
    );
  }

  const zipBuf = await zip.generateAsync({ type: "nodebuffer" });
  return new NextResponse(new Uint8Array(zipBuf), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="signed-batch-${id.slice(0, 8)}.zip"`,
      "Cache-Control": "private, no-store",
    },
  });
}
