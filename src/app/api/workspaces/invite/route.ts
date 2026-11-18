import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getSessionContext } from "@/lib/auth";
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

  if (body.action === "accept" && typeof body.token === "string") {
    const db = await getDb();
    const invites = await db
      .select()
      .from(schema.workspaceInvites)
      .where(eq(schema.workspaceInvites.token, body.token));

    if (invites.length === 0) {
      return NextResponse.json({ error: "Invite not found" }, { status: 404 });
    }

    const invite = invites[0];
    if (invite.acceptedAt || invite.expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: "Invite expired or already used" }, { status: 400 });
    }

    const existing = await db
      .select()
      .from(schema.memberships)
      .where(
        and(
          eq(schema.memberships.workspaceId, invite.workspaceId),
          eq(schema.memberships.userId, ctx.user.id)
        )
      );

    if (existing.length === 0) {
      await db.insert(schema.memberships).values({
        id: crypto.randomUUID(),
        workspaceId: invite.workspaceId,
        userId: ctx.user.id,
        role: invite.role,
      });
    }

    await db
      .update(schema.workspaceInvites)
      .set({ acceptedAt: new Date() })
      .where(eq(schema.workspaceInvites.id, invite.id));

    return NextResponse.json({ ok: true, workspaceId: invite.workspaceId });
  }

  if (ctx.membership.role !== "owner" && ctx.membership.role !== "admin") {
    return NextResponse.json({ error: "Only owners or admins can invite members" }, { status: 403 });
  }

  const email = String(body.email || "").trim().toLowerCase();
  const role = body.role === "admin" ? "admin" : "member";
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }

  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const db = await getDb();

  await db.insert(schema.workspaceInvites).values({
    id: crypto.randomUUID(),
    workspaceId: ctx.workspace.id,
    email,
    role,
    token,
    expiresAt,
  });

  return NextResponse.json({ token, expiresAt }, { status: 201 });
}
