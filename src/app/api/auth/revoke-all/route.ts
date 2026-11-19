import { NextRequest, NextResponse } from "next/server";
import { getSessionContext, revokeAllUserSessions } from "@/lib/auth";
import { verifySameOrigin } from "@/lib/security";

export async function POST(req: NextRequest) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const ctx = await getSessionContext();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await revokeAllUserSessions(ctx.user.id);
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
