"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Download, ExternalLink, FileArchive, RefreshCw } from "lucide-react";

interface JobItemView {
  id: string;
  originalName: string;
  mimeType: string;
  status: string;
  errorCode: string | null;
  errorMessage: string | null;
  expiresAt: string | null;
  downloadUrl: string | null;
  publicProof: { slug: string; status: string } | null;
}

interface JobDetailView {
  job: {
    id: string;
    status: string;
    fileCount: number;
    creditsReserved: number;
    creatorName: string;
  };
  items: JobItemView[];
}

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const jobId = params.id;

  const [data, setData] = useState<JobDetailView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const loadJob = useCallback(async () => {
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (!res.ok) {
        const body = await res.json();
        setError(body.error || "Could not load job.");
        return;
      }
      const json = (await res.json()) as JobDetailView;
      setData(json);
    } catch {
      setError("Network error loading job.");
    }
  }, [jobId]);

  useEffect(() => {
    void loadJob();
  }, [loadJob]);

  useEffect(() => {
    if (!data) return;
    if (data.job.status === "queued" || data.job.status === "running") {
      const timer = setInterval(() => {
        void loadJob();
      }, 1500);
      return () => clearInterval(timer);
    }
  }, [data, loadJob]);

  const publishProof = async (itemId: string) => {
    setPublishingId(itemId);
    try {
      const res = await fetch("/api/proof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId }),
      });
      if (res.ok) {
        await loadJob();
      }
    } finally {
      setPublishingId(null);
    }
  };

  if (error) {
    return (
      <div className="rounded-xl border border-[#C83C4D]/30 bg-rose-50 p-4 text-sm text-rose-950">
        {error}
      </div>
    );
  }

  if (!data) {
    return <div className="py-12 text-center text-sm text-[var(--color-muted)]">Loading job…</div>;
  }

  const doneCount = data.items.filter((i) => i.status === "done").length;
  const pct = data.items.length > 0 ? Math.round((doneCount / data.items.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/app/jobs" className="text-xs text-[var(--color-blue)] hover:underline">
            ← Back to jobs
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-[var(--color-ink)]">
            Batch Job {data.job.id.slice(0, 8)}
          </h1>
          <p className="text-xs text-[var(--color-muted)]">
            Status: <strong>{data.job.status}</strong> • {doneCount} / {data.items.length} signed
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadJob()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-xs font-medium text-[var(--color-ink)]"
          >
            <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
            Refresh
          </button>
          {doneCount > 0 && (
            <a
              href={`/api/jobs/${data.job.id}/zip`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--color-blue)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--color-electric)]"
            >
              <FileArchive aria-hidden="true" className="h-4 w-4" />
              Download ZIP
            </a>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-[var(--color-border)] bg-white p-4 space-y-2">
        <div className="flex justify-between text-xs text-[var(--color-muted)]">
          <span>Batch progress</span>
          <span>{pct}%</span>
        </div>
        <progress value={doneCount} max={Math.max(1, data.items.length)} className="w-full h-2" />
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-white p-6 space-y-3">
        <h2 className="text-base font-semibold text-[var(--color-ink)]">Files</h2>
        <ul className="divide-y divide-[var(--color-border)]">
          {data.items.map((item) => (
            <li
              key={item.id}
              className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--color-ink)] truncate">
                  {item.originalName}
                </p>
                <p className="text-xs text-[var(--color-muted)]">
                  Status: <strong>{item.status}</strong>
                  {item.errorMessage ? ` — ${item.errorMessage}` : ""}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {item.downloadUrl && (
                  <a
                    href={item.downloadUrl}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink)] hover:border-[var(--color-blue)]"
                  >
                    <Download aria-hidden="true" className="h-3.5 w-3.5" />
                    Download
                  </a>
                )}

                {item.status === "done" && !item.publicProof && (
                  <button
                    type="button"
                    disabled={publishingId === item.id}
                    onClick={() => void publishProof(item.id)}
                    className="rounded-lg bg-[var(--color-navy)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {publishingId === item.id ? "Publishing…" : "Publish proof page"}
                  </button>
                )}

                {item.publicProof && (
                  <Link
                    href={`/p/${item.publicProof.slug}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-900"
                  >
                    Proof ({item.publicProof.status})
                    <ExternalLink aria-hidden="true" className="h-3 w-3" />
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
