"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  ExternalLink,
  FileCheck2,
  Film,
  HelpCircle,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  RotateCcw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { CredentialsResultCard } from "@/components/CredentialsResultCard";
import { inspectBlob, type InspectionResult } from "@/lib/c2pa-inspect";
import type { MediaMetadataReport } from "@/lib/media-metadata";
import type {
  C2paInspectionSummary,
  PrivacyCleanOptions,
  ProcessingStageKey,
  ProcessingStageUpdate,
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
  personalMetadataLabel: "Cleaned" | "Already Clean" | "Not Processed";
  removedFields: string[];
  preservedOriginalBytes: boolean;
  outputVerified: boolean;
  dimensionsPreserved: boolean;
  processingTimeMs: number;
  stages: ProcessingStageUpdate[];
  beforeMetadata: MediaMetadataReport;
  afterMetadata: MediaMetadataReport;
  cleanDownloadUrl: string;
  originalDownloadUrl: string;
  expiresAt: string;
  isAuthenticated: boolean;
  recordUrl: string | null;
}

interface PrivacySessionInfo {
  isAuthenticated: boolean;
  planName: string;
  dailyLimit: number;
  usedToday: number;
  maxImageMb: number;
  maxVideoMb: number;
  retentionHours: number;
  synthIdVerifierConfigured: boolean;
}

interface LocalPreviewMeta {
  previewUrl: string;
  mediaKind: "image" | "video";
  width?: number;
  height?: number;
  durationSec?: number;
  formatLabel: string;
}

const DEFAULT_SESSION_INFO: PrivacySessionInfo = {
  isAuthenticated: false,
  planName: "Guest",
  dailyLimit: 10,
  usedToday: 0,
  maxImageMb: 15,
  maxVideoMb: 50,
  retentionHours: 24,
  synthIdVerifierConfigured: false,
};

const CHUNK_THRESHOLD_BYTES = 3.5 * 1024 * 1024;
const ALLOWED_EXT_RX = /\.(png|jpe?g|webp|mp4|mov|webm)$/i;

const FILTER_ACCEPT: Record<"all" | "image" | "video", string> = {
  all: ".png,.jpg,.jpeg,.webp,.mp4,.mov,.webm,image/png,image/jpeg,image/webp,video/mp4,video/quicktime,video/webm",
  image: ".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp",
  video: ".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm",
};

const FILTER_FORMATS_LABEL: Record<"all" | "image" | "video", string> = {
  all: "PNG · JPG · JPEG · WEBP (images) | MP4 · MOV · WEBM (videos)",
  image: "PNG · JPG · JPEG · WEBP (images up to plan limit)",
  video: "MP4 · MOV · WEBM (videos up to plan limit)",
};

const BACKEND_STAGES: Array<{ step: number; key: ProcessingStageKey; label: string }> = [
  { step: 1, key: "uploaded", label: "File uploaded" },
  { step: 2, key: "validated", label: "File validated" },
  { step: 3, key: "analysed", label: "Image analysed" },
  { step: 4, key: "metadata_inspected", label: "Metadata inspected" },
  { step: 5, key: "c2pa_inspected", label: "C2PA credentials inspected" },
  { step: 6, key: "synthid_attempted", label: "SynthID verification attempted" },
  { step: 7, key: "metadata_cleaned", label: "Selected privacy metadata cleaned" },
  { step: 8, key: "output_generated", label: "Output file generated" },
  { step: 9, key: "output_verified", label: "Output integrity verified" },
  { step: 10, key: "download_prepared", label: "Download prepared" },
];

function createInitialStages(): ProcessingStageUpdate[] {
  const now = new Date().toISOString();
  return BACKEND_STAGES.map((s) => ({
    step: s.step,
    key: s.key,
    label: s.label,
    status: s.step === 1 ? "running" : "pending",
    timestamp: now,
  }));
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}

function makeAbortError(): Error {
  const err = new Error("Processing cancelled by user.");
  err.name = "AbortError";
  return err;
}

function hasValidMediaSignature(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return true;
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return true;
  }
  const ascii = (start: number, end: number) =>
    String.fromCharCode(...bytes.slice(start, end));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return true;
  if (ascii(4, 8) === "ftyp") return true;
  if (
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3
  ) {
    return true;
  }
  return false;
}

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
    try {
      const dims = await new Promise<{ width: number; height: number }>(
        (resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            if (img.naturalWidth > 0 && img.naturalHeight > 0) {
              resolve({ width: img.naturalWidth, height: img.naturalHeight });
            } else {
              reject(
                new Error(
                  `Image file "${file.name}" is corrupted or has invalid dimensions.`
                )
              );
            }
          };
          img.onerror = () =>
            reject(
              new Error(
                `Image file "${file.name}" is corrupted or unreadable and could not be decoded.`
              )
            );
          img.src = previewUrl;
        }
      );
      return {
        previewUrl,
        mediaKind: "image",
        width: dims.width,
        height: dims.height,
        formatLabel: ext === "JPEG" ? "JPG" : ext,
      };
    } catch (err) {
      URL.revokeObjectURL(previewUrl);
      throw err;
    }
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

