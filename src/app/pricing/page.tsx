import React from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { CREDIT_PACKS, getCreditCostPerFile } from "@/config/pricing";

export const metadata = {
  title: "Pricing",
  description: "Free in-browser Content Credentials checks and credit packs for batch signing.",
};

export default function PricingPage() {
  const costPerFile = getCreditCostPerFile();

  return (
    <div className="space-y-10">
      <section className="space-y-2 max-w-2xl">
        <h1 className="text-3xl font-bold text-[var(--plum)]">Pricing</h1>
        <p className="text-sm text-[var(--plum-muted)]">
          Checking Content Credentials in your browser is always free. Batch signing costs{" "}
          <strong className="text-[var(--plum)]">{costPerFile} credit</strong> per signed file;
          failed files are refunded automatically.
        </p>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {CREDIT_PACKS.map((pack) => (
          <div
            key={pack.id}
            className="glass-surface p-6 flex flex-col justify-between space-y-5"
          >
            <div className="space-y-2">
              <h2 className="text-lg font-bold text-[var(--plum)]">{pack.name}</h2>
              <p className="text-3xl font-bold text-[var(--plum)]">
                ${(pack.amountCents / 100).toFixed(0)}
                <span className="text-xs font-normal text-[var(--plum-muted)]">
                  {" "}
                  USD • {pack.credits} credits
                </span>
              </p>
              <p className="text-xs text-[var(--plum-muted)]">{pack.description}</p>
            </div>
            <Link
              href="/app/billing"
              className="inline-flex justify-center btn-plum px-4 py-2.5 text-sm font-semibold"
            >
              Buy in Billing
            </Link>
          </div>
        ))}
      </section>

      <section className="glass-surface p-6 sm:p-8 space-y-4">
        <h2 className="text-lg font-bold text-[var(--plum)]">
          Free Checks &amp; Team Workspaces
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-[var(--plum)]">
          <div className="rounded-[20px] bg-[var(--mint)]/60 p-4 space-y-2">
            <h3 className="font-semibold">Free Browser Checks ($0)</h3>
            <ul className="space-y-1.5 text-xs text-[var(--plum)]">
              <li className="flex items-center gap-2">
                <Check aria-hidden="true" className="h-4 w-4 shrink-0" />
                Unlimited local C2PA inspections (files stay on your device)
              </li>
              <li className="flex items-center gap-2">
                <Check aria-hidden="true" className="h-4 w-4 shrink-0" />
                Instagram Post, Story, Reels &amp; TikTok format fit checks
              </li>
            </ul>
          </div>
          <div className="rounded-[20px] bg-[var(--lime)]/45 p-4 space-y-2">
            <h3 className="font-semibold">Team Workspaces (Included)</h3>
            <ul className="space-y-1.5 text-xs text-[var(--plum)]">
              <li className="flex items-center gap-2">
                <Check aria-hidden="true" className="h-4 w-4 shrink-0" />
                Owner, admin, and member roles with shared credit balance
              </li>
              <li className="flex items-center gap-2">
                <Check aria-hidden="true" className="h-4 w-4 shrink-0" />
                Reusable brand signing profiles &amp; revocable public proof pages
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
