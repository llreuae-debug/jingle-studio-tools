import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-keys";
import { getSignJobForWorkspace } from "@/lib/sign-jobs-service";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiKey(req.headers.get("authorization"));
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await context.params;
  const data = await getSignJobForWorkspace(auth.workspaceId, id);
  if (!data) {
    return NextResponse.json({ error: "Sign job not found." }, { status: 404 });
  }

  return NextResponse.json(data);
}
