import type { NextRequest } from "next/server";

export function detectRealMimeType(buf: Buffer): string | null {
  if (buf.length < 12) return null;

  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  ) {
    return "image/png";
  }

  // WebP: RIFF....WEBP
  if (
    buf.subarray(0, 4).toString("ascii") === "RIFF" &&
    buf.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }

  // PDF: %PDF
  if (buf.subarray(0, 4).toString("ascii") === "%PDF") {
    return "application/pdf";
  }

  // MP4 / MOV: ftyp at offset 4
  if (buf.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = buf.subarray(8, 12).toString("ascii");
    if (brand === "qt  ") return "video/quicktime";
    return "video/mp4";
  }

  // WebM / Matroska: EBML header 1A 45 DF A3
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
    return "video/webm";
  }

  return null;
}

export function verifySameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // non-browser / curl / server-to-server without Origin
  const forwardedHost = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = req.headers.get("host")?.trim();
  if (!forwardedHost && !host) return false;
  try {
    const originHost = new URL(origin).host;
    return originHost === host || (Boolean(forwardedHost) && originHost === forwardedHost);
  } catch {
    return false;
  }
}

export function logStructured(
  level: "info" | "warn" | "error",
  event: string,
  meta: Record<string, unknown> = {}
) {
  // Never log secrets or private keys
  const safeMeta = { ...meta };
  for (const k of Object.keys(safeMeta)) {
    if (k.toLowerCase().includes("key") || k.toLowerCase().includes("secret") || k.toLowerCase().includes("pem")) {
      safeMeta[k] = "[REDACTED]";
    }
  }
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...safeMeta,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
