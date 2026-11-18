import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-keys";
import { getWorkspaceBalance } from "@/lib/credits";

export async function GET(req: NextRequest) {
  const auth = await authenticateApiKey(req.headers.get("authorization"));
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const balance = await getWorkspaceBalance(auth.workspaceId);
  return NextResponse.json({
    workspaceId: auth.workspaceId,
    balance,
  });
}
