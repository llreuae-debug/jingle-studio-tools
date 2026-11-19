"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  FileCheck2,
  Film,
  HelpCircle,
  Image as ImageIcon,
  Info,
  RefreshCw,
  RotateCcw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { CredentialsResultCard } from "@/components/CredentialsResultCard";
import { inspectBlob, type InspectionResult } from "@/lib/c2pa-inspect";
import type { MediaMetadataReport } from "@/lib/media-metadata";
import type {
  C2paInspectionSummary,
  PrivacyCleanOptions,
  SynthIdSummary,
} from "@/lib/privacy-cleaner";

interface ServerCleanResponse {
  ok: true;
  recordId: string;
  fileName: string;
  cleanFileName: string;
  mimeType: string;
  mediaKind: "image" | "video";
  fileSizeBytes: number;
  cleanedSizeBytes: number;
  inputSha256: string;
  outputSha256: string;
  c2pa: C2paInspectionSummary;
  c2paResultStatus: "preserved" | "not_present" | "unable_to_preserve";
  c2paNotice: string | null;
  synthId: SynthIdSummary;
  personalMetadataStatus: "removed" | "preserved" | "not_available";
  removedFields: string[];
  preservedOriginalBytes: boolean;
  beforeMetadata: MediaMetadataReport;
  afterMetadata: MediaMetadataReport;
  cleanDownloadUrl: string;
  originalDownloadUrl: string;
  expiresAt: string;
}

interface LocalPreviewMeta {
  previewUrl: string;
  mediaKind: "image" | "video";
  width?: number;
  height?: number;
  durationSec?: number;
  formatLabel: string;
}

const CHUNK_THRESHOLD_BYTES = 3.5 * 1024 * 1024;
const ALLOWED_EXT_RX = /\.(png|jpe?g|webp|mp4|mov|webm)$/i;

const PROCESSING_STEPS = [
  "Uploading file",
  "Validating media",
  "Inspecting metadata",
  "Checking available credentials",
  "Cleaning selected personal metadata",
  "Verifying output",
  "Preparing download",
] as const;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function measureLocalFile(file: File): Promise<LocalPreviewMeta> {
  const previewUrl = URL.createObjectURL(file);
  const ext = file.name.split(".").pop()?.toUpperCase() || "MEDIA";
  const isVideo =
    file.type.startsWith("video/") || /\.(mp4|mov|webm)$/i.test(file.name);

  if (!isVideo) {
    const dims = await new Promise<{ width?: number; height?: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => resolve({});
      img.src = previewUrl;
    });
    return {
      previewUrl,
      mediaKind: "image",
      width: dims.width,
      height: dims.height,
      formatLabel: ext === "JPEG" ? "JPG" : ext,
    };
  }

  const vmeta = await new Promise<{
    width?: number;
    height?: number;
    durationSec?: number;
  }>((resolve) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () =>
      resolve({
        width: video.videoWidth || undefined,
        height: video.videoHeight || undefined,
        durationSec: Number.isFinite(video.duration) ? video.duration : undefined,
      });
    video.onerror = () => resolve({});
    video.src = previewUrl;
  });

  return {
    previewUrl,
    mediaKind: "video",
    width: vmeta.width,
    height: vmeta.height,
    durationSec: vmeta.durationSec,
    formatLabel: ext,
  };
}

function uploadSmallWithProgress(
  file: File,
  options: PrivacyCleanOptions,
  onProgress: (pct: number) => void,
  onStage: (stepIndex: number) => void
): Promise<ServerCleanResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/privacy-clean");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) {
        onProgress(Math.min(70, Math.round((e.loaded / e.total) * 70)));
      }
    };
    xhr.upload.onload = () => {
      onProgress(75);
      onStage(1);
    };
    xhr.onreadystatechange = () => {
      if (xhr.readyState === 3) {
        onStage(3);
        onProgress(85);
      }
      if (xhr.readyState === 4) {
        try {
          const data = JSON.parse(xhr.responseText || "{}");
          if (xhr.status >= 200 && xhr.status < 300 && data.ok) {
            onProgress(100);
            resolve(data as ServerCleanResponse);
          } else {
            reject(
              new Error(data.error || `Server returned HTTP ${xhr.status}`)
            );
          }
        } catch {
          reject(new Error(`Processing failed (HTTP ${xhr.status})`));
        }
      }
    };
    xhr.onerror = () => reject(new Error("Network error uploading file."));
    const fd = new FormData();
    fd.append("file", file);
    fd.append("options", JSON.stringify(options));
    xhr.send(fd);
  });
}

