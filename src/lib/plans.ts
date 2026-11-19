import { asc, eq } from "drizzle-orm";
import {
  DEFAULT_SUBSCRIPTION_PLANS,
  type SubscriptionPlanSpec,
} from "@/config/pricing";
import { getDb, schema } from "@/db";

export async function listPricingPlans(): Promise<SubscriptionPlanSpec[]> {
  try {
    const db = await getDb();
    const rows = await db
      .select()
      .from(schema.pricingPlans)
      .orderBy(asc(schema.pricingPlans.monthlyPriceCents));

    if (rows.length === 0) return DEFAULT_SUBSCRIPTION_PLANS;

    return rows.map((r) => ({
      id: (r.id as "free" | "pro" | "business") || "free",
      name: r.name,
      monthlyPriceCents: r.monthlyPriceCents,
      dailyLimit: r.dailyLimit,
      maxImageMb: r.maxImageMb,
      maxVideoMb: r.maxVideoMb,
      includedCredits: r.includedCredits,
      features: Array.isArray(r.features) ? r.features : [],
      active: r.active,
    }));
  } catch {
    return DEFAULT_SUBSCRIPTION_PLANS;
  }
}

export async function getEffectivePlanForWorkspace(
  workspaceId?: string | null
): Promise<SubscriptionPlanSpec> {
  const plans = await listPricingPlans();
  const freePlan =
    plans.find((p) => p.id === "free") || DEFAULT_SUBSCRIPTION_PLANS[0];

  if (!workspaceId) return freePlan;

  try {
    const db = await getDb();
    const subs = await db
      .select()
      .from(schema.userSubscriptions)
      .where(eq(schema.userSubscriptions.workspaceId, workspaceId));

    if (subs.length > 0 && subs[0].status === "active") {
      const matched = plans.find((p) => p.id === subs[0].planId && p.active);
      if (matched) return matched;
    }
  } catch {
    // fallback to free plan
  }

  return freePlan;
}
