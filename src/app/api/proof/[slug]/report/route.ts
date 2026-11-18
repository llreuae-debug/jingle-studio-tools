import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const body = await req.json();
  const reason = String(body.reason || "").trim();
  const details = typeof body.details === "string" ? body.details.trim() : null;
  const reporterEmail =
    typeof body.reporterEmail === "string" ? body.reporterEmail.trim() : null;

  if (!reason) {
    return NextResponse.json({ error: "Reason is required" }, { status: 400 });
  }

  const db = await getDb();
  const proofs = await db
    .select()
    .from(schema.publicCredentials)
    .where(eq(schema.publicCredentials.slug, slug));

  if (proofs.length === 0) {
    return NextResponse.json({ error: "Proof page not found" }, { status: 404 });
  }

  await db.insert(schema.abuseReports).values({
    id: crypto.randomUUID(),
    publicCredentialId: proofs[0].id,
    reason,
    details,
    reporterEmail,
    status: "open",
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
