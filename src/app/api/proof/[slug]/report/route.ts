import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifySameOrigin } from "@/lib/security";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
  const rl = checkRateLimit(`report:${ip}`, 10, 10 * 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many reports submitted. Please try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  const { slug } = await context.params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }
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