function uploadSmallWithStream(
  file: File,
  options: PrivacyCleanOptions,
  onProgress: (pct: number) => void,
  onStage: (stage: ProcessingStageUpdate) => void,
  registerAbort: (abortFn: () => void) => void
): Promise<ServerCleanResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/privacy-clean");
    xhr.setRequestHeader("Accept", "application/x-ndjson");

    let parsedOffset = 0;
    let settledStages = 0;
    let finalResult: ServerCleanResponse | null = null;
    let streamError: string | null = null;

    const handleLine = (rawLine: string) => {
      const trimmed = rawLine.trim();
      if (!trimmed) return;
      try {
        const msg = JSON.parse(trimmed) as {
          type?: string;
          ok?: boolean;
          stage?: ProcessingStageUpdate;
          data?: ServerCleanResponse;
          error?: string;
        };
        if (msg.type === "stage" && msg.stage) {
          onStage(msg.stage);
          if (
            msg.stage.status === "completed" ||
            msg.stage.status === "skipped" ||
            msg.stage.status === "unavailable"
          ) {
            settledStages = Math.max(settledStages, msg.stage.step);
            onProgress(35 + Math.round((settledStages / 10) * 63));
          }
        } else if (msg.type === "result" && msg.data) {
          finalResult = msg.data;
          onProgress(100);
        } else if (msg.type === "error" && msg.error) {
          streamError = msg.error;
        } else if (msg.ok && !msg.type) {
          // Compatibility fallback if an intermediary returned plain JSON
          finalResult = msg as unknown as ServerCleanResponse;
          onProgress(100);
        }
      } catch {
        // Ignore partial chunk until newline arrives
      }
    };

    const drainLines = (flushRemainder: boolean) => {
      const text = xhr.responseText || "";
      if (text.length <= parsedOffset) return;
      const slice = text.slice(parsedOffset);
      const lastNewline = slice.lastIndexOf("\n");
      if (lastNewline >= 0) {
        const completeBlock = slice.slice(0, lastNewline);
        parsedOffset += lastNewline + 1;
        for (const line of completeBlock.split("\n")) {
          handleLine(line);
        }
      }
      if (flushRemainder && parsedOffset < text.length) {
        const tail = text.slice(parsedOffset);
        parsedOffset = text.length;
        for (const line of tail.split("\n")) {
          handleLine(line);
        }
      }
    };

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && e.total > 0) {
        onProgress(Math.min(35, Math.round((e.loaded / e.total) * 35)));
      }
    };

    xhr.upload.onload = () => {
      onProgress(35);
    };

    xhr.onprogress = () => {
      drainLines(false);
    };

    xhr.onload = () => {
      drainLines(true);
      if (xhr.status >= 200 && xhr.status < 300) {
        if (streamError) {
          reject(new Error(streamError));
          return;
        }
        if (finalResult) {
          resolve(finalResult);
          return;
        }
      }
      try {
        const errJson = JSON.parse(xhr.responseText || "{}") as { error?: string };
        reject(
          new Error(
            streamError || errJson.error || `Server returned HTTP ${xhr.status}`
          )
        );
      } catch {
        reject(new Error(streamError || `Processing failed (HTTP ${xhr.status})`));
      }
    };

    xhr.onerror = () =>
      reject(new Error("Network interruption while uploading or processing file."));
    xhr.onabort = () => reject(makeAbortError());

    registerAbort(() => xhr.abort());

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
  onStage: (stage: ProcessingStageUpdate) => void,
  registerAbort: (abortFn: () => void) => void
): Promise<ServerCleanResponse> {
  const controller = new AbortController();
  registerAbort(() => controller.abort(makeAbortError()));

  const initRes = await fetch("/api/privacy-clean/upload-init", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: controller.signal,
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
      signal: controller.signal,
      body: fd,
    });
    const chunkData = await chunkRes.json().catch(() => ({}));
    if (!chunkRes.ok) {
      throw new Error(chunkData.error || `Chunk ${i + 1} failed to upload.`);
    }
    onProgress(Math.round(((i + 1) / totalChunks) * 35));
  }

  const res = await fetch("/api/privacy-clean", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/x-ndjson",
    },
    signal: controller.signal,
    body: JSON.stringify({ uploadId, options }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || `Processing failed (HTTP ${res.status}).`);
  }

  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/x-ndjson") || !res.body) {
    const data = await res.json().catch(() => ({}));
    if (!data.ok) throw new Error(data.error || "Processing failed.");
    onProgress(100);
    return data as ServerCleanResponse;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let finalResult: ServerCleanResponse | null = null;
  let streamError: string | null = null;

  while (true) {
    const { value, done } = await reader.read();
    if (value) {
      buf += decoder.decode(value, { stream: !done });
    }
    const lines = buf.split("\n");
    buf = done ? "" : (lines.pop() ?? "");

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const msg = JSON.parse(trimmed) as {
          type?: string;
          stage?: ProcessingStageUpdate;
          data?: ServerCleanResponse;
          error?: string;
        };
        if (msg.type === "stage" && msg.stage) {
          onStage(msg.stage);
          if (
            msg.stage.status === "completed" ||
            msg.stage.status === "skipped" ||
            msg.stage.status === "unavailable"
          ) {
            onProgress(35 + Math.round((msg.stage.step / 10) * 63));
          }
        } else if (msg.type === "result" && msg.data) {
          finalResult = msg.data;
          onProgress(100);
        } else if (msg.type === "error" && msg.error) {
          streamError = msg.error;
        }
      } catch {
        // ignore invalid line
      }
    }

    if (done) break;
  }

  if (streamError) throw new Error(streamError);
  if (!finalResult) throw new Error("Processing stream ended unexpectedly.");
  return finalResult;
}

