import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { applyPurchaseCredits } from "@/lib/credits";
import { verifyWebhookSignature } from "@/lib/payments";
import { logStructured } from "@/lib/security";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const sig = req.headers.get("x-webhook-signature");

  if (!verifyWebhookSignature(rawBody, sig)) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  let payload: { providerRef?: string; status?: string };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!payload.providerRef) {
    return NextResponse.json({ error: "Missing providerRef" }, { status: 400 });
  }

  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.purchases)
    .where(eq(schema.purchases.providerRef, payload.providerRef));

  if (rows.length === 0) {
    return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
  }

  const purchase = rows[0];

  if (payload.status === "paid" || payload.status === "completed") {
    const credited = await applyPurchaseCredits({
      workspaceId: purchase.workspaceId,
      purchaseId: purchase.id,
      credits: purchase.credits,
    });
    logStructured("info", "payment_webhook_processed", {
      purchaseId: purchase.id,
      credited,
    });
    return NextResponse.json({ ok: true, credited });
  }

  if (payload.status === "failed") {
    await db
      .update(schema.purchases)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(schema.purchases.id, purchase.id));
  }

  return NextResponse.json({ ok: true, credited: false });
}
