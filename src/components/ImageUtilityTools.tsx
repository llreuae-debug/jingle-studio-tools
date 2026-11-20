"use client";

import React, { useEffect, useId, useRef, useState } from "react";
import {
  CheckCircle2,
  Copy,
  Download,
  FileCheck2,
  RotateCcw,
  ShieldCheck,
  Upload,
  XCircle,
} from "lucide-react";
import {
  inspectMediaFileLocally,
  type LocalMediaInspection,
} from "@/lib/browser-media-inspector";
import {
  compressImageLocally,
  convertImageLocally,
  resizeImageLocally,
  triggerVerifiedBlobDownload,
  type CanvasOutputMime,
  type CanvasTransformResult,
} from "@/lib/canvas-image-tools";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function validateImageFile(file: File | undefined | null): string | null {
  if (!file) return "Please select an image file.";
  if (file.size === 0) return `File "${file.name}" is empty (0 bytes).`;
  if (!/\.(png|jpe?g|webp)$/i.test(file.name) && !/^image\/(png|jpeg|webp)$/i.test(file.type)) {
    return `Unsupported format for "${file.name}". Please upload PNG, JPG, JPEG, or WebP.`;
  }
  return null;
}

/* ============================================================================
   1. EXIF VIEWER TOOL (/tools/exif-viewer)
   ============================================================================ */

