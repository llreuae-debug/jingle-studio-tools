import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-keys";
import { readC2paStoreFromBuffer } from "@/lib/c2pa-server";
import { detectRealMimeType } from "@/lib/security";

const MAX_CHECK_BYTES = 25 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const auth = await authenticateApiKey(req.headers.get("authorization"));
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  let buffer: Buffer;
  let mimeType: string | null = null;

  const contentType = req.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const fd = await req.formData();
    const file = fd.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing 'file' field." }, { status: 400 });
    }
    if (file.size === 0 || file.size > MAX_CHECK_BYTES) {
      return NextResponse.json({ error: "File is empty or exceeds 25 MB." }, { status: 400 });
    }
    buffer = Buffer.from(await file.arrayBuffer());
    mimeType = detectRealMimeType(buffer) || file.type || null;
  } else {
    const body = await req.json().catch(() => null);
    if (!body || typeof body.base64 !== "string") {
      return NextResponse.json(
        { error: "Provide multipart/form-data 'file' or JSON { base64 }." },
        { status: 400 }
      );
    }
    buffer = Buffer.from(body.base64, "base64");
    if (buffer.length === 0 || buffer.length > MAX_CHECK_BYTES) {
      return NextResponse.json({ error: "Decoded file is empty or exceeds 25 MB." }, { status: 400 });
    }
    mimeType = detectRealMimeType(buffer) || (typeof body.mimeType === "string" ? body.mimeType : null);
  }

  if (!mimeType) {
    return NextResponse.json({ error: "Unsupported or unrecognized file format." }, { status: 400 });
  }

  // Read credentials without storing the file
  const result = await readC2paStoreFromBuffer(buffer, mimeType);
  if (!result) {
    return NextResponse.json({
      hasCredentials: false,
      status: "none",
      note: "No Content Credentials found. This does not show how the file was made.",
      manifestStore: null,
    });
  }

  const { store, activeManifest: active } = result;
  return NextResponse.json({
    hasCredentials: true,
    status: store.validation_state === "Invalid" ? "warning" : "signed",
    validationState: store.validation_state,
    signer: active?.signature_info?.issuer || null,
    signingTime: active?.signature_info?.time || null,
    manifestStore: store,
  });
}