async function uploadChunkedLargeFile(
  file: File,
  options: PrivacyCleanOptions,
  onProgress: (pct: number) => void,
  onStage: (stepIndex: number) => void
): Promise<ServerCleanResponse> {
  const initRes = await fetch("/api/privacy-clean/upload-init", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type || "video/mp4",
      fileSizeBytes: file.size,
    }),
  });
  const initData = await initRes.json().catch(() => ({}));
  if (!initRes.ok) {
    throw new Error(initData.error || "Could not initialize upload.");
  }

  const { uploadId, chunkSize, totalChunks } = initData as {
    uploadId: string;
    chunkSize: number;
    totalChunks: number;
  };

  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(file.size, start + chunkSize);
    const fd = new FormData();
    fd.append("uploadId", uploadId);
    fd.append("index", String(i));
    fd.append("chunk", file.slice(start, end), `${file.name}.part${i}`);

    const chunkRes = await fetch("/api/privacy-clean/upload-chunk", {
      method: "POST",
      body: fd,
    });
    const chunkData = await chunkRes.json().catch(() => ({}));
    if (!chunkRes.ok) {
      throw new Error(chunkData.error || `Chunk ${i + 1} failed to upload.`);
    }
    onProgress(Math.round(((i + 1) / totalChunks) * 75));
  }

  onStage(2);
  onProgress(85);
  const res = await fetch("/api/privacy-clean", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uploadId, options }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || "Processing failed.");
  }
  onProgress(100);
  return data as ServerCleanResponse;
}

