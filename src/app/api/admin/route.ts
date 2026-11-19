import crypto from "node:crypto";
import { desc, eq, gte, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { getSessionContext } from "@/lib/auth";
import { applyPurchaseCredits } from "@/lib/credits";
import { listPricingPlans } from "@/lib/plans";
import { verifySameOrigin } from "@/lib/security";
import { purgeExpiredPrivacyFiles } from "@/lib/storage";
import { recordSystemLog } from "@/lib/system-logs";

export const runtime = "nodejs";

export async function GET() {
  const ctx = await getSessionContext();
  if (!ctx || ctx.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = await getDb();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [
    users,
    jobs,
    purchases,
    reports,
    trustSnapshots,
    auditLogs,
    processingRecords,
    systemLogs,
    pricingPlans,
    subscriptions,
    dauRows,
    totalUserRows,
    totalPrivacyRows,
    imageCountRows,
    videoCountRows,
    failedPrivacyRows,
    failedJobRows,
    storageRows,
    revenueRows,
  ] = await Promise.all([
    db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        name: schema.users.name,
        role: schema.users.role,
        disabled: schema.users.disabled,
        lastLoginAt: schema.users.lastLoginAt,
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
    db
      .select()
      .from(schema.mediaProcessingRecords)
      .orderBy(desc(schema.mediaProcessingRecords.createdAt))
      .limit(50),
    db
      .select()
      .from(schema.systemLogs)
      .orderBy(desc(schema.systemLogs.createdAt))
      .limit(50),
    listPricingPlans(),
    db.select().from(schema.userSubscriptions).limit(50),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(schema.users)
      .where(gte(schema.users.lastLoginAt, since24h)),
    db.select({ count: sql<number>`COUNT(*)` }).from(schema.users),
    db.select({ count: sql<number>`COUNT(*)` }).from(schema.mediaProcessingRecords),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(schema.mediaProcessingRecords)
      .where(eq(schema.mediaProcessingRecords.mediaKind, "image")),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(schema.mediaProcessingRecords)
      .where(eq(schema.mediaProcessingRecords.mediaKind, "video")),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(schema.mediaProcessingRecords)
      .where(eq(schema.mediaProcessingRecords.status, "failed")),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(schema.signJobs)
      .where(eq(schema.signJobs.status, "failed")),
    db
      .select({
        bytes: sql<number>`COALESCE(SUM(${schema.mediaProcessingRecords.fileSizeBytes}) + SUM(COALESCE(${schema.mediaProcessingRecords.cleanedSizeBytes}, 0)), 0)`,
      })
      .from(schema.mediaProcessingRecords)
      .where(eq(schema.mediaProcessingRecords.status, "done")),
    db
      .select({
        cents: sql<number>`COALESCE(SUM(${schema.purchases.amountCents}), 0)`,
      })
      .from(schema.purchases)
      .where(eq(schema.purchases.status, "paid")),
  ]);

  // Attach primary workspace ID + credit balance + planId to each user row for management
  const allWorkspaces = await db.select().from(schema.workspaces);
  const ledgerTotals = await db
    .select({
      workspaceId: schema.creditLedgerEntries.workspaceId,
      balance: sql<number>`COALESCE(SUM(${schema.creditLedgerEntries.delta}), 0)`,
    })
    .from(schema.creditLedgerEntries)
    .groupBy(schema.creditLedgerEntries.workspaceId);

  const balanceMap = new Map(
    ledgerTotals.map((r) => [r.workspaceId, Number(r.balance ?? 0)])
  );
  const subMap = new Map(
    subscriptions.map((s) => [s.workspaceId, s.planId])
  );
  const userWsMap = new Map(allWorkspaces.map((w) => [w.ownerId, w.id]));

  const enrichedUsers = users.map((u) => {
    const wsId = userWsMap.get(u.id) || null;
    return {
      ...u,
      workspaceId: wsId,
      credits: wsId ? (balanceMap.get(wsId) ?? 0) : 0,
      planId: wsId ? (subMap.get(wsId) || "free") : "free",
    };
  });

  const stats = {
    totalUsers: Number(totalUserRows[0]?.count ?? users.length),
    dailyActiveUsers: Number(dauRows[0]?.count ?? 0),
    totalUploads: Number(totalPrivacyRows[0]?.count ?? 0) + jobs.length,
    imageCount: Number(imageCountRows[0]?.count ?? 0),
    videoCount: Number(videoCountRows[0]?.count ?? 0),
    failureCount:
      Number(failedPrivacyRows[0]?.count ?? 0) +
      Number(failedJobRows[0]?.count ?? 0),
    storageBytes: Number(storageRows[0]?.bytes ?? 0),
    revenueCents: Number(revenueRows[0]?.cents ?? 0),
    apiHealth: {
      ok: true,
      db: "connected",
      timestamp: new Date().toISOString(),
    },
  };

  return NextResponse.json({
    stats,
    users: enrichedUsers,
    jobs,
    processingRecords,
    purchases,
    reports,
    trustSnapshots,
    auditLogs,
    systemLogs,
    pricingPlans,
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

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }
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

  if (body.action === "toggle_user_disabled" && typeof body.userId === "string") {
    const disabled = Boolean(body.disabled);
    if (body.userId === ctx.user.id && disabled) {
      return NextResponse.json(
        { error: "Cannot disable your own active admin account." },
        { status: 400 }
      );
    }
    await db
      .update(schema.users)
      .set({ disabled })
      .where(eq(schema.users.id, body.userId));
    await db.insert(schema.adminAuditLogs).values({
      id: crypto.randomUUID(),
      actorUserId: ctx.user.id,
      action: "toggle_user_disabled",
      targetType: "user",
      targetId: body.userId,
      metadata: { disabled },
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "update_user_role" && typeof body.userId === "string") {
    const role = body.role === "admin" ? "admin" : "user";
    if (body.userId === ctx.user.id && role !== "admin") {
      return NextResponse.json(
        { error: "Cannot demote your own active admin account." },
        { status: 400 }
      );
    }
    await db
      .update(schema.users)
      .set({ role })
      .where(eq(schema.users.id, body.userId));
    await db.insert(schema.adminAuditLogs).values({
      id: crypto.randomUUID(),
      actorUserId: ctx.user.id,
      action: "update_user_role",
      targetType: "user",
      targetId: body.userId,
      metadata: { role },
    });
    return NextResponse.json({ ok: true });
  }

  if (
    body.action === "adjust_credits" &&
    typeof body.workspaceId === "string" &&
    Number.isInteger(Number(body.delta))
  ) {
    const delta = Number(body.delta);
    if (delta === 0) {
      return NextResponse.json({ error: "Delta must be non-zero" }, { status: 400 });
    }
    await db.insert(schema.creditLedgerEntries).values({
      id: crypto.randomUUID(),
      workspaceId: body.workspaceId,
      delta,
      reason: "manual_adjustment",
      idempotencyKey: `admin:${ctx.user.id}:${crypto.randomUUID()}`,
    });
    await db.insert(schema.adminAuditLogs).values({
      id: crypto.randomUUID(),
      actorUserId: ctx.user.id,
      action: "adjust_credits",
      targetType: "workspace",
      targetId: body.workspaceId,
      metadata: { delta },
    });
    await recordSystemLog({
      level: "info",
      event: "admin_adjust_credits",
      userId: ctx.user.id,
      message: `Adjusted workspace ${body.workspaceId} credits by ${delta}`,
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "update_workspace_plan" && typeof body.workspaceId === "string") {
    const planId = ["free", "pro", "business"].includes(String(body.planId))
      ? String(body.planId)
      : "free";
    const existing = await db
      .select()
      .from(schema.userSubscriptions)
      .where(eq(schema.userSubscriptions.workspaceId, body.workspaceId));

    if (existing.length > 0) {
      await db
        .update(schema.userSubscriptions)
        .set({ planId, status: "active", updatedAt: new Date() })
        .where(eq(schema.userSubscriptions.workspaceId, body.workspaceId));
    } else {
      await db.insert(schema.userSubscriptions).values({
        id: crypto.randomUUID(),
        workspaceId: body.workspaceId,
        planId,
        status: "active",
      });
    }

    await db.insert(schema.adminAuditLogs).values({
      id: crypto.randomUUID(),
      actorUserId: ctx.user.id,
      action: "update_workspace_plan",
      targetType: "workspace",
      targetId: body.workspaceId,
      metadata: { planId },
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "update_pricing_plan" && typeof body.id === "string") {
    const planId = body.id;
    if (!["free", "pro", "business"].includes(planId)) {
      return NextResponse.json({ error: "Invalid plan ID" }, { status: 400 });
    }
    const rawPrice = Number(body.monthlyPriceCents ?? 0);
    const rawDaily = Number(body.dailyLimit ?? 20);
    const rawImg = Number(body.maxImageMb ?? 25);
    const rawVid = Number(body.maxVideoMb ?? 100);
    const rawCredits = Number(body.includedCredits ?? 10);
    if (
      !Number.isFinite(rawPrice) ||
      !Number.isFinite(rawDaily) ||
      !Number.isFinite(rawImg) ||
      !Number.isFinite(rawVid) ||
      !Number.isFinite(rawCredits)
    ) {
      return NextResponse.json(
        { error: "Plan numeric fields must be valid numbers." },
        { status: 400 }
      );
    }
    const monthlyPriceCents = Math.max(0, Math.round(rawPrice));
    const dailyLimit = Math.max(1, Math.round(rawDaily));
    const maxImageMb = Math.max(1, Math.round(rawImg));
    const maxVideoMb = Math.max(1, Math.round(rawVid));
    const includedCredits = Math.max(0, Math.round(rawCredits));
    const active = body.active !== false;

    await db
      .update(schema.pricingPlans)
      .set({
        monthlyPriceCents,
        dailyLimit,
        maxImageMb,
        maxVideoMb,
        includedCredits,
        active,
        updatedAt: new Date(),
      })
      .where(eq(schema.pricingPlans.id, planId));

    await db.insert(schema.adminAuditLogs).values({
      id: crypto.randomUUID(),
      actorUserId: ctx.user.id,
      action: "update_pricing_plan",
      targetType: "pricing_plan",
      targetId: planId,
      metadata: { monthlyPriceCents, dailyLimit, maxImageMb, maxVideoMb, includedCredits },
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "purge_expired") {
    const purged = await purgeExpiredPrivacyFiles();
    await recordSystemLog({
      level: "info",
      event: "admin_purge_expired",
      userId: ctx.user.id,
      message: `Purged ${purged} expired media records`,
    });
    return NextResponse.json({ ok: true, purged });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
