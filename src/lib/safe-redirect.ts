export function sanitizeReturnPath(raw: string | null | undefined, fallback = "/app"): string {
  if (!raw || typeof raw !== "string") return fallback;

  let decoded = raw.trim();
  try {
    decoded = decodeURIComponent(decoded).trim();
  } catch {
    return fallback;
  }

  // Must start with a single '/' and never '//', '/\' or contain protocol/control chars
  if (!decoded.startsWith("/")) return fallback;
  if (decoded.startsWith("//") || decoded.startsWith("/\\")) return fallback;
  if (/[\r\n\t\0]/.test(decoded)) return fallback;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/i.test(decoded)) return fallback;

  // Re-check raw input against encoded slash/backslash bypasses
  const lowerRaw = raw.trim().toLowerCase();
  if (lowerRaw.startsWith("//") || lowerRaw.startsWith("/%2f") || lowerRaw.startsWith("/%5c")) {
    return fallback;
  }

  return decoded;
}
