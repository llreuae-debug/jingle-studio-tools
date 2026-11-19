import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
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
  res.cookies.delete("__Secure-authjs.session-token");
  res.cookies.delete("authjs.session-token");
  return res;
}
