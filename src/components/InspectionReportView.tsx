"use client";

import React, { useId, useState } from "react";
import type { InspectionResult } from "@/lib/c2pa-inspect";
import type {
  InspectionStatusLabel,
  LocalMediaInspection,
} from "@/lib/browser-media-inspector";
import {
  buildInspectionReportJson,
  buildInspectionReportPdf,
  type ExportableInspectionReport,
} from "@/lib/pdf-report";
import { triggerVerifiedBlobDownload } from "@/lib/canvas-image-tools";

export type InspectionCategoryStatus = InspectionStatusLabel;

export interface SynthIdPanelData {
  statusLabel: string;
  badgeStatus: InspectionStatusLabel;
  explanation: string;
}

export interface PrivacyCleanPanelData {
  cleaned: boolean;
  removedFields: string[];
  preservedOriginalBytes: boolean;
  outputSha256: string | null;
  cleanedSizeBytes: number | null;
}

export interface InspectionReportViewProps {
  localInspection: LocalMediaInspection;
  c2paResult: InspectionResult | null;
  c2paError?: string | null;
  synthIdData?: SynthIdPanelData | null;
  privacyCleanData?: PrivacyCleanPanelData | null;
  hideExportButtons?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDuration(sec?: number): string {
  if (sec === undefined || !Number.isFinite(sec) || sec <= 0) return "Unknown";
  if (sec < 60) return `${sec.toFixed(2)} s`;
  const mins = Math.floor(sec / 60);
  const rem = (sec % 60).toFixed(1);
  return `${mins}m ${rem}s`;
}

function StatusBadge({ status }: { status: InspectionStatusLabel }) {
  const styles: Record<
    InspectionStatusLabel,
    { bg: string; border: string; text: string; icon: string }
  > = {
    Verified: {
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      text: "text-emerald-800",
      icon: "✓",
    },
    Detected: {
      bg: "bg-indigo-50",
      border: "border-indigo-200",
      text: "text-indigo-800",
      icon: "●",
    },
    "Not detected": {
      bg: "bg-slate-50",
      border: "border-slate-200",
      text: "text-slate-700",
      icon: "○",
    },
    Unsupported: {
      bg: "bg-zinc-50",
      border: "border-zinc-200",
      text: "text-zinc-700",
      icon: "—",
    },
    "Unable to verify": {
      bg: "bg-amber-50",
      border: "border-amber-200",
      text: "text-amber-800",
      icon: "!",
    },
    "Inspection failed": {
      bg: "bg-rose-50",
      border: "border-rose-200",
      text: "text-rose-800",
      icon: "✕",
    },
  };
  const s = styles[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${s.bg} ${s.border} ${s.text}`}
    >
      <span aria-hidden="true">{s.icon}</span>
      <span>{status}</span>
    </span>
  );
}

function mapC2paStatus(
  c2pa: InspectionResult | null,
  c2paError: string | null | undefined,
  hasC2paBox: boolean
): InspectionStatusLabel {
  if (c2paError) return "Inspection failed";
  if (!c2pa) return hasC2paBox ? "Detected" : "Unable to verify";
  if (c2pa.status === "verified") return "Verified";
  if (c2pa.status === "unrecognized" || c2pa.status === "warning") return "Unable to verify";
  if (hasC2paBox) return "Detected";
  return "Not detected";
}

export default function InspectionReportView({
  localInspection,
  c2paResult,
  c2paError,
  synthIdData,
  privacyCleanData,
  hideExportButtons = false,
}: InspectionReportViewProps) {
  const [showGps, setShowGps] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);
  const tableCaptionId = useId();

  const { fileInfo, integrity, exif, iptcXmp, videoInfo, hasC2paBox } = localInspection;

  const c2paStatus = mapC2paStatus(c2paResult, c2paError, hasC2paBox);
  const provenanceStatus: InspectionStatusLabel =
    c2paStatus === "Verified"
      ? "Verified"
      : hasC2paBox || Boolean(c2paResult?.rootNode)
        ? "Detected"
        : "Not detected";

  const effectiveSynthId: SynthIdPanelData = synthIdData ?? {
    statusLabel: "SynthID verification unavailable",
    badgeStatus: "Unable to verify",
    explanation:
      "No client-side or unconfigured SynthID detector can verify Google DeepMind pixel watermarks. Absence of a detected signal does not prove SynthID is absent.",
  };

  const buildReportPayload = (): ExportableInspectionReport => ({
    generatedAt: new Date().toISOString(),
    localInspection,
    c2paInspection: c2paResult
      ? {
          status: c2paResult.status,
          title: c2paResult.statusHeadline,
          subtitle: c2paResult.statusDetail,
          issuer: c2paResult.rootNode?.issuer ?? null,
          signingTime: c2paResult.rootNode?.signingTimeLocal ?? null,
          claimGenerator: c2paResult.rootNode?.claimGenerator ?? null,
          aiUseLabel: c2paResult.rootNode?.aiInfo.isAiGeneratedOrModified
            ? "AI-generated or modified"
            : "No AI generation claim declared",
          actionsCount: c2paResult.rootNode?.actions.length ?? 0,
          ingredientsCount: c2paResult.rootNode?.ingredients.length ?? 0,
          validationErrors: c2paResult.validationErrors,
        }
      : null,
    synthIdSummary: {
      statusLabel: effectiveSynthId.statusLabel,
      explanation: effectiveSynthId.explanation,
    },
    privacyCleanSummary: privacyCleanData ?? null,
  });

  const handleDownloadJson = () => {
    try {
      const jsonText = buildInspectionReportJson(buildReportPayload());
      const blob = new Blob([jsonText], { type: "application/json;charset=utf-8" });
      const base = fileInfo.fileName.replace(/\.[^.]+$/, "") || "media";
      triggerVerifiedBlobDownload(blob, `${base}-inspection-report.json`);
      setDownloadStatus(`JSON inspection report downloaded (${formatBytes(blob.size)}).`);
    } catch (err) {
      setDownloadStatus(
        err instanceof Error ? err.message : "Failed to generate JSON inspection report."
      );
    }
  };

  const handleDownloadPdf = () => {
    try {
      const pdfBytes = buildInspectionReportPdf(buildReportPayload());
      const copy = new Uint8Array(pdfBytes.byteLength);
      copy.set(pdfBytes);
      const blob = new Blob([copy.buffer], { type: "application/pdf" });
      const base = fileInfo.fileName.replace(/\.[^.]+$/, "") || "media";
      triggerVerifiedBlobDownload(blob, `${base}-inspection-report.pdf`);
      setDownloadStatus(`PDF inspection report downloaded (${formatBytes(blob.size)}).`);
    } catch (err) {
      setDownloadStatus(
        err instanceof Error ? err.message : "Failed to generate PDF inspection report."
      );
    }
  };

  const xmpEntries = Object.entries(iptcXmp.xmp);
  const textChunkEntries = Object.entries(iptcXmp.textChunks);
  const cleanedDone = Boolean(privacyCleanData?.cleaned);

  return (
    <section
      aria-label="8-Category Inspection Report"
      className="mt-6 space-y-6 rounded-2xl border border-[var(--border)] bg-white p-5 shadow-xs sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--border)] pb-4">
        <div>
          <h3 className="text-lg font-bold tracking-tight text-[var(--color-ink)]">
            8-Category Media Inspection Report
          </h3>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            Read-only local inspection of container headers, metadata, provenance, and file integrity.
          </p>
        </div>
        {!hideExportButtons && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadJson}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-[var(--border)] bg-white px-3.5 py-2 text-xs font-semibold text-[var(--color-ink)] transition-colors hover:bg-[var(--color-brand-soft)]"
            >
              Download JSON Report
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[var(--color-brand)] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[var(--color-brand-hover)]"
            >
              Download PDF Report
            </button>
          </div>
        )}
      </div>

      {downloadStatus && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-900"
        >
          {downloadStatus}
        </div>
      )}

      {/* 8 Inspection Categories Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* 1. Media File Information */}
        <article className="rounded-xl border border-[var(--border)] bg-[var(--color-surface-muted)] p-4">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <h4 className="text-sm font-bold text-[var(--color-ink)]">1. Media file information</h4>
            <StatusBadge status="Verified" />
          </div>
          <dl className="grid grid-cols-[120px_1fr] gap-x-2 gap-y-1.5 text-xs">
            <dt className="text-[var(--color-text-muted)]">File name</dt>
            <dd className="truncate font-medium text-[var(--color-ink)]" title={fileInfo.fileName}>
              {fileInfo.fileName}
            </dd>
            <dt className="text-[var(--color-text-muted)]">Detected format</dt>
            <dd className="font-medium text-[var(--color-ink)]">
              {fileInfo.detectedFormat} ({fileInfo.mimeType})
            </dd>
            <dt className="text-[var(--color-text-muted)]">File size</dt>
            <dd className="font-medium text-[var(--color-ink)]">
              {formatBytes(fileInfo.fileSizeBytes)} ({fileInfo.fileSizeBytes.toLocaleString()} bytes)
            </dd>
            <dt className="text-[var(--color-text-muted)]">Dimensions</dt>
            <dd className="font-medium text-[var(--color-ink)]">
              {fileInfo.width && fileInfo.height
                ? `${fileInfo.width} × ${fileInfo.height} px`
                : "Not reported by container"}
            </dd>
            <dt className="text-[var(--color-text-muted)]">SHA-256</dt>
            <dd className="break-all font-mono text-[11px] text-[var(--color-text-muted)]">
              {fileInfo.sha256 ?? "Unavailable"}
            </dd>
          </dl>
        </article>

        {/* 2. EXIF Metadata */}
        <article className="rounded-xl border border-[var(--border)] bg-[var(--color-surface-muted)] p-4">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <h4 className="text-sm font-bold text-[var(--color-ink)]">2. EXIF metadata</h4>
            <StatusBadge status={exif.status} />
          </div>
          {exif.hasExif ? (
            <div className="space-y-2 text-xs">
              <dl className="grid grid-cols-[120px_1fr] gap-x-2 gap-y-1">
                <dt className="text-[var(--color-text-muted)]">Camera / Device</dt>
                <dd className="font-medium text-[var(--color-ink)]">
                  {[exif.make, exif.model].filter(Boolean).join(" ") || "Not present"}
                </dd>
                <dt className="text-[var(--color-text-muted)]">Software</dt>
                <dd className="font-medium text-[var(--color-ink)]">
                  {exif.software || exif.editingSoftware || "Not present"}
                </dd>
                <dt className="text-[var(--color-text-muted)]">Capture time</dt>
                <dd className="font-medium text-[var(--color-ink)]">
                  {exif.dateTimeOriginal || exif.createDate || "Not present"}
                </dd>
                <dt className="text-[var(--color-text-muted)]">EXIF tags found</dt>
                <dd className="font-medium text-[var(--color-ink)]">{exif.rawTagCount} tags</dd>
                <dt className="text-[var(--color-text-muted)]">GPS location</dt>
                <dd className="font-medium text-[var(--color-ink)]">
                  {exif.hasGps ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span>
                        {showGps && exif.gps
                          ? `${exif.gps.latitude?.toFixed(5) ?? "?"}, ${exif.gps.longitude?.toFixed(5) ?? "?"}`
                          : "Coordinates hidden for privacy"}
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowGps((v) => !v)}
                        className="rounded-md border border-[var(--color-brand-line)] bg-white px-2 py-0.5 text-[11px] font-semibold text-[var(--color-brand)] hover:bg-[var(--color-brand-soft)]"
                      >
                        {showGps ? "Hide GPS coordinates" : "Show GPS coordinates"}
                      </button>
                    </div>
                  ) : (
                    "Not detected"
                  )}
                </dd>
              </dl>
            </div>
          ) : (
            <p className="text-xs text-[var(--color-text-muted)]">
              No embedded EXIF camera, software, or GPS tags were detected in this file.
            </p>
          )}
        </article>

        {/* 3. IPTC & XMP Metadata */}
        <article className="rounded-xl border border-[var(--border)] bg-[var(--color-surface-muted)] p-4">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <h4 className="text-sm font-bold text-[var(--color-ink)]">3. IPTC &amp; XMP metadata</h4>
            <StatusBadge status={iptcXmp.status} />
          </div>
          <dl className="grid grid-cols-[120px_1fr] gap-x-2 gap-y-1.5 text-xs">
            <dt className="text-[var(--color-text-muted)]">IPTC block</dt>
            <dd className="font-medium text-[var(--color-ink)]">
              {iptcXmp.hasIptc ? `Detected (${iptcXmp.iptcBytes ?? 0} bytes)` : "Not detected"}
            </dd>
            <dt className="text-[var(--color-text-muted)]">XMP fields</dt>
            <dd className="font-medium text-[var(--color-ink)]">
              {xmpEntries.length > 0
                ? xmpEntries
                    .slice(0, 3)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(" · ")
                : "Not detected"}
            </dd>
            <dt className="text-[var(--color-text-muted)]">Text chunks</dt>
            <dd className="font-medium text-[var(--color-ink)]">
              {textChunkEntries.length > 0
                ? `${textChunkEntries.length} embedded text chunk(s)`
                : "None"}
            </dd>
          </dl>
        </article>

        {/* 4. C2PA Content Credentials Verification */}
        <article className="rounded-xl border border-[var(--border)] bg-[var(--color-surface-muted)] p-4">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <h4 className="text-sm font-bold text-[var(--color-ink)]">
              4. C2PA Content Credentials verification
            </h4>
            <StatusBadge status={c2paStatus} />
          </div>
          <dl className="grid grid-cols-[120px_1fr] gap-x-2 gap-y-1.5 text-xs">
            <dt className="text-[var(--color-text-muted)]">Status</dt>
            <dd className="font-medium text-[var(--color-ink)]">
              {c2paResult?.statusHeadline ?? (hasC2paBox ? "C2PA container detected" : "No C2PA manifest")}
            </dd>
            <dt className="text-[var(--color-text-muted)]">Issuer</dt>
            <dd className="font-medium text-[var(--color-ink)]">
              {c2paResult?.rootNode?.issuer ?? "Not available"}
            </dd>
            <dt className="text-[var(--color-text-muted)]">Signing tool</dt>
            <dd className="font-medium text-[var(--color-ink)]">
              {c2paResult?.rootNode?.claimGenerator ?? "Not available"}
            </dd>
            <dt className="text-[var(--color-text-muted)]">Signed at</dt>
            <dd className="font-medium text-[var(--color-ink)]">
              {c2paResult?.rootNode?.signingTimeLocal ?? "Not available"}
            </dd>
          </dl>
        </article>

        {/* 5. Embedded Provenance Information */}
        <article className="rounded-xl border border-[var(--border)] bg-[var(--color-surface-muted)] p-4">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <h4 className="text-sm font-bold text-[var(--color-ink)]">
              5. Embedded provenance information
            </h4>
            <StatusBadge status={provenanceStatus} />
          </div>
          <p className="text-xs leading-relaxed text-[var(--color-text-muted)]">
            {hasC2paBox || c2paResult?.rootNode
              ? `JUMBF/C2PA manifest carrier box detected (${c2paResult?.rootNode?.actions.length ?? 0} action assertion(s), ${c2paResult?.rootNode?.ingredients.length ?? 0} ingredient(s)). Privacy cleaning preserves cryptographic provenance intact.`
              : "No embedded C2PA or JUMBF provenance manifest box was found in this file."}
          </p>
        </article>

        {/* 6. Available SynthID Verification Status */}
        <article className="rounded-xl border border-[var(--border)] bg-[var(--color-surface-muted)] p-4">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <h4 className="text-sm font-bold text-[var(--color-ink)]">
              6. Available SynthID verification status
            </h4>
            <StatusBadge status={effectiveSynthId.badgeStatus} />
          </div>
          <p className="text-xs font-semibold text-[var(--color-ink)]">{effectiveSynthId.statusLabel}</p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-muted)]">
            {effectiveSynthId.explanation}
          </p>
        </article>

        {/* 7. Video Container & Frame Information */}
        <article className="rounded-xl border border-[var(--border)] bg-[var(--color-surface-muted)] p-4">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <h4 className="text-sm font-bold text-[var(--color-ink)]">
              7. Video container &amp; frame information
            </h4>
            <StatusBadge status={videoInfo.status} />
          </div>
          {videoInfo.supported ? (
            <div className="space-y-2 text-xs">
              <dl className="grid grid-cols-[120px_1fr] gap-x-2 gap-y-1">
                <dt className="text-[var(--color-text-muted)]">Container / Codec</dt>
                <dd className="font-medium text-[var(--color-ink)]">
                  {videoInfo.container ?? "Video"} · {videoInfo.videoCodec ?? "Unknown"}
                </dd>
                <dt className="text-[var(--color-text-muted)]">Duration / FPS</dt>
                <dd className="font-medium text-[var(--color-ink)]">
                  {formatDuration(videoInfo.durationSec)} · {videoInfo.frameRate ?? "Variable/Unknown"}
                </dd>
                <dt className="text-[var(--color-text-muted)]">Overall bitrate</dt>
                <dd className="font-medium text-[var(--color-ink)]">
                  {videoInfo.bitrateKbps ? `${videoInfo.bitrateKbps.toLocaleString()} kbps` : "Unknown"}
                </dd>
                <dt className="text-[var(--color-text-muted)]">Audio stream</dt>
                <dd className="font-medium text-[var(--color-ink)]">
                  {videoInfo.audioCodec
                    ? `${videoInfo.audioCodec}${videoInfo.audioChannels ? ` (${videoInfo.audioChannels} ch)` : ""}${videoInfo.audioSampleRate ? ` @ ${videoInfo.audioSampleRate} Hz` : ""}`
                    : "No audio stream detected"}
                </dd>
              </dl>
              <p className="rounded-lg bg-amber-50/70 px-2.5 py-1.5 text-[11px] text-amber-900">
                {videoInfo.containerOnlyNotice}
              </p>
            </div>
          ) : (
            <p className="text-xs text-[var(--color-text-muted)]">
              Not applicable to still image files. Upload an MP4, MOV, or WebM video to inspect container streams.
            </p>
          )}
        </article>

        {/* 8. File Integrity & Format Validation */}
        <article className="rounded-xl border border-[var(--border)] bg-[var(--color-surface-muted)] p-4">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <h4 className="text-sm font-bold text-[var(--color-ink)]">
              8. File integrity &amp; format validation
            </h4>
            <StatusBadge status={integrity.status} />
          </div>
          <ul className="space-y-1 text-xs text-[var(--color-text-muted)]">
            <li>Magic-byte signature: {integrity.magicBytesValid ? "Valid" : "Invalid"}</li>
            <li>Extension matches header: {integrity.extensionMatchesHeader ? "Yes" : "Mismatch"}</li>
            <li>Container structure: {integrity.structureValid ? "Valid" : "Truncated or malformed"}</li>
            <li>Polyglot safety check: {integrity.polyglotSafe ? "Passed" : "Suspicious embedded header"}</li>
            <li>
              Browser decode check:{" "}
              {integrity.pixelDecodeValid === true
                ? "Decoded cleanly"
                : integrity.pixelDecodeValid === false
                  ? "Failed to decode"
                  : "Not run"}
            </li>
          </ul>
        </article>
      </div>

      {/* Section 5: Before-and-After Comparison Table */}
      <div
        tabIndex={0}
        role="region"
        aria-labelledby={tableCaptionId}
        className="table-wrapper rounded-xl border border-[var(--border)]"
      >
        <table className="min-w-[640px] text-left text-xs">
          <caption
            id={tableCaptionId}
            className="bg-[var(--color-brand-soft)] px-4 py-2.5 text-left text-xs font-bold text-[var(--color-ink)]"
          >
            Before &amp; After Verification Summary (Distinguishing Detected, Verified, Unchecked, and User-Modified Fields)
          </caption>
          <thead className="bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]">
            <tr>
              <th scope="col" className="border-b border-[var(--border)] px-4 py-2.5 font-semibold">
                Dimension
              </th>
              <th scope="col" className="border-b border-[var(--border)] px-4 py-2.5 font-semibold">
                Before (Original File)
              </th>
              <th scope="col" className="border-b border-[var(--border)] px-4 py-2.5 font-semibold">
                After (Privacy-Cleaned Copy)
              </th>
              <th scope="col" className="border-b border-[var(--border)] px-4 py-2.5 font-semibold">
                Scope &amp; Provenance Note
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)] bg-white text-[var(--color-ink)]">
            <tr>
              <th scope="row" className="px-4 py-2.5 font-semibold text-[var(--color-ink)]">
                File integrity
              </th>
              <td className="px-4 py-2.5">{integrity.status}</td>
              <td className="px-4 py-2.5">
                {cleanedDone ? "Verified (re-encoded/re-packaged)" : "Pending privacy clean"}
              </td>
              <td className="px-4 py-2.5 text-[var(--color-text-muted)]">
                Verified by magic bytes, structure, and decode check
              </td>
            </tr>
            <tr>
              <th scope="row" className="px-4 py-2.5 font-semibold text-[var(--color-ink)]">
                EXIF metadata
              </th>
              <td className="px-4 py-2.5">{exif.status}</td>
              <td className="px-4 py-2.5">
                {cleanedDone ? "Not detected (stripped)" : "Unchanged (read-only)"}
              </td>
              <td className="px-4 py-2.5 text-[var(--color-text-muted)]">
                {cleanedDone ? "Changed by user privacy operation" : "Read-only local inspection"}
              </td>
            </tr>
            <tr>
              <th scope="row" className="px-4 py-2.5 font-semibold text-[var(--color-ink)]">
                C2PA credentials
              </th>
              <td className="px-4 py-2.5">{c2paStatus}</td>
              <td className="px-4 py-2.5">
                {cleanedDone
                  ? hasC2paBox
                    ? "Preserved intact"
                    : "Not detected"
                  : "Preserved"}
              </td>
              <td className="px-4 py-2.5 text-[var(--color-text-muted)]">
                Cryptographic provenance is never stripped by privacy cleaning
              </td>
            </tr>
            <tr>
              <th scope="row" className="px-4 py-2.5 font-semibold text-[var(--color-ink)]">
                SynthID
              </th>
              <td className="px-4 py-2.5">{effectiveSynthId.badgeStatus}</td>
              <td className="px-4 py-2.5">{effectiveSynthId.badgeStatus}</td>
              <td className="px-4 py-2.5 text-[var(--color-text-muted)]">
                Could not be checked locally; privacy cleaning does not remove SynthID
              </td>
            </tr>
            <tr>
              <th scope="row" className="px-4 py-2.5 font-semibold text-[var(--color-ink)]">
                Personal metadata
              </th>
              <td className="px-4 py-2.5">{localInspection.personalMetadata.status}</td>
              <td className="px-4 py-2.5">
                {cleanedDone
                  ? `Cleaned (${privacyCleanData?.removedFields.length ?? 0} field group(s) removed)`
                  : "Unchanged (original preserved)"}
              </td>
              <td className="px-4 py-2.5 text-[var(--color-text-muted)]">
                {cleanedDone
                  ? "Changed by user privacy operation on separate copy"
                  : "Confirm cleaning to generate a separate copy"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
