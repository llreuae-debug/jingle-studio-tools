import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { createDbSessionForUser, ensureUserAndWorkspace } from "@/lib/auth";
import { verifySameOrigin } from "@/lib/security";
import { recordSystemLog } from "@/lib/system-logs";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const email =
    typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 }
    );
  }

  if (!password || password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters." },
      { status: 400 }
    );
  }

  const db = await getDb();
  const existing = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, email));

  if (existing.length > 0) {
    return NextResponse.json(
      { error: "An account with this email already exists. Please log in instead." },
      { status: 409 }
    );
  }

  const user = await ensureUserAndWorkspace({
    email,
    name: name || email.split("@")[0],
    password,
  });

  if (!user) {
    return NextResponse.json(
      { error: "Could not create account." },
      { status: 400 }
    );
  }

  // Issue email verification token (1h TTL)
  const token = crypto.randomBytes(24).toString("hex");
  await db.insert(schema.verificationTokens).values({
    identifier: `verify:${email}`,
    token,
    expires: new Date(Date.now() + 60 * 60 * 1000),
  });

  const sess = await createDbSessionForUser(user.id);
  await recordSystemLog({
    level: "info",
    event: "auth_signup",
    userId: user.id,
    message: `New user signed up: ${email}`,
  });

  const allowPreview =
    process.env.NODE_ENV !== "production" ||
    process.env.ALLOW_LOCAL_TOKEN_PREVIEW === "true";

  const payload: Record<string, unknown> = {
    ok: true,
    userId: user.id,
    requiresVerification: true,
  };
  if (allowPreview) {
    payload.devVerifyUrl = `/verify-email?email=${encodeURIComponent(
      email
    )}&token=${encodeURIComponent(token)}`;
  }

  const res = NextResponse.json(payload);
  res.cookies.set(sess.cookieName, sess.sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: sess.secure,
    maxAge: sess.maxAge,
  });
  return res;
}
