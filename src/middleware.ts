import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";

export function middleware(req: NextRequest) {
  const isHttps =
    req.nextUrl.protocol === "https:" ||
    req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() === "https";

  const applySecurityHeaders = (res: NextResponse) => {
    res.headers.set("X-Content-Type-Options", "nosniff");
    res.headers.set("X-Frame-Options", "DENY");
    res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    res.headers.set(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()"
    );
    if (isHttps) {
      res.headers.set(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains"
      );
    }
    return res;
  };

  if (req.nextUrl.pathname === "/") {
    const reqHost =
      req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
      req.headers.get("host");
    const proto = isHttps ? "https" : req.nextUrl.protocol.replace(":", "");
    const base = reqHost ? `${proto}://${reqHost}` : req.url;
    const dest = new URL(`/tools${req.nextUrl.search}`, base);
    return applySecurityHeaders(NextResponse.redirect(dest, 307));
  }

  // Rate-limit sign-in and auth POST endpoints by IP
  if (req.method === "POST" && req.nextUrl.pathname.startsWith("/api/auth/")) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    const rl = checkRateLimit(`auth:${ip}`, 20, 60_000);
    if (!rl.allowed) {
      return applySecurityHeaders(
        NextResponse.json(
          { error: "Too many sign-in attempts. Please wait a minute and try again." },
          { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
        )
      );
    }
  }

  return applySecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
