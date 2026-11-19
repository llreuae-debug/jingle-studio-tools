import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { Download, Film, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/Logo";
import { getDb, schema } from "@/db";
import { getSessionContext } from "@/lib/auth";
import { getWorkspaceBalance } from "@/lib/credits";
import { getEffectivePlanForWorkspace } from "@/lib/plans";
import { buildPrivacyDownloadUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function AppDashboardPage() {
  const ctx = await getSessionContext();
  if (!ctx) {
    redirect("/login?callbackUrl=/app");
  }

  const db = await getDb();
  const [balance, plan, jobs, privacyRecords] = await Promise.all([
    getWorkspaceBalance(ctx.workspace.id),
    getEffectivePlanForWorkspace(ctx.workspace.id),
    db
      .select()
      .from(schema.signJobs)
      .where(eq(schema.signJobs.workspaceId, ctx.workspace.id))
      .orderBy(desc(schema.signJobs.createdAt))
      .limit(10),
    db
      .select()
      .from(schema.mediaProcessingRecords)
      .where(eq(schema.mediaProcessingRecords.workspaceId, ctx.workspace.id))
      .orderBy(desc(schema.mediaProcessingRecords.createdAt))
      .limit(25),
  ]);

  const ownerScope = `ws:${ctx.workspace.id}`;
  const now = Date.now();

  const totalProcessed = privacyRecords.filter(
    (r) => r.status === "done" || r.status === "expired"
  ).length;
  const imagesInspected = privacyRecords.filter((r) => r.mediaKind === "image").length;
  const videosInspected = privacyRecords.filter((r) => r.mediaKind === "video").length;
  const privacyCleaned = privacyRecords.filter(
    (r) => r.personalMetadataStatus === "removed"
  ).length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <Logo variant="horizontal" size="sm" theme="light" />
          <h1 className="text-2xl font-bold text-[var(--color-ink)]">
            {ctx.workspace.name}
          </h1>
          <p className="text-xs text-[var(--color-text-muted)]">
            Signed in as {ctx.user.email} • Role: {ctx.membership.role} • Plan:{" "}
            <strong>{plan.name}</strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <span className="rounded-full bg-[var(--color-brand-soft)] border border-[var(--color-brand-line)] px-3.5 py-1.5 text-xs font-semibold text-[var(--color-brand)]">
            {balance} credits
          </span>
          <Link href="/tools" className="btn-mint px-4 py-2 text-xs font-semibold">
            Inspect &amp; clean media
          </Link>
          <Link href="/app/sign" className="btn-plum px-4 py-2 text-xs font-semibold">
            New signing batch
          </Link>
        </div>
      </div>

      {/* Overview Metrics */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { label: "Total files processed", value: totalProcessed },
          { label: "Images inspected", value: imagesInspected },
          { label: "Videos inspected", value: videosInspected },
          { label: "Privacy-cleaned files", value: privacyCleaned },
          { label: "Remaining credits", value: balance },
        ].map((stat) => (
          <div key={stat.label} className="glass-surface p-4 space-y-1">
            <p className="text-[11px] font-medium text-[var(--color-text-muted)]">
              {stat.label}
            </p>
            <p className="text-2xl font-bold text-[var(--color-ink)]">{stat.value}</p>
          </div>
        ))}
      </section>

      <nav aria-label="Workspace" className="flex flex-wrap gap-2 text-xs font-medium">
        {[
          { href: "/tools", label: "Media Inspector & Cleaner" },
          { href: "/app/sign", label: "Sign Batch" },
          { href: "/app/jobs", label: "All Signing Jobs" },
          { href: "/app/billing", label: "Credits & Billing" },
          { href: "/app/settings", label: "Account & Profiles" },
          { href: "/app/developers", label: "API Keys" },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-[10px] border border-[var(--border)] bg-white px-3.5 py-2 text-[var(--color-ink)] hover:border-[var(--color-brand)] hover:bg-[var(--color-brand-soft)] transition-colors duration-150"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Processing History Table */}
      <section className="glass-surface p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-[var(--color-ink)]">
            Media Inspection &amp; Cleaning History
          </h2>
          <span className="text-[11px] text-[var(--color-text-muted)]">
            Plan limit: {plan.dailyLimit}/day • {plan.maxImageMb} MB img / {plan.maxVideoMb} MB video
          </span>
        </div>

        {privacyRecords.length === 0 ? (
          <p className="text-xs text-[var(--color-text-muted)]">
            No inspected or privacy-cleaned files yet. Upload an image or video on{" "}
            <Link href="/tools" className="font-semibold text-[var(--color-brand)] underline">
              SynthID Remover
            </Link>{" "}
            to save processing results here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--color-text-muted)]">
                  <th scope="col" className="py-2 pr-4">File</th>
                  <th scope="col" className="py-2 pr-4">Date processed</th>
                  <th scope="col" className="py-2 pr-4">Format</th>
                  <th scope="col" className="py-2 pr-4">Result</th>
                  <th scope="col" className="py-2">Downloads</th>
                </tr>
              </thead>
              <tbody>
                {privacyRecords.map((rec) => {
                  const expired =
                    rec.status === "expired" ||
                    (rec.expiresAt ? rec.expiresAt.getTime() < now : false);
                  const dot = rec.originalName.lastIndexOf(".");
                  const base =
                    dot > 0 ? rec.originalName.slice(0, dot) : rec.originalName;
                  const ext = dot > 0 ? rec.originalName.slice(dot) : "";
                  const cleanName = `${base}-privacy-cleaned${ext}`;
                  const cleanUrl =
                    !expired && rec.status === "done" && rec.cleanedKey
                      ? buildPrivacyDownloadUrl({
                          recordId: rec.id,
                          kind: "cleaned",
                          ownerScope,
                          fileName: cleanName,
                          ttlSeconds: 900,
                        })
                      : null;
                  const origUrl =
                    !expired && rec.status === "done" && rec.originalKey
                      ? buildPrivacyDownloadUrl({
                          recordId: rec.id,
                          kind: "original",
                          ownerScope,
                          fileName: rec.originalName,
                          ttlSeconds: 900,
                        })
                      : null;

                  const metadataLabel =
                    rec.personalMetadataStatus === "removed"
                      ? "Cleaned"
                      : rec.personalMetadataStatus === "preserved"
                        ? "Not Processed"
                        : "Already Clean";

                  const synthIdShortLabel =
                    rec.synthIdStatus === "verified_no_signal"
                      ? "No Signal"
                      : rec.synthIdStatus === "signal_detected"
                        ? "Signal Detected"
                        : rec.synthIdStatus === "inconclusive"
                          ? "Inconclusive"
                          : "Unavailable";

                  return (
                    <tr key={rec.id} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-2.5">
                          <div className="h-9 w-9 shrink-0 overflow-hidden rounded-[8px] border border-[var(--border)] bg-[var(--color-surface-muted)] flex items-center justify-center">
                            {rec.thumbnailDataUrl ? (
                              <img
                                src={rec.thumbnailDataUrl}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : rec.mediaKind === "video" ? (
                              <Film aria-hidden="true" className="h-4 w-4 text-[var(--color-brand)]" />
                            ) : (
                              <ShieldCheck aria-hidden="true" className="h-4 w-4 text-[var(--color-text-muted)]" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-[var(--color-ink)] truncate max-w-[180px]">
                              {rec.originalName}
                            </p>
                            {rec.width && rec.height && (
                              <p className="text-[11px] text-[var(--color-text-muted)]">
                                {rec.width}×{rec.height}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 pr-4 text-[var(--color-text-muted)] whitespace-nowrap">
                        {rec.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                      </td>
                      <td className="py-2.5 pr-4 font-medium">
                        {rec.mimeType.split("/")[1]?.toUpperCase() || rec.mimeType}
                      </td>
                      <td className="py-2.5 pr-4">
                        <div className="flex flex-wrap gap-1.5">
                          <span className="rounded-full bg-[var(--color-surface-muted)] border border-[var(--border)] px-2 py-0.5 text-[11px] font-medium">
                            Metadata: {metadataLabel}
                          </span>
                          <span className="rounded-full bg-[var(--color-brand-soft)] border border-[var(--color-brand-line)] px-2 py-0.5 text-[11px] font-medium text-[var(--color-brand)]">
                            C2PA: {rec.c2paResultStatus.replace("_", " ")}
                          </span>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                              rec.synthIdStatus === "verified_no_signal"
                                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                : rec.synthIdStatus === "signal_detected"
                                  ? "bg-rose-50 border-rose-200 text-rose-700"
                                  : rec.synthIdStatus === "inconclusive"
                                    ? "bg-amber-50 border-amber-200 text-amber-800"
                                    : "bg-slate-100 border-slate-200 text-slate-600"
                            }`}
                          >
                            SynthID: {synthIdShortLabel}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 whitespace-nowrap">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/app/media/${rec.id}`}
                            className="rounded-[8px] border border-[var(--border)] bg-white px-2.5 py-1 text-[11px] font-semibold text-[var(--color-ink)] hover:bg-[var(--color-surface-muted)]"
                          >
                            View Report
                          </Link>
                          {rec.status === "failed" ? (
                            <span className="text-rose-700 font-semibold">Failed</span>
                          ) : cleanUrl ? (
                            <>
                              <a
                                href={cleanUrl}
                                download={cleanName}
                                className="inline-flex items-center gap-1 rounded-[8px] bg-[var(--color-brand)] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[var(--color-brand-hover)]"
                              >
                                <Download aria-hidden="true" className="h-3 w-3" />
                                Download Processed
                              </a>
                              {origUrl && (
                                <a
                                  href={origUrl}
                                  download={rec.originalName}
                                  className="inline-flex items-center gap-1 rounded-[8px] border border-[var(--border)] bg-white px-2.5 py-1 text-[11px] font-semibold text-[var(--color-ink)] hover:bg-[var(--color-surface-muted)]"
                                >
                                  Original
                                </a>
                              )}
                            </>
                          ) : (
                            <span className="text-[var(--color-text-muted)]">Expired</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Existing Signing Jobs Table */}
      <section className="glass-surface p-6 space-y-4">
        <h2 className="text-base font-semibold text-[var(--color-ink)]">Recent C2PA Signing Jobs</h2>
        {jobs.length === 0 ? (
          <p className="text-xs text-[var(--color-text-muted)]">
            No signing jobs yet. Start a batch to attach Content Credentials to your work.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--color-text-muted)]">
                  <th scope="col" className="py-2 pr-4">Job</th>
                  <th scope="col" className="py-2 pr-4">Files</th>
                  <th scope="col" className="py-2 pr-4">Status</th>
                  <th scope="col" className="py-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id} className="border-b border-[var(--border)] last:border-0">
                    <td className="py-2.5 pr-4 font-medium">
                      <Link
                        href={`/app/jobs/${job.id}`}
                        className="text-[var(--color-brand)] hover:underline"
                      >
                        {job.id.slice(0, 8)}…
                      </Link>
                    </td>
                    <td className="py-2.5 pr-4">{job.fileCount}</td>
                    <td className="py-2.5 pr-4">{job.status}</td>
                    <td className="py-2.5 text-[var(--color-text-muted)]">
                      {job.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
