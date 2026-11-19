"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  FileCheck2,
  HelpCircle,
  Info,
  Link2,
  ShieldAlert,
  ShieldQuestion,
  Sparkles,
  Upload,
} from "lucide-react";
import {
  inspectBlob,
  type InspectionResult,
  type ParsedManifestNode,
  type VerificationStatusKind,
} from "@/lib/c2pa-inspect";

const SUPPORTED_FORMATS = [
  "JPEG",
  "PNG",
  "WebP",
  "HEIC / HEIF",
  "AVIF",
  "TIFF",
  "DNG",
  "SVG",
  "MP4 / MOV",
  "PDF",
];

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
  const styles: Record<
    VerificationStatusKind,
    { wrap: string; icon: React.ReactNode }
  > = {
    verified: {
      wrap: "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-100",
      icon: (
        <CheckCircle2
          aria-hidden="true"
          className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400"
        />
      ),
    },
    unrecognized: {
      wrap: "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-100",
      icon: (
        <ShieldQuestion
          aria-hidden="true"
          className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400"
        />
      ),
    },
    warning: {
      wrap: "border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-800/60 dark:bg-rose-950/40 dark:text-rose-100",
      icon: (
        <ShieldAlert
          aria-hidden="true"
          className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400"
        />
      ),
    },
    none: {
      wrap: "border-slate-200 bg-slate-100 text-slate-900 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100",
      icon: (
        <HelpCircle
          aria-hidden="true"
          className="h-5 w-5 shrink-0 text-slate-500 dark:text-slate-400"
        />
      ),
    },
  };

  const current = styles[status];

  return (
    <div className={`rounded-xl border p-4 flex items-start gap-3 ${current.wrap}`}>
      {current.icon}
      <div className="min-w-0">
        <p className="font-semibold text-sm">{headline}</p>
        <p className="mt-1 text-xs leading-relaxed opacity-90">{detail}</p>
      </div>
    </div>
  );
}

function SelfDeclaredBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[var(--warm-divider)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--warm-stone)]">
      <Info aria-hidden="true" className="h-3 w-3" />
      Self-declared
    </span>
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
        className={`w-full text-left rounded-[16px] border px-2.5 py-2 flex items-center gap-2.5 transition-colors ${
          isSelected
            ? "border-[var(--color-brand)] bg-[var(--warm-peach)]/65"
            : "border-[var(--border)] bg-white hover:bg-[var(--warm-surface)]"
        }`}
      >
        {node.thumbnailUrl ? (
          <img
            src={node.thumbnailUrl}
            alt=""
            width={36}
            height={36}
            className="h-9 w-9 shrink-0 rounded-[10px] object-cover border border-[var(--border)]"
          />
        ) : (
          <span
            aria-hidden="true"
            className="h-9 w-9 shrink-0 rounded-[10px] bg-[var(--warm-divider)] flex items-center justify-center text-xs font-medium text-[var(--color-text-muted)]"
          >
            File
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="filename text-xs font-medium text-[var(--espresso-black)]">
            <span>{stem}</span>
            {ext}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
            {node.hasCredentials ? (
              <span className="inline-flex items-center gap-1 text-[var(--color-brand)] font-medium">
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

export function VerifyClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sourceParam = searchParams.get("source");

  const fileInputId = useId();
  const urlInputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [urlInput, setUrlInput] = useState(sourceParam || "");
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<InspectionResult | null>(null);
  const [selectedNode, setSelectedNode] = useState<ParsedManifestNode | null>(
    null
  );
  const [announcement, setAnnouncement] = useState("");

  const cleanupRef = useRef<(() => void) | null>(null);

  const runInspection = useCallback(async (blob: Blob, name: string) => {
    setIsLoading(true);
    setErrorMsg(null);
    setAnnouncement(`Inspecting ${name}…`);

    try {
      const next = await inspectBlob(blob, name);
      if (cleanupRef.current) cleanupRef.current();
      cleanupRef.current = next.cleanup;
      setResult(next);
      setSelectedNode(next.rootNode);
      setAnnouncement(`${name}: ${next.statusHeadline}`);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Could not read Content Credentials from this file.";
      setErrorMsg(message);
      setAnnouncement(`Error inspecting ${name}: ${message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (cleanupRef.current) cleanupRef.current();
    };
  }, []);

  const loadFromUrl = useCallback(
    async (assetUrl: string) => {
      setIsLoading(true);
      setErrorMsg(null);
      setAnnouncement("Fetching remote asset…");
      try {
        const res = await fetch(assetUrl, { mode: "cors" });
        if (!res.ok) {
          throw new Error(`Remote server returned HTTP ${res.status}.`);
        }
        const blob = await res.blob();
        const urlObj = new URL(assetUrl);
        const name =
          urlObj.pathname.split("/").filter(Boolean).pop() || "remote-asset";
        await runInspection(blob, name);
      } catch {
        setIsLoading(false);
        const msg =
          "Could not fetch this URL directly from the browser. The host may block cross-origin (CORS) requests or require login. Download the file and drop it here to inspect locally.";
        setErrorMsg(msg);
        setAnnouncement(msg);
      }
    },
    [runInspection]
  );

  useEffect(() => {
    if (sourceParam) {
      setUrlInput(sourceParam);
      void loadFromUrl(sourceParam);
    }
  }, [sourceParam, loadFromUrl]);

  const handleFile = (file?: File | null) => {
    if (!file) return;
    void runInspection(file, file.name);
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    router.push(`/verify?source=${encodeURIComponent(trimmed)}`);
  };

  const resetView = () => {
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }
    setResult(null);
    setSelectedNode(null);
    setErrorMsg(null);
    if (sourceParam) router.push("/verify");
  };

  const activeNode = selectedNode || result?.rootNode || null;

  return (
    <div className="space-y-8">
      <div aria-live="polite" className="visually-hidden">
        {announcement}
      </div>

      <section className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--espresso-black)]">
          Verify Content Credentials
        </h1>
        <p className="text-sm sm:text-base text-[var(--color-text-muted)] max-w-2xl">
          Inspect who signed a file, what tools or AI were declared, and its editing history.
          Local checks run in your browser—files never leave your device.
        </p>
      </section>

      {!result && (
        <section aria-label="Choose a file to inspect" className="space-y-6">
          <div className="glass-surface p-4 sm:p-6">
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
              className={`rounded-[16px] border-2 border-dashed p-8 sm:p-12 text-center transition-colors ${
                isDragging
                  ? "border-[var(--solar-orange)] bg-[var(--warm-peach)]/80"
                  : "border-[var(--solar-orange)]/35 bg-[var(--warm-peach)]/45"
              }`}
            >
              <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-[14px] bg-[var(--color-brand)] text-white shadow-[var(--shadow-3)]">
                <Upload aria-hidden="true" className="h-6 w-6" />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-[var(--espresso-black)]">
                Drop a file here to check its Content Credentials
              </h2>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                Your file stays on your device and is read locally with WebAssembly.
              </p>

              <div className="mt-6">
                <label htmlFor={fileInputId} className="visually-hidden">
                  Choose a file to verify
                </label>
                <input
                  ref={fileInputRef}
                  id={fileInputId}
                  type="file"
                  className="visually-hidden"
                  accept="image/*,video/mp4,video/quicktime,application/pdf"
                  onChange={(e) => handleFile(e.target.files?.[0])}
                />
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 btn-plum px-6 py-2.5 text-sm font-semibold disabled:opacity-60"
                >
                  {isLoading ? "Reading file…" : "Choose a file"}
                </button>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-1.5">
                {SUPPORTED_FORMATS.map((fmt) => (
                  <span
                    key={fmt}
                    className="rounded-full bg-white/80 border border-[var(--border)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-text-muted)]"
                  >
                    {fmt}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <form
            onSubmit={handleUrlSubmit}
            className="glass-surface p-4 sm:p-5 space-y-3"
          >
            <label
              htmlFor={urlInputId}
              className="block text-sm font-medium text-[var(--espresso-black)]"
            >
              Or check a public asset by URL
            </label>
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Link2
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--stone-taupe)]"
                />
                <input
                  id={urlInputId}
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="w-full glass-input pl-9 pr-3 py-2 text-sm focus:border-[var(--solar-orange)] focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading || !urlInput.trim()}
                className="btn-mint px-4 py-2 text-sm font-semibold disabled:opacity-50"
              >
                Check URL
              </button>
            </div>
            <p className="text-xs text-[var(--color-text-muted)]">
              Note: The asset host must allow cross-origin (CORS) requests from the browser.
            </p>
          </form>

          {errorMsg && (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 dark:border-rose-800/60 dark:bg-rose-950/40 p-4 text-sm text-rose-900 dark:text-rose-100 flex items-start gap-3"
            >
              <AlertTriangle aria-hidden="true" className="h-5 w-5 shrink-0 text-rose-600" />
              <p>{errorMsg}</p>
            </div>
          )}
        </section>
      )}

      {result && (
        <section aria-label="Verification result" className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="filename text-base font-semibold text-[var(--espresso-black)]">
                <span>{splitFileName(result.fileName).stem}</span>
                {splitFileName(result.fileName).ext}
              </div>
              <p className="text-xs text-[var(--color-text-muted)]">
                {(result.fileSize / 1024).toFixed(1)} KB • {result.mimeType}
              </p>
            </div>
            <button
              type="button"
              onClick={resetView}
              className="btn-mint px-4 py-2 text-sm font-semibold"
            >
              Check another file
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left panel: preview + status + G5 caveat */}
            <div className="lg:col-span-4 space-y-4">
              <div className="overflow-hidden glass-surface">
                {result.mimeType.startsWith("image/") ? (
                  <img
                    src={result.previewUrl}
                    alt={`Preview of ${result.fileName}`}
                    className="w-full max-h-72 object-contain bg-[var(--warm-surface)]"
                  />
                ) : (
                  <div className="h-44 flex items-center justify-center bg-[var(--warm-surface)] text-sm text-[var(--color-text-muted)]">
                    Preview unavailable for {result.mimeType}
                  </div>
                )}
              </div>

              <StatusBanner
                status={result.status}
                headline={result.statusHeadline}
                detail={result.statusDetail}
              />

              <div className="glass-surface p-4 text-xs text-[var(--color-text-muted)] space-y-2">
                <p className="font-semibold text-[var(--espresso-black)]">
                  What this check cannot prove
                </p>
                <p>
                  Content Credentials record provenance declared at signing time. Missing
                  credentials do not mean a file is &ldquo;real&rdquo;, human-made, or unedited.
                </p>
                <p>
                  Looking for Google SynthID watermarks? SynthID is separate from C2PA and can be
                  checked in the{" "}
                  <a
                    href="https://support.google.com/gemini/answer/16722517?hl=en"
                    target="_blank"
                    rel="noreferrer"
                    className="underline font-semibold text-[var(--color-brand)]"
                  >
                    Gemini app
                  </a>
                  .
                </p>
              </div>
            </div>

            {/* Centre panel: Ingredient tree (S02 / S04) */}
            <div className="lg:col-span-4 glass-surface p-4 space-y-3">
              <h2 className="text-sm font-semibold text-[var(--espresso-black)]">
                History &amp; Ingredients
              </h2>
              {result.rootNode ? (
                <ul role="tree" aria-label="Credential ingredient tree" className="space-y-1.5">
                  <IngredientTreeItem
                    node={result.rootNode}
                    selectedId={activeNode?.id || ""}
                    onSelect={setSelectedNode}
                  />
                </ul>
              ) : (
                <p className="text-xs text-[var(--color-text-muted)]">
                  No manifest history found in this file.
                </p>
              )}
            </div>

            {/* Right panel: Credential details (collapsible <details> for Find-in-Page) */}
            <div className="lg:col-span-4 space-y-3">
              {activeNode && activeNode.hasCredentials ? (
                <>
                  <details
                    open
                    className="glass-surface p-4"
                  >
                    <summary className="cursor-pointer font-semibold text-sm text-[var(--espresso-black)]">
                      Signing info
                    </summary>
                    <dl className="mt-3 space-y-2 text-xs">
                      <div>
                        <dt className="text-[var(--color-text-muted)]">Issued by</dt>
                        <dd className="font-medium text-[var(--espresso-black)]">
                          {activeNode.issuer || "Unknown / Unrecognized"}
                        </dd>
                      </div>
                      {activeNode.signingTimeLocal && (
                        <div>
                          <dt className="text-[var(--color-text-muted)]">
                            Signed (local time)
                          </dt>
                          <dd className="font-medium text-[var(--espresso-black)]">
                            {activeNode.signingTimeLocal}
                          </dd>
                        </div>
                      )}
                      {result.validationErrors.length > 0 && (
                        <div>
                          <dt className="text-rose-700 font-medium">
                            Validation notices
                          </dt>
                          <dd className="mt-1 space-y-1 text-rose-800">
                            {result.validationErrors.map((err, i) => (
                              <div key={i}>• {err}</div>
                            ))}
                          </dd>
                        </div>
                      )}
                    </dl>
                  </details>

                  {activeNode.aiInfo.isAiGeneratedOrModified && (
                    <details
                      open
                      className="rounded-[24px] border border-[var(--color-brand-line)] bg-[var(--warm-peach)]/55 p-4"
                    >
                      <summary className="cursor-pointer font-semibold text-sm text-[var(--espresso-black)] flex items-center gap-2">
                        <Sparkles aria-hidden="true" className="h-4 w-4 text-[var(--color-brand)]" />
                        AI-generated or modified content
                      </summary>
                      <div className="mt-3 space-y-2 text-xs">
                        <SelfDeclaredBadge />
                        {activeNode.aiInfo.digitalSourceTypes.length > 0 && (
                          <p className="text-[var(--espresso-black)]">
                            Type: {activeNode.aiInfo.digitalSourceTypes.join(", ")}
                          </p>
                        )}
                        {activeNode.aiInfo.tools.length > 0 && (
                          <p className="text-[var(--espresso-black)]">
                            Tools / Models: {activeNode.aiInfo.tools.join(", ")}
                          </p>
                        )}
                      </div>
                    </details>
                  )}

                  <details
                    open
                    className="glass-surface p-4"
                  >
                    <summary className="cursor-pointer font-semibold text-sm text-[var(--espresso-black)]">
                      Credit and usage
                    </summary>
                    <div className="mt-3 space-y-2 text-xs">
                      <SelfDeclaredBadge />
                      {activeNode.creditInfo.author ? (
                        <p className="text-[var(--espresso-black)]">
                          Produced by: <span className="font-medium">{activeNode.creditInfo.author}</span>
                        </p>
                      ) : (
                        <p className="text-[var(--color-text-muted)]">
                          No author name declared.
                        </p>
                      )}
                      {activeNode.creditInfo.website && (
                        <p>
                          Website:{" "}
                          <a
                            href={activeNode.creditInfo.website}
                            target="_blank"
                            rel="noreferrer"
                            className="underline font-semibold text-[var(--color-brand)]"
                          >
                            {activeNode.creditInfo.website}
                          </a>
                        </p>
                      )}
                      {activeNode.creditInfo.doNotTrain && (
                        <p className="inline-block rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-900">
                          Do-not-train preference signaled
                        </p>
                      )}
                    </div>
                  </details>

                  <details
                    open
                    className="glass-surface p-4"
                  >
                    <summary className="cursor-pointer font-semibold text-sm text-[var(--espresso-black)]">
                      Process &amp; actions
                    </summary>
                    <div className="mt-3 space-y-2 text-xs">
                      {activeNode.claimGenerator && (
                        <p className="text-[var(--espresso-black)]">
                          App / device: <span className="font-medium">{activeNode.claimGenerator}</span>
                        </p>
                      )}
                      {activeNode.actions.length > 0 ? (
                        <ul className="space-y-1.5 pt-1">
                          {activeNode.actions.map((act, idx) => (
                            <li
                              key={idx}
                              className="rounded-[12px] bg-[var(--warm-surface)] px-2.5 py-1.5"
                            >
                              <div className="font-medium text-[var(--espresso-black)]">
                                {act.action}
                              </div>
                              {(act.softwareAgent || act.digitalSourceType) && (
                                <div className="text-[11px] text-[var(--color-text-muted)]">
                                  {[act.softwareAgent, act.digitalSourceType]
                                    .filter(Boolean)
                                    .join(" • ")}
                                </div>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-[var(--color-text-muted)]">No actions recorded.</p>
                      )}
                    </div>
                  </details>

                  {Object.keys(activeNode.exifDetails).length > 0 && (
                    <details className="glass-surface p-4">
                      <summary className="cursor-pointer font-semibold text-sm text-[var(--espresso-black)]">
                        Camera capture details
                      </summary>
                      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        {Object.entries(activeNode.exifDetails).map(([k, v]) => (
                          <div key={k}>
                            <dt className="text-[var(--color-text-muted)]">{k}</dt>
                            <dd className="font-medium text-[var(--espresso-black)]">{v}</dd>
                          </div>
                        ))}
                      </dl>
                    </details>
                  )}
                </>
              ) : (
                <div className="glass-surface p-4 text-xs text-[var(--color-text-muted)]">
                  {activeNode
                    ? "This source ingredient does not have attached Content Credentials."
                    : "Select an item or drop a credentialed file to inspect details."}
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
