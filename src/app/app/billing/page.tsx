"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { CreditPack } from "@/config/pricing";

interface BillingPayload {
  balance: number;
  packs: CreditPack[];
  purchases: Array<{
    id: string;
    provider: string;
    providerRef: string;
    credits: number;
    amountCents: number;
    currency: string;
    status: string;
    createdAt: string;
  }>;
  ledger: Array<{
    id: string;
    delta: number;
    reason: string;
    createdAt: string;
  }>;
}

export default function BillingPage() {
  const router = useRouter();
  const [data, setData] = useState<BillingPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [instructions, setInstructions] = useState<{
    bankName: string;
    accountTitle: string;
    ibanOrAccount: string;
    referenceCode: string;
    amountDisplay: string;
  } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/billing");
      if (res.status === 401) {
        router.replace("/login?callbackUrl=/app/billing");
        return;
      }
      if (!res.ok) {
        setError("Could not load billing information.");
        return;
      }
      setData(await res.json());
    } catch {
      setError("Network error loading billing information.");
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const buyPack = async (packId: string, method: "manual_bank" | "hosted") => {
    const key = `${packId}:${method}`;
    if (busyKey) return;
    setBusyKey(key);
    setError(null);
    try {
      const res = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId, method }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || "Could not start purchase request.");
        return;
      }
      if (body.bankInstructions) {
        setInstructions(body.bankInstructions);
      } else if (body.checkoutUrl) {
        window.location.href = body.checkoutUrl;
      }
      await load();
    } catch {
      setError("Network error starting purchase request.");
    } finally {
      setBusyKey(null);
    }
  };

  if (error && !data) {
    return (
      <div role="alert" className="rounded-[14px] border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900">
        {error}
      </div>
    );
  }

  if (!data) {
    return <div className="py-12 text-center text-sm text-[var(--color-muted)]">Loading billing…</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-[var(--color-ink)]">Credits &amp; Billing</h1>
        <span className="rounded-full bg-[var(--color-navy)] px-4 py-1.5 text-sm font-semibold text-white">
          Balance: {data.balance} credits
        </span>
      </div>

      {error && (
        <div role="alert" className="rounded-[14px] border border-rose-200 bg-rose-50 p-4 text-xs text-rose-900">
          {error}
        </div>
      )}

      {instructions && (
        <div className="rounded-[20px] border border-[var(--color-brand-line)] bg-[var(--warm-peach)]/60 p-5 space-y-2 text-xs text-[var(--espresso-black)]">
          <p className="font-bold text-sm">Manual Bank Transfer Instructions</p>
          <p>Bank: {instructions.bankName}</p>
          <p>Account Title: {instructions.accountTitle}</p>
          <p>Account / IBAN: {instructions.ibanOrAccount}</p>
          <p>Amount: {instructions.amountDisplay}</p>
          <p>
            Reference Code (include in transfer): <strong>{instructions.referenceCode}</strong>
          </p>
          <p className="text-[var(--color-muted)]">
            Once transferred, an administrator will approve your purchase in /admin and credit your
            workspace.
          </p>
        </div>
      )}

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {data.packs.map((pack) => (
          <div
            key={pack.id}
            className="glass-surface p-5 space-y-3"
          >
            <h2 className="font-bold text-[var(--espresso-black)]">{pack.name}</h2>
            <p className="text-2xl font-bold text-[var(--espresso-black)]">
              ${(pack.amountCents / 100).toFixed(0)} • {pack.credits} credits
            </p>
            <p className="text-xs text-[var(--color-muted)]">{pack.description}</p>
            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                disabled={busyKey !== null}
                onClick={() => void buyPack(pack.id, "manual_bank")}
                className="btn-plum px-3 py-2 text-xs font-semibold disabled:opacity-60"
              >
                {busyKey === `${pack.id}:manual_bank`
                  ? "Creating instructions…"
                  : "Request Manual Bank Transfer"}
              </button>
              <button
                type="button"
                disabled={busyKey !== null}
                onClick={() => void buyPack(pack.id, "hosted")}
                className="btn-mint px-3 py-2 text-xs font-semibold disabled:opacity-60"
              >
                {busyKey === `${pack.id}:hosted`
                  ? "Starting checkout…"
                  : "Hosted Checkout"}
              </button>
            </div>
          </div>
        ))}
      </section>

      <section className="glass-surface p-6 space-y-3">
        <h2 className="text-base font-semibold text-[var(--color-ink)]">Purchases</h2>
        {data.purchases.length === 0 ? (
          <p className="text-xs text-[var(--color-muted)]">No purchases yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
                  <th scope="col" className="py-2 pr-4">Reference</th>
                  <th scope="col" className="py-2 pr-4">Credits</th>
                  <th scope="col" className="py-2 pr-4">Method</th>
                  <th scope="col" className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.purchases.map((p) => (
                  <tr key={p.id} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="py-2 pr-4 font-mono">{p.providerRef}</td>
                    <td className="py-2 pr-4">{p.credits}</td>
                    <td className="py-2 pr-4">{p.provider}</td>
                    <td className="py-2 font-medium">{p.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="glass-surface p-6 space-y-3">
        <h2 className="text-base font-semibold text-[var(--espresso-black)]">Credit Ledger (Append-Only)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
                <th scope="col" className="py-2 pr-4">Reason</th>
                <th scope="col" className="py-2 pr-4">Delta</th>
                <th scope="col" className="py-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {data.ledger.map((entry) => (
                <tr key={entry.id} className="border-b border-[var(--color-border)] last:border-0">
                  <td className="py-2 pr-4">{entry.reason}</td>
                  <td
                    className={`py-2 pr-4 font-semibold ${
                      entry.delta >= 0 ? "text-[#16865B]" : "text-[#C83C4D]"
                    }`}
                  >
                    {entry.delta >= 0 ? `+${entry.delta}` : entry.delta}
                  </td>
                  <td className="py-2 text-[var(--color-muted)] whitespace-nowrap">
                    {new Date(entry.createdAt).toISOString().slice(0, 16).replace("T", " ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
