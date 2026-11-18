import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";

const C2PA_TRUST_LIST_URL =
  process.env.C2PA_TRUST_LIST_URL ||
  "https://raw.githubusercontent.com/c2pa-org/conformance-public/refs/heads/main/trust-list/C2PA-TRUST-LIST.pem";

export async function GET() {
  try {
    const res = await fetch(C2PA_TRUST_LIST_URL, {
      next: { revalidate: 86400 },
    });

    if (!res.ok) {
      return NextResponse.json(
        {
          pem: null,
          sha256: null,
          fetchedAt: new Date().toISOString(),
          sourceUrl: C2PA_TRUST_LIST_URL,
          error: `Upstream returned ${res.status}`,
        },
        { status: 200 }
      );
    }

    const pem = await res.text();
    const sha256 = crypto.createHash("sha256").update(pem).digest("hex");

    try {
      const db = await getDb();
      const latest = await db
        .select({ sha256: schema.trustListSnapshots.sha256 })
        .from(schema.trustListSnapshots)
        .where(eq(schema.trustListSnapshots.active, true))
        .orderBy(desc(schema.trustListSnapshots.fetchedAt))
        .limit(1);

      if (latest[0]?.sha256 !== sha256) {
        await db
          .update(schema.trustListSnapshots)
          .set({ active: false })
          .where(eq(schema.trustListSnapshots.active, true));

        await db.insert(schema.trustListSnapshots).values({
          id: crypto.randomUUID(),
          sourceUrl: C2PA_TRUST_LIST_URL,
          sha256,
          pemBundle: pem,
          active: true,
        });
      }
    } catch {
      // Non-fatal if DB snapshot write fails
    }

    return NextResponse.json({
      pem,
      sha256,
      fetchedAt: new Date().toISOString(),
      sourceUrl: C2PA_TRUST_LIST_URL,
    });
  } catch (err) {
    return NextResponse.json(
      {
        pem: null,
        sha256: null,
        fetchedAt: new Date().toISOString(),
        sourceUrl: C2PA_TRUST_LIST_URL,
        error: err instanceof Error ? err.message : "Failed to fetch trust list",
      },
      { status: 200 }
    );
  }
}
