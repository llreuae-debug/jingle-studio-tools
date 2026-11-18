import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { isSigningTestMode } from "@/lib/c2pa-server";

export async function GET() {
  try {
    const db = await getDb();
    const snapshots = await db
      .select({
        sha256: schema.trustListSnapshots.sha256,
        fetchedAt: schema.trustListSnapshots.fetchedAt,
      })
      .from(schema.trustListSnapshots)
      .where(eq(schema.trustListSnapshots.active, true))
      .orderBy(desc(schema.trustListSnapshots.fetchedAt))
      .limit(1);

    return NextResponse.json({
      ok: true,
      db: "connected",
      signingMode: isSigningTestMode() ? "test" : "production",
      trustList: snapshots[0] || null,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Health check failed",
      },
      { status: 500 }
    );
  }
}
