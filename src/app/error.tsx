"use client";

import React, { useEffect } from "react";
import { RefreshCw, RotateCcw } from "lucide-react";
import { Logo } from "@/components/Logo";

function isStaleChunkError(error: Error | null | undefined): boolean {
  const msg = `${error?.name ?? ""} ${error?.message ?? ""}`;
  return /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(
    msg
  );
}

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStaleChunkError(error)) {
      const key = "jingle_chunk_reload_ts";
      const last = Number(sessionStorage.getItem(key) || "0");
      if (Date.now() - last > 15_000) {
        sessionStorage.setItem(key, String(Date.now()));
        window.location.reload();
      }
    }
  }, [error]);

  return (
    <div className="mx-auto max-w-lg glass-surface p-8 text-center space-y-4">
      <Logo variant="stacked" size="md" theme="light" className="mx-auto" />
      <h1 className="text-2xl font-bold text-[var(--color-ink)]">
        Page update detected
      </h1>
      <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
        A new version of Jingle Studio Tools was deployed or a temporary connection issue occurred. Reload to continue with the latest build.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="btn-plum inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold"
        >
          <RefreshCw aria-hidden="true" className="h-3.5 w-3.5" />
          Reload latest version
        </button>
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex items-center gap-1.5 rounded-[12px] border border-[var(--border)] bg-white px-4 py-2.5 text-xs font-semibold text-[var(--color-ink)] hover:bg-[var(--color-surface-muted)]"
        >
          <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
          Try again
        </button>
      </div>
    </div>
  );
}
