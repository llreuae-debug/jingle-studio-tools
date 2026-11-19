import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb, schema } from "@/db";
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
  const token = typeof body?.token === "string" ? body.token.trim() : "";

  if (!email || !token) {
    return NextResponse.json(
      { error: "Email and verification token are required." },
      { status: 400 }
    );
  }

  const db = await getDb();
  const identifier = `verify:${email}`;
  const tokens = await db
    .select()
    .from(schema.verificationTokens)
    .where(
      and(
        eq(schema.verificationTokens.identifier, identifier),
        eq(schema.verificationTokens.token, token)
      )
    );

  if (tokens.length === 0 || new Date(tokens[0].expires).getTime() < Date.now()) {
    return NextResponse.json(
      { error: "Verification token is invalid or expired." },
      { status: 400 }
    );
  }

  const users = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email));
  if (users.length === 0) {
    return NextResponse.json({ error: "Account not found." }, { status: 404 });
  }

  await db
    .update(schema.users)
    .set({ emailVerified: new Date() })
    .where(eq(schema.users.id, users[0].id));

  await db
    .delete(schema.verificationTokens)
    .where(eq(schema.verificationTokens.identifier, identifier));

  await recordSystemLog({
    level: "info",
    event: "auth_email_verified",
    userId: users[0].id,
    message: `Email verified for ${email}`,
  });

  return NextResponse.json({ ok: true });
}
