import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { createWorkspaceApiKey } from "@/lib/api-keys";
import { getSessionContext } from "@/lib/auth";
import { verifySameOrigin } from "@/lib/security";

export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDb();
  const keys = await db
    .select({
      id: schema.apiKeys.id,
      keyPrefix: schema.apiKeys.keyPrefix,
      label: schema.apiKeys.label,
      lastUsedAt: schema.apiKeys.lastUsedAt,
      revokedAt: schema.apiKeys.revokedAt,
      createdAt: schema.apiKeys.createdAt,
    })
    .from(schema.apiKeys)
    .where(eq(schema.apiKeys.workspaceId, ctx.workspace.id))
    .orderBy(desc(schema.apiKeys.createdAt));

  return NextResponse.json({ keys });
}

export async function POST(req: NextRequest) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (ctx.membership.role !== "owner" && ctx.membership.role !== "admin") {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const body = await req.json();

  if (body.action === "revoke" && typeof body.id === "string") {
    const db = await getDb();
    await db
      .update(schema.apiKeys)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(schema.apiKeys.id, body.id),
          eq(schema.apiKeys.workspaceId, ctx.workspace.id)
        )
      );
    return NextResponse.json({ ok: true });
  }

  const label = String(body.label || "API Key").trim();
  const created = await createWorkspaceApiKey(ctx.workspace.id, label);
  return NextResponse.json(created, { status: 201 });
}
