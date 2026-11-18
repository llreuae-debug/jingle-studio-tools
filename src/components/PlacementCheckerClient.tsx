"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileCheck2,
  HelpCircle,
  Info,
  ShieldAlert,
  ShieldQuestion,
  Sparkles,
  Upload,
} from "lucide-react";
import { CredentialsResultCard } from "@/components/CredentialsResultCard";
import { useLanguage } from "@/components/LanguageProvider";
import { PLACEMENT_SPECS, type PlacementId } from "@/config/platforms";
import {
  inspectBlob,
  type InspectionResult,
  type ParsedManifestNode,
  type VerificationStatusKind,
} from "@/lib/c2pa-inspect";

interface MediaMetrics {
  width?: number;
  height?: number;
  aspectRatio?: number;
  durationSec?: number;
}

async function measureMediaLocally(file: File): Promise<MediaMetrics> {
  if (file.type.startsWith("image/")) {
    return await new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        URL.revokeObjectURL(url);
        resolve({ width: w, height: h, aspectRatio: h > 0 ? w / h : undefined });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({});
      };
      img.src = url;
    });
  }

  if (file.type.startsWith("video/")) {
    return await new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        const w = video.videoWidth;
        const h = video.videoHeight;
        const durationSec = Number.isFinite(video.duration) ? video.duration : undefined;
        URL.revokeObjectURL(url);
        resolve({
          width: w,
          height: h,
          aspectRatio: h > 0 ? w / h : undefined,
          durationSec,
        });
      };
      video.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({});
      };
      video.src = url;
    });
  }

  return {};
}

function splitFileName(name: string): { stem: string; ext: string } {
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return { stem: name, ext: "" };
  return { stem: name.slice(0, dot), ext: name.slice(dot) };
}

function StatusBanner({
  status,
  headline,
  detail,
}: {
  status: VerificationStatusKind;
  headline: string;
  detail: string;
}) {
  const styles: Record<VerificationStatusKind, { wrap: string; icon: React.ReactNode }> = {
    verified: {
      wrap: "border-[rgba(63,17,61,0.18)] bg-[var(--mint)] text-[var(--plum)]",
      icon: <CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0 text-[var(--plum)]" />,
    },
    unrecognized: {
      wrap: "border-[rgba(63,17,61,0.18)] bg-[var(--lime)]/70 text-[var(--plum)]",
      icon: <ShieldQuestion aria-hidden="true" className="h-5 w-5 shrink-0 text-[var(--plum)]" />,
    },
    warning: {
      wrap: "border-[#a32032]/35 bg-rose-100/90 text-[var(--plum)]",
      icon: <ShieldAlert aria-hidden="true" className="h-5 w-5 shrink-0 text-[#a32032]" />,
    },
    none: {
      wrap: "border-[var(--glass-border)] bg-[var(--glass-fill)] text-[var(--plum)]",
      icon: <HelpCircle aria-hidden="true" className="h-5 w-5 shrink-0 text-[var(--plum-muted)]" />,
    },
  };

  const current = styles[status];

  return (
    <div className={`rounded-[20px] border p-4 flex items-start gap-3 ${current.wrap}`}>
      {current.icon}
      <div className="min-w-0">
        <p className="font-semibold text-sm">{headline}</p>
        <p className="mt-1 text-xs leading-relaxed opacity-90">{detail}</p>
      </div>
    </div>
  );
}

