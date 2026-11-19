import { NextRequest, NextResponse } from "next/server";
import { createDbSessionForUser, ensureUserAndWorkspace } from "@/lib/auth";
import { logStructured, verifySameOrigin } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const name = typeof body?.name === "string" ? body.name.trim() : undefined;

  if (
    !email ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    !password ||
    password.length < 6
  ) {
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

  const sess = await createDbSessionForUser(user.id);

  logStructured("info", "email_signin_success", {
    userId: user.id,
    provider: "email",
  });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(sess.cookieName, sess.sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: sess.secure,
    maxAge: sess.maxAge,
  });

  return res;
}
