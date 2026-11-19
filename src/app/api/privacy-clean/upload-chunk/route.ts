import { NextRequest, NextResponse } from "next/server";
import { attachPrivacyCookie, resolvePrivacyActor } from "@/lib/privacy-session";
import { verifySameOrigin } from "@/lib/security";
import { getPrivateObject, putPrivateObject } from "@/lib/storage";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!verifySameOrigin(req)) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const actor = await resolvePrivacyActor(req);
  const fd = await req.formData().catch(() => null);
  if (!fd) {
    return NextResponse.json({ error: "Invalid multipart chunk payload." }, { status: 400 });
  }

  const uploadId = typeof fd.get("uploadId") === "string" ? String(fd.get("uploadId")) : "";
  const index = Number.parseInt(String(fd.get("index") ?? "-1"), 10);
  const chunk = fd.get("chunk");

  if (
    !/^[0-9a-f-]{36}$/i.test(uploadId) ||
    !Number.isInteger(index) ||
    index < 0 ||
    !(chunk instanceof Blob)
  ) {
    return NextResponse.json({ error: "Invalid chunk parameters." }, { status: 400 });
  }

  const metaRaw = await getPrivateObject(`chunks/${uploadId}/meta.json`);
  if (!metaRaw) {
    return NextResponse.json({ error: "Upload session not found." }, { status: 404 });
  }

  const meta = JSON.parse(metaRaw.toString("utf8")) as {
    ownerScope: string;
    totalChunks: number;
  };
  if (meta.ownerScope !== actor.ownerScope) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (index >= meta.totalChunks || chunk.size > 3 * 1024 * 1024) {
    return NextResponse.json({ error: "Chunk index or size out of bounds." }, { status: 400 });
  }

  const buf = Buffer.from(await chunk.arrayBuffer());
  await putPrivateObject(
    `chunks/${uploadId}/${index}.part`,
    buf,
    "application/octet-stream"
  );

  const res = NextResponse.json({ ok: true, index, receivedBytes: buf.length });
  return attachPrivacyCookie(res, actor, req);
}
