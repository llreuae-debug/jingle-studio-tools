import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Film,
  Shield,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { getDb, schema } from "@/db";
import { getSessionContext } from "@/lib/auth";
import type { MediaMetadataReport } from "@/lib/media-metadata";
import type { ProcessingStageUpdate } from "@/lib/privacy-cleaner";
import { buildPrivacyDownloadUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getMetadataLabel(status: string): "Cleaned" | "Already Clean" | "Not Processed" {
  if (status === "removed") return "Cleaned";
  if (status === "preserved") return "Not Processed";
  return "Already Clean";
}

function getSynthIdBadge(status: string): {
  label: string;
  classes: string;
} {
  if (status === "verified_no_signal") {
    return {
      label: "Verified No Detectable SynthID Signal",
      classes: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    };
  }
  if (status === "signal_detected") {
    return {
      label: "Signal Detected",
      classes: "bg-rose-50 text-rose-700 border border-rose-200",
    };
  }
  if (status === "inconclusive") {
    return {
      label: "Inconclusive",
      classes: "bg-amber-50 text-amber-800 border border-amber-200",
    };
  }
  return {
    label: "Verification Unavailable",
    classes: "bg-slate-100 text-slate-700 border border-slate-200",
  };
}

export default async function MediaRecordDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getSessionContext();
  if (!ctx) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/app/media/${id}`)}`);
  }

  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.mediaProcessingRecords)
    .where(
      and(
        eq(schema.mediaProcessingRecords.id, id),
        eq(schema.mediaProcessingRecords.workspaceId, ctx.workspace.id)
      )
    );

  if (rows.length === 0) {
    notFound();
  }

  const rec = rows[0];
  const downloads = await db
    .select()
    .from(schema.mediaDownloadRecords)
    .where(eq(schema.mediaDownloadRecords.recordId, rec.id))
    .orderBy(desc(schema.mediaDownloadRecords.downloadedAt))
    .limit(20);

  const now = Date.now();
  const expired =
    rec.status === "expired" ||
    (rec.expiresAt ? rec.expiresAt.getTime() < now : false);
  const ownerScope = `ws:${ctx.workspace.id}`;

  const dot = rec.originalName.lastIndexOf(".");
  const base = dot > 0 ? rec.originalName.slice(0, dot) : rec.originalName;
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

  const removedFields = Array.isArray(rec.removedFields) ? rec.removedFields : [];
  const beforeMeta = (rec.beforeMetadata || null) as MediaMetadataReport | null;
  const afterMeta = (rec.afterMetadata || null) as MediaMetadataReport | null;
  const stages = Array.isArray(rec.processingStages)
    ? (rec.processingStages as ProcessingStageUpdate[])
    : [];

  const synthBadge = getSynthIdBadge(rec.synthIdStatus);
  const metaLabel = getMetadataLabel(rec.personalMetadataStatus);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/app"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-brand)] hover:underline"
        >
          <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
          Back to Dashboard
        </Link>
        <span className="text-[11px] text-[var(--color-text-muted)]">
          Record ID: <code className="font-mono">{rec.id}</code>
        </span>
      </div>

      {/* Overview Header Card */}
      <section className="glass-surface p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--color-surface-muted)] flex items-center justify-center">
              {rec.thumbnailDataUrl ? (
                <img
                  src={rec.thumbnailDataUrl}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : rec.mediaKind === "video" ? (
                <Film aria-hidden="true" className="h-6 w-6 text-[var(--color-brand)]" />
              ) : (
                <ShieldCheck aria-hidden="true" className="h-6 w-6 text-[var(--color-brand)]" />
              )}
            </div>
            <div className="min-w-0">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 mb-1">
                <CheckCircle2 aria-hidden="true" className="h-3 w-3" />
                {rec.synthIdStatus === "verified_no_signal"
                  ? "Your Image Is SynthID-Free"
                  : "Saved Analysis Report"}
              </span>
              <h1 className="text-xl font-bold text-[var(--color-ink)] truncate max-w-md">
                {rec.originalName}
              </h1>
              <p className="text-xs text-[var(--color-text-muted)]">
                {rec.mimeType} • Original {formatBytes(rec.fileSizeBytes)}
                {rec.cleanedSizeBytes !== null
                  ? ` → Cleaned ${formatBytes(rec.cleanedSizeBytes)}`
                  : ""}
                {rec.width && rec.height ? ` • ${rec.width}×${rec.height} px` : ""}
                {rec.processingTimeMs !== null ? ` • ${(rec.processingTimeMs / 1000).toFixed(2)}s` : ""}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {cleanUrl ? (
              <a
                href={cleanUrl}
                download={cleanName}
                className="inline-flex items-center gap-1.5 btn-plum px-4 py-2 text-xs font-semibold"
              >
                <Download aria-hidden="true" className="h-3.5 w-3.5" />
                Download Processed {rec.mediaKind === "video" ? "Video" : "Image"}
              </a>
            ) : (
              <span className="rounded-[10px] border border-[var(--border)] bg-[var(--color-surface-muted)] px-3.5 py-2 text-xs text-[var(--color-text-muted)]">
                Files expired
              </span>
            )}
            {origUrl && (
              <a
                href={origUrl}
                download={rec.originalName}
                className="inline-flex items-center gap-1.5 rounded-[10px] border border-[var(--border)] bg-white px-4 py-2 text-xs font-semibold text-[var(--color-ink)] hover:bg-[var(--color-surface-muted)]"
              >
                <Download aria-hidden="true" className="h-3.5 w-3.5" />
                Download Original
              </a>
            )}
          </div>
        </div>

        {/* 3 Verification Panels */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="rounded-[14px] border border-[var(--border)] bg-[var(--color-surface-muted)] p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold text-[var(--color-ink)] flex items-center gap-1.5">
                <Shield aria-hidden="true" className="h-3.5 w-3.5 text-[var(--color-brand)]" />
                1. C2PA Content Credentials
              </p>
              <span className="rounded-full bg-white border border-[var(--border)] px-2 py-0.5 text-[11px] font-bold">
                {rec.c2paResultStatus === "preserved"
                  ? "Preserved"
                  : rec.c2paResultStatus === "unable_to_preserve"
                    ? "Unable to Verify"
                    : "Not Detected"}
              </span>
            </div>
            <p className="text-[var(--color-text-muted)]">
              Signature status:{" "}
              <strong>{rec.c2paCredentialStatus || "Not detected"}</strong>
              {rec.c2paIssuer ? ` • Issuer: ${rec.c2paIssuer}` : ""}
            </p>
          </div>

          <div className="rounded-[14px] border border-[var(--border)] bg-[var(--color-surface-muted)] p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="font-bold text-[var(--color-ink)]">2. Personal Metadata</p>
              <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                {metaLabel}
              </span>
            </div>
            <p className="text-[var(--color-text-muted)]">
              {removedFields.length > 0
                ? `Removed: ${removedFields.join(", ")}`
                : rec.personalMetadataStatus === "preserved"
                  ? "Metadata preserved per options or to keep C2PA hash intact."
                  : "No personal metadata tags were present in the file."}
            </p>
          </div>

          <div className="rounded-[14px] border border-[var(--border)] bg-[var(--color-surface-muted)] p-4 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="font-bold text-[var(--color-ink)] flex items-center gap-1.5">
                {rec.synthIdStatus === "signal_detected" ? (
                  <ShieldAlert aria-hidden="true" className="h-3.5 w-3.5 text-rose-600" />
                ) : (
                  <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
                )}
                3. SynthID Verification
              </p>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${synthBadge.classes}`}>
                {synthBadge.label}
              </span>
            </div>
            <p className="text-[var(--color-text-muted)]">
              {rec.synthIdDetail ||
                "No external SynthID verification detector was available when this file was checked."}
            </p>
          </div>
        </div>

        {/* Cryptographic Hashes */}
        <div className="rounded-[14px] border border-[var(--border)] bg-[var(--color-surface-muted)] p-4 text-[11px] font-mono space-y-1 text-[var(--color-text-muted)]">
          <p className="break-all">
            <strong className="text-[var(--color-ink)]">Input SHA-256:</strong>{" "}
            {rec.inputSha256 || "N/A"}
          </p>
          <p className="break-all">
            <strong className="text-[var(--color-ink)]">Output SHA-256:</strong>{" "}
            {rec.outputSha256 || "N/A"}
          </p>
        </div>
      </section>

      {/* Before / After Comparison Table */}
      {beforeMeta && afterMeta && (
        <section className="glass-surface p-6 space-y-4">
          <h2 className="text-base font-bold text-[var(--color-ink)]">
            Before &amp; After Metadata Comparison
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--color-text-muted)]">
                  <th scope="col" className="py-2 pr-4">Property</th>
                  <th scope="col" className="py-2 pr-4">Before Cleaning</th>
                  <th scope="col" className="py-2">After Cleaning</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[var(--border)]">
                  <td className="py-2 pr-4 font-semibold">Dimensions</td>
                  <td className="py-2 pr-4">
                    {beforeMeta.width && beforeMeta.height
                      ? `${beforeMeta.width}×${beforeMeta.height}`
                      : "N/A"}
                  </td>
                  <td className="py-2">
                    {afterMeta.width && afterMeta.height
                      ? `${afterMeta.width}×${afterMeta.height}`
                      : "N/A"}
                  </td>
                </tr>
                <tr className="border-b border-[var(--border)]">
                  <td className="py-2 pr-4 font-semibold">GPS Location</td>
                  <td className="py-2 pr-4">{beforeMeta.hasGps ? "Present" : "None"}</td>
                  <td className="py-2">{afterMeta.hasGps ? "Present" : "Removed / None"}</td>
                </tr>
                <tr className="border-b border-[var(--border)]">
                  <td className="py-2 pr-4 font-semibold">EXIF Segment</td>
                  <td className="py-2 pr-4">{beforeMeta.hasExif ? "Present" : "None"}</td>
                  <td className="py-2">{afterMeta.hasExif ? "Present" : "Removed / None"}</td>
                </tr>
                <tr className="border-b border-[var(--border)]">
                  <td className="py-2 pr-4 font-semibold">Camera Info</td>
                  <td className="py-2 pr-4">
                    {beforeMeta.exif?.make || beforeMeta.exif?.model
                      ? `${beforeMeta.exif.make || ""} ${beforeMeta.exif.model || ""}`.trim()
                      : "None"}
                  </td>
                  <td className="py-2">
                    {afterMeta.exif?.make || afterMeta.exif?.model
                      ? `${afterMeta.exif.make || ""} ${afterMeta.exif.model || ""}`.trim()
                      : "Removed / None"}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-semibold">Detected Tags</td>
                  <td className="py-2 pr-4">{beforeMeta.rawTagCount}</td>
                  <td className="py-2">{afterMeta.rawTagCount}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 10-Stage Processing Timeline & Download Audit */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="glass-surface p-6 space-y-3">
          <h2 className="text-base font-bold text-[var(--color-ink)]">
            Processing Pipeline Audit ({stages.length} stages)
          </h2>
          {stages.length === 0 ? (
            <p className="text-xs text-[var(--color-text-muted)]">
              Detailed stage telemetry was not recorded for this legacy entry.
            </p>
          ) : (
            <ol className="space-y-2 text-xs">
              {stages.map((st) => (
                <li
                  key={`${st.step}-${st.key}`}
                  className="flex items-start justify-between gap-3 rounded-[10px] border border-[var(--border)] bg-[var(--color-surface-muted)] px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--color-ink)]">
                      {st.step}. {st.label}
                    </p>
                    {st.detail && (
                      <p className="text-[11px] text-[var(--color-text-muted)] break-words">
                        {st.detail}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 rounded-full bg-white border border-[var(--border)] px-2 py-0.5 text-[10px] font-bold uppercase">
                    {st.status}
                    {st.durationMs !== undefined ? ` (${st.durationMs}ms)` : ""}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="glass-surface p-6 space-y-3">
          <h2 className="text-base font-bold text-[var(--color-ink)]">
            Download Activity ({downloads.length})
          </h2>
          {downloads.length === 0 ? (
            <p className="text-xs text-[var(--color-text-muted)]">
              No downloads have been recorded for this item yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[var(--color-text-muted)]">
                    <th scope="col" className="py-2 pr-3">Variant</th>
                    <th scope="col" className="py-2 pr-3">Size</th>
                    <th scope="col" className="py-2">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {downloads.map((d) => (
                    <tr key={d.id} className="border-b border-[var(--border)] last:border-0">
                      <td className="py-2 pr-3 font-semibold capitalize">{d.kind}</td>
                      <td className="py-2 pr-3">{formatBytes(d.bytesSent)}</td>
                      <td className="py-2 text-[var(--color-text-muted)] whitespace-nowrap">
                        {d.downloadedAt.toISOString().slice(0, 19).replace("T", " ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
