export type SynthIdVerificationStatus =
  | "verified_no_signal"
  | "signal_detected"
  | "verification_unavailable"
  | "inconclusive";

export interface SynthIdSummary {
  status: SynthIdVerificationStatus;
  label: string;
  available: boolean;
  provider: string | null;
  confidence: number | null;
  checkedAt: string;
  explanation: string;
  originalSignalModified: false;
}

const UNAVAILABLE_EXPLANATION =
  "No external SynthID verification detector is configured on this server. SynthID is a separate imperceptible watermark checked with official Google tools; absence of verification does not prove how the file was made.";

function parseVerifierUrl(): string | null {
  const raw = process.env.SYNTHID_VERIFIER_URL?.trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

export function isSynthIdVerifierConfigured(): boolean {
  return parseVerifierUrl() !== null;
}

function makeAbortError(reason?: unknown): Error {
  if (reason instanceof Error) return reason;
  const err = new Error("Verification aborted by user.");
  err.name = "AbortError";
  return err;
}

/**
 * Verifies a media buffer against an externally configured SynthID detector
 * (`SYNTHID_VERIFIER_URL`) when available. Never modifies pixels or watermarks
 * and never fabricates a "no signal" verdict on unavailable or failed checks.
 */
export async function verifySynthId(params: {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  sha256: string;
  signal?: AbortSignal;
}): Promise<SynthIdSummary> {
  if (params.signal?.aborted) {
    throw makeAbortError(params.signal.reason);
  }

  const endpointUrl = parseVerifierUrl();
  const checkedAt = new Date().toISOString();

  if (!endpointUrl) {
    return {
      status: "verification_unavailable",
      label: "Verification Unavailable",
      available: false,
      provider: null,
      confidence: null,
      checkedAt,
      explanation: UNAVAILABLE_EXPLANATION,
      originalSignalModified: false,
    };
  }

  const defaultProvider =
    process.env.SYNTHID_VERIFIER_PROVIDER?.trim() || new URL(endpointUrl).hostname;
  const apiKey = process.env.SYNTHID_VERIFIER_API_KEY?.trim();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(new Error("SynthID detector timed out.")), 15_000);
  const onParentAbort = () => controller.abort(makeAbortError(params.signal?.reason));

  if (params.signal) {
    params.signal.addEventListener("abort", onParentAbort, { once: true });
  }

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const res = await fetch(endpointUrl, {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        fileName: params.fileName,
        mimeType: params.mimeType,
        sha256: params.sha256,
        contentBase64: params.buffer.toString("base64"),
      }),
    });

    if (!res.ok) {
      return {
        status: "verification_unavailable",
        label: "Verification Unavailable",
        available: false,
        provider: defaultProvider,
        confidence: null,
        checkedAt: new Date().toISOString(),
        explanation: `${defaultProvider} returned HTTP ${res.status}. SynthID verification could not be completed; absence of verification does not prove how the file was made.`,
        originalSignalModified: false,
      };
    }

    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!data || typeof data.verdict !== "string") {
      return {
        status: "verification_unavailable",
        label: "Verification Unavailable",
        available: false,
        provider: defaultProvider,
        confidence: null,
        checkedAt: new Date().toISOString(),
        explanation: `${defaultProvider} returned an unreadable response. SynthID verification is unavailable.`,
        originalSignalModified: false,
      };
    }

    const provider =
      typeof data.provider === "string" && data.provider.trim()
        ? data.provider.trim()
        : defaultProvider;
    const confidence =
      typeof data.confidence === "number" && Number.isFinite(data.confidence)
        ? data.confidence
        : null;
    const detail =
      typeof data.detail === "string" && data.detail.trim() ? data.detail.trim() : null;

    if (data.verdict === "no_detectable_signal") {
      return {
        status: "verified_no_signal",
        label: "Verified No Detectable SynthID Signal",
        available: true,
        provider,
        confidence,
        checkedAt: new Date().toISOString(),
        explanation: `${provider} reported no detectable SynthID signal. Absence of a detected signal does not prove that SynthID is absent. Original pixels were not altered to remove watermarks.`,
        originalSignalModified: false,
      };
    }

    if (data.verdict === "signal_detected") {
      const confidenceText =
        confidence !== null ? ` (confidence ${(confidence * 100).toFixed(0)}%)` : "";
      return {
        status: "signal_detected",
        label: "Signal Detected",
        available: true,
        provider,
        confidence,
        checkedAt: new Date().toISOString(),
        explanation:
          detail ||
          `${provider} detected a SynthID watermark signal${confidenceText}. Original signal was preserved untouched.`,
        originalSignalModified: false,
      };
    }

    if (data.verdict === "inconclusive") {
      return {
        status: "inconclusive",
        label: "Inconclusive",
        available: true,
        provider,
        confidence,
        checkedAt: new Date().toISOString(),
        explanation:
          detail || `${provider} returned an inconclusive SynthID result.`,
        originalSignalModified: false,
      };
    }

    return {
      status: "verification_unavailable",
      label: "Verification Unavailable",
      available: false,
      provider,
      confidence: null,
      checkedAt: new Date().toISOString(),
      explanation: `${provider} returned an unrecognized SynthID verdict (${data.verdict}).`,
      originalSignalModified: false,
    };
  } catch (err) {
    if (params.signal?.aborted) {
      throw makeAbortError(params.signal.reason || err);
    }
    return {
      status: "verification_unavailable",
      label: "Verification Unavailable",
      available: false,
      provider: defaultProvider,
      confidence: null,
      checkedAt: new Date().toISOString(),
      explanation: `Could not reach configured SynthID detector (${defaultProvider}). Absence of verification does not prove how the file was made.`,
      originalSignalModified: false,
    };
  } finally {
    clearTimeout(timeoutId);
    if (params.signal) {
      params.signal.removeEventListener("abort", onParentAbort);
    }
  }
}