export function ExifViewerTool() {
  const inputId = useId();
  const tableCaptionId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const [inspection, setInspection] = useState<LocalMediaInspection | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showGps, setShowGps] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFile = async (file?: File | null) => {
    setError(null);
    setStatusMsg(null);
    const err = validateImageFile(file);
    if (err || !file) {
      setError(err);
      return;
    }
    setBusy(true);
    try {
      const report = await inspectMediaFileLocally(file);
      if (!report.integrity.magicBytesValid || report.integrity.pixelDecodeValid === false) {
        throw new Error(`Image "${file.name}" is corrupted or has an invalid header.`);
      }
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(file));
      setInspection(report);
      setShowGps(false);
    } catch (e) {
      setInspection(null);
      setError(e instanceof Error ? e.message : "Failed to inspect EXIF metadata.");
    } finally {
      setBusy(false);
    }
  };

  const handleCopyJson = async () => {
    if (!inspection) return;
    try {
      const payload = JSON.stringify(
        { file: inspection.fileInfo, exif: inspection.exif, iptcXmp: inspection.iptcXmp },
        null,
        2
      );
      await navigator.clipboard.writeText(payload);
      setStatusMsg("EXIF & metadata JSON copied to clipboard.");
    } catch {
      setError("Clipboard access was denied. Use Download EXIF JSON instead.");
    }
  };

  const handleDownloadJson = () => {
    if (!inspection) return;
    const payload = JSON.stringify(
      { file: inspection.fileInfo, exif: inspection.exif, iptcXmp: inspection.iptcXmp },
      null,
      2
    );
    const blob = new Blob([payload], { type: "application/json;charset=utf-8" });
    const base = inspection.fileInfo.fileName.replace(/\.[^.]+$/, "") || "image";
    triggerVerifiedBlobDownload(blob, `${base}-exif.json`);
    setStatusMsg(`Downloaded ${base}-exif.json (${formatBytes(blob.size)}).`);
  };

  const exifEntries = inspection
    ? Object.entries(inspection.exif.extraTags).map(([k, v]) => [k, String(v)])
    : [];

  return (
    <div className="glass-surface rounded-[22px] p-5 sm:p-8 space-y-6">
      <div className="rounded-[14px] border border-[var(--color-brand-line)] bg-[var(--color-brand-soft)]/50 px-4 py-3 text-xs text-[var(--color-text-muted)] flex items-start gap-2.5">
        <ShieldCheck aria-hidden="true" className="h-4 w-4 shrink-0 text-[var(--color-brand)] mt-0.5" />
        <span>
          <strong>Local-only inspection:</strong> EXIF, GPS, IPTC, and XMP tags are parsed directly in your browser without uploading your image.
        </span>
      </div>

      <label htmlFor={inputId} className="visually-hidden">
        Upload image to view EXIF metadata
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
        className="visually-hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="btn-plum inline-flex min-h-[44px] items-center gap-2 px-5 py-2.5 text-sm font-semibold"
        >
          <Upload aria-hidden="true" className="h-4 w-4" />
          {busy ? "Inspecting…" : inspection ? "Choose Another Image" : "Select Image to Inspect EXIF"}
        </button>
        {inspection && (
          <>
            <button
              type="button"
              onClick={() => void handleCopyJson()}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[12px] border border-[var(--border)] bg-white px-4 py-2 text-xs font-semibold text-[var(--color-ink)] hover:bg-[var(--color-brand-soft)]"
            >
              <Copy aria-hidden="true" className="h-3.5 w-3.5" />
              Copy EXIF JSON
            </button>
            <button
              type="button"
              onClick={handleDownloadJson}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[12px] border border-[var(--border)] bg-white px-4 py-2 text-xs font-semibold text-[var(--color-ink)] hover:bg-[var(--color-brand-soft)]"
            >
              <Download aria-hidden="true" className="h-3.5 w-3.5" />
              Download EXIF JSON
            </button>
          </>
        )}
      </div>

      {error && (
        <div role="alert" className="rounded-[12px] border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-900">
          {error}
        </div>
      )}
      {statusMsg && (
        <div role="status" className="rounded-[12px] border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-900">
          {statusMsg}
        </div>
      )}

      {inspection && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-4 space-y-3">
            {previewUrl && (
              <img
                src={previewUrl}
                alt={`Preview of ${inspection.fileInfo.fileName}`}
                width={inspection.fileInfo.width || 640}
                height={inspection.fileInfo.height || 480}
                className="w-full max-h-64 rounded-[14px] border border-[var(--border)] bg-[#f7f7fa] object-contain"
              />
            )}
            <div className="rounded-[14px] border border-[var(--border)] bg-[var(--color-surface-muted)] p-3.5 text-xs space-y-1">
              <p className="font-bold text-[var(--color-ink)] truncate">{inspection.fileInfo.fileName}</p>
              <p className="text-[var(--color-text-muted)]">
                {inspection.fileInfo.detectedFormat} · {formatBytes(inspection.fileInfo.fileSizeBytes)}
                {inspection.fileInfo.width && inspection.fileInfo.height
                  ? ` · ${inspection.fileInfo.width}×${inspection.fileInfo.height}`
                  : ""}
              </p>
            </div>
          </div>

          <div className="lg:col-span-8 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="rounded-[12px] border border-[var(--border)] bg-white p-3.5">
                <p className="text-[var(--color-text-muted)]">Camera / Device</p>
                <p className="mt-0.5 font-bold text-[var(--color-ink)]">
                  {[inspection.exif.make, inspection.exif.model].filter(Boolean).join(" ") || "Not detected"}
                </p>
              </div>
              <div className="rounded-[12px] border border-[var(--border)] bg-white p-3.5">
                <p className="text-[var(--color-text-muted)]">Software / Capture Time</p>
                <p className="mt-0.5 font-bold text-[var(--color-ink)]">
                  {inspection.exif.software || inspection.exif.dateTimeOriginal || "Not detected"}
                </p>
              </div>
              <div className="rounded-[12px] border border-[var(--border)] bg-white p-3.5 sm:col-span-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[var(--color-text-muted)]">GPS Coordinates</p>
                  <p className="mt-0.5 font-bold text-[var(--color-ink)]">
                    {inspection.exif.hasGps
                      ? showGps && inspection.exif.gps
                        ? `${inspection.exif.gps.latitude?.toFixed(5) ?? "?"}, ${inspection.exif.gps.longitude?.toFixed(5) ?? "?"}`
                        : "Detected (hidden by default for privacy)"
                      : "Not detected"}
                  </p>
                </div>
                {inspection.exif.hasGps && (
                  <button
                    type="button"
                    onClick={() => setShowGps((v) => !v)}
                    className="rounded-[8px] border border-[var(--border)] bg-[var(--color-brand-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--color-brand)]"
                  >
                    {showGps ? "Hide GPS coordinates" : "Show GPS coordinates"}
                  </button>
                )}
              </div>
            </div>

            <div
              tabIndex={0}
              role="region"
              aria-labelledby={tableCaptionId}
              className="table-wrapper rounded-[12px] border border-[var(--border)]"
            >
              <table className="min-w-[420px] text-left text-xs">
                <caption id={tableCaptionId} className="bg-[var(--color-brand-soft)] px-4 py-2 text-left font-bold text-[var(--color-ink)]">
                  Extracted EXIF &amp; Embedded Text Tags ({exifEntries.length} tags)
                </caption>
                <thead className="bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]">
                  <tr>
                    <th scope="col" className="border-b border-[var(--border)] px-4 py-2">Tag</th>
                    <th scope="col" className="border-b border-[var(--border)] px-4 py-2">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] bg-white">
                  {exifEntries.length > 0 ? (
                    exifEntries.map(([tag, val]) => (
                      <tr key={tag}>
                        <th scope="row" className="px-4 py-2 font-semibold text-[var(--color-ink)]">{tag}</th>
                        <td className="px-4 py-2 text-[var(--color-text-muted)] break-all">{val}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={2} className="px-4 py-3 text-[var(--color-text-muted)]">
                        No raw EXIF tags were found in this image.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   2. FILE INTEGRITY CHECKER (/tools/file-integrity-checker)
   ============================================================================ */

export function FileIntegrityTool() {
  const inputId = useId();
  const checksumId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const [inspection, setInspection] = useState<LocalMediaInspection | null>(null);
  const [expectedHash, setExpectedHash] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (file?: File | null) => {
    setError(null);
    if (!file) return;
    if (file.size === 0) {
      setError(`File "${file.name}" is empty (0 bytes) and failed integrity verification.`);
      setInspection(null);
      return;
    }
    setBusy(true);
    try {
      const report = await inspectMediaFileLocally(file);
      setInspection(report);
    } catch (e) {
      setInspection(null);
      setError(e instanceof Error ? e.message : "File integrity inspection failed.");
    } finally {
      setBusy(false);
    }
  };

  const normalizedExpected = expectedHash.trim().toLowerCase();
  const actualHash = inspection?.fileInfo.sha256?.toLowerCase() ?? "";
  const hasExpected = normalizedExpected.length > 0;
  const hashMatches = hasExpected && actualHash === normalizedExpected;

  return (
    <div className="glass-surface rounded-[22px] p-5 sm:p-8 space-y-6">
      <label htmlFor={inputId} className="visually-hidden">
        Upload media file for integrity verification
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept=".png,.jpg,.jpeg,.webp,.mp4,.mov,.webm"
        className="visually-hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="btn-plum inline-flex min-h-[44px] items-center gap-2 px-5 py-2.5 text-sm font-semibold"
        >
          <FileCheck2 aria-hidden="true" className="h-4 w-4" />
          {busy ? "Checking…" : "Select File to Verify Integrity"}
        </button>
      </div>

      {error && (
        <div role="alert" className="rounded-[12px] border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-900">
          {error}
        </div>
      )}

      {inspection && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            {[
              { label: "Magic-byte signature", ok: inspection.integrity.magicBytesValid },
              { label: "Extension matches header", ok: inspection.integrity.extensionMatchesHeader },
              { label: "Container structure", ok: inspection.integrity.structureValid },
              { label: "Polyglot safety check", ok: inspection.integrity.polyglotSafe },
              {
                label: "Browser decode check",
                ok: inspection.integrity.pixelDecodeValid !== false,
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-[12px] border border-[var(--border)] bg-white p-3.5 flex items-center justify-between gap-2"
              >
                <span className="font-semibold text-[var(--color-ink)]">{item.label}</span>
                {item.ok ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-bold">
                    <CheckCircle2 aria-hidden="true" className="h-4 w-4" /> Pass
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-rose-700 font-bold">
                    <XCircle aria-hidden="true" className="h-4 w-4" /> Fail
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="rounded-[14px] border border-[var(--border)] bg-[var(--color-surface-muted)] p-4 space-y-3 text-xs">
            <div>
              <p className="font-semibold text-[var(--color-text-muted)]">Computed SHA-256 Checksum</p>
              <p className="mt-1 break-all font-mono text-xs text-[var(--color-ink)]">
                {inspection.fileInfo.sha256 ?? "Unavailable"}
              </p>
            </div>
            <div>
              <label htmlFor={checksumId} className="block font-semibold text-[var(--color-ink)]">
                Compare against Expected SHA-256 (optional)
              </label>
              <input
                id={checksumId}
                type="text"
                value={expectedHash}
                onChange={(e) => setExpectedHash(e.target.value)}
                placeholder="Paste 64-character hex SHA-256 hash"
                className="mt-1.5 w-full rounded-[10px] border border-[var(--border)] bg-white px-3 py-2 text-[16px] font-mono text-[var(--color-ink)]"
              />
              {hasExpected && (
                <p
                  role="status"
                  className={`mt-2 font-semibold ${
                    hashMatches ? "text-emerald-700" : "text-rose-700"
                  }`}
                >
                  {hashMatches
                    ? "Checksum Match Verified — file bytes match the expected SHA-256 digest."
                    : "Checksum Mismatch — computed SHA-256 does not match the expected value."}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   3. IMAGE FORMAT CONVERTER (/tools/image-converter)
   ============================================================================ */

export function ImageConverterTool() {
  const inputId = useId();
  const formatId = useId();
  const qualityId = useId();
  const bgId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [targetMime, setTargetMime] = useState<CanvasOutputMime>("image/webp");
  const [quality, setQuality] = useState(90);
  const [jpegBg, setJpegBg] = useState("#ffffff");
  const [result, setResult] = useState<CanvasTransformResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return () => {
      if (result?.previewUrl) URL.revokeObjectURL(result.previewUrl);
    };
  }, [result]);

  const runConvert = async (file: File, mime: CanvasOutputMime, q: number, bg: string) => {
    setBusy(true);
    setError(null);
    setStatusMsg(null);
    try {
      const converted = await convertImageLocally({
        file,
        targetMime: mime,
        quality: q / 100,
        jpegBg: bg,
      });
      setResult((prev) => {
        if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
        return converted;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Image conversion failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleFile = async (file?: File | null) => {
    const err = validateImageFile(file);
    if (err || !file) {
      setError(err);
      return;
    }
    setSourceFile(file);
    await runConvert(file, targetMime, quality, jpegBg);
  };

  const handleDownload = () => {
    if (!result) return;
    triggerVerifiedBlobDownload(result.blob, result.fileName);
    setStatusMsg(`Converted image "${result.fileName}" (${formatBytes(result.outputBytes)}) downloaded.`);
  };

  return (
    <div className="glass-surface rounded-[22px] p-5 sm:p-8 space-y-6">
      <div className="rounded-[14px] border border-amber-200 bg-amber-50/70 px-4 py-3 text-xs text-amber-950">
        <strong>Derivative export notice:</strong> Client-side Canvas format conversion re-encodes pixel data into a new derivative file, which strips container metadata and C2PA Content Credentials from the converted copy. Your original file remains untouched.
      </div>

      <label htmlFor={inputId} className="visually-hidden">
        Upload image to convert format
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
        className="visually-hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />

      <fieldset className="rounded-[16px] border border-[var(--border)] bg-[var(--color-surface-muted)] p-4 space-y-4">
        <legend className="px-2 text-xs font-bold text-[var(--color-ink)]">Conversion Settings</legend>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label htmlFor={formatId} className="block font-semibold text-[var(--color-ink)]">
              Target Format
            </label>
            <select
              id={formatId}
              value={targetMime}
              onChange={(e) => {
                const next = e.target.value as CanvasOutputMime;
                setTargetMime(next);
                if (sourceFile) void runConvert(sourceFile, next, quality, jpegBg);
              }}
              className="mt-1.5 w-full rounded-[10px] border border-[var(--border)] bg-white px-3 py-2 text-[16px] text-[var(--color-ink)]"
            >
              <option value="image/webp">WebP (.webp)</option>
              <option value="image/jpeg">JPEG (.jpg)</option>
              <option value="image/png">PNG (.png)</option>
            </select>
          </div>

          <div>
            <label htmlFor={qualityId} className="block font-semibold text-[var(--color-ink)]">
              Quality ({quality}%)
            </label>
            <input
              id={qualityId}
              type="range"
              min={10}
              max={100}
              value={quality}
              disabled={targetMime === "image/png"}
              onChange={(e) => {
                const q = Number(e.target.value);
                setQuality(q);
                if (sourceFile) void runConvert(sourceFile, targetMime, q, jpegBg);
              }}
              className="mt-3 w-full accent-[var(--color-brand)]"
            />
          </div>

          <div>
            <label htmlFor={bgId} className="block font-semibold text-[var(--color-ink)]">
              JPEG Background Fill
            </label>
            <input
              id={bgId}
              type="color"
              value={jpegBg}
              disabled={targetMime !== "image/jpeg"}
              onChange={(e) => {
                setJpegBg(e.target.value);
                if (sourceFile) void runConvert(sourceFile, targetMime, quality, e.target.value);
              }}
              className="mt-1.5 h-10 w-full cursor-pointer rounded-[10px] border border-[var(--border)] bg-white p-1"
            />
          </div>
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="btn-plum inline-flex min-h-[44px] items-center gap-2 px-5 py-2.5 text-sm font-semibold"
        >
          <Upload aria-hidden="true" className="h-4 w-4" />
          {busy ? "Converting…" : sourceFile ? "Choose Another Image" : "Select Image to Convert"}
        </button>
        {result && (
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-[12px] bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <Download aria-hidden="true" className="h-4 w-4" />
            Download Converted Image
          </button>
        )}
      </div>

      {error && (
        <div role="alert" className="rounded-[12px] border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-900">
          {error}
        </div>
      )}
      {statusMsg && (
        <div role="status" className="rounded-[12px] border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-900">
          {statusMsg}
        </div>
      )}

      {result && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center rounded-[14px] border border-[var(--border)] bg-white p-4">
          <img
            src={result.previewUrl}
            alt={`Converted preview ${result.fileName}`}
            width={result.width}
            height={result.height}
            className="max-h-56 w-full rounded-[10px] bg-[#f7f7fa] object-contain"
          />
          <dl className="space-y-2 text-xs">
            <div>
              <dt className="text-[var(--color-text-muted)]">Output file</dt>
              <dd className="font-bold text-[var(--color-ink)]">{result.fileName}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-text-muted)]">Dimensions</dt>
              <dd className="font-bold text-[var(--color-ink)]">
                {result.width} × {result.height} px
              </dd>
            </div>
            <div>
              <dt className="text-[var(--color-text-muted)]">Size comparison</dt>
              <dd className="font-bold text-[var(--color-ink)]">
                {formatBytes(result.originalBytes)} → {formatBytes(result.outputBytes)}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   4. IMAGE RESIZER (/tools/image-resizer)
   ============================================================================ */

export function ImageResizerTool() {
  const inputId = useId();
  const widthId = useId();
  const heightId = useId();
  const formatId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [origDims, setOrigDims] = useState<{ width: number; height: number } | null>(null);
  const [width, setWidth] = useState(1080);
  const [height, setHeight] = useState(1080);
  const [lockAspect, setLockAspect] = useState(true);
  const [targetMime, setTargetMime] = useState<CanvasOutputMime>("image/png");
  const [result, setResult] = useState<CanvasTransformResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return () => {
      if (result?.previewUrl) URL.revokeObjectURL(result.previewUrl);
    };
  }, [result]);

  const executeResize = async (
    file: File,
    w: number,
    h: number,
    mime: CanvasOutputMime
  ) => {
    setBusy(true);
    setError(null);
    setStatusMsg(null);
    try {
      const resized = await resizeImageLocally({
        file,
        width: Math.max(1, w),
        height: Math.max(1, h),
        targetMime: mime,
        quality: 0.92,
      });
      setResult((prev) => {
        if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
        return resized;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to resize image.");
    } finally {
      setBusy(false);
    }
  };

  const handleFile = async (file?: File | null) => {
    const err = validateImageFile(file);
    if (err || !file) {
      setError(err);
      return;
    }
    setSourceFile(file);
    setBusy(true);
    setError(null);
    try {
      const report = await inspectMediaFileLocally(file);
      const w = report.fileInfo.width ?? 1080;
      const h = report.fileInfo.height ?? 1080;
      setOrigDims({ width: w, height: h });
      setWidth(w);
      setHeight(h);
      await executeResize(file, w, h, targetMime);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read image dimensions.");
      setBusy(false);
    }
  };

  const handleWidthChange = (nextW: number) => {
    const safeW = Math.max(1, Math.min(8192, nextW || 1));
    setWidth(safeW);
    if (lockAspect && origDims && origDims.width > 0) {
      setHeight(Math.max(1, Math.round((safeW / origDims.width) * origDims.height)));
    }
  };

  const handleHeightChange = (nextH: number) => {
    const safeH = Math.max(1, Math.min(8192, nextH || 1));
    setHeight(safeH);
    if (lockAspect && origDims && origDims.height > 0) {
      setWidth(Math.max(1, Math.round((safeH / origDims.height) * origDims.width)));
    }
  };

  const applyPreset = (w: number, h: number) => {
    setWidth(w);
    setHeight(h);
    if (sourceFile) void executeResize(sourceFile, w, h, targetMime);
  };

  const handleDownload = () => {
    if (!result) return;
    triggerVerifiedBlobDownload(result.blob, result.fileName);
    setStatusMsg(`Resized image "${result.fileName}" (${result.width}×${result.height}) downloaded.`);
  };

  return (
    <div className="glass-surface rounded-[22px] p-5 sm:p-8 space-y-6">
      <label htmlFor={inputId} className="visually-hidden">
        Upload image to resize
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
        className="visually-hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />

      <fieldset className="rounded-[16px] border border-[var(--border)] bg-[var(--color-surface-muted)] p-4 space-y-4">
        <legend className="px-2 text-xs font-bold text-[var(--color-ink)]">Resize Dimensions</legend>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label htmlFor={widthId} className="block font-semibold text-[var(--color-ink)]">
              Target Width (px)
            </label>
            <input
              id={widthId}
              type="number"
              min={1}
              max={8192}
              value={width}
              onChange={(e) => handleWidthChange(Number(e.target.value))}
              className="mt-1.5 w-full rounded-[10px] border border-[var(--border)] bg-white px-3 py-2 text-[16px] text-[var(--color-ink)]"
            />
          </div>
          <div>
            <label htmlFor={heightId} className="block font-semibold text-[var(--color-ink)]">
              Target Height (px)
            </label>
            <input
              id={heightId}
              type="number"
              min={1}
              max={8192}
              value={height}
              onChange={(e) => handleHeightChange(Number(e.target.value))}
              className="mt-1.5 w-full rounded-[10px] border border-[var(--border)] bg-white px-3 py-2 text-[16px] text-[var(--color-ink)]"
            />
          </div>
          <div>
            <label htmlFor={formatId} className="block font-semibold text-[var(--color-ink)]">
              Output Format
            </label>
            <select
              id={formatId}
              value={targetMime}
              onChange={(e) => setTargetMime(e.target.value as CanvasOutputMime)}
              className="mt-1.5 w-full rounded-[10px] border border-[var(--border)] bg-white px-3 py-2 text-[16px] text-[var(--color-ink)]"
            >
              <option value="image/png">PNG</option>
              <option value="image/jpeg">JPEG</option>
              <option value="image/webp">WebP</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <label className="inline-flex items-center gap-2 font-semibold text-[var(--color-ink)] cursor-pointer">
            <input
              type="checkbox"
              checked={lockAspect}
              onChange={(e) => setLockAspect(e.target.checked)}
              className="h-4 w-4 accent-[var(--color-brand)]"
            />
            <span>Lock aspect ratio</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "1080×1080", w: 1080, h: 1080 },
              { label: "1920×1080", w: 1920, h: 1080 },
              { label: "1280×720", w: 1280, h: 720 },
              { label: "320×240", w: 320, h: 240 },
            ].map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p.w, p.h)}
                className="rounded-[8px] border border-[var(--border)] bg-white px-2.5 py-1 text-[11px] font-semibold text-[var(--color-brand)] hover:bg-[var(--color-brand-soft)]"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="btn-plum inline-flex min-h-[44px] items-center gap-2 px-5 py-2.5 text-sm font-semibold"
        >
          <Upload aria-hidden="true" className="h-4 w-4" />
          {sourceFile ? "Choose Another Image" : "Select Image to Resize"}
        </button>
        {sourceFile && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void executeResize(sourceFile, width, height, targetMime)}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-[12px] border border-[var(--border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--color-ink)] hover:bg-[var(--color-brand-soft)]"
          >
            <RotateCcw aria-hidden="true" className="h-4 w-4" />
            Apply Resize
          </button>
        )}
        {result && (
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-[12px] bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <Download aria-hidden="true" className="h-4 w-4" />
            Download Resized Image
          </button>
        )}
      </div>

      {error && (
        <div role="alert" className="rounded-[12px] border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-900">
          {error}
        </div>
      )}
      {statusMsg && (
        <div role="status" className="rounded-[12px] border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-900">
          {statusMsg}
        </div>
      )}

      {result && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center rounded-[14px] border border-[var(--border)] bg-white p-4">
          <img
            src={result.previewUrl}
            alt={`Resized preview ${result.fileName}`}
            width={result.width}
            height={result.height}
            className="max-h-56 w-full rounded-[10px] bg-[#f7f7fa] object-contain"
          />
          <dl className="space-y-2 text-xs">
            <div>
              <dt className="text-[var(--color-text-muted)]">Output dimensions</dt>
              <dd className="font-bold text-[var(--color-ink)]">
                {result.width} × {result.height} px (from {result.originalWidth} × {result.originalHeight})
              </dd>
            </div>
            <div>
              <dt className="text-[var(--color-text-muted)]">Output file size</dt>
              <dd className="font-bold text-[var(--color-ink)]">
                {formatBytes(result.outputBytes)}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   5. IMAGE COMPRESSION TOOL (/tools/image-compressor)
   ============================================================================ */

export function ImageCompressorTool() {
  const inputId = useId();
  const formatId = useId();
  const qualityId = useId();
  const maxWidthId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [targetMime, setTargetMime] = useState<"image/webp" | "image/jpeg">("image/jpeg");
  const [quality, setQuality] = useState(75);
  const [maxWidth, setMaxWidth] = useState<number>(0);
  const [result, setResult] = useState<CanvasTransformResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    return () => {
      if (result?.previewUrl) URL.revokeObjectURL(result.previewUrl);
    };
  }, [result]);

  const runCompress = async (
    file: File,
    mime: "image/webp" | "image/jpeg",
    q: number,
    mw: number
  ) => {
    setBusy(true);
    setError(null);
    setStatusMsg(null);
    try {
      const compressed = await compressImageLocally({
        file,
        targetMime: mime,
        quality: q / 100,
        maxWidth: mw > 0 ? mw : undefined,
      });
      setResult((prev) => {
        if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
        return compressed;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Image compression failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleFile = async (file?: File | null) => {
    const err = validateImageFile(file);
    if (err || !file) {
      setError(err);
      return;
    }
    setSourceFile(file);
    await runCompress(file, targetMime, quality, maxWidth);
  };

  const handleDownload = () => {
    if (!result) return;
    triggerVerifiedBlobDownload(result.blob, result.fileName);
    setStatusMsg(`Compressed image "${result.fileName}" (${formatBytes(result.outputBytes)}) downloaded.`);
  };

  const savingsPct =
    result && result.originalBytes > 0
      ? Math.round(((result.originalBytes - result.outputBytes) / result.originalBytes) * 100)
      : 0;

  return (
    <div className="glass-surface rounded-[22px] p-5 sm:p-8 space-y-6">
      <label htmlFor={inputId} className="visually-hidden">
        Upload image to compress
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
        className="visually-hidden"
        onChange={(e) => void handleFile(e.target.files?.[0])}
      />

      <fieldset className="rounded-[16px] border border-[var(--border)] bg-[var(--color-surface-muted)] p-4 space-y-4">
        <legend className="px-2 text-xs font-bold text-[var(--color-ink)]">Compression Settings</legend>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label htmlFor={formatId} className="block font-semibold text-[var(--color-ink)]">
              Output Codec
            </label>
            <select
              id={formatId}
              value={targetMime}
              onChange={(e) => {
                const next = e.target.value as "image/webp" | "image/jpeg";
                setTargetMime(next);
                if (sourceFile) void runCompress(sourceFile, next, quality, maxWidth);
              }}
              className="mt-1.5 w-full rounded-[10px] border border-[var(--border)] bg-white px-3 py-2 text-[16px] text-[var(--color-ink)]"
            >
              <option value="image/jpeg">JPEG (.jpg)</option>
              <option value="image/webp">WebP (.webp)</option>
            </select>
          </div>
          <div>
            <label htmlFor={qualityId} className="block font-semibold text-[var(--color-ink)]">
              Quality ({quality}%)
            </label>
            <input
              id={qualityId}
              type="range"
              min={10}
              max={100}
              value={quality}
              onChange={(e) => {
                const q = Number(e.target.value);
                setQuality(q);
                if (sourceFile) void runCompress(sourceFile, targetMime, q, maxWidth);
              }}
              className="mt-3 w-full accent-[var(--color-brand)]"
            />
          </div>
          <div>
            <label htmlFor={maxWidthId} className="block font-semibold text-[var(--color-ink)]">
              Max Width Cap (px, 0 = original)
            </label>
            <input
              id={maxWidthId}
              type="number"
              min={0}
              max={8192}
              value={maxWidth}
              onChange={(e) => {
                const mw = Math.max(0, Number(e.target.value) || 0);
                setMaxWidth(mw);
                if (sourceFile) void runCompress(sourceFile, targetMime, quality, mw);
              }}
              className="mt-1.5 w-full rounded-[10px] border border-[var(--border)] bg-white px-3 py-2 text-[16px] text-[var(--color-ink)]"
            />
          </div>
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="btn-plum inline-flex min-h-[44px] items-center gap-2 px-5 py-2.5 text-sm font-semibold"
        >
          <Upload aria-hidden="true" className="h-4 w-4" />
          {busy ? "Compressing…" : sourceFile ? "Choose Another Image" : "Select Image to Compress"}
        </button>
        {result && (
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-[12px] bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <Download aria-hidden="true" className="h-4 w-4" />
            Download Compressed Image
          </button>
        )}
      </div>

      {error && (
        <div role="alert" className="rounded-[12px] border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-900">
          {error}
        </div>
      )}
      {statusMsg && (
        <div role="status" className="rounded-[12px] border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-900">
          {statusMsg}
        </div>
      )}

      {result && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center rounded-[14px] border border-[var(--border)] bg-white p-4">
          <img
            src={result.previewUrl}
            alt={`Compressed preview ${result.fileName}`}
            width={result.width}
            height={result.height}
            className="max-h-56 w-full rounded-[10px] bg-[#f7f7fa] object-contain"
          />
          <dl className="space-y-2 text-xs">
            <div>
              <dt className="text-[var(--color-text-muted)]">Original vs Compressed</dt>
              <dd className="font-bold text-[var(--color-ink)]">
                {formatBytes(result.originalBytes)} → {formatBytes(result.outputBytes)}{" "}
                <span className={savingsPct >= 0 ? "text-emerald-700" : "text-amber-700"}>
                  ({savingsPct >= 0 ? `Saved ${savingsPct}%` : `+${Math.abs(savingsPct)}%`})
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-[var(--color-text-muted)]">Output dimensions</dt>
              <dd className="font-bold text-[var(--color-ink)]">
                {result.width} × {result.height} px
              </dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}
