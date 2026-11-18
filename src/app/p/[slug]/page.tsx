import Link from "next/link";
import { eq } from "drizzle-orm";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ProofActionsClient } from "@/components/ProofActionsClient";
import { getDb, schema } from "@/db";
import { getSessionContext } from "@/lib/auth";

export default async function PublicProofPage({
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

  if (rows.length === 0) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-[var(--color-border)] bg-white p-8 text-center space-y-3">
        <h1 className="text-xl font-bold text-[var(--color-ink)]">Proof record not found</h1>
        <p className="text-xs text-[var(--color-muted)]">
          This public verification link does not exist.
        </p>
        <Link
          href="/tools/content-credentials-check"
          className="inline-block rounded-lg bg-[var(--color-blue)] px-4 py-2 text-xs font-semibold text-white"
        >
          Open Content Credentials Check
        </Link>
      </div>
    );
  }

  const record = rows[0];

  if (record.status === "revoked") {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center space-y-3">
        <ShieldAlert aria-hidden="true" className="mx-auto h-10 w-10 text-[#C83C4D]" />
        <h1 className="text-xl font-bold text-rose-950">Proof record revoked</h1>
        <p className="text-xs text-rose-900">
          The workspace owner has revoked this public proof page. Its details are no longer
          displayed.
        </p>
      </div>
    );
  }

  const ctx = await getSessionContext();
  const canRevoke = Boolean(ctx && ctx.workspace.id === record.workspaceId);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="glass-surface p-6 sm:p-8 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-[#16865B]">
            <ShieldCheck aria-hidden="true" className="h-6 w-6" />
            <span className="text-xs font-semibold uppercase tracking-wider">
              Public Content Credential Record
            </span>
          </div>
          <Logo variant="mark" size="sm" theme="light" />
        </div>

        <h1 className="text-2xl font-bold text-[var(--color-ink)]">{record.title}</h1>

        {record.thumbnailDataUrl && (
          <img
            src={record.thumbnailDataUrl}
            alt={`Thumbnail of ${record.title}`}
            className="max-h-64 rounded-xl border border-[var(--color-border)] object-contain"
          />
        )}

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs border-t border-b border-[var(--color-border)] py-4">
          <div>
            <dt className="text-[var(--color-muted)]">Signer certificate</dt>
            <dd className="mt-0.5 font-semibold text-[var(--color-ink)]">{record.signer}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-muted)]">Signing time (UTC)</dt>
            <dd className="mt-0.5 font-semibold text-[var(--color-ink)]">
              {record.signingTimeIso}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--color-muted)]">Creator (Self-declared)</dt>
            <dd className="mt-0.5 font-semibold text-[var(--color-ink)]">
              {record.creatorName}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--color-muted)]">AI Disclosure (Self-declared)</dt>
            <dd className="mt-0.5 font-semibold text-[var(--color-ink)]">
              {record.disclosureSummary}
            </dd>
          </div>
        </dl>

        <div className="rounded-xl bg-[var(--color-surface)] p-4 text-xs text-[var(--color-muted)] space-y-1">
          <p className="font-semibold text-[var(--color-ink)]">What this record cannot prove</p>
          <p>
            This record reflects the Content Credentials signed at the time listed above. Creator
            names and AI-use answers are self-declared by the signer and are not independently
            verified identity. Personal capture or GPS data is never displayed here.
          </p>
        </div>

        <Link
          href="/tools/content-credentials-check"
          className="inline-block rounded-lg border border-[var(--color-border)] px-4 py-2 text-xs font-medium text-[var(--color-ink)] hover:border-[var(--color-blue)]"
        >
          Re-check local file
        </Link>
      </div>

      <ProofActionsClient slug={record.slug} canRevoke={canRevoke} />
    </div>
  );
}
