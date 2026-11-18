import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getSessionContext } from "@/lib/auth";
import { getPrivateObject, verifySignedToken } from "@/lib/storage";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const payload = verifySignedToken(token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid or expired download link" }, { status: 403 });
  }

  const ctx = await getSessionContext();
  if (!ctx || ctx.workspace.id !== payload.workspaceId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = await getDb();
  const items = await db
    .select()
    .from(schema.signJobItems)
    .where(eq(schema.signJobItems.outputKey, payload.key));

  if (items.length === 0 || items[0].status === "expired") {
    return NextResponse.json({ error: "File has expired or was deleted" }, { status: 410 });
  }

  if (items[0].expiresAt && items[0].expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "File has expired" }, { status: 410 });
  }

  const buf = await getPrivateObject(payload.key);
  if (!buf) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": items[0].mimeType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${payload.fileName.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
