import { eq } from "drizzle-orm";
import { SignerClient } from "@/components/SignerClient";
import { getDb, schema } from "@/db";
import { getSessionContext } from "@/lib/auth";
import { isSigningTestMode } from "@/lib/c2pa-server";
import { getWorkspaceBalance } from "@/lib/credits";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "AI Disclosure Signer",
  description: "Batch-sign up to 50 JPG or PNG files with C2PA Content Credentials and honest AI disclosures.",
};

export default async function PublicSignerPage() {
  const ctx = await getSessionContext();
  const isTestMode = isSigningTestMode();

  if (!ctx) {
    return <SignerClient isAuthenticated={false} isTestMode={isTestMode} />;
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
      isTestMode={isTestMode}
      profiles={profiles}
      creditBalance={balance}
    />
  );
}
