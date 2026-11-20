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
