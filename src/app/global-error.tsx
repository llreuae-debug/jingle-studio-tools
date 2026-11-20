"use client";

import React, { useEffect } from "react";

function isStaleChunkError(error: Error | null | undefined): boolean {
  const msg = `${error?.name ?? ""} ${error?.message ?? ""}`;
  return /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(
    msg
  );
}

export default function GlobalError({
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
    <html lang="en">
      <body className="min-h-screen flex items-center justify-center bg-white p-6 text-[#111111] antialiased">
        <div className="mx-auto max-w-md rounded-2xl border border-[#e7e7ec] bg-white p-8 text-center shadow-lg space-y-4">
          <h1 className="text-xl font-bold text-[#111111]">
            Reloading Jingle Studio Tools
          </h1>
          <p className="text-xs text-[#55555d] leading-relaxed">
            A new release was just published. Click below to load the latest version cleanly.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-xl bg-[#6c47ff] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#5835e6]"
            >
              Reload Page
            </button>
            <button
              type="button"
              onClick={() => reset()}
              className="rounded-xl border border-[#e7e7ec] bg-white px-4 py-2.5 text-xs font-semibold text-[#111111]"
            >
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
