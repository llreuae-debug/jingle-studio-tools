"use client";

import React, { useCallback, useEffect, useState } from "react";

interface AdminPayload {
  users: Array<{ id: string; email: string; role: string; createdAt: string }>;
  jobs: Array<{ id: string; status: string; fileCount: number; createdAt: string }>;
  purchases: Array<{
    id: string;
    provider: string;
    providerRef: string;
    credits: number;
    status: string;
  }>;
  reports: Array<{
    id: string;
    reason: string;
    details: string | null;
    status: string;
  }>;
  trustSnapshots: Array<{
    id: string;
    sha256: string;
    fetchedAt: string;
    active: boolean;
  }>;
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<AdminPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin");
    if (!res.ok) {
      setError("Admin access required.");
      return;
    }
    setData(await res.json());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (payload: Record<string, string>) => {
    const res = await fetch("/api/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) await load();
  };

  if (error) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-950">
        {error}
      </div>
    );
  }

  if (!data) {
    return <div className="py-12 text-center text-sm text-[var(--color-muted)]">Loading admin…</div>;
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-[var(--color-ink)]">Admin &amp; Operations</h1>

      <section className="rounded-2xl border border-[var(--color-border)] bg-white p-6 space-y-3">
        <h2 className="text-base font-semibold text-[var(--color-ink)]">
          Manual Bank Transfers &amp; Purchases
        </h2>
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
              <th scope="col" className="py-2 pr-4">Reference</th>
              <th scope="col" className="py-2 pr-4">Credits</th>
              <th scope="col" className="py-2 pr-4">Status</th>
              <th scope="col" className="py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {data.purchases.map((p) => (
              <tr key={p.id} className="border-b border-[var(--color-border)] last:border-0">
                <td className="py-2 pr-4 font-mono">{p.providerRef}</td>
                <td className="py-2 pr-4">{p.credits}</td>
                <td className="py-2 pr-4">{p.status}</td>
                <td className="py-2 space-x-2">
                  {p.status === "pending" && (
                    <>
                      <button
                        type="button"
                        onClick={() => void act({ action: "approve_purchase", purchaseId: p.id })}
                        className="rounded bg-[#16865B] px-2.5 py-1 text-white font-medium"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => void act({ action: "reject_purchase", purchaseId: p.id })}
                        className="rounded bg-[#C83C4D] px-2.5 py-1 text-white font-medium"
                      >
                        Reject
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="rounded-2xl border border-[var(--color-border)] bg-white p-6 space-y-3">
        <h2 className="text-base font-semibold text-[var(--color-ink)]">Abuse Reports</h2>
        {data.reports.length === 0 ? (
          <p className="text-xs text-[var(--color-muted)]">No abuse reports.</p>
        ) : (
          <ul className="space-y-2 text-xs">
            {data.reports.map((r) => (
              <li
                key={r.id}
                className="rounded-lg border border-[var(--color-border)] p-3 flex items-center justify-between gap-3"
              >
                <div>
                  <p className="font-semibold">
                    {r.reason} ({r.status})
                  </p>
                  {r.details && <p className="text-[var(--color-muted)]">{r.details}</p>}
                </div>
                {r.status === "open" && (
                  <button
                    type="button"
                    onClick={() =>
                      void act({ action: "resolve_report", reportId: r.id, status: "reviewed" })
                    }
                    className="rounded bg-[var(--color-navy)] px-3 py-1 text-white"
                  >
                    Mark reviewed
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-[var(--color-border)] bg-white p-6 space-y-2 text-xs">
          <h2 className="text-base font-semibold text-[var(--color-ink)]">
            Users ({data.users.length}) &amp; Jobs ({data.jobs.length})
          </h2>
          <p className="text-[var(--color-muted)]">
            Failed jobs: {data.jobs.filter((j) => j.status === "failed" || j.status === "partial_failure").length}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--color-border)] bg-white p-6 space-y-2 text-xs">
          <h2 className="text-base font-semibold text-[var(--color-ink)]">Trust List Status</h2>
          {data.trustSnapshots.length > 0 ? (
            <p className="font-mono text-[var(--color-muted)] break-all">
              Active SHA-256: {data.trustSnapshots[0].sha256}
            </p>
          ) : (
            <p className="text-[var(--color-muted)]">
              Will populate on first /api/trust-list/active refresh.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
