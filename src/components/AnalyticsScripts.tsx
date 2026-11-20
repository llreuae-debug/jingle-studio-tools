"use client";

import React, { useEffect } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { trackToolEvent } from "@/lib/analytics";

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || "";
const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID?.trim() || "";

export function AnalyticsScripts() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname?.startsWith("/tools")) {
      trackToolEvent("tool_opened", { path: pathname });
    }
  }, [pathname]);

  useEffect(() => {
    const maybeReloadOnStaleChunk = (rawMsg: string) => {
      if (
        /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(
          rawMsg
        )
      ) {
        const key = "jingle_chunk_reload_ts";
        const last = Number(sessionStorage.getItem(key) || "0");
        if (Date.now() - last > 15_000) {
          sessionStorage.setItem(key, String(Date.now()));
          window.location.reload();
        }
      }
    };

    const onError = (e: ErrorEvent) => {
      maybeReloadOnStaleChunk(`${e.message || ""} ${e.error?.message || ""}`);
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason;
      const msg =
        reason instanceof Error ? `${reason.name} ${reason.message}` : String(reason || "");
      maybeReloadOnStaleChunk(msg);
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return (
    <>
      {GA_ID && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              window.gtag = gtag;
              gtag('js', new Date());
              gtag('config', '${GA_ID.replace(/[^a-zA-Z0-9_-]/g, "")}', { anonymize_ip: true });
            `}
          </Script>
        </>
      )}
      {CLARITY_ID && (
        <Script id="clarity-init" strategy="afterInteractive">
          {`
            (function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "${CLARITY_ID.replace(/[^a-zA-Z0-9_-]/g, "")}");
          `}
        </Script>
      )}
    </>
  );
}