export function MediaInspectorWorkbench() {
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortFnRef = useRef<(() => void) | null>(null);

  const [sessionInfo, setSessionInfo] =
    useState<PrivacySessionInfo>(DEFAULT_SESSION_INFO);
  const [mediaFilter, setMediaFilter] = useState<"all" | "image" | "video">("all");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewMeta, setPreviewMeta] = useState<LocalPreviewMeta | null>(null);
  const [localC2pa, setLocalC2pa] = useState<InspectionResult | null>(null);
  const [localReadingStage, setLocalReadingStage] = useState<
    "idle" | "reading" | "checking"
  >("idle");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [oversizedNeedsUpgrade, setOversizedNeedsUpgrade] = useState(false);
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

  // Real-time 10-stage processing telemetry
  const [processing, setProcessing] = useState(false);
  const [progressPct, setProgressPct] = useState(0);
  const [stages, setStages] = useState<ProcessingStageUpdate[]>([]);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [cancelledMsg, setCancelledMsg] = useState<string | null>(null);
  const [processError, setProcessError] = useState<string | null>(null);
  const [serverResult, setServerResult] = useState<ServerCleanResponse | null>(null);

  // Download & link expiry recovery
  const [downloadBusy, setDownloadBusy] = useState<"cleaned" | "original" | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadLinkExpired, setDownloadLinkExpired] = useState(false);
  const [refreshingLinks, setRefreshingLinks] = useState(false);

  // Collapsible inspection sections
  const [metaOpen, setMetaOpen] = useState(true);
  const [reportOpen, setReportOpen] = useState(false);
  const [showGpsCoords, setShowGpsCoords] = useState(false);

  const loadSessionInfo = useCallback(async () => {
    try {
      const res = await fetch("/api/privacy-clean/session", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as Partial<PrivacySessionInfo> & { ok?: boolean };
      if (data.ok) {
        setSessionInfo({
          isAuthenticated: Boolean(data.isAuthenticated),
          planName: data.planName || "Guest",
          dailyLimit: Number(data.dailyLimit ?? 10),
          usedToday: Number(data.usedToday ?? 0),
          maxImageMb: Number(data.maxImageMb ?? 15),
          maxVideoMb: Number(data.maxVideoMb ?? 50),
          retentionHours: Number(data.retentionHours ?? 24),
          synthIdVerifierConfigured: Boolean(data.synthIdVerifierConfigured),
        });
      }
    } catch {
      // keep safe guest defaults
    }
  }, []);

  useEffect(() => {
    void loadSessionInfo();
  }, [loadSessionInfo]);

  useEffect(() => {
    if (!processing) return;
    const t0 = Date.now();
    setElapsedMs(0);
    const id = setInterval(() => {
      setElapsedMs(Date.now() - t0);
    }, 100);
    return () => clearInterval(id);
  }, [processing]);

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
      abortFnRef.current?.();
    };
  }, [cleanupResources]);

  const mergeStageUpdate = useCallback((update: ProcessingStageUpdate) => {
    setStages((prev) => {
      const next = prev.length > 0 ? [...prev] : createInitialStages();
      const idx = next.findIndex((s) => s.key === update.key || s.step === update.step);
      if (idx >= 0) next[idx] = update;
      else next.push(update);
      return next;
    });
  }, []);

  const handleFileSelect = useCallback(
    async (file?: File | null) => {
      if (!file) return;
      setValidationError(null);
      setOversizedNeedsUpgrade(false);
      setCancelledMsg(null);
      setProcessError(null);
      setDownloadError(null);
      setDownloadLinkExpired(false);
      setServerResult(null);
      setStages([]);
      setReportOpen(false);
      setProgressPct(0);

      if (!ALLOWED_EXT_RX.test(file.name)) {
        setValidationError(
          `Unsupported file "${file.name}". Please choose PNG, JPG, JPEG, WEBP, MP4, MOV, or WEBM.`
        );
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      const isVideo =
        /\.(mp4|mov|webm)$/i.test(file.name) || file.type.startsWith("video/");
      if (file.size === 0) {
        setValidationError("Selected file is empty and cannot be processed.");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      const maxImageBytes = sessionInfo.maxImageMb * 1024 * 1024;
      const maxVideoBytes = sessionInfo.maxVideoMb * 1024 * 1024;
      if (isVideo && file.size > maxVideoBytes) {
        setOversizedNeedsUpgrade(!sessionInfo.isAuthenticated);
        setValidationError(
          `Selected video exceeds your ${sessionInfo.planName} plan limit (${sessionInfo.maxVideoMb} MB).`
        );
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      if (!isVideo && file.size > maxImageBytes) {
        setOversizedNeedsUpgrade(!sessionInfo.isAuthenticated);
        setValidationError(
          `Selected image exceeds your ${sessionInfo.planName} plan limit (${sessionInfo.maxImageMb} MB).`
        );
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      const headBytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
      if (!hasValidMediaSignature(headBytes)) {
        setValidationError(
          `File "${file.name}" does not have a valid PNG, JPG, JPEG, WEBP, MP4, MOV, or WEBM file header.`
        );
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }

      if (mediaFilter === "image" && isVideo) {
        setMediaFilter("video");
      } else if (mediaFilter === "video" && !isVideo) {
        setMediaFilter("image");
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
        cleanupResources();
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        const rawMsg = err instanceof Error ? err.message : String(err || "");
        setValidationError(
          /invalidasset|out of range|unexpected eof|corrupt|could not be decoded/i.test(
            rawMsg
          )
            ? `${isVideo ? "Video" : "Image"} file "${file.name}" is corrupted or unreadable and could not be decoded.`
            : rawMsg || "File could not be decoded in the browser."
        );
      } finally {
        setLocalReadingStage("idle");
      }
    },
    [
      cleanupResources,
      mediaFilter,
      sessionInfo.isAuthenticated,
      sessionInfo.maxImageMb,
      sessionInfo.maxVideoMb,
      sessionInfo.planName,
    ]
  );

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = e.clipboardData?.files?.[0];
      if (file) void handleFileSelect(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [handleFileSelect]);

  const handleReset = () => {
    abortFnRef.current?.();
    abortFnRef.current = null;
    cleanupResources();
    setSelectedFile(null);
    setServerResult(null);
    setStages([]);
    setProcessError(null);
    setCancelledMsg(null);
    setValidationError(null);
    setOversizedNeedsUpgrade(false);
    setDownloadError(null);
    setDownloadLinkExpired(false);
    setProgressPct(0);
    setShowGpsCoords(false);
    setReportOpen(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCancelProcessing = () => {
    if (!processing) return;
    abortFnRef.current?.();
  };

  const handleRunCleaning = async () => {
    if (!selectedFile || processing) return;
    setProcessing(true);
    setProcessError(null);
    setCancelledMsg(null);
    setDownloadError(null);
    setDownloadLinkExpired(false);
    setProgressPct(2);
    setStages(createInitialStages());

    try {
      const data =
        selectedFile.size > CHUNK_THRESHOLD_BYTES
          ? await uploadChunkedLargeFile(
              selectedFile,
              options,
              (pct) => setProgressPct(pct),
              mergeStageUpdate,
              (fn) => {
                abortFnRef.current = fn;
              }
            )
          : await uploadSmallWithStream(
              selectedFile,
              options,
              (pct) => setProgressPct(pct),
              mergeStageUpdate,
              (fn) => {
                abortFnRef.current = fn;
              }
            );

      setServerResult(data);
      setElapsedMs(data.processingTimeMs);
      void loadSessionInfo();
    } catch (err) {
      if (isAbortError(err)) {
        setCancelledMsg("Processing was cancelled. Your file remains loaded and ready if you want to retry.");
      } else {
        setProcessError(
          err instanceof Error ? err.message : "Processing failed. Please try again."
        );
      }
    } finally {
      abortFnRef.current = null;
      setProcessing(false);
    }
  };

  const handleRefreshDownloadLinks = async () => {
    if (!serverResult || refreshingLinks) return;
    setRefreshingLinks(true);
    setDownloadError(null);
    try {
      const res = await fetch(
        `/api/privacy-clean/records/${encodeURIComponent(serverResult.recordId)}`,
        { cache: "no-store" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.record) {
        throw new Error(data.error || "Could not refresh download link.");
      }
      if (!data.record.cleanDownloadUrl) {
        setDownloadLinkExpired(true);
        setDownloadError("This processed file has expired and was deleted.");
        return;
      }
      setServerResult((prev) =>
        prev
          ? {
              ...prev,
              cleanDownloadUrl: data.record.cleanDownloadUrl,
              originalDownloadUrl: data.record.originalDownloadUrl || prev.originalDownloadUrl,
            }
          : prev
      );
      setDownloadLinkExpired(false);
      setDownloadError(null);
    } catch (err) {
      setDownloadError(
        err instanceof Error ? err.message : "Unable to refresh download link."
      );
    } finally {
      setRefreshingLinks(false);
    }
  };

  const handleVerifiedDownload = async (
    e: React.MouseEvent<HTMLAnchorElement>,
    url: string,
    fileName: string,
    kind: "cleaned" | "original"
  ) => {
    e.preventDefault();
    if (downloadBusy) return;
    setDownloadBusy(kind);
    setDownloadError(null);

    try {
      const res = await fetch(url);
      if (!res.ok) {
        const errJson = (await res.json().catch(() => ({}))) as {
          error?: string;
          code?: string;
        };
        if (
          res.status === 403 ||
          res.status === 410 ||
          errJson.code === "ERR_LINK_EXPIRED" ||
          errJson.code === "ERR_FILE_EXPIRED"
        ) {
          setDownloadLinkExpired(true);
        }
        throw new Error(errJson.error || `Download failed (HTTP ${res.status}).`);
      }

      const blob = await res.blob();
      if (!blob || blob.size === 0) {
        throw new Error("Downloaded file was empty and failed integrity check.");
      }

      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 15_000);
    } catch (err) {
      setDownloadError(
        err instanceof Error ? err.message : "Could not download file."
      );
    } finally {
      setDownloadBusy(null);
    }
  };

  const activeNode = localC2pa?.rootNode || null;
  const activeBefore = serverResult?.beforeMetadata || null;

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

  const activeRunningStage =
    stages.find((s) => s.status === "running") ||
    [...stages].reverse().find((s) => s.status !== "pending") ||
    stages[0];

  const isVideoFile =
    (serverResult?.mediaKind ?? previewMeta?.mediaKind) === "video";

  const synthStatus = serverResult?.synthId.status;
  const completionHeading =
    synthStatus === "verified_no_signal"
      ? isVideoFile
        ? "Your Video Is SynthID-Free"
        : "Your Image Is SynthID-Free"
      : isVideoFile
        ? "Your Video Is Ready"
        : "Your Image Is Ready";

  const overlaySynthLabel =
    synthStatus === "verified_no_signal"
      ? "SynthID: No Signal"
      : synthStatus === "signal_detected"
        ? "SynthID: Signal Detected"
        : synthStatus === "inconclusive"
          ? "SynthID: Inconclusive"
          : sessionInfo.synthIdVerifierConfigured
            ? "SynthID: Ready to Check"
            : "SynthID: Unavailable";

  const overlaySynthColor =
    synthStatus === "verified_no_signal"
      ? "text-emerald-700"
      : synthStatus === "signal_detected"
        ? "text-rose-700"
        : synthStatus === "inconclusive"
          ? "text-amber-700"
          : "text-[var(--color-text-muted)]";

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
        accept={FILTER_ACCEPT[mediaFilter]}
        onChange={(e) => void handleFileSelect(e.target.files?.[0])}
      />

      {/* Main Container Card */}
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
                    {tab.id === "image" && (
                      <ImageIcon aria-hidden="true" className="h-3.5 w-3.5" />
                    )}
                    {tab.id === "video" && (
                      <Film aria-hidden="true" className="h-3.5 w-3.5" />
                    )}
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
                  : mediaFilter === "image"
                    ? "Drop images or browse files"
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
                {FILTER_FORMATS_LABEL[mediaFilter]} •{" "}
                {sessionInfo.isAuthenticated
                  ? `${sessionInfo.planName}: up to ${sessionInfo.maxImageMb} MB images / ${sessionInfo.maxVideoMb} MB videos`
                  : `Guest: up to ${sessionInfo.maxImageMb} MB images / ${sessionInfo.maxVideoMb} MB videos (${sessionInfo.dailyLimit - sessionInfo.usedToday}/${sessionInfo.dailyLimit} left today)`}
              </p>
            </div>

            {validationError && (
              <div
                role="alert"
                className="rounded-[12px] border border-rose-200 bg-rose-50 p-4 text-xs sm:text-sm text-rose-900 flex flex-wrap items-center justify-between gap-3 text-left"
              >
                <div className="flex items-start gap-2.5">
                  <AlertTriangle
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 text-rose-600 mt-0.5"
                  />
                  <span>{validationError}</span>
                </div>
                {oversizedNeedsUpgrade && (
                  <Link
                    href="/signup?callbackUrl=/tools"
                    className="shrink-0 rounded-[8px] bg-[var(--color-brand)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--color-brand-hover)]"
                  >
                    Create free account (25 MB limit)
                  </Link>
                )}
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

                {/* Bottom-left overlay status pill */}
                <div className="pointer-events-none absolute bottom-3 left-3 inline-flex flex-wrap items-center gap-2 rounded-full bg-white/95 backdrop-blur-sm border border-[var(--border)] px-3 py-1 text-[11px] font-semibold text-[var(--color-ink)] shadow-[var(--shadow-2)]">
                  <span className="inline-flex items-center gap-1">
                    {displayC2paStatus === "present" ? (
                      <Check aria-hidden="true" className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <HelpCircle
                        aria-hidden="true"
                        className="h-3.5 w-3.5 text-[var(--color-text-muted)]"
                      />
                    )}
                    C2PA
                  </span>
                  <span aria-hidden="true" className="text-[var(--border)]">
                    •
                  </span>
                  <span className={`inline-flex items-center gap-1 ${overlaySynthColor}`}>
                    {overlaySynthLabel}
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
                  <p
                    className="text-xs font-bold text-[var(--color-ink)] truncate"
                    title={selectedFile.name}
                  >
                    {selectedFile.name}
                  </p>
                  <p className="text-[11px] text-[var(--color-text-muted)]">
                    {formatBytes(selectedFile.size)} • {previewMeta.formatLabel}
                    {displayWidth && displayHeight ? ` • ${displayWidth}×${displayHeight}` : ""}
                    {displayDuration !== undefined ? ` • ${displayDuration.toFixed(1)}s` : ""}
                  </p>
                </div>
              </div>

              {/* Real 10-Stage Backend Progress + Cancel Control */}
              {(processing || (stages.length > 0 && !serverResult)) && (
                <div
                  aria-live="polite"
                  className="space-y-3 rounded-[14px] border border-[var(--color-brand-line)] bg-[var(--color-brand-soft)]/50 p-3.5"
                >
                  <div className="flex items-center justify-between gap-2 text-xs font-semibold text-[var(--color-ink)]">
                    <span className="inline-flex items-center gap-1.5 min-w-0 truncate">
                      {processing && (
                        <Loader2
                          aria-hidden="true"
                          className="h-3.5 w-3.5 shrink-0 animate-spin text-[var(--color-brand)]"
                        />
                      )}
                      <span className="truncate">
                        {activeRunningStage
                          ? `${activeRunningStage.step}/10 ${activeRunningStage.label}…`
                          : "Processing…"}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-[var(--color-text-muted)]">
                      {progressPct}% • {(elapsedMs / 1000).toFixed(1)}s
                    </span>
                  </div>

                  <div className="h-2 w-full overflow-hidden rounded-full bg-white border border-[var(--color-brand-line)]">
                    <div
                      className="h-full bg-[var(--color-brand)] transition-all duration-150"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>

                  <ol className="space-y-1 text-[11px]">
                    {stages.map((st) => (
                      <li
                        key={st.step}
                        className="flex items-center justify-between gap-2 text-[var(--color-text-muted)]"
                      >
                        <span className="inline-flex items-center gap-1.5 min-w-0 truncate">
                          {st.status === "completed" ? (
                            <CheckCircle2
                              aria-hidden="true"
                              className="h-3 w-3 shrink-0 text-emerald-600"
                            />
                          ) : st.status === "failed" ? (
                            <XCircle
                              aria-hidden="true"
                              className="h-3 w-3 shrink-0 text-rose-600"
                            />
                          ) : st.status === "running" ? (
                            <Loader2
                              aria-hidden="true"
                              className="h-3 w-3 shrink-0 animate-spin text-[var(--color-brand)]"
                            />
                          ) : (
                            <Clock
                              aria-hidden="true"
                              className="h-3 w-3 shrink-0 text-slate-400"
                            />
                          )}
                          <span
                            className={`truncate ${
                              st.status === "running" || st.status === "completed"
                                ? "font-semibold text-[var(--color-ink)]"
                                : ""
                            }`}
                          >
                            {st.step}. {st.label}
                          </span>
                        </span>
                        <span className="shrink-0 text-[10px] uppercase tracking-wide">
                          {st.status}
                        </span>
                      </li>
                    ))}
                  </ol>

                  {processing && (
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={handleCancelProcessing}
                        className="inline-flex items-center gap-1 rounded-[8px] border border-[var(--border)] bg-white px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                      >
                        <XCircle aria-hidden="true" className="h-3.5 w-3.5" />
                        Cancel
                      </button>
                    </div>
                  )}
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
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-0.5 text-xs font-bold text-emerald-700">
                          <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
                          Clean File Ready
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-surface-muted)] border border-[var(--border)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--color-text-muted)]">
                          <Clock aria-hidden="true" className="h-3 w-3" />
                          Processed in {(serverResult.processingTimeMs / 1000).toFixed(2)}s
                        </span>
                      </div>
                      <h2 className="text-xl sm:text-2xl font-bold text-[var(--color-ink)]">
                        {completionHeading}
                      </h2>
                      <p className="text-xs sm:text-sm text-[var(--color-text-muted)]">
                        {isVideoFile
                          ? "Your video has been successfully processed and is ready to download."
                          : "Your image has been successfully processed and is ready to download."}
                      </p>
                    </div>
                  </div>

                  {/* 3 Completion Verification Result Cards */}
                  <div className="space-y-3 text-xs sm:text-sm">
                    {/* 1. C2PA Content Credentials */}
                    <div className="rounded-[14px] border border-[var(--border)] bg-[var(--color-surface-muted)] p-3.5 flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <p className="font-bold text-[var(--color-ink)]">
                          1. C2PA Content Credentials
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {serverResult.c2paResultStatus === "preserved" ? (
                            <>
                              Issuer: <strong>{serverResult.c2pa.issuer || "Signer"}</strong> •
                              Signature: <strong>{serverResult.c2pa.credentialStatus}</strong>.{" "}
                              {serverResult.c2paNotice ||
                                "Provenance credentials were preserved intact."}
                            </>
                          ) : serverResult.c2paResultStatus === "unable_to_preserve" ? (
                            <>
                              Signature: <strong>{serverResult.c2pa.credentialStatus}</strong>.{" "}
                              {serverResult.c2paNotice ||
                                "Unable to verify container signature; original bytes were kept intact."}
                            </>
                          ) : (
                            "No Content Credentials were present in the original file."
                          )}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          serverResult.c2paResultStatus === "preserved"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : serverResult.c2paResultStatus === "unable_to_preserve"
                              ? "bg-amber-50 text-amber-800 border border-amber-200"
                              : "bg-slate-100 text-slate-700 border border-slate-200"
                        }`}
                      >
                        {serverResult.c2paResultStatus === "preserved"
                          ? "Preserved"
                          : serverResult.c2paResultStatus === "unable_to_preserve"
                            ? "Unable to Verify"
                            : "Not Detected"}
                      </span>
                    </div>

                    {/* 2. Personal Metadata */}
                    <div className="rounded-[14px] border border-[var(--border)] bg-[var(--color-surface-muted)] p-3.5 flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <p className="font-bold text-[var(--color-ink)]">
                          2. Personal Metadata
                        </p>
                        {serverResult.removedFields.length > 0 ? (
                          <p className="text-xs text-[var(--color-text-muted)]">
                            Removed: <strong>{serverResult.removedFields.join(", ")}</strong>. Output file generated and verified (
                            {serverResult.afterMetadata.width && serverResult.afterMetadata.height
                              ? `${serverResult.afterMetadata.width}×${serverResult.afterMetadata.height} px preserved`
                              : formatBytes(serverResult.cleanedSizeBytes)}
                            ).
                          </p>
                        ) : serverResult.personalMetadataLabel === "Not Processed" ? (
                          <p className="text-xs text-[var(--color-text-muted)]">
                            Original metadata was preserved to protect C2PA signature integrity or per your selected cleaning options. Output file generated ({formatBytes(serverResult.cleanedSizeBytes)}).
                          </p>
                        ) : (
                          <p className="text-xs text-[var(--color-text-muted)]">
                            No personal EXIF or GPS tags were detected. Output file generated and integrity verified (
                            {serverResult.afterMetadata.width && serverResult.afterMetadata.height
                              ? `${serverResult.afterMetadata.width}×${serverResult.afterMetadata.height} px preserved`
                              : formatBytes(serverResult.cleanedSizeBytes)}
                            ).
                          </p>
                        )}
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          serverResult.personalMetadataLabel === "Cleaned"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : serverResult.personalMetadataLabel === "Already Clean"
                              ? "bg-emerald-50/70 text-emerald-800 border border-emerald-200"
                              : "bg-slate-100 text-slate-700 border border-slate-200"
                        }`}
                      >
                        {serverResult.personalMetadataLabel}
                      </span>
                    </div>

                    {/* 3. SynthID Verification */}
                    <div
                      className={`rounded-[14px] border p-3.5 space-y-1.5 ${
                        serverResult.synthId.status === "verified_no_signal"
                          ? "border-emerald-200 bg-emerald-50/70"
                          : serverResult.synthId.status === "signal_detected"
                            ? "border-rose-200 bg-rose-50/80"
                            : serverResult.synthId.status === "inconclusive"
                              ? "border-amber-200 bg-amber-50/80"
                              : "border-slate-200 bg-slate-100/80"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-bold text-[var(--color-ink)]">
                          3. SynthID Verification
                        </p>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            serverResult.synthId.status === "verified_no_signal"
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                              : serverResult.synthId.status === "signal_detected"
                                ? "bg-rose-100 text-rose-800 border border-rose-200"
                                : serverResult.synthId.status === "inconclusive"
                                  ? "bg-amber-100 text-amber-900 border border-amber-200"
                                  : "bg-white text-slate-700 border border-slate-200"
                          }`}
                        >
                          {serverResult.synthId.label}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                        {serverResult.synthId.explanation}
                      </p>
                      {!serverResult.synthId.available && (
                        <a
                          href="https://support.google.com/gemini/answer/16722517?hl=en"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-brand)] hover:underline"
                        >
                          How to check in Gemini
                          <ExternalLink aria-hidden="true" className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Download Error & Refresh Link Recovery */}
                  {downloadError && (
                    <div
                      role="alert"
                      className="rounded-[12px] border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-900 flex flex-wrap items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2">
                        <AlertTriangle
                          aria-hidden="true"
                          className="h-4 w-4 shrink-0 text-rose-600"
                        />
                        <span>{downloadError}</span>
                      </div>
                      {downloadLinkExpired && (
                        <button
                          type="button"
                          disabled={refreshingLinks}
                          onClick={() => void handleRefreshDownloadLinks()}
                          className="rounded-[8px] bg-rose-700 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-800 disabled:opacity-50"
                        >
                          {refreshingLinks ? "Refreshing…" : "Refresh Download Link"}
                        </button>
                      )}
                    </div>
                  )}

                  {/* 4 Required Completion Buttons */}
                  <div className="flex flex-wrap items-center gap-2.5 pt-1">
                    <a
                      href={serverResult.cleanDownloadUrl}
                      download={serverResult.cleanFileName}
                      onClick={(e) =>
                        void handleVerifiedDownload(
                          e,
                          serverResult.cleanDownloadUrl,
                          serverResult.cleanFileName,
                          "cleaned"
                        )
                      }
                      className="inline-flex items-center gap-2 btn-plum px-5 py-2.5 text-xs sm:text-sm font-semibold"
                    >
                      <Download aria-hidden="true" className="h-4 w-4" />
                      {downloadBusy === "cleaned"
                        ? "Preparing download…"
                        : isVideoFile
                          ? "Download Processed Video"
                          : "Download Processed Image"}
                    </a>
                    <a
                      href={serverResult.originalDownloadUrl}
                      download={serverResult.fileName}
                      onClick={(e) =>
                        void handleVerifiedDownload(
                          e,
                          serverResult.originalDownloadUrl,
                          serverResult.fileName,
                          "original"
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-[12px] border border-[var(--border)] bg-white px-4 py-2.5 text-xs sm:text-sm font-semibold text-[var(--color-ink)] hover:bg-[var(--color-surface-muted)]"
                    >
                      <Download aria-hidden="true" className="h-3.5 w-3.5" />
                      {downloadBusy === "original"
                        ? "Downloading…"
                        : isVideoFile
                          ? "Download Original Video"
                          : "Download Original Image"}
                    </a>
                    <button
                      type="button"
                      onClick={() => setReportOpen((v) => !v)}
                      className="inline-flex items-center gap-1.5 btn-mint px-4 py-2.5 text-xs sm:text-sm font-semibold"
                    >
                      <span>{reportOpen ? "Hide Analysis Report" : "View Analysis Report"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleReset}
                      className="inline-flex items-center gap-1.5 rounded-[12px] border border-[var(--border)] bg-white px-4 py-2.5 text-xs sm:text-sm font-semibold text-[var(--color-ink)] hover:bg-[var(--color-surface-muted)]"
                    >
                      <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
                      {isVideoFile ? "Process Another Video" : "Process Another Image"}
                    </button>
                  </div>

                  {/* Honest Guest vs Registered Persistence Footer */}
                  <div className="rounded-[12px] border border-[var(--border)] bg-white px-3.5 py-2.5 text-[11px] text-[var(--color-text-muted)] flex flex-wrap items-center justify-between gap-2">
                    {serverResult.isAuthenticated && serverResult.recordUrl ? (
                      <>
                        <span>
                          Saved to your workspace history (7-day file retention).
                        </span>
                        <div className="flex items-center gap-3 font-semibold text-[var(--color-brand)]">
                          <Link href={serverResult.recordUrl} className="hover:underline">
                            Open Saved Report
                          </Link>
                          <Link href="/app" className="hover:underline">
                            Dashboard History
                          </Link>
                        </div>
                      </>
                    ) : (
                      <>
                        <span>
                          Guest link expires after 24 hours. Sign up free to save processing history for 7 days and raise upload limits.
                        </span>
                        <Link
                          href="/signup?callbackUrl=/app"
                          className="font-semibold text-[var(--color-brand)] hover:underline"
                        >
                          Save history with free account
                        </Link>
                      </>
                    )}
                  </div>

                  {/* Expanded Analysis Report */}
                  {reportOpen && (
                    <div className="rounded-[14px] border border-[var(--border)] bg-[var(--color-surface-muted)] p-4 text-xs space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-bold text-[var(--color-ink)]">
                          Verified Output &amp; Integrity Report (
                          {formatBytes(serverResult.fileSizeBytes)} →{" "}
                          {formatBytes(serverResult.cleanedSizeBytes)})
                        </p>
                        <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                          {serverResult.dimensionsPreserved
                            ? "Dimensions Preserved"
                            : "Verified"}
                        </span>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-[11px]">
                          <thead>
                            <tr className="border-b border-[var(--border)] text-[var(--color-text-muted)]">
                              <th scope="col" className="py-1.5 pr-3">Field</th>
                              <th scope="col" className="py-1.5 pr-3">Before</th>
                              <th scope="col" className="py-1.5">After</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b border-[var(--border)]">
                              <td className="py-1.5 pr-3 font-semibold">Dimensions</td>
                              <td className="py-1.5 pr-3">
                                {serverResult.beforeMetadata.width &&
                                serverResult.beforeMetadata.height
                                  ? `${serverResult.beforeMetadata.width}×${serverResult.beforeMetadata.height}`
                                  : "N/A"}
                              </td>
                              <td className="py-1.5">
                                {serverResult.afterMetadata.width &&
                                serverResult.afterMetadata.height
                                  ? `${serverResult.afterMetadata.width}×${serverResult.afterMetadata.height}`
                                  : "N/A"}
                              </td>
                            </tr>
                            <tr className="border-b border-[var(--border)]">
                              <td className="py-1.5 pr-3 font-semibold">GPS Location</td>
                              <td className="py-1.5 pr-3">
                                {serverResult.beforeMetadata.hasGps ? "Present" : "None"}
                              </td>
                              <td className="py-1.5">
                                {serverResult.afterMetadata.hasGps ? "Present" : "Removed / None"}
                              </td>
                            </tr>
                            <tr className="border-b border-[var(--border)]">
                              <td className="py-1.5 pr-3 font-semibold">EXIF Segment</td>
                              <td className="py-1.5 pr-3">
                                {serverResult.beforeMetadata.hasExif ? "Present" : "None"}
                              </td>
                              <td className="py-1.5">
                                {serverResult.afterMetadata.hasExif ? "Present" : "Removed / None"}
                              </td>
                            </tr>
                            <tr>
                              <td className="py-1.5 pr-3 font-semibold">Metadata Tags</td>
                              <td className="py-1.5 pr-3">
                                {serverResult.beforeMetadata.rawTagCount}
                              </td>
                              <td className="py-1.5">
                                {serverResult.afterMetadata.rawTagCount}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      <div className="space-y-1">
                        <p className="font-mono text-[11px] break-all text-[var(--color-text-muted)]">
                          Input SHA-256: {serverResult.inputSha256}
                        </p>
                        <p className="font-mono text-[11px] break-all text-[var(--color-text-muted)]">
                          Output SHA-256: {serverResult.outputSha256}
                        </p>
                      </div>

                      {serverResult.stages.length > 0 && (
                        <div className="space-y-1.5 pt-1 border-t border-[var(--border)]">
                          <p className="font-bold text-[var(--color-ink)]">
                            Backend Stage Log ({serverResult.stages.length} steps)
                          </p>
                          <ol className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
                            {serverResult.stages.map((st) => (
                              <li
                                key={st.step}
                                className="rounded-[8px] bg-white border border-[var(--border)] px-2.5 py-1.5 flex items-center justify-between gap-2"
                              >
                                <span className="truncate font-medium text-[var(--color-ink)]">
                                  {st.step}. {st.label}
                                </span>
                                <span className="shrink-0 text-[10px] uppercase text-[var(--color-text-muted)]">
                                  {st.status}
                                </span>
                              </li>
                            ))}
                          </ol>
                        </div>
                      )}
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
                  <div
                    className={`rounded-[14px] border p-3.5 space-y-1.5 text-xs ${
                      sessionInfo.synthIdVerifierConfigured
                        ? "border-emerald-200 bg-emerald-50/50"
                        : "border-slate-200 bg-slate-100/70"
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold text-[var(--color-ink)]">
                        B. SynthID Verification
                      </span>
                      <span
                        className={`font-semibold ${
                          sessionInfo.synthIdVerifierConfigured
                            ? "text-emerald-700"
                            : "text-slate-600"
                        }`}
                      >
                        {sessionInfo.synthIdVerifierConfigured
                          ? "Verifier available on clean"
                          : "Verification unavailable"}
                      </span>
                    </div>
                    <p className="text-[var(--color-text-muted)] leading-relaxed">
                      {sessionInfo.synthIdVerifierConfigured
                        ? "Configured SynthID verification will run automatically during processing without altering pixels or watermarks. Absence of a detected signal does not prove that SynthID is absent."
                        : "No external SynthID verification detector is configured on this server. This tool never strips or circumvents SynthID watermarks."}
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
                          <dt className="text-[11px] text-[var(--color-text-muted)]">
                            File format
                          </dt>
                          <dd className="font-semibold text-[var(--color-ink)]">
                            {previewMeta.formatLabel}
                          </dd>
                        </div>
                        <div className="rounded-[10px] bg-white border border-[var(--border)] p-2">
                          <dt className="text-[11px] text-[var(--color-text-muted)]">
                            Dimensions
                          </dt>
                          <dd className="font-semibold text-[var(--color-ink)]">
                            {displayWidth && displayHeight
                              ? `${displayWidth} × ${displayHeight}`
                              : "Pending"}
                          </dd>
                        </div>
                        {previewMeta.mediaKind === "video" && (
                          <>
                            <div className="rounded-[10px] bg-white border border-[var(--border)] p-2">
                              <dt className="text-[11px] text-[var(--color-text-muted)]">
                                Duration
                              </dt>
                              <dd className="font-semibold text-[var(--color-ink)]">
                                {displayDuration !== undefined
                                  ? `${displayDuration.toFixed(2)}s`
                                  : "Detected on clean"}
                              </dd>
                            </div>
                            {displayCodec && (
                              <div className="rounded-[10px] bg-white border border-[var(--border)] p-2">
                                <dt className="text-[11px] text-[var(--color-text-muted)]">
                                  Video codec
                                </dt>
                                <dd className="font-semibold text-[var(--color-ink)]">
                                  {displayCodec}
                                </dd>
                              </div>
                            )}
                            {displayFps && (
                              <div className="rounded-[10px] bg-white border border-[var(--border)] p-2">
                                <dt className="text-[11px] text-[var(--color-text-muted)]">
                                  Frame rate
                                </dt>
                                <dd className="font-semibold text-[var(--color-ink)]">
                                  {displayFps} fps
                                </dd>
                              </div>
                            )}
                          </>
                        )}
                        <div className="rounded-[10px] bg-white border border-[var(--border)] p-2">
                          <dt className="text-[11px] text-[var(--color-text-muted)]">
                            EXIF / Capture
                          </dt>
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
                      <FileCheck2
                        aria-hidden="true"
                        className="h-4 w-4 text-[var(--color-brand)]"
                      />
                      Privacy Cleaning Options
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(
                        [
                          ["removeGps", "Remove GPS location metadata"],
                          ["removeCameraInfo", "Remove personal camera info"],
                          ["removeExif", "Remove unnecessary EXIF metadata"],
                          [
                            "removePersonalMetadata",
                            "Remove non-essential personal metadata",
                          ],
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

                  {/* Cancellation Notice */}
                  {cancelledMsg && (
                    <div
                      role="status"
                      className="rounded-[12px] border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900 flex flex-wrap items-center justify-between gap-2"
                    >
                      <span>{cancelledMsg}</span>
                    </div>
                  )}

                  {/* Actual Server Processing Error + Retry */}
                  {processError && (
                    <div
                      role="alert"
                      className="rounded-[12px] border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-900 flex flex-wrap items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2">
                        <AlertTriangle
                          aria-hidden="true"
                          className="h-4 w-4 shrink-0 text-rose-600"
                        />
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

                  {/* Primary Action Bar */}
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
                        ? `${activeRunningStage?.label || "Processing"}…`
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
