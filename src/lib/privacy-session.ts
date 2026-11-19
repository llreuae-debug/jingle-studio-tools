import crypto from "node:crypto";
import { and, eq, gte, sql } from "drizzle-orm";
import type { NextRequest, NextResponse } from "next/server";
import type { SubscriptionPlanSpec } from "@/config/pricing";
import { getDb, schema } from "@/db";
import { getSessionContext } from "@/lib/auth";
import { getEffectivePlanForWorkspace } from "@/lib/plans";

export const PRIVACY_COOKIE_NAME = "privacy_session";

export const GUEST_PLAN_LIMITS: SubscriptionPlanSpec = {
  id: "free",
  name: "Guest",
  monthlyPriceCents: 0,
  dailyLimit: 10,
  maxImageMb: 15,
  maxVideoMb: 50,
  includedCredits: 0,
  features: [
    "Browser C2PA inspection & lossless metadata cleaning",
    "Up to 15 MB images & 50 MB videos",
    "10 daily checks/cleanings (24-hour file retention)",
  ],
  active: true,
};

export interface PrivacyActorContext {
  isAuthenticated: boolean;
  userId: string | null;
  workspaceId: string | null;
  ownerScope: string;
  ownerTokenHash: string | null;
  plan: SubscriptionPlanSpec;
  setCookieToken: string | null;
}

export function hashPrivacyCookieToken(raw: string): string {
  return crypto.createHash("sha256").update(`privacy:${raw}`).digest("hex");
}

export async function resolvePrivacyActor(
  req: NextRequest
): Promise<PrivacyActorContext> {
  const sessionCtx = await getSessionContext();
  if (sessionCtx) {
    const plan = await getEffectivePlanForWorkspace(sessionCtx.workspace.id);
    return {
      isAuthenticated: true,
      userId: sessionCtx.user.id,
      workspaceId: sessionCtx.workspace.id,
      ownerScope: `ws:${sessionCtx.workspace.id}`,
      ownerTokenHash: null,
      plan,
      setCookieToken: null,
    };
  }

  const existing = req.cookies.get(PRIVACY_COOKIE_NAME)?.value?.trim() || "";
  const rawToken =
    existing.length >= 16 ? existing : crypto.randomBytes(24).toString("hex");
  const ownerTokenHash = hashPrivacyCookieToken(rawToken);
  // Enforce genuine tighter guest limits (15 MB img / 50 MB vid / 10 daily) until signed in
  const plan = GUEST_PLAN_LIMITS;

  return {
    isAuthenticated: false,
    userId: null,
    workspaceId: null,
    ownerScope: `anon:${ownerTokenHash}`,
    ownerTokenHash,
    plan,
    setCookieToken: existing.length >= 16 ? null : rawToken,
  };
}

export function attachPrivacyCookie(
  res: NextResponse,
  actor: PrivacyActorContext,
  req?: NextRequest
): NextResponse {
  if (actor.setCookieToken) {
    const isHttps = req
      ? req.nextUrl.protocol === "https:" ||
        req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() === "https"
      : process.env.NODE_ENV === "production";

    res.cookies.set(PRIVACY_COOKIE_NAME, actor.setCookieToken, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: isHttps,
      maxAge: 7 * 24 * 60 * 60,
    });
  }
  return res;
}

export async function checkDailyPlanLimit(actor: PrivacyActorContext): Promise<{
  allowed: boolean;
  usedToday: number;
  limit: number;
}> {
  const db = await getDb();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const filter = actor.workspaceId
    ? and(
        eq(schema.mediaProcessingRecords.workspaceId, actor.workspaceId),
        gte(schema.mediaProcessingRecords.createdAt, since)
      )
    : actor.ownerTokenHash
    ? and(
        eq(schema.mediaProcessingRecords.ownerTokenHash, actor.ownerTokenHash),
        gte(schema.mediaProcessingRecords.createdAt, since)
      )
    : null;

  if (!filter) {
    return { allowed: true, usedToday: 0, limit: actor.plan.dailyLimit };
  }

  const rows = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(schema.mediaProcessingRecords)
    .where(filter);

  const usedToday = Number(rows[0]?.count ?? 0);
  return {
    allowed: usedToday < actor.plan.dailyLimit,
    usedToday,
    limit: actor.plan.dailyLimit,
  };
}

export async function generateSafeImageThumbnail(
  buf: Buffer,
  mimeType: string
): Promise<string | null> {
  if (!mimeType.startsWith("image/")) return null;
  try {
    const sharp = (await import("sharp")).default;
    const out = await sharp(buf)
      .resize({ width: 96, height: 96, fit: "cover" })
      .webp({ quality: 72 })
      .toBuffer();
    if (out.length > 24 * 1024) return null;
    return `data:image/webp;base64,${out.toString("base64")}`;
  } catch {
    return null;
  }
}
