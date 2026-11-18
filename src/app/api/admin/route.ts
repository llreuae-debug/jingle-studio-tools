import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getSessionContext } from "@/lib/auth";
import { applyPurchaseCredits } from "@/lib/credits";
import { verifySameOrigin } from "@/lib/security";

export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx || ctx.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = await getDb();
  const [users, jobs, purchases, reports, trustSnapshots, auditLogs] = await Promise.all([
    db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        name: schema.users.name,
        role: schema.users.role,
        createdAt: schema.users.createdAt,
      })
      .from(schema.users)
      .orderBy(desc(schema.users.createdAt))
      .limit(50),
    db.select().from(schema.signJobs).orderBy(desc(schema.signJobs.createdAt)).limit(50),
    db.select().from(schema.purchases).orderBy(desc(schema.purchases.createdAt)).limit(50),
    db.select().from(schema.abuseReports).orderBy(desc(schema.abuseReports.createdAt)).limit(50),
    db
      .select({
        id: schema.trustListSnapshots.id,
        sourceUrl: schema.trustListSnapshots.sourceUrl,
        sha256: schema.trustListSnapshots.sha256,
        fetchedAt: schema.trustListSnapshots.fetchedAt,
        active: schema.trustListSnapshots.active,
      })
      .from(schema.trustListSnapshots)
      .orderBy(desc(schema.trustListSnapshots.fetchedAt))
      .limit(10),
    db.select().from(schema.adminAuditLogs).orderBy(desc(schema.adminAuditLogs.createdAt)).limit(50),
  ]);

  return NextResponse.json({
    users,
    jobs,
    purchases,
    reports,
    trustSnapshots,
    auditLogs,
  });
}

export async function POST(req: NextRequest) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const ctx = await getSessionContext();
  if (!ctx || ctx.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const db = await getDb();

  if (body.action === "approve_purchase" && typeof body.purchaseId === "string") {
    const rows = await db
      .select()
      .from(schema.purchases)
      .where(eq(schema.purchases.id, body.purchaseId));
    if (rows.length === 0) {
      return NextResponse.json({ error: "Purchase not found" }, { status: 404 });
    }
    const p = rows[0];
    const credited = await applyPurchaseCredits({
      workspaceId: p.workspaceId,
      purchaseId: p.id,
      credits: p.credits,
    });
    await db
      .update(schema.purchases)
      .set({ approvedBy: ctx.user.id, updatedAt: new Date() })
      .where(eq(schema.purchases.id, p.id));

    await db.insert(schema.adminAuditLogs).values({
      id: crypto.randomUUID(),
      actorUserId: ctx.user.id,
      action: "approve_purchase",
      targetType: "purchase",
      targetId: p.id,
      metadata: { credited, credits: p.credits },
    });

    return NextResponse.json({ ok: true, credited });
  }

  if (body.action === "reject_purchase" && typeof body.purchaseId === "string") {
    await db
      .update(schema.purchases)
      .set({ status: "rejected", approvedBy: ctx.user.id, updatedAt: new Date() })
      .where(eq(schema.purchases.id, body.purchaseId));

    await db.insert(schema.adminAuditLogs).values({
      id: crypto.randomUUID(),
      actorUserId: ctx.user.id,
      action: "reject_purchase",
      targetType: "purchase",
      targetId: body.purchaseId,
      metadata: {},
    });

    return NextResponse.json({ ok: true });
  }

  if (body.action === "resolve_report" && typeof body.reportId === "string") {
    const nextStatus = body.status === "dismissed" ? "dismissed" : "reviewed";
    await db
      .update(schema.abuseReports)
      .set({ status: nextStatus })
      .where(eq(schema.abuseReports.id, body.reportId));

    await db.insert(schema.adminAuditLogs).values({
      id: crypto.randomUUID(),
      actorUserId: ctx.user.id,
      action: "resolve_report",
      targetType: "abuse_report",
      targetId: body.reportId,
      metadata: { status: nextStatus },
    });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
