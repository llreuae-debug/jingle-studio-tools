import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { authenticateApiKey } from "@/lib/api-keys";
import type { AiUseChoice } from "@/lib/c2pa-server";
import { createSignJobForWorkspace } from "@/lib/sign-jobs-service";

export async function POST(req: NextRequest) {
  const auth = await authenticateApiKey(req.headers.get("authorization"));
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const db = await getDb();
  const wsRows = await db
    .select({ ownerId: schema.workspaces.ownerId })
    .from(schema.workspaces)
    .where(eq(schema.workspaces.id, auth.workspaceId));

  if (wsRows.length === 0) {
    return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
  }

  const contentType = req.headers.get("content-type") || "";
  let files: Array<{ name: string; buffer: Buffer }> = [];
  let creatorName = "";
  let creatorWebsite: string | undefined;
  let aiUse = "" as AiUseChoice;
  let modelType: string | undefined;
  let modelName: string | undefined;
  let doNotTrain = true;
  let idempotencyKey = req.headers.get("idempotency-key") || undefined;

  if (contentType.includes("multipart/form-data")) {
    const fd = await req.formData();
    const uploaded = fd.getAll("files").filter((v): v is File => v instanceof File);
    files = await Promise.all(
      uploaded.map(async (f) => ({ name: f.name, buffer: Buffer.from(await f.arrayBuffer()) }))
    );
    creatorName = String(fd.get("creatorName") || "");
    creatorWebsite = String(fd.get("creatorWebsite") || "") || undefined;
    aiUse = String(fd.get("aiUse") || "") as AiUseChoice;
    modelType = String(fd.get("modelType") || "") || undefined;
    modelName = String(fd.get("modelName") || "") || undefined;
    doNotTrain = String(fd.get("doNotTrain") || "true") !== "false";
    idempotencyKey = idempotencyKey || String(fd.get("idempotencyKey") || "") || undefined;
  } else {
    const body = await req.json().catch(() => null);
    if (!body || !Array.isArray(body.files)) {
      return NextResponse.json(
        { error: "Provide multipart/form-data or JSON { files: [{ name, base64 }], ... }." },
        { status: 400 }
      );
    }
    files = body.files
      .filter((f: unknown): f is { name: string; base64: string } =>
        Boolean(f && typeof (f as { name?: string }).name === "string" && typeof (f as { base64?: string }).base64 === "string")
      )
      .map((f: { name: string; base64: string }) => ({
        name: f.name,
        buffer: Buffer.from(f.base64, "base64"),
      }));
    creatorName = String(body.creatorName || "");
    creatorWebsite = typeof body.creatorWebsite === "string" ? body.creatorWebsite : undefined;
    aiUse = String(body.aiUse || "") as AiUseChoice;
    modelType = typeof body.modelType === "string" ? body.modelType : undefined;
    modelName = typeof body.modelName === "string" ? body.modelName : undefined;
    doNotTrain = body.doNotTrain !== false;
    idempotencyKey = idempotencyKey || (typeof body.idempotencyKey === "string" ? body.idempotencyKey : undefined);
  }

  const result = await createSignJobForWorkspace({
    workspaceId: auth.workspaceId,
    createdByUserId: wsRows[0].ownerId,
    files,
    creatorName,
    creatorWebsite,
    aiUse,
    modelType,
    modelName,
    doNotTrain,
    idempotencyKey,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, ...(result.code ? { code: result.code } : {}) },
      { status: result.status }
    );
  }

  return NextResponse.json(
    { jobId: result.jobId, duplicate: result.duplicate },
    { status: result.duplicate ? 200 : 202 }
  );
}
