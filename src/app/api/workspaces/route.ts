import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getSessionContext } from "@/lib/auth";
import { getWorkspaceBalance } from "@/lib/credits";
import { verifySameOrigin } from "@/lib/security";

export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDb();

  const workspaces = await db
    .select({
      id: schema.workspaces.id,
      name: schema.workspaces.name,
      role: schema.memberships.role,
    })
    .from(schema.memberships)
    .innerJoin(
      schema.workspaces,
      eq(schema.memberships.workspaceId, schema.workspaces.id)
    )
    .where(eq(schema.memberships.userId, ctx.user.id));

  const members = await db
    .select({
      id: schema.memberships.id,
      role: schema.memberships.role,
      email: schema.users.email,
      name: schema.users.name,
    })
    .from(schema.memberships)
    .innerJoin(schema.users, eq(schema.memberships.userId, schema.users.id))
    .where(eq(schema.memberships.workspaceId, ctx.workspace.id));

  const profiles = await db
    .select()
    .from(schema.signingProfiles)
    .where(eq(schema.signingProfiles.workspaceId, ctx.workspace.id));

  const invites = await db
    .select()
    .from(schema.workspaceInvites)
    .where(eq(schema.workspaceInvites.workspaceId, ctx.workspace.id));

  const balance = await getWorkspaceBalance(ctx.workspace.id);

  return NextResponse.json({
    activeWorkspace: ctx.workspace,
    activeRole: ctx.membership.role,
    balance,
    workspaces,
    members,
    profiles,
    invites,
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

  const body = await req.json();

  if (body.action === "switch" && typeof body.workspaceId === "string") {
    const db = await getDb();
    const rows = await db
      .select()
      .from(schema.memberships)
      .where(eq(schema.memberships.userId, ctx.user.id));
    if (!rows.some((r) => r.workspaceId === body.workspaceId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const res = NextResponse.json({ ok: true });
    res.cookies.set("jingle_ws", body.workspaceId, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
    return res;
  }

  if (body.action === "save_profile") {
    if (ctx.membership.role !== "owner" && ctx.membership.role !== "admin") {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
    }
    const displayName = String(body.displayName || "").trim();
    const website = String(body.website || "").trim();
    const defaultTrainingPreference = Boolean(body.defaultTrainingPreference ?? true);

    if (!displayName) {
      return NextResponse.json({ error: "Display name is required" }, { status: 400 });
    }

    const db = await getDb();
    const profileId = crypto.randomUUID();
    await db.insert(schema.signingProfiles).values({
      id: profileId,
      workspaceId: ctx.workspace.id,
      displayName,
      website: website || null,
      defaultTrainingPreference,
    });

    return NextResponse.json({ id: profileId }, { status: 201 });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
