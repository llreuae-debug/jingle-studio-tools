import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { renderBrandOgImage } from "@/lib/og-template";

export const alt = "Public Proof — Jingle Studio Tools";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function PublicProofOgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.publicCredentials)
    .where(eq(schema.publicCredentials.slug, slug));

  const record = rows[0];
  if (!record || record.status !== "live") {
    return renderBrandOgImage({
      eyebrow: "Public Proof Record",
      title: "Proof record unavailable",
      subtitle: "This public Content Credential record is not published or has been revoked.",
    });
  }

  return renderBrandOgImage({
    eyebrow: "Published Content Credential",
    title: record.title,
    subtitle: `Signed by ${record.signer} • ${record.disclosureSummary}`,
  });
}
