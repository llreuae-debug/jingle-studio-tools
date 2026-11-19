"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Activity, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";

interface AdminPricingPlan {
  id: string;
  name: string;
  monthlyPriceCents: number;
  dailyLimit: number;
  maxImageMb: number;
  maxVideoMb: number;
  includedCredits: number;
  active: boolean;
}

interface AdminPayload {
  stats: {
    totalUsers: number;
    dailyActiveUsers: number;
    totalUploads: number;
    imageCount: number;
    videoCount: number;
    failureCount: number;
    storageBytes: number;
    revenueCents: number;
    apiHealth: { ok: boolean; db: string; timestamp: string };
  };
  users: Array<{
    id: string;
    email: string;
    name: string | null;
    role: string;
    disabled: boolean;
    workspaceId: string | null;
    credits: number;
    planId: string;
    lastLoginAt: string | null;
    createdAt: string;
  }>;
  jobs: Array<{ id: string; status: string; fileCount: number; createdAt: string }>;
  processingRecords: Array<{
    id: string;
    originalName: string;
    mimeType: string;
    mediaKind: string;
    fileSizeBytes: number;
    status: string;
    personalMetadataStatus: string;
    c2paResultStatus: string;
    createdAt: string;
  }>;
  purchases: Array<{
    id: string;
    provider: string;
    providerRef: string;
    credits: number;
    amountCents: number;
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
  systemLogs: Array<{
    id: string;
    level: string;
    event: string;
    message: string;
    createdAt: string;
  }>;
  pricingPlans: AdminPricingPlan[];
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<AdminPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin");
      if (!res.ok) {
        setError("Admin access required.");
        return;
      }
      setData(await res.json());
    } catch {
      setError("Network error loading admin console.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (payload: Record<string, unknown>, label?: string) => {
    if (busy) return;
    setBusy(true);
    setStatusMsg(null);
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        if (label) setStatusMsg(label);
        await load();
      } else {
        const err = await res.json().catch(() => ({}));
        setStatusMsg(err.error || "Action failed.");
      }
    } catch {
      setStatusMsg("Network error performing admin action.");
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <div className="rounded-[16px] border border-rose-200 bg-rose-50 p-6 text-sm text-rose-950 flex flex-wrap items-center justify-between gap-3">
        <span>{error}</span>
        <Link href="/login?callbackUrl=/admin" className="btn-plum px-4 py-2 text-xs font-semibold">
          Sign in with admin account
        </Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="py-12 text-center text-sm text-[var(--color-text-muted)]">
        Loading admin…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-ink)]">
            Super Admin &amp; Operations
          </h1>
          <p className="text-xs text-[var(--color-text-muted)]">
            Platform metrics, user &amp; credit controls, configurable pricing, and processing queue.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700">
            <Activity aria-hidden="true" className="h-3.5 w-3.5" />
            API: {data.stats.apiHealth.db}
          </span>
          <button
            type="button"
            onClick={() => void act({ action: "purge_expired" }, "Purged expired media files.")}
            className="inline-flex items-center gap-1.5 btn-mint px-3.5 py-1.5 text-xs font-semibold"
          >
            <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
            Purge expired files
          </button>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 btn-plum px-3.5 py-1.5 text-xs font-semibold"
          >
            <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className="rounded-[12px] border border-[var(--color-brand-line)] bg-[var(--color-brand-soft)] px-4 py-2.5 text-xs font-semibold text-[var(--color-ink)]">
          {statusMsg}
        </div>
      )}

      {/* Overview Statistics Grid */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Registered Users", value: data.stats.totalUsers },
          { label: "Daily Active Users (24h)", value: data.stats.dailyActiveUsers },
          { label: "Total Uploads", value: data.stats.totalUploads },
          {
            label: "Image / Video Split",
            value: `${data.stats.imageCount} img / ${data.stats.videoCount} vid`,
          },
          { label: "Processing Failures", value: data.stats.failureCount },
          {
            label: "Storage Consumption",
            value: `${(data.stats.storageBytes / (1024 * 1024)).toFixed(2)} MB`,
          },
          {
            label: "Revenue (Paid)",
            value: `$${(data.stats.revenueCents / 100).toFixed(2)}`,
          },
          {
            label: "API Health",
            value: data.stats.apiHealth.ok ? "Healthy" : "Degraded",
          },
        ].map((item) => (
          <div key={item.label} className="glass-surface p-4 space-y-1">
            <p className="text-[11px] font-medium text-[var(--color-text-muted)]">{item.label}</p>
            <p className="text-xl font-bold text-[var(--color-ink)]">{item.value}</p>
          </div>
        ))}
      </section>

      {/* Configurable Pricing Plans */}
      <section className="glass-surface p-6 space-y-4">
        <h2 className="text-base font-semibold text-[var(--color-ink)]">
          Pricing &amp; Subscription Plan Limits
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {data.pricingPlans.map((plan) => (
            <form
              key={plan.id}
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                void act(
                  {
                    action: "update_pricing_plan",
                    id: plan.id,
                    monthlyPriceCents: Number(fd.get("priceUsd")) * 100,
                    dailyLimit: Number(fd.get("dailyLimit")),
                    maxImageMb: Number(fd.get("maxImageMb")),
                    maxVideoMb: Number(fd.get("maxVideoMb")),
                    includedCredits: Number(fd.get("includedCredits")),
                  },
                  `Updated ${plan.name} plan settings.`
                );
              }}
              className="rounded-[14px] border border-[var(--border)] bg-[var(--color-surface-muted)] p-4 space-y-2.5 text-xs"
            >
              <p className="font-bold text-sm text-[var(--color-ink)]">{plan.name}</p>
              <label className="block space-y-1">
                <span className="text-[var(--color-text-muted)]">Monthly price ($ USD)</span>
                <input
                  name="priceUsd"
                  type="number"
                  min={0}
                  defaultValue={Math.round(plan.monthlyPriceCents / 100)}
                  className="w-full glass-input px-2.5 py-1.5 text-xs"
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block space-y-1">
                  <span className="text-[var(--color-text-muted)]">Daily limit</span>
                  <input
                    name="dailyLimit"
                    type="number"
                    min={1}
                    defaultValue={plan.dailyLimit}
                    className="w-full glass-input px-2.5 py-1.5 text-xs"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-[var(--color-text-muted)]">Credits</span>
                  <input
                    name="includedCredits"
                    type="number"
                    min={0}
                    defaultValue={plan.includedCredits}
                    className="w-full glass-input px-2.5 py-1.5 text-xs"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-[var(--color-text-muted)]">Max img (MB)</span>
                  <input
                    name="maxImageMb"
                    type="number"
                    min={1}
                    defaultValue={plan.maxImageMb}
                    className="w-full glass-input px-2.5 py-1.5 text-xs"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-[var(--color-text-muted)]">Max vid (MB)</span>
                  <input
                    name="maxVideoMb"
                    type="number"
                    min={1}
                    defaultValue={plan.maxVideoMb}
                    className="w-full glass-input px-2.5 py-1.5 text-xs"
                  />
                </label>
              </div>
              <button type="submit" className="w-full btn-plum py-1.5 text-xs font-semibold">
                Save {plan.name}
              </button>
            </form>
          ))}
        </div>
      </section>

      {/* User, Subscription & Credit Management */}
      <section className="glass-surface p-6 space-y-4">
        <h2 className="text-base font-semibold text-[var(--color-ink)]">
          User, Subscription &amp; Credit Management
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--border)] text-[var(--color-text-muted)]">
                <th scope="col" className="py-2 pr-4">User</th>
                <th scope="col" className="py-2 pr-4">Role</th>
                <th scope="col" className="py-2 pr-4">Plan</th>
                <th scope="col" className="py-2 pr-4">Credits</th>
                <th scope="col" className="py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((u) => (
                <tr key={u.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-2.5 pr-4">
                    <p className="font-semibold text-[var(--color-ink)]">{u.email}</p>
                    <p className="text-[11px] text-[var(--color-text-muted)]">
                      {u.disabled ? "Disabled" : "Active"}
                    </p>
                  </td>
                  <td className="py-2.5 pr-4">{u.role}</td>
                  <td className="py-2.5 pr-4">
                    {u.workspaceId ? (
                      <select
                        aria-label={`Plan for ${u.email}`}
                        value={u.planId}
                        onChange={(e) =>
                          void act(
                            {
                              action: "update_workspace_plan",
                              workspaceId: u.workspaceId,
                              planId: e.target.value,
                            },
                            `Updated plan for ${u.email}`
                          )
                        }
                        className="glass-input px-2 py-1 text-xs"
                      >
                        {data.pricingPlans.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-2.5 pr-4 font-semibold">{u.credits}</td>
                  <td className="py-2.5 flex flex-wrap gap-1.5">
                    {u.workspaceId && (
                      <button
                        type="button"
                        onClick={() =>
                          void act(
                            {
                              action: "adjust_credits",
                              workspaceId: u.workspaceId,
                              delta: 25,
                            },
                            `Added +25 credits to ${u.email}`
                          )
                        }
                        className="rounded-[8px] bg-[var(--color-brand)] px-2.5 py-1 text-[11px] font-semibold text-white"
                      >
                        +25 credits
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        void act(
                          {
                            action: "toggle_user_disabled",
                            userId: u.id,
                            disabled: !u.disabled,
                          },
                          `${u.disabled ? "Enabled" : "Disabled"} ${u.email}`
                        )
                      }
                      className="rounded-[8px] border border-[var(--border)] bg-white px-2.5 py-1 text-[11px] font-semibold"
                    >
                      {u.disabled ? "Enable" : "Disable"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Media Processing Queue & History */}
      <section className="glass-surface p-6 space-y-4">
        <h2 className="text-base font-semibold text-[var(--color-ink)]">
          Media Processing Queue &amp; Recent Operations ({data.processingRecords.length})
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--border)] text-[var(--color-text-muted)]">
                <th scope="col" className="py-2 pr-4">File</th>
                <th scope="col" className="py-2 pr-4">Kind</th>
                <th scope="col" className="py-2 pr-4">Status</th>
                <th scope="col" className="py-2 pr-4">Metadata / C2PA</th>
                <th scope="col" className="py-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {data.processingRecords.slice(0, 15).map((r) => (
                <tr key={r.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-2 pr-4 font-medium truncate max-w-[200px]">{r.originalName}</td>
                  <td className="py-2 pr-4">{r.mediaKind}</td>
                  <td className="py-2 pr-4 font-semibold">{r.status}</td>
                  <td className="py-2 pr-4">
                    {r.personalMetadataStatus} / {r.c2paResultStatus}
                  </td>
                  <td className="py-2 text-[var(--color-text-muted)]">
                    {r.createdAt.slice(0, 16).replace("T", " ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Purchases & Abuse Reports */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="glass-surface p-6 space-y-3">
          <h2 className="text-base font-semibold text-[var(--color-ink)]">
            Manual Bank Transfers &amp; Purchases
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--color-text-muted)]">
                  <th scope="col" className="py-2 pr-4">Reference</th>
                  <th scope="col" className="py-2 pr-4">Credits</th>
                  <th scope="col" className="py-2 pr-4">Status</th>
                  <th scope="col" className="py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {data.purchases.map((p) => (
                  <tr key={p.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-2 pr-4 font-mono">{p.providerRef}</td>
                    <td className="py-2 pr-4">{p.credits}</td>
                    <td className="py-2 pr-4">{p.status}</td>
                    <td className="py-2 space-x-2">
                      {p.status === "pending" && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              void act({ action: "approve_purchase", purchaseId: p.id })
                            }
                            className="rounded bg-[#16865B] px-2.5 py-1 text-white font-medium"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void act({ action: "reject_purchase", purchaseId: p.id })
                            }
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
          </div>
        </section>

        <section className="glass-surface p-6 space-y-3">
          <h2 className="text-base font-semibold text-[var(--color-ink)]">Abuse Reports</h2>
          {data.reports.length === 0 ? (
            <p className="text-xs text-[var(--color-text-muted)]">No abuse reports.</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {data.reports.map((r) => (
                <li
                  key={r.id}
                  className="rounded-[12px] border border-[var(--border)] p-3 flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="font-semibold">
                      {r.reason} ({r.status})
                    </p>
                    {r.details && (
                      <p className="text-[var(--color-text-muted)]">{r.details}</p>
                    )}
                  </div>
                  {r.status === "open" && (
                    <button
                      type="button"
                      onClick={() =>
                        void act({
                          action: "resolve_report",
                          reportId: r.id,
                          status: "reviewed",
                        })
                      }
                      className="btn-plum px-3 py-1 text-xs"
                    >
                      Mark reviewed
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* System Logs & Trust List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="glass-surface p-6 space-y-3 text-xs">
          <h2 className="text-base font-semibold text-[var(--color-ink)]">System Logs</h2>
          <div className="max-h-64 overflow-y-auto space-y-1.5">
            {data.systemLogs.length === 0 ? (
              <p className="text-[var(--color-text-muted)]">No system logs recorded yet.</p>
            ) : (
              data.systemLogs.map((l) => (
                <div
                  key={l.id}
                  className="rounded-[10px] border border-[var(--border)] bg-[var(--color-surface-muted)] px-3 py-2"
                >
                  <p className="font-semibold text-[var(--color-ink)]">
                    [{l.level.toUpperCase()}] {l.event}
                  </p>
                  <p className="text-[var(--color-text-muted)]">{l.message}</p>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="glass-surface p-6 space-y-2 text-xs">
          <h2 className="text-base font-semibold text-[var(--color-ink)] flex items-center gap-1.5">
            <ShieldCheck aria-hidden="true" className="h-4 w-4 text-[var(--color-brand)]" />
            Trust List Status
          </h2>
          {data.trustSnapshots.length > 0 ? (
            <p className="font-mono text-[var(--color-text-muted)] break-all">
              Active SHA-256: {data.trustSnapshots[0].sha256}
            </p>
          ) : (
            <p className="text-[var(--color-text-muted)]">
              Will populate on first /api/trust-list/active refresh.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
