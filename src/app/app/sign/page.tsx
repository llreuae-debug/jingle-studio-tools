import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { SignerClient } from "@/components/SignerClient";
import { getDb, schema } from "@/db";
import { getSessionContext } from "@/lib/auth";
import { isSigningTestMode } from "@/lib/c2pa-server";
import { getWorkspaceBalance } from "@/lib/credits";

export default async function AppSignPage() {
  const ctx = await getSessionContext();
  if (!ctx) {
    redirect("/login?callbackUrl=/app/sign");
  }

  const db = await getDb();
  const [profiles, balance] = await Promise.all([
    db
      .select()
      .from(schema.signingProfiles)
      .where(eq(schema.signingProfiles.workspaceId, ctx.workspace.id)),
    getWorkspaceBalance(ctx.workspace.id),
  ]);

  return (
    <SignerClient
      isAuthenticated={true}
      isTestMode={isSigningTestMode()}
      profiles={profiles}
      creditBalance={balance}
    />
  );
}
