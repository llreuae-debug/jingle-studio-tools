import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { ensureUserAndWorkspace } from "@/lib/auth";
import { logStructured, verifySameOrigin } from "@/lib/security";

export async function POST(req: NextRequest) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const name = typeof body?.name === "string" ? body.name : undefined;

  if (!email || !password || password.length < 6) {
    return NextResponse.json(
      { error: "Valid email and password (min 6 characters) required." },
      { status: 400 }
    );
  }

  const user = await ensureUserAndWorkspace({ email, name, password });
  if (!user) {
    return NextResponse.json(
      { error: "Invalid credentials or account unavailable." },
      { status: 401 }
    );
  }

  const sessionToken = crypto.randomUUID();
  const maxAge = 30 * 24 * 60 * 60;
  const expires = new Date(Date.now() + maxAge * 1000);
  const db = await getDb();

  await db.insert(schema.sessions).values({
    sessionToken,
    userId: user.id,
    expires,
  });

  logStructured("info", "email_signin_success", {
    userId: user.id,
    provider: "email",
  });

  const isProd = process.env.NODE_ENV === "production";
  const cookieName = isProd
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";

  const res = NextResponse.json({ ok: true });
  res.cookies.set(cookieName, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: isProd,
    maxAge,
  });

  return res;
}
