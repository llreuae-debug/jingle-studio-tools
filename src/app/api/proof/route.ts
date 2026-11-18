import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getSessionContext } from "@/lib/auth";
import { isSigningTestMode } from "@/lib/c2pa-server";
import { verifySameOrigin } from "@/lib/security";

export async function POST(req: NextRequest) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const db = await getDb();

  if (body.action === "revoke" && typeof body.slug === "string") {
    const existing = await db
      .select()
      .from(schema.publicCredentials)
      .where(
        and(
          eq(schema.publicCredentials.slug, body.slug),
          eq(schema.publicCredentials.workspaceId, ctx.workspace.id)
        )
      );

    if (existing.length === 0) {
      return NextResponse.json({ error: "Proof page not found" }, { status: 404 });
    }

    await db
      .update(schema.publicCredentials)
      .set({ status: "revoked", revokedAt: new Date() })
      .where(eq(schema.publicCredentials.id, existing[0].id));

    return NextResponse.json({ ok: true, status: "revoked" });
  }

  const itemId = String(body.itemId || "");
  if (!itemId) {
    return NextResponse.json({ error: "itemId is required" }, { status: 400 });
  }

  const itemRows = await db
    .select({
      itemId: schema.signJobItems.id,
      originalName: schema.signJobItems.originalName,
      status: schema.signJobItems.status,
      workspaceId: schema.signJobs.workspaceId,
      creatorName: schema.signJobs.creatorName,
      createdAt: schema.signJobs.createdAt,
    })
    .from(schema.signJobItems)
    .innerJoin(schema.signJobs, eq(schema.signJobItems.jobId, schema.signJobs.id))
    .where(
      and(
        eq(schema.signJobItems.id, itemId),
        eq(schema.signJobs.workspaceId, ctx.workspace.id)
      )
    );

  if (itemRows.length === 0) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const item = itemRows[0];
  if (item.status !== "done") {
    return NextResponse.json({ error: "Only signed items can be published" }, { status: 400 });
  }

  const existingProof = await db
    .select()
    .from(schema.publicCredentials)
    .where(eq(schema.publicCredentials.jobItemId, item.itemId));

  if (existingProof.length > 0) {
    return NextResponse.json({ slug: existingProof[0].slug, status: existingProof[0].status });
  }

  const discRows = await db
    .select()
    .from(schema.disclosures)
    .where(eq(schema.disclosures.jobItemId, item.itemId));
  const disc = discRows[0];

  const slug = crypto.randomBytes(6).toString("hex");
  const signer = isSigningTestMode()
    ? "Jingle Studio Dev Test Signer"
    : "Jingle Studio";

  const disclosureSummary = disc
    ? `${disc.aiUse} (${disc.digitalSourceType})${disc.modelName ? ` — ${disc.modelName}` : ""} [Self-declared]`
    : "Self-declared";

  await db.insert(schema.publicCredentials).values({
    id: crypto.randomUUID(),
    jobItemId: item.itemId,
    workspaceId: ctx.workspace.id,
    slug,
    status: "live",
    title: item.originalName,
    thumbnailDataUrl: typeof body.thumbnailDataUrl === "string" ? body.thumbnailDataUrl.slice(0, 60000) : null,
    signer,
    creatorName: item.creatorName,
    disclosureSummary,
    signingTimeIso: item.createdAt.toISOString(),
  });

  return NextResponse.json({ slug, status: "live" }, { status: 201 });
}