export function MediaInspectorWorkbench() {
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mediaFilter, setMediaFilter] = useState<"all" | "image" | "video">("all");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewMeta, setPreviewMeta] = useState<LocalPreviewMeta | null>(null);
  const [localC2pa, setLocalC2pa] = useState<InspectionResult | null>(null);
  const [localReadingStage, setLocalReadingStage] = useState<
    "idle" | "reading" | "checking"
  >("idle");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Privacy cleaner checkboxes
  const [options, setOptions] = useState<PrivacyCleanOptions>({
    removeGps: true,
    removeCameraInfo: true,
    removeExif: true,
    removePersonalMetadata: true,
    preserveQuality: true,
    preserveC2pa: true,
  });

  // Processing state
  const [processing, setProcessing] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [activeStepIndex, setActiveStepIndex] = useState(-1);
  const [processError, setProcessError] = useState<string | null>(null);
  const [serverResult, setServerResult] = useState<ServerCleanResponse | null>(null);

  // Collapsible sections
  const [metaOpen, setMetaOpen] = useState(true);
  const [compareOpen, setCompareOpen] = useState(false);
  const [showGpsCoords, setShowGpsCoords] = useState(false);

  const cleanupResources = useCallback(() => {
    setPreviewMeta((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
    setLocalC2pa((prev) => {
      prev?.cleanup();
      return null;
    });
  }, []);

  useEffect(() => {
    return () => {
      cleanupResources();
    };
  }, [cleanupResources]);

  const handleFileSelect = useCallback(async (file?: File | null) => {
    if (!file) return;
    setValidationError(null);
    setProcessError(null);
    setServerResult(null);
    setCompareOpen(false);
    setProgressPct(0);
    setActiveStepIndex(-1);

    if (!ALLOWED_EXT_RX.test(file.name)) {
      setValidationError(
        `Unsupported file "${file.name}". Please choose PNG, JPG, JPEG, WEBP, MP4, MOV, or WEBM.`
      );
      return;
    }

    const isVideo = /\.(mp4|mov|webm)$/i.test(file.name) || file.type.startsWith("video/");
    if (file.size === 0) {
      setValidationError("Selected file is empty.");
      return;
    }
    if (isVideo && file.size > 500 * 1024 * 1024) {
      setValidationError("Selected video exceeds maximum 500 MB upload size.");
      return;
    }
    if (!isVideo && file.size > 100 * 1024 * 1024) {
      setValidationError("Selected image exceeds maximum 100 MB upload size.");
      return;
    }

    cleanupResources();
    setSelectedFile(file);
    setLocalReadingStage("reading");

    try {
      const [measured, inspection] = await Promise.all([
        measureLocalFile(file),
        inspectBlob(file, file.name, (stage) => setLocalReadingStage(stage)),
      ]);
      setPreviewMeta(measured);
      setLocalC2pa(inspection);
    } catch (err) {
      setValidationError(
        err instanceof Error ? err.message : "Could not read file in browser."
      );
    } finally {
      setLocalReadingStage("idle");
    }
  }, [cleanupResources]);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = e.clipboardData?.files?.[0];
      if (file) void handleFileSelect(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [handleFileSelect]);

  const handleReset = () => {
    cleanupResources();
    setSelectedFile(null);
    setServerResult(null);
    setProcessError(null);
    setValidationError(null);
    setProgressPct(0);
    setActiveStepIndex(-1);
    setShowGpsCoords(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRunCleaning = async () => {
    if (!selectedFile || processing) return;
    setProcessing(true);
    setProcessError(null);
    setProgressPct(5);
    setActiveStepIndex(0);

    try {
      const data =
        selectedFile.size > CHUNK_THRESHOLD_BYTES
          ? await uploadChunkedLargeFile(
              selectedFile,
              options,
              (pct) => setProgressPct(pct),
              (step) => setActiveStepIndex(step)
            )
          : await uploadSmallWithProgress(
              selectedFile,
              options,
              (pct) => setProgressPct(pct),
              (step) => setActiveStepIndex(step)
            );

      setActiveStepIndex(6);
      setServerResult(data);
    } catch (err) {
      setProcessError(
        err instanceof Error ? err.message : "Cleaning failed. Please try again."
      );
    } finally {
      setProcessing(false);
    }
  };

  const activeNode = localC2pa?.rootNode || null;
  const activeBefore = serverResult?.beforeMetadata || null;

  // Derived display metadata combining instant client reading + richer server inspection
  const displayWidth = activeBefore?.width ?? previewMeta?.width;
  const displayHeight = activeBefore?.height ?? previewMeta?.height;
  const displayDuration = activeBefore?.durationSec ?? previewMeta?.durationSec;
  const displayCodec = activeBefore?.codec;
  const displayFps = activeBefore?.frameRate;

  const displayC2paStatus: "present" | "not_detected" | "unable_to_verify" = serverResult
    ? serverResult.c2pa.status
    : localC2pa && localC2pa.status !== "none"
      ? localC2pa.status === "warning"
        ? "unable_to_verify"
        : "present"
      : "not_detected";

  const displayC2paIssuer = serverResult
    ? serverResult.c2pa.issuer
    : activeNode?.issuer || null;

  const displayC2paCredStatus = serverResult
    ? serverResult.c2pa.credentialStatus
    : !localC2pa || localC2pa.status === "none"
      ? "Not detected"
      : localC2pa.status === "verified"
        ? "Valid"
        : localC2pa.status === "warning"
          ? "Invalid"
          : "Unable to verify";

  return (
    <div className="space-y-6">
      <label htmlFor={fileInputId} className="visually-hidden">
        Choose media file to inspect
      </label>
      <input
        ref={fileInputRef}
        id={fileInputId}
        type="file"
        className="visually-hidden"
        accept=".png,.jpg,.jpeg,.webp,.mp4,.mov,.webm,image/png,image/jpeg,image/webp,video/mp4,video/quicktime,video/webm"
        onChange={(e) => void handleFileSelect(e.target.files?.[0])}
      />

      {/* Main Container Card matching reference screenshot aesthetic */}
      <div className="glass-surface rounded-[22px] p-5 sm:p-8 space-y-6">
        {!selectedFile && (
          <div className="space-y-5">
            {/* Segmented Format Filter */}
            <div className="flex justify-center">
              <div
                role="group"
                aria-label="Media format filter"
                className="inline-flex rounded-[12px] border border-[var(--border)] bg-[var(--color-surface-muted)] p-1 text-xs font-semibold"
              >
                {[
                  { id: "all" as const, label: "All Media" },
                  { id: "image" as const, label: "Image" },
                  { id: "video" as const, label: "Video" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    aria-pressed={mediaFilter === tab.id}
                    onClick={() => setMediaFilter(tab.id)}
                    className={`inline-flex items-center gap-1.5 rounded-[9px] px-3.5 py-1.5 transition-all duration-150 ${
                      mediaFilter === tab.id
                        ? "bg-[var(--color-brand-soft)] text-[var(--color-brand)] shadow-[var(--shadow-1)]"
                        : "text-[var(--color-text-muted)] hover:text-[var(--color-ink)]"
                    }`}
                  >
                    {tab.id === "image" && <ImageIcon aria-hidden="true" className="h-3.5 w-3.5" />}
                    {tab.id === "video" && <Film aria-hidden="true" className="h-3.5 w-3.5" />}
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Drag-and-drop Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                void handleFileSelect(e.dataTransfer.files?.[0]);
              }}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              className={`rounded-[16px] border-2 border-dashed p-8 sm:p-12 text-center cursor-pointer transition-colors duration-150 ${
                isDragging
                  ? "border-[var(--color-brand)] bg-[var(--color-brand-soft)]"
                  : "border-[#dcdce4] bg-[#fafafe] hover:bg-[var(--color-brand-soft)]/60 hover:border-[var(--color-brand-light)]"
              }`}
            >
              <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-[12px] bg-[var(--color-brand)] text-white shadow-[var(--shadow-3)]">
                <Upload aria-hidden="true" className="h-6 w-6" />
              </div>
              <p className="mt-4 text-base sm:text-lg font-bold text-[var(--color-ink)]">
                {mediaFilter === "video"
                  ? "Drop AI videos or browse files"
                  : "Drop images or videos"}
              </p>
              <p className="mt-1 text-xs sm:text-sm text-[var(--color-text-muted)]">
                Inspect C2PA Content Credentials &amp; embedded metadata, then remove personal GPS &amp; EXIF tags safely.
              </p>
              <div className="mt-5 flex justify-center">
                <span className="inline-flex items-center gap-2 btn-plum px-5 py-2.5 text-xs sm:text-sm font-semibold">
                  Browse Files
                </span>
              </div>
              <p className="mt-4 text-[11px] text-[var(--color-text-muted)]">
                PNG · JPG · JPEG · WEBP (images) &nbsp;|&nbsp; MP4 · MOV · WEBM (videos)
              </p>
            </div>

            {validationError && (
              <div
                role="alert"
                className="rounded-[12px] border border-rose-200 bg-rose-50 p-4 text-xs sm:text-sm text-rose-900 flex items-start gap-2.5 text-left"
              >
                <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{validationError}</span>
              </div>
            )}
          </div>
        )}

        {/* Active 2-Column Interface */}
        {selectedFile && previewMeta && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
            {/* LEFT PANEL — MEDIA PREVIEW */}
            <div className="lg:col-span-5 space-y-4 min-w-0">
              <div className="relative overflow-hidden rounded-[16px] border border-[var(--border)] bg-[#f4f4f8]">
                {previewMeta.mediaKind === "image" ? (
                  <img
                    src={previewMeta.previewUrl}
                    alt={`Preview of ${selectedFile.name}`}
                    className="w-full max-h-80 object-contain bg-[#f7f7fa]"
                  />
                ) : (
                  <video
                    src={previewMeta.previewUrl}
                    controls
                    playsInline
                    className="w-full max-h-80 bg-black"
                  />
                )}

                {/* Bottom-left overlay badge matching screenshot */}
                <div className="pointer-events-none absolute bottom-3 left-3 inline-flex flex-wrap items-center gap-2 rounded-full bg-white/95 backdrop-blur-sm border border-[var(--border)] px-3 py-1 text-[11px] font-semibold text-[var(--color-ink)] shadow-[var(--shadow-2)]">
                  <span className="inline-flex items-center gap-1">
                    {displayC2paStatus === "present" ? (
                      <Check aria-hidden="true" className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <HelpCircle aria-hidden="true" className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
                    )}
                    C2PA
                  </span>
                  <span aria-hidden="true" className="text-[var(--border)]">•</span>
                  <span className="inline-flex items-center gap-1 text-[var(--color-brand)]">
                    <span className="h-2 w-2 rounded-full bg-[var(--color-brand)]" />
                    SynthID: Unavailable
                  </span>
                </div>
              </div>

              {/* Thumbnail + File Info */}
              <div className="rounded-[14px] border border-[var(--border)] bg-[var(--color-surface-muted)] p-3.5 flex items-center gap-3 min-w-0">
                <div className="h-11 w-11 shrink-0 overflow-hidden rounded-[10px] border border-[var(--border)] bg-white flex items-center justify-center">
                  {previewMeta.mediaKind === "image" ? (
                    <img
                      src={previewMeta.previewUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Film aria-hidden="true" className="h-5 w-5 text-[var(--color-brand)]" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-[var(--color-ink)] truncate" title={selectedFile.name}>
                    {selectedFile.name}
                  </p>
                  <p className="text-[11px] text-[var(--color-text-muted)]">
                    {formatBytes(selectedFile.size)} • {previewMeta.formatLabel}
                    {displayWidth && displayHeight ? ` • ${displayWidth}×${displayHeight}` : ""}
                    {displayDuration !== undefined ? ` • ${displayDuration.toFixed(1)}s` : ""}
                  </p>
                </div>
              </div>

              {/* Progress indicator during real upload/processing */}
              {(processing || progressPct > 0) && !serverResult && (
                <div className="space-y-2 rounded-[14px] border border-[var(--color-brand-line)] bg-[var(--color-brand-soft)]/50 p-3.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-[var(--color-ink)]">
                    <span>
                      {activeStepIndex >= 0
                        ? `${activeStepIndex + 1}/7 ${PROCESSING_STEPS[activeStepIndex]}…`
                        : "Preparing…"}
                    </span>
                    <span>{progressPct}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white border border-[var(--color-brand-line)]">
                    <div
                      className="h-full bg-[var(--color-brand)] transition-all duration-150"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Replace / Remove Controls */}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={processing}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-[10px] border border-[var(--border)] bg-white px-3.5 py-2 text-xs font-semibold text-[var(--color-ink)] hover:bg-[var(--color-surface-muted)] disabled:opacity-50"
                >
                  <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
                  Replace file
                </button>
                <button
                  type="button"
                  disabled={processing}
                  onClick={handleReset}
                  className="inline-flex items-center justify-center gap-1.5 rounded-[10px] border border-[var(--border)] bg-white px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                >
                  <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
                  Remove
                </button>
              </div>
            </div>

            {/* RIGHT PANEL — ANALYSIS RESULTS OR COMPLETION SCREEN */}
            <div className="lg:col-span-7 space-y-5 min-w-0">
              {serverResult ? (
                /* ===================== COMPLETION SCREEN ===================== */
                <div className="space-y-5">
                  <div className="flex flex-wrap items-start justify-between gap-2 pb-3 border-b border-[var(--border)]">
                    <div className="space-y-1">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-0.5 text-xs font-bold text-emerald-700">
                        <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
                        Clean File Ready
                      </span>
                      <h2 className="text-xl sm:text-2xl font-bold text-[var(--color-ink)]">
                        Your Privacy-Cleaned File Is Ready!
                      </h2>
                      <p className="text-xs sm:text-sm text-[var(--color-text-muted)]">
                        Your selected personal metadata has been processed successfully. Your file is ready to download.
                      </p>
                    </div>
                  </div>

                  {/* 3 Completion Result Rows */}
                  <div className="space-y-3 text-xs sm:text-sm">
                    <div className="rounded-[14px] border border-[var(--border)] bg-[var(--color-surface-muted)] p-3.5 flex items-start justify-between gap-3">
                      <div className="space-y-0.5">
                        <p className="font-bold text-[var(--color-ink)]">1. C2PA Content Credentials</p>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {serverResult.c2paNotice
                            ? serverResult.c2paNotice
                            : serverResult.c2paResultStatus === "preserved"
                              ? `Issuer: ${serverResult.c2pa.issuer || "Signer"} (${serverResult.c2pa.credentialStatus})`
                              : "No C2PA credentials existed on the original file."}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          serverResult.c2paResultStatus === "preserved"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : serverResult.c2paResultStatus === "unable_to_preserve"
                              ? "bg-amber-50 text-amber-800 border border-amber-200"
                              : "bg-white text-[var(--color-text-muted)] border border-[var(--border)]"
                        }`}
                      >
                        {serverResult.c2paResultStatus === "preserved"
                          ? "Preserved"
                          : serverResult.c2paResultStatus === "unable_to_preserve"
                            ? "Unable to preserve"
                            : "Not present"}
                      </span>
                    </div>

                    <div className="rounded-[14px] border border-[var(--border)] bg-[var(--color-surface-muted)] p-3.5 flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="font-bold text-[var(--color-ink)]">2. Personal Metadata</p>
                        {serverResult.removedFields.length > 0 ? (
                          <p className="text-xs text-[var(--color-text-muted)]">
                            Removed: {serverResult.removedFields.join(", ")}
                          </p>
                        ) : (
                          <p className="text-xs text-[var(--color-text-muted)]">
                            {serverResult.personalMetadataStatus === "preserved"
                              ? "Original metadata preserved to protect C2PA signature or per your selection."
                              : "No personal metadata tags were found."}
                          </p>
                        )}
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          serverResult.personalMetadataStatus === "removed"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : serverResult.personalMetadataStatus === "preserved"
                              ? "bg-[var(--color-brand-soft)] text-[var(--color-brand)] border border-[var(--color-brand-line)]"
                              : "bg-white text-[var(--color-text-muted)] border border-[var(--border)]"
                        }`}
                      >
                        {serverResult.personalMetadataStatus === "removed"
                          ? "Removed"
                          : serverResult.personalMetadataStatus === "preserved"
                            ? "Preserved"
                            : "Not available"}
                      </span>
                    </div>

                    <div className="rounded-[14px] border border-rose-200 bg-rose-50/70 p-3.5 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-bold text-[var(--color-ink)]">3. SynthID Verification</p>
                        <span className="text-xs font-bold text-rose-700">
                          Original signal not intentionally modified
                        </span>
                      </div>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {serverResult.synthId.explanation}
                      </p>
                    </div>
                  </div>

                  {/* Completion Buttons */}
                  <div className="flex flex-wrap items-center gap-2.5 pt-1">
                    <a
                      href={serverResult.cleanDownloadUrl}
                      download={serverResult.cleanFileName}
                      className="inline-flex items-center gap-2 btn-plum px-5 py-2.5 text-xs sm:text-sm font-semibold"
                    >
                      <Download aria-hidden="true" className="h-4 w-4" />
                      Download Clean File
                    </a>
                    <a
                      href={serverResult.originalDownloadUrl}
                      download={serverResult.fileName}
                      className="inline-flex items-center gap-1.5 rounded-[12px] border border-[var(--border)] bg-white px-4 py-2.5 text-xs sm:text-sm font-semibold text-[var(--color-ink)] hover:bg-[var(--color-surface-muted)]"
                    >
                      <Download aria-hidden="true" className="h-3.5 w-3.5" />
                      Download Original
                    </a>
                    <button
                      type="button"
                      onClick={() => setCompareOpen((v) => !v)}
                      className="inline-flex items-center gap-1.5 btn-mint px-4 py-2.5 text-xs sm:text-sm font-semibold"
                    >
                      <span>{compareOpen ? "Hide Results" : "Inspect Results"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleReset}
                      className="inline-flex items-center gap-1.5 rounded-[12px] border border-[var(--border)] bg-white px-4 py-2.5 text-xs sm:text-sm font-semibold text-[var(--color-ink)] hover:bg-[var(--color-surface-muted)]"
                    >
                      <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
                      Process Another File
                    </button>
                  </div>

                  {compareOpen && (
                    <div className="rounded-[14px] border border-[var(--border)] bg-[var(--color-surface-muted)] p-4 text-xs space-y-2.5">
                      <p className="font-bold text-[var(--color-ink)]">
                        Verified Output Summary ({formatBytes(serverResult.fileSizeBytes)} →{" "}
                        {formatBytes(serverResult.cleanedSizeBytes)})
                      </p>
                      <p className="font-mono text-[11px] break-all text-[var(--color-text-muted)]">
                        Input SHA-256: {serverResult.inputSha256}
                      </p>
                      <p className="font-mono text-[11px] break-all text-[var(--color-text-muted)]">
                        Output SHA-256: {serverResult.outputSha256}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                /* ===================== LIVE ANALYSIS & CLEANING FORM ===================== */
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
                    <div>
                      <p className="text-xs text-[var(--color-text-muted)] truncate max-w-xs sm:max-w-md">
                        {selectedFile.name} • {formatBytes(selectedFile.size)}
                      </p>
                      <h2 className="text-xl font-bold text-[var(--color-ink)]">
                        Your Media Analysis
                      </h2>
                    </div>
                    <span className="rounded-full bg-[var(--color-brand-soft)] border border-[var(--color-brand-line)] px-3 py-1 text-xs font-semibold text-[var(--color-brand)]">
                      {localReadingStage !== "idle"
                        ? "Inspecting…"
                        : processing
                          ? "Processing…"
                          : "Ready to clean"}
                    </span>
                  </div>

                  {/* Section A: C2PA Content Credentials */}
                  <div className="rounded-[14px] border border-[var(--border)] bg-white p-3.5 flex items-start gap-3">
                    <div
                      className={`mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                        displayC2paStatus === "present"
                          ? "bg-emerald-50 text-emerald-700"
                          : displayC2paStatus === "unable_to_verify"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]"
                      }`}
                    >
                      {displayC2paStatus === "present" ? (
                        <ShieldCheck aria-hidden="true" className="h-4 w-4" />
                      ) : displayC2paStatus === "unable_to_verify" ? (
                        <ShieldAlert aria-hidden="true" className="h-4 w-4" />
                      ) : (
                        <Shield aria-hidden="true" className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold text-[var(--color-ink)]">
                          A. C2PA Content Credentials
                        </span>
                        <span className="font-semibold text-[var(--color-text-muted)]">
                          {displayC2paStatus === "present"
                            ? "Present"
                            : displayC2paStatus === "unable_to_verify"
                              ? "Unable to verify"
                              : "Not detected"}
                        </span>
                      </div>
                      {displayC2paStatus !== "not_detected" ? (
                        <p className="text-[var(--color-text-muted)]">
                          Issuer: <strong>{displayC2paIssuer || "Unknown"}</strong> • Signature:{" "}
                          <strong>{displayC2paCredStatus}</strong>
                          {activeNode?.claimGenerator ? ` • App: ${activeNode.claimGenerator}` : ""}
                        </p>
                      ) : (
                        <p className="text-[var(--color-text-muted)]">
                          No C2PA provenance manifest found in this file.
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Section B: SynthID Information */}
                  <div className="rounded-[14px] border border-rose-200 bg-rose-50/70 p-3.5 space-y-1.5 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold text-[var(--color-ink)]">
                        B. SynthID Verification
                      </span>
                      <span className="font-semibold text-rose-700">
                        Verification unavailable
                      </span>
                    </div>
                    <p className="text-[var(--color-text-muted)] leading-relaxed">
                      The presence or absence of a detectable SynthID watermark signal does not establish whether content was AI-generated. This tool does not strip or circumvent SynthID signals.
                    </p>
                    <a
                      href="https://support.google.com/gemini/answer/16722517?hl=en"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-[var(--color-brand)] hover:underline"
                    >
                      How to check in Gemini
                      <ExternalLink aria-hidden="true" className="h-3 w-3" />
                    </a>
                  </div>

                  {/* Section C: Metadata Inspector */}
                  <div className="rounded-[14px] border border-[var(--border)] bg-[var(--color-surface-muted)] p-3.5 text-xs">
                    <button
                      type="button"
                      aria-expanded={metaOpen}
                      onClick={() => setMetaOpen((v) => !v)}
                      className="w-full flex items-center justify-between font-bold text-[var(--color-ink)]"
                    >
                      <span>C. Metadata Inspector</span>
                      {metaOpen ? (
                        <ChevronUp aria-hidden="true" className="h-4 w-4" />
                      ) : (
                        <ChevronDown aria-hidden="true" className="h-4 w-4" />
                      )}
                    </button>

                    {metaOpen && (
                      <dl className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                        <div className="rounded-[10px] bg-white border border-[var(--border)] p-2">
                          <dt className="text-[11px] text-[var(--color-text-muted)]">File format</dt>
                          <dd className="font-semibold text-[var(--color-ink)]">{previewMeta.formatLabel}</dd>
                        </div>
                        <div className="rounded-[10px] bg-white border border-[var(--border)] p-2">
                          <dt className="text-[11px] text-[var(--color-text-muted)]">Dimensions</dt>
                          <dd className="font-semibold text-[var(--color-ink)]">
                            {displayWidth && displayHeight
                              ? `${displayWidth} × ${displayHeight}`
                              : "Pending"}
                          </dd>
                        </div>
                        {previewMeta.mediaKind === "video" && (
                          <>
                            <div className="rounded-[10px] bg-white border border-[var(--border)] p-2">
                              <dt className="text-[11px] text-[var(--color-text-muted)]">Duration</dt>
                              <dd className="font-semibold text-[var(--color-ink)]">
                                {displayDuration !== undefined ? `${displayDuration.toFixed(2)}s` : "Detected on clean"}
                              </dd>
                            </div>
                            {displayCodec && (
                              <div className="rounded-[10px] bg-white border border-[var(--border)] p-2">
                                <dt className="text-[11px] text-[var(--color-text-muted)]">Video codec</dt>
                                <dd className="font-semibold text-[var(--color-ink)]">{displayCodec}</dd>
                              </div>
                            )}
                            {displayFps && (
                              <div className="rounded-[10px] bg-white border border-[var(--border)] p-2">
                                <dt className="text-[11px] text-[var(--color-text-muted)]">Frame rate</dt>
                                <dd className="font-semibold text-[var(--color-ink)]">{displayFps} fps</dd>
                              </div>
                            )}
                          </>
                        )}
                        <div className="rounded-[10px] bg-white border border-[var(--border)] p-2">
                          <dt className="text-[11px] text-[var(--color-text-muted)]">EXIF / Capture</dt>
                          <dd className="font-semibold text-[var(--color-ink)]">
                            {activeNode && Object.keys(activeNode.exifDetails).length > 0
                              ? `${Object.keys(activeNode.exifDetails).length} tags`
                              : "Inspected on server clean"}
                          </dd>
                        </div>
                        {activeNode && Object.keys(activeNode.captureDetails).length > 0 && (
                          <div className="rounded-[10px] bg-white border border-[var(--border)] p-2 col-span-2 sm:col-span-3">
                            <dt className="text-[11px] text-[var(--color-text-muted)] flex items-center justify-between">
                              <span>Personal GPS / Location data detected</span>
                              <button
                                type="button"
                                onClick={() => setShowGpsCoords((v) => !v)}
                                className="text-[var(--color-brand)] underline font-semibold"
                              >
                                {showGpsCoords ? "Hide coordinates" : "Show coordinates"}
                              </button>
                            </dt>
                            <dd className="font-semibold text-[var(--color-ink)] mt-0.5">
                              {showGpsCoords
                                ? Object.entries(activeNode.captureDetails)
                                    .map(([k, v]) => `${k}: ${v}`)
                                    .join(" • ")
                                : "Hidden by default for privacy (included in cleaning)"}
                            </dd>
                          </div>
                        )}
                      </dl>
                    )}
                  </div>

                  {/* Privacy Cleaning Options */}
                  <div className="rounded-[14px] border border-[var(--border)] bg-white p-3.5 space-y-2.5 text-xs">
                    <p className="font-bold text-[var(--color-ink)] flex items-center gap-1.5">
                      <FileCheck2 aria-hidden="true" className="h-4 w-4 text-[var(--color-brand)]" />
                      Privacy Cleaning Options
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(
                        [
                          ["removeGps", "Remove GPS location metadata"],
                          ["removeCameraInfo", "Remove personal camera info"],
                          ["removeExif", "Remove unnecessary EXIF metadata"],
                          ["removePersonalMetadata", "Remove non-essential personal metadata"],
                          ["preserveQuality", "Preserve original image/video quality"],
                          ["preserveC2pa", "Preserve C2PA Content Credentials"],
                        ] as const
                      ).map(([key, label]) => (
                        <label
                          key={key}
                          className="inline-flex items-center gap-2 text-[var(--color-ink)] cursor-pointer select-none"
                        >
                          <input
                            type="checkbox"
                            checked={options[key]}
                            disabled={key === "preserveC2pa"}
                            onChange={(e) =>
                              setOptions((prev) => ({
                                ...prev,
                                [key]: e.target.checked,
                              }))
                            }
                            className="h-3.5 w-3.5 accent-[var(--color-brand)]"
                          />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Actual Server Processing Error + Retry */}
                  {processError && (
                    <div
                      role="alert"
                      className="rounded-[12px] border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-900 flex flex-wrap items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2">
                        <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0 text-rose-600" />
                        <span>{processError}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleRunCleaning()}
                        className="rounded-[8px] bg-rose-700 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-800"
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {/* Primary Action Bar matching screenshot bottom-right */}
                  <div className="flex items-center gap-3 pt-1">
                    <button
                      type="button"
                      aria-label="Reset workbench"
                      disabled={processing}
                      onClick={handleReset}
                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border border-[var(--border)] bg-white text-[var(--color-ink)] hover:bg-[var(--color-surface-muted)] disabled:opacity-50"
                    >
                      <RotateCcw aria-hidden="true" className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      disabled={processing}
                      onClick={() => void handleRunCleaning()}
                      className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 btn-plum px-6 py-2.5 text-sm font-semibold disabled:opacity-60"
                    >
                      {processing
                        ? `${PROCESSING_STEPS[Math.max(0, activeStepIndex)]}…`
                        : "Clean Privacy Metadata"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Preserve Honest Local C2PA Credentials Result Card below the workbench */}
      {localC2pa && (
        <CredentialsResultCard result={localC2pa} onReset={handleReset} />
      )}
    </div>
  );
}
