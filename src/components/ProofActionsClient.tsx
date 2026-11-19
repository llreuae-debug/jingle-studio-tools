"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

export function ProofActionsClient({
  slug,
  canRevoke,
}: {
  slug: string;
  canRevoke: boolean;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("misleading_disclosure");
  const [details, setDetails] = useState("");
  const [reporterEmail, setReporterEmail] = useState("");
  const [reportSent, setReportSent] = useState(false);
  const [submittingReport, setSubmittingReport] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleRevoke = async () => {
    setRevoking(true);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/proof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke", slug }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const body = await res.json().catch(() => ({}));
        setErrorMsg(body.error || "Could not revoke proof page.");
      }
    } catch {
      setErrorMsg("Network error revoking proof page.");
    } finally {
      setRevoking(false);
    }
  };

  const handleReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingReport) return;
    setSubmittingReport(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/proof/${slug}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, details, reporterEmail }),
      });
      if (res.ok) {
        setReportSent(true);
        setDetails("");
      } else {
        const body = await res.json().catch(() => ({}));
        setErrorMsg(body.error || "Could not submit report.");
      }
    } catch {
      setErrorMsg("Network error submitting report.");
    } finally {
      setSubmittingReport(false);
    }
  };

  return (
    <div className="space-y-6">
      {errorMsg && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">
          {errorMsg}
        </div>
      )}
      {canRevoke && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 flex items-center justify-between gap-3">
          <span className="text-xs text-rose-950">
            Workspace owner controls: you can revoke this public proof page at any time.
          </span>
          <button
            type="button"
            disabled={revoking}
            onClick={() => void handleRevoke()}
            className="rounded-lg bg-[#C83C4D] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {revoking ? "Revoking…" : "Revoke proof page"}
          </button>
        </div>
      )}

      <details className="rounded-xl border border-[var(--color-border)] bg-white p-4">
        <summary className="cursor-pointer text-xs font-semibold text-[var(--color-ink)]">
          Report abuse or misleading disclosure
        </summary>
        {reportSent ? (
          <p className="mt-3 text-xs text-[#16865B] font-medium">
            Report submitted. Our operations team will review it.
          </p>
        ) : (
          <form onSubmit={handleReport} className="mt-3 space-y-3 text-xs">
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2"
            >
              <option value="misleading_disclosure">Misleading AI disclosure</option>
              <option value="impersonation">Creator impersonation</option>
              <option value="other">Other</option>
            </select>
            <textarea
              placeholder="Details (optional)"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2"
              rows={3}
            />
            <input
              type="email"
              placeholder="Your email (optional)"
              value={reporterEmail}
              onChange={(e) => setReporterEmail(e.target.value)}
              className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2"
            />
            <button
              type="submit"
              disabled={submittingReport}
              className="rounded-lg bg-[var(--color-navy)] px-4 py-2 font-semibold text-white disabled:opacity-60"
            >
              {submittingReport ? "Submitting…" : "Submit report"}
            </button>
          </form>
        )}
      </details>
    </div>
  );
}
