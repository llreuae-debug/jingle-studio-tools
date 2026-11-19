import { NextRequest, NextResponse } from "next/server";
import {
  attachPrivacyCookie,
  checkDailyPlanLimit,
  resolvePrivacyActor,
} from "@/lib/privacy-session";
import { isSynthIdVerifierConfigured } from "@/lib/synthid-verifier";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const actor = await resolvePrivacyActor(req);
  const daily = await checkDailyPlanLimit(actor);

  const res = NextResponse.json({
    ok: true,
    isAuthenticated: actor.isAuthenticated,
    planName: actor.plan.name,
    dailyLimit: daily.limit,
    usedToday: daily.usedToday,
    maxImageMb: actor.plan.maxImageMb,
    maxVideoMb: actor.plan.maxVideoMb,
    retentionHours: actor.isAuthenticated ? 168 : 24,
    synthIdVerifierConfigured: isSynthIdVerifierConfigured(),
  });
  return attachPrivacyCookie(res, actor, req);
}
