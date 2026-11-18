"use client";

import React, { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  FileIcon,
  Info,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import type { InspectionResult, VerificationStatusKind } from "@/lib/c2pa-inspect";
import { buildCredentialsCardModel } from "@/lib/credentials-card-model";

interface CredentialsResultCardProps {
  result: InspectionResult;
  onReset: () => void;
}

const BADGE_STYLES: Record<
  VerificationStatusKind,
  { bg: string; text: string; border: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  verified: {
    bg: "bg-[var(--mint)]",
    text: "text-[var(--plum)]",
    border: "border-[#16865B]/35",
    Icon: ShieldCheck,
  },
  unrecognized: {
    bg: "bg-amber-100/90",
    text: "text-[var(--plum)]",
    border: "border-[#9A5D07]/35",
    Icon: ShieldAlert,
  },
  warning: {
    bg: "bg-rose-100/90",
    text: "text-[#7A1422]",
    border: "border-[#A32032]/35",
    Icon: AlertTriangle,
  },
  none: {
    bg: "bg-white/75",
    text: "text-[var(--plum)]",
    border: "border-[var(--plum)]/20",
    Icon: Info,
  },
};

export function CredentialsResultCard({
  result,
  onReset,
}: CredentialsResultCardProps) {
  const model = useMemo(() => buildCredentialsCardModel(result), [result]);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [ingredientsOpen, setIngredientsOpen] = useState(false);
  const [techOpen, setTechOpen] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [copiedSha, setCopiedSha] = useState(false);
  const reportSectionRef = useRef<HTMLDivElement>(null);

  const badge = BADGE_STYLES[model.status];
  const BadgeIcon = badge.Icon;

  const handleViewFullReport = () => {
    setActionsOpen(true);
    setIngredientsOpen(true);
    setTechOpen(true);
    setTimeout(() => {
      reportSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 40);
  };

  const handleCopySummary = async () => {
    try {
      await navigator.clipboard.writeText(model.copySummaryText);
      setCopiedSummary(true);
      setTimeout(() => setCopiedSummary(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleCopySha = async () => {
    try {
      await navigator.clipboard.writeText(model.technicalDetails.sha256);
      setCopiedSha(true);
      setTimeout(() => setCopiedSha(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const exifEntries = Object.entries(model.technicalDetails.exifDetails);
  const captureEntries = Object.entries(model.technicalDetails.captureDetails);

  return (
    <article
      aria-label="Credentials check result"
      className="glass-surface rounded-[28px] p-5 sm:p-8 text-[var(--plum)] space-y-6 overflow-hidden min-w-0"
    >
      <div aria-live="polite" className="visually-hidden">
        {model.ariaAnnouncement}
      </div>

      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-5 min-w-0">
        <div className="h-20 w-20 sm:h-24 sm:w-24 shrink-0 overflow-hidden rounded-[20px] border border-[var(--plum)]/15 bg-white/75 flex items-center justify-center">
          {model.mimeType.startsWith("image/") ? (
            <img
              src={model.previewUrl}
              alt={`Preview of ${model.fileName}`}
              className="h-full w-full object-cover"
            />
          ) : model.mimeType.startsWith("video/") ? (
            <video
              src={model.previewUrl}
              muted
              playsInline
              className="h-full w-full object-cover bg-black"
            />
          ) : (
            <FileIcon aria-hidden="true" className="h-8 w-8 text-[var(--plum-muted)]" />
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${badge.bg} ${badge.text} ${badge.border}`}
            >
              <BadgeIcon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
              <span>{model.badgeLabel}</span>
            </span>
            <span className="text-xs text-[var(--plum-muted)] break-all">
              {model.mimeType} • {model.fileSizeLabel}
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--plum)] break-words">
            {model.headerTitle}
          </h2>
          <p className="text-sm text-[var(--plum-muted)] leading-relaxed">
            {model.headerSubtitle}
          </p>
          <p className="text-xs font-medium text-[var(--plum-muted)] truncate" title={model.fileName}>
            {model.fileName}
          </p>
        </div>
      </header>

      {/* Validation problem callout */}
      {model.technicalDetails.validationProblems.length > 0 && (
        <div
          role="alert"
          className="rounded-[20px] border border-[#A32032]/30 bg-rose-50/90 p-4 text-xs sm:text-sm text-[#7A1422] space-y-1.5"
        >
          <p className="font-bold flex items-center gap-1.5">
            <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span>Validation problem detected</span>
          </p>
          <ul className="list-disc list-inside space-y-1">
            {model.technicalDetails.validationProblems.map((prob, idx) => (
              <li key={idx}>{prob}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Result Rows */}
      <dl className="divide-y divide-[var(--plum)]/12 border-y border-[var(--plum)]/12">
        {model.rows.map((row, index) => {
          const canExpandActions =
            row.id === "editHistory" &&
            row.expandableActions &&
            row.expandableActions.length > 0;
          const canExpandIngredients =
            row.id === "sourceFiles" &&
            row.expandableIngredients &&
            row.expandableIngredients.length > 0;

          return (
            <div
              key={row.id}
              style={{ animationDelay: `${index * 45}ms` }}
              className="credential-row-stagger py-3.5 sm:py-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1.5 sm:gap-4 min-w-0"
            >
              <dt className="text-xs sm:text-sm font-semibold text-[var(--plum-muted)] sm:w-48 shrink-0">
                {row.label}
              </dt>
              <dd className="min-w-0 flex-1 space-y-1.5 text-sm text-[var(--plum)]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span className="font-semibold break-words">{row.value}</span>
                    {row.unverified && (
                      <span className="rounded-full bg-rose-100 border border-[#A32032]/30 px-2 py-0.5 text-[11px] font-bold text-[#7A1422]">
                        Unverified
                      </span>
                    )}
                  </div>

                  {canExpandActions && (
                    <button
                      type="button"
                      onClick={() => setActionsOpen((v) => !v)}
                      aria-expanded={actionsOpen}
                      className="inline-flex items-center gap-1 rounded-full border border-[var(--plum)]/20 bg-white/70 px-2.5 py-1 text-xs font-semibold text-[var(--plum)] hover:bg-[var(--mint)]/70"
                    >
                      <span>{actionsOpen ? "Hide list" : "Show list"}</span>
                      {actionsOpen ? (
                        <ChevronUp aria-hidden="true" className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}

                  {canExpandIngredients && (
                    <button
                      type="button"
                      onClick={() => setIngredientsOpen((v) => !v)}
                      aria-expanded={ingredientsOpen}
                      className="inline-flex items-center gap-1 rounded-full border border-[var(--plum)]/20 bg-white/70 px-2.5 py-1 text-xs font-semibold text-[var(--plum)] hover:bg-[var(--mint)]/70"
                    >
                      <span>{ingredientsOpen ? "Hide files" : "Show files"}</span>
                      {ingredientsOpen ? (
                        <ChevronUp aria-hidden="true" className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" />
                      )}
                    </button>
                  )}
                </div>

                {row.disclosureDetail && (
                  <p className="text-xs font-medium text-[var(--plum)]">
                    {row.disclosureDetail}
                  </p>
                )}

                {row.helper && (
                  <p className="text-xs text-[var(--plum-muted)]">{row.helper}</p>
                )}

                {row.link && (
                  <a
                    href={row.link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--plum)] underline decoration-[var(--plum)]/40 hover:decoration-[var(--plum)]"
                  >
                    <span>{row.link.label}</span>
                    <ExternalLink aria-hidden="true" className="h-3 w-3" />
                  </a>
                )}

                {canExpandActions && actionsOpen && (
                  <ul className="mt-2 space-y-1.5 rounded-[16px] bg-white/65 border border-[var(--plum)]/10 p-3 text-xs">
                    {row.expandableActions!.map((act, idx) => (
                      <li key={idx} className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-semibold text-[var(--plum)]">{act.label}</span>
                        {act.detail && (
                          <span className="text-[var(--plum-muted)]">{act.detail}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {canExpandIngredients && ingredientsOpen && (
                  <ul className="mt-2 space-y-2 rounded-[16px] bg-white/65 border border-[var(--plum)]/10 p-3 text-xs">
                    {row.expandableIngredients!.map((ing) => (
                      <li key={ing.id} className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 shrink-0 rounded-lg overflow-hidden border border-[var(--plum)]/15 bg-white flex items-center justify-center">
                          {ing.thumbnailUrl ? (
                            <img
                              src={ing.thumbnailUrl}
                              alt={ing.title}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <FileIcon
                              aria-hidden="true"
                              className="h-4 w-4 text-[var(--plum-muted)]"
                            />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-[var(--plum)] truncate">
                            {ing.title}
                          </p>
                          <p className="text-[var(--plum-muted)] break-words">
                            {ing.credentialStatus}
                            {ing.format ? ` • ${ing.format}` : ""}
                            {ing.hasAiHistory ? " • AI-labelled" : ""}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </dd>
            </div>
          );
        })}
      </dl>

      {/* Technical Details */}
      <div ref={reportSectionRef} className="space-y-3">
        <button
          type="button"
          onClick={() => setTechOpen((v) => !v)}
          aria-expanded={techOpen}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--plum)] underline decoration-[var(--plum)]/40"
        >
          <span>Technical details</span>
          {techOpen ? (
            <ChevronUp aria-hidden="true" className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" />
          )}
        </button>

        {techOpen && (
          <div className="rounded-[20px] border border-[var(--plum)]/15 bg-white/65 p-4 space-y-4 text-xs">
            {model.technicalDetails.unverifiedSignerName && (
              <div className="space-y-1">
                <p className="font-semibold text-[var(--plum-muted)]">
                  Certificate signer
                </p>
                <p className="font-semibold text-[var(--plum)] flex flex-wrap items-center gap-2">
                  <span>{model.technicalDetails.unverifiedSignerName}</span>
                  <span className="rounded-full bg-amber-100 border border-[#9A5D07]/30 px-2 py-0.5 text-[11px] font-bold text-[var(--plum)]">
                    Not verified
                  </span>
                </p>
              </div>
            )}

            <div className="space-y-1">
              <p className="font-semibold text-[var(--plum-muted)]">
                File SHA-256 fingerprint
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <code className="rounded-lg bg-[var(--cream)] px-2.5 py-1.5 font-mono text-[11px] text-[var(--plum)] break-all">
                  {model.technicalDetails.sha256}
                </code>
                <button
                  type="button"
                  onClick={handleCopySha}
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--plum)]/20 bg-white px-2.5 py-1 text-[11px] font-semibold text-[var(--plum)] hover:bg-[var(--mint)]"
                >
                  {copiedSha ? (
                    <>
                      <Check aria-hidden="true" className="h-3 w-3" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy aria-hidden="true" className="h-3 w-3" />
                      <span>Copy SHA-256</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {model.technicalDetails.earlierManifests.length > 0 && (
              <div className="space-y-1.5">
                <p className="font-semibold text-[var(--plum-muted)]">
                  Earlier manifests in history
                </p>
                <ul className="space-y-1.5">
                  {model.technicalDetails.earlierManifests.map((m) => (
                    <li
                      key={m.id}
                      className="rounded-xl border border-[var(--plum)]/10 bg-[var(--cream)]/70 p-2.5"
                    >
                      <p className="font-semibold text-[var(--plum)]">{m.title}</p>
                      <p className="text-[var(--plum-muted)]">
                        {[m.issuer, m.claimGenerator, m.signingTimeLocal]
                          .filter(Boolean)
                          .join(" • ") || "Manifest record"}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {exifEntries.length > 0 && (
              <div className="space-y-1">
                <p className="font-semibold text-[var(--plum-muted)]">
                  Camera settings
                </p>
                <dl className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {exifEntries.map(([k, v]) => (
                    <div key={k} className="rounded-lg bg-[var(--cream)]/70 px-2.5 py-1.5">
                      <dt className="text-[11px] text-[var(--plum-muted)]">{k}</dt>
                      <dd className="font-semibold text-[var(--plum)] break-words">{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {captureEntries.length > 0 && (
              <div className="space-y-2 pt-1 border-t border-[var(--plum)]/10">
                <button
                  type="button"
                  onClick={() => setCaptureOpen((v) => !v)}
                  aria-expanded={captureOpen}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--plum)]/25 bg-white px-3 py-1.5 text-xs font-semibold text-[var(--plum)] hover:bg-[var(--mint)]"
                >
                  <span>
                    {captureOpen ? "Hide capture details" : "Show capture details"}
                  </span>
                </button>
                {captureOpen && (
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {captureEntries.map(([k, v]) => (
                      <div key={k} className="rounded-lg bg-[var(--cream)]/70 px-2.5 py-1.5">
                        <dt className="text-[11px] text-[var(--plum-muted)]">{k}</dt>
                        <dd className="font-semibold text-[var(--plum)] break-words">{v}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <footer className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[var(--plum)]/12">
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleViewFullReport}
            className="btn-plum px-5 py-2.5 text-xs sm:text-sm font-semibold"
          >
            View full report
          </button>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--plum)]/25 bg-white/80 px-4 py-2.5 text-xs sm:text-sm font-semibold text-[var(--plum)] hover:bg-[var(--mint)]"
          >
            <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
            <span>Check another file</span>
          </button>
          <button
            type="button"
            onClick={handleCopySummary}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--plum)]/25 bg-white/80 px-4 py-2.5 text-xs sm:text-sm font-semibold text-[var(--plum)] hover:bg-[var(--mint)]"
          >
            {copiedSummary ? (
              <>
                <Check aria-hidden="true" className="h-3.5 w-3.5" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy aria-hidden="true" className="h-3.5 w-3.5" />
                <span>Copy summary</span>
              </>
            )}
          </button>
        </div>

        <Link
          href="/tools/ai-disclosure-signer"
          className="inline-flex items-center rounded-full bg-[var(--lime)] px-4 py-2.5 text-xs sm:text-sm font-bold text-[var(--plum)] hover:opacity-90"
        >
          Sign your own work
        </Link>
      </footer>
    </article>
  );
}
