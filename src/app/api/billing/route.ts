import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getSessionContext } from "@/lib/auth";
import { CREDIT_PACKS, getWorkspaceBalance } from "@/lib/credits";
import { getPaymentProvider } from "@/lib/payments";
import { verifySameOrigin } from "@/lib/security";

export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  const balance = await getWorkspaceBalance(ctx.workspace.id);

  const purchases = await db
    .select()
    .from(schema.purchases)
    .where(eq(schema.purchases.workspaceId, ctx.workspace.id))
    .orderBy(desc(schema.purchases.createdAt))
    .limit(50);

  const ledger = await db
    .select()
    .from(schema.creditLedgerEntries)
    .where(eq(schema.creditLedgerEntries.workspaceId, ctx.workspace.id))
    .orderBy(desc(schema.creditLedgerEntries.createdAt))
    .limit(100);

  return NextResponse.json({
    balance,
    packs: CREDIT_PACKS,
    purchases,
    ledger,
  });
}

export async function POST(req: NextRequest) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }
  const packId = String(body.packId || "");
  const method = body.method === "hosted" ? "hosted" : "manual_bank";
  const bankReference = typeof body.bankReference === "string" ? body.bankReference.trim() : null;

  const pack = CREDIT_PACKS.find((p) => p.id === packId);
  if (!pack) {
    return NextResponse.json({ error: "Invalid credit pack" }, { status: 400 });
  }

  const provider = getPaymentProvider(method);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const session = await provider.createCheckout({
    workspaceId: ctx.workspace.id,
    pack,
    successUrl: `${appUrl}/app/billing`,
    cancelUrl: `${appUrl}/app/billing`,
  });

  const db = await getDb();
  const purchaseId = crypto.randomUUID();
  await db.insert(schema.purchases).values({
    id: purchaseId,
    workspaceId: ctx.workspace.id,
    provider: session.provider,
    providerRef: session.providerRef,
    packId: pack.id,
    amountCents: pack.amountCents,
    currency: pack.currency,
    credits: pack.credits,
    status: "pending",
    bankReference: bankReference || session.bankInstructions?.referenceCode || null,
  });

  return NextResponse.json(
    {
      purchaseId,
      providerRef: session.providerRef,
      checkoutUrl: session.checkoutUrl,
      bankInstructions: session.bankInstructions,
    },
    { status: 201 }
  );
}
