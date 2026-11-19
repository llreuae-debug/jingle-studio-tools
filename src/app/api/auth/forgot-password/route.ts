import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { checkRateLimit } from "@/lib/rate-limit";
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

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 }
    );
  }

  const rl = checkRateLimit(`forgot:${email}`, 10, 10 * 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many reset requests. Please try again later." },
      { status: 429 }
    );
  }

  const db = await getDb();
  const users = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email));

  let devResetUrl: string | undefined;
  if (users.length > 0 && !users[0].disabled) {
    const token = crypto.randomBytes(24).toString("hex");
    await db
      .delete(schema.verificationTokens)
      .where(eq(schema.verificationTokens.identifier, `reset:${email}`));

    await db.insert(schema.verificationTokens).values({
      identifier: `reset:${email}`,
      token,
      expires: new Date(Date.now() + 60 * 60 * 1000),
    });

    await recordSystemLog({
      level: "info",
      event: "auth_forgot_password",
      userId: users[0].id,
      message: `Password reset requested for ${email}`,
    });

    const allowPreview =
      process.env.NODE_ENV !== "production" ||
      process.env.ALLOW_LOCAL_TOKEN_PREVIEW === "true";
    if (allowPreview) {
      devResetUrl = `/reset-password?email=${encodeURIComponent(
        email
      )}&token=${encodeURIComponent(token)}`;
    }
  }

  return NextResponse.json({
    ok: true,
    message:
      "If an account exists for that email, a password reset link has been prepared.",
    ...(devResetUrl ? { devResetUrl } : {}),
  });
}
