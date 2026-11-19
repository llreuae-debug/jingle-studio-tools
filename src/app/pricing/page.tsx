import React from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { CREDIT_PACKS, getCreditCostPerFile } from "@/config/pricing";
import { listPricingPlans } from "@/lib/plans";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Pricing",
  description:
    "Subscription tiers for AI media inspection & privacy cleaning, plus credit packs for C2PA batch signing.",
  alternates: { canonical: "/pricing" },
};

export default async function PricingPage() {
  const costPerFile = getCreditCostPerFile();
  const plans = await listPricingPlans();

  return (
    <div className="space-y-12">
      <section className="space-y-2 max-w-2xl">
        <h1 className="text-3xl font-bold text-[var(--color-ink)]">Pricing &amp; Plans</h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Inspect Content Credentials in your browser for free, clean personal metadata on our plans, and purchase credit packs ({costPerFile} credit per signed file) for C2PA batch signing.
        </p>
      </section>

      {/* Subscription Plans (Admin configurable) */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-[var(--color-ink)]">Subscription Tiers</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {plans.filter((p) => p.active).map((plan) => (
            <div
              key={plan.id}
              className="glass-surface p-6 flex flex-col justify-between space-y-5"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg font-bold text-[var(--color-ink)]">{plan.name}</h3>
                  <span className="rounded-full bg-[var(--color-brand-soft)] border border-[var(--color-brand-line)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--color-brand)]">
                    {plan.dailyLimit}/day
                  </span>
                </div>
                <p className="text-3xl font-bold text-[var(--color-ink)]">
                  {plan.monthlyPriceCents === 0
                    ? "$0"
                    : `$${(plan.monthlyPriceCents / 100).toFixed(0)}`}
                  <span className="text-xs font-normal text-[var(--color-text-muted)]">
                    {" "}
                    / month • {plan.maxImageMb} MB img / {plan.maxVideoMb} MB video
                  </span>
                </p>
                <ul className="space-y-1.5 text-xs text-[var(--color-text-muted)]">
                  {plan.features.map((feat, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-[var(--color-brand)]" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Link
                href={plan.monthlyPriceCents === 0 ? "/signup" : "/app/billing"}
                className="inline-flex justify-center btn-plum px-4 py-2.5 text-sm font-semibold"
              >
                {plan.monthlyPriceCents === 0 ? "Start Free" : "Upgrade / Billing"}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Credit Packs */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-[var(--color-ink)]">C2PA Signing Credit Packs</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {CREDIT_PACKS.map((pack) => (
            <div
              key={pack.id}
              className="glass-surface p-6 flex flex-col justify-between space-y-5"
            >
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-[var(--color-ink)]">{pack.name}</h3>
                <p className="text-3xl font-bold text-[var(--color-ink)]">
                  ${(pack.amountCents / 100).toFixed(0)}
                  <span className="text-xs font-normal text-[var(--color-text-muted)]">
                    {" "}
                    USD • {pack.credits} credits
                  </span>
                </p>
                <p className="text-xs text-[var(--color-text-muted)]">{pack.description}</p>
              </div>
              <Link
                href="/app/billing"
                className="inline-flex justify-center btn-mint px-4 py-2.5 text-sm font-semibold"
              >
                Buy in Billing
              </Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
