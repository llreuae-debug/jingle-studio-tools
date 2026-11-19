import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { verifySameOrigin } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const tokens = [
    req.cookies.get("__Secure-authjs.session-token")?.value,
    req.cookies.get("authjs.session-token")?.value,
  ].filter((t): t is string => Boolean(t));

  if (tokens.length > 0) {
    const db = await getDb();
    for (const token of tokens) {
      await db
        .delete(schema.sessions)
        .where(eq(schema.sessions.sessionToken, token));
    }
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("__Secure-authjs.session-token", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: true,
    maxAge: 0,
  });
  res.cookies.set("authjs.session-token", "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: false,
    maxAge: 0,
  });
  return res;
}
