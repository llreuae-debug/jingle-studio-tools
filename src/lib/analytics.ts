"use client";

export type AnalyticsEventName =
  | "tool_opened"
  | "file_uploaded"
  | "processing_completed"
  | "processing_failed"
  | "download_completed"
  | "tool_cta_clicked";

declare global {
  interface Window {
    gtag?: (
      command: "event" | "config" | "js",
      targetOrAction: string | Date,
      params?: Record<string, unknown>
    ) => void;
  }
}

/**
 * Privacy-first event dispatcher. Never logs file names, user PII, or file contents.
 */
export function trackToolEvent(
  eventName: AnalyticsEventName,
  params: Record<string, string | number | boolean> = {}
): void {
  if (typeof window === "undefined") return;
  try {
    if (typeof window.gtag === "function") {
      window.gtag("event", eventName, params);
    }
    window.dispatchEvent(
      new CustomEvent("jinglestudio:analytics", {
        detail: { eventName, params, timestamp: Date.now() },
      })
    );
  } catch {
    // Analytics must never interrupt user workflows
  }
}