function IngredientTreeItem({
  node,
  selectedId,
  onSelect,
  depth = 0,
}: {
  node: ParsedManifestNode;
  selectedId: string;
  onSelect: (node: ParsedManifestNode) => void;
  depth?: number;
}) {
  const isSelected = node.id === selectedId;
  const { stem, ext } = splitFileName(node.title);

  return (
    <li role="treeitem" aria-selected={isSelected} className="space-y-1.5">
      <button
        type="button"
        onClick={() => onSelect(node)}
        style={{ paddingInlineStart: `${depth * 14 + 10}px` }}
        className={`w-full text-left rounded-lg border px-2.5 py-2 flex items-center gap-2.5 transition-colors ${
          isSelected
            ? "border-[var(--color-blue)] bg-blue-50/70"
            : "border-[var(--color-border)] bg-white hover:bg-slate-50"
        }`}
      >
        {node.thumbnailUrl ? (
          <img
            src={node.thumbnailUrl}
            alt=""
            width={36}
            height={36}
            className="h-9 w-9 shrink-0 rounded object-cover border border-[var(--color-border)]"
          />
        ) : (
          <span
            aria-hidden="true"
            className="h-9 w-9 shrink-0 rounded bg-slate-100 flex items-center justify-center text-xs font-medium text-[var(--color-muted)]"
          >
            File
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="filename text-xs font-medium text-[var(--color-ink)]">
            <span>{stem}</span>
            {ext}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[var(--color-muted)]">
            {node.hasCredentials ? (
              <span className="inline-flex items-center gap-1 text-[var(--color-blue)] font-medium">
                <FileCheck2 aria-hidden="true" className="h-3 w-3" />
                Credentials
              </span>
            ) : (
              <span>No credentials</span>
            )}
            {node.relationship && <span>• {node.relationship}</span>}
          </div>
        </div>
      </button>

      {node.ingredients.length > 0 && (
        <ul role="group" className="space-y-1.5">
          {node.ingredients.map((child) => (
            <IngredientTreeItem
              key={child.id}
              node={child}
              selectedId={selectedId}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function PlacementCheckerClient({ placementId }: { placementId: PlacementId }) {
  const spec = PLACEMENT_SPECS[placementId];
  const { locale, t } = useLanguage();

  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [stage, setStage] = useState<"idle" | "reading" | "checking">("idle");
  const isLoading = stage !== "idle";
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<InspectionResult | null>(null);
  const [metrics, setMetrics] = useState<MediaMetrics>({});
  const [copied, setCopied] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    return () => {
      if (cleanupRef.current) cleanupRef.current();
    };
  }, []);

  const handleFile = useCallback(
    async (file?: File | null) => {
      if (!file) return;
      setStage("reading");
      setErrorMsg(null);
      setAnnouncement(`Reading ${file.name}`);

      try {
        const [inspection, measured] = await Promise.all([
          inspectBlob(file, file.name, (s) => {
            setStage(s);
            if (s === "checking") {
              setAnnouncement(`Checking credentials for ${file.name}`);
            }
          }),
          measureMediaLocally(file),
        ]);
        if (cleanupRef.current) cleanupRef.current();
        cleanupRef.current = inspection.cleanup;
        setResult(inspection);
        setMetrics(measured);
        setAnnouncement(`${file.name}: ${inspection.statusHeadline}`);
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : "Unsupported or unreadable file. Please choose a supported media file.";
        setErrorMsg(msg);
        setAnnouncement(msg);
      } finally {
        setStage("idle");
      }
    },
    []
  );

  const resetView = () => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    setResult(null);
    setMetrics({});
    setErrorMsg(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText(spec.recommendedCaption[locale]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const activeNode = result?.rootNode || null;

  // Format fit checks
  const sizeMb = result ? result.fileSize / (1024 * 1024) : 0;
  const sizeOk = result ? sizeMb <= spec.maxFileSizeMb : true;
  const typeOk = result
    ? spec.acceptedMimePrefixes.some((p) => result.mimeType.startsWith(p))
    : true;
  const aspectOk =
    spec.aspectRatioRange && metrics.aspectRatio
      ? metrics.aspectRatio >= spec.aspectRatioRange.min &&
        metrics.aspectRatio <= spec.aspectRatioRange.max
      : true;
  const durationOk =
    spec.maxDurationSec && metrics.durationSec
      ? metrics.durationSec <= spec.maxDurationSec
      : true;

  return (
    <div className="space-y-8">
      <div aria-live="polite" className="visually-hidden">
        {announcement}
      </div>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--plum-muted)]">
          <span className="rounded-full bg-[var(--plum)] px-3 py-0.5 font-semibold text-[var(--lime)]">
            {spec.platformName}
          </span>
          <span>
            {t.check.lastChecked}: {spec.lastChecked}
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--plum)]">
          {spec.title[locale]}
        </h1>
        <p className="text-sm sm:text-base text-[var(--plum-muted)] max-w-2xl">
          {spec.subtitle[locale]}
        </p>
      </section>

      {!result && (
        <section aria-label="File upload" className="space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              handleFile(e.dataTransfer.files?.[0]);
            }}
            className={`glass-surface p-8 sm:p-12 text-center transition-colors ${
              isDragging ? "ring-2 ring-[var(--plum)] bg-[var(--mint)]/70" : ""
            }`}
          >
            <Upload aria-hidden="true" className="mx-auto h-10 w-10 text-[var(--plum)]" />
            <h2 className="mt-4 text-lg font-semibold text-[var(--plum)]">
              {t.check.dropTitle}
            </h2>
            <p className="mt-1 text-sm text-[var(--plum-muted)]">{t.check.dropSubtitle}</p>

            <div className="mt-6">
              <label htmlFor={fileInputId} className="visually-hidden">
                {t.check.chooseFile}
              </label>
              <input
                ref={fileInputRef}
                id={fileInputId}
                type="file"
                className="visually-hidden"
                accept={spec.acceptedExtensions.join(",")}
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              <button
                type="button"
                disabled={isLoading}
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 btn-plum px-6 py-2.5 text-sm font-semibold disabled:opacity-60"
              >
                {stage === "reading"
                  ? "Reading file…"
                  : stage === "checking"
                    ? "Checking credentials…"
                    : t.check.chooseFile}
              </button>
            </div>

            <p className="mt-5 text-xs text-[var(--plum-muted)]">
              Supported: {spec.recommendedFormatsLabel}
            </p>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="rounded-xl border border-[#C83C4D]/30 bg-rose-50 p-4 text-sm text-rose-950 flex items-start gap-3"
            >
              <AlertTriangle aria-hidden="true" className="h-5 w-5 shrink-0 text-[#C83C4D]" />
              <p>{errorMsg}</p>
            </div>
          )}
        </section>
      )}

      {result && (
        <section aria-label="Inspection result" className="space-y-6">
          <CredentialsResultCard result={result} onReset={resetView} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {/* Format fit */}
            <div className="glass-surface rounded-[28px] p-5 space-y-2.5 text-xs">
              <h2 className="font-semibold text-sm text-[var(--plum)]">
                {t.check.formatFit}
              </h2>
              <ul className="space-y-1.5">
                <li className="flex items-center justify-between">
                  <span>File type ({result.mimeType})</span>
                  <span className={typeOk ? "text-[#16865B] font-medium" : "text-[#9A5D07] font-medium"}>
                    {typeOk ? "Fit" : "Check format"}
                  </span>
                </li>
                <li className="flex items-center justify-between">
                  <span>Size ({sizeMb.toFixed(2)} / {spec.maxFileSizeMb} MB)</span>
                  <span className={sizeOk ? "text-[#16865B] font-medium" : "text-[#A32032] font-medium"}>
                    {sizeOk ? "Fit" : "Too large"}
                  </span>
                </li>
                {spec.aspectRatioRange && metrics.aspectRatio && (
                  <li className="flex items-center justify-between">
                    <span>Aspect ({metrics.aspectRatio.toFixed(2)})</span>
                    <span className={aspectOk ? "text-[#16865B] font-medium" : "text-[#9A5D07] font-medium"}>
                      {aspectOk ? "Fit" : `Target ${spec.aspectRatioRange.label}`}
                    </span>
                  </li>
                )}
                {spec.maxDurationSec && metrics.durationSec !== undefined && (
                  <li className="flex items-center justify-between">
                    <span>Duration ({metrics.durationSec.toFixed(1)}s / {spec.maxDurationSec}s)</span>
                    <span className={durationOk ? "text-[#16865B] font-medium" : "text-[#A32032] font-medium"}>
                      {durationOk ? "Fit" : "Too long"}
                    </span>
                  </li>
                )}
              </ul>
            </div>

            {/* Recommended honest caption */}
            <div className="glass-surface rounded-[28px] p-5 space-y-2.5">
              <h2 className="font-semibold text-sm text-[var(--plum)]">
                {t.check.captionTitle}
              </h2>
              <p className="rounded-[16px] bg-white/75 p-3 text-xs text-[var(--plum)]">
                {spec.recommendedCaption[locale]}
              </p>
              <button
                type="button"
                onClick={copyCaption}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--plum)]/20 bg-white/80 px-3.5 py-1.5 text-xs font-semibold text-[var(--plum)] hover:bg-[var(--mint)]"
              >
                {copied ? (
                  <>
                    <Check aria-hidden="true" className="h-3.5 w-3.5 text-[#16865B]" />
                    {t.check.copied}
                  </>
                ) : (
                  <>
                    <Copy aria-hidden="true" className="h-3.5 w-3.5" />
                    {t.check.copyCaption}
                  </>
                )}
              </button>
            </div>

            {/* Platform AI label steps */}
            <details open className="glass-surface rounded-[28px] p-5">
              <summary className="cursor-pointer font-semibold text-sm text-[var(--plum)]">
                {t.check.platformStepsTitle}
              </summary>
              <ol className="mt-3 space-y-1.5 text-xs text-[var(--plum-muted)] list-decimal list-inside">
                {spec.platformSteps[locale].map((step, i) => (
                  <li key={i}>{step}</li>
                ))}
              </ol>
            </details>

            {/* Labelled by mistake? */}
            <details open className="glass-surface rounded-[28px] p-5">
              <summary className="cursor-pointer font-semibold text-sm text-[var(--plum)] flex items-center gap-2">
                <Info aria-hidden="true" className="h-4 w-4 text-[var(--plum)]" />
                {t.check.labelledByMistakeTitle}
              </summary>
              <div className="mt-3 space-y-2.5 text-xs text-[var(--plum-muted)]">
                <p>{t.check.labelledByMistakeIntro}</p>
                {activeNode?.aiInfo.isAiGeneratedOrModified ? (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-2.5 text-amber-950">
                    Declared signals:{" "}
                    {activeNode.aiInfo.digitalSourceTypes.join(", ") || "c2pa.ai-disclosure"}
                  </div>
                ) : (
                  <p>{t.check.noSignalsFound}</p>
                )}
                <a
                  href={spec.officialHelpUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 font-semibold text-[var(--plum)] underline"
                >
                  {spec.officialHelpLabel[locale]}
                  <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                </a>
              </div>
            </details>
          </div>
        </section>
      )}
    </div>
  );
}
