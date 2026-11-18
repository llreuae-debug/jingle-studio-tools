import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { Logo } from "@/components/Logo";
import { getDb, schema } from "@/db";
import { getSessionContext } from "@/lib/auth";
import { getWorkspaceBalance } from "@/lib/credits";

export default async function AppDashboardPage() {
  const ctx = await getSessionContext();
  if (!ctx) {
    redirect("/login?callbackUrl=/app");
  }

  const db = await getDb();
  const [balance, jobs] = await Promise.all([
    getWorkspaceBalance(ctx.workspace.id),
    db
      .select()
      .from(schema.signJobs)
      .where(eq(schema.signJobs.workspaceId, ctx.workspace.id))
      .orderBy(desc(schema.signJobs.createdAt))
      .limit(10),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <Logo variant="horizontal" size="sm" theme="light" />
          <h1 className="text-2xl font-bold text-[var(--color-ink)]">
            {ctx.workspace.name}
          </h1>
          <p className="text-xs text-[var(--color-muted)]">
            Signed in as {ctx.user.email} • Role: {ctx.membership.role}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full bg-[var(--color-navy)] px-3.5 py-1.5 text-xs font-semibold text-white">
            {balance} credits
          </span>
          <Link
            href="/app/sign"
            className="rounded-lg bg-[var(--color-blue)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--color-electric)]"
          >
            New signing batch
          </Link>
        </div>
      </div>

      <nav aria-label="Workspace" className="flex flex-wrap gap-2 text-xs font-medium">
        {[
          { href: "/app/sign", label: "Sign Batch" },
          { href: "/app/jobs", label: "All Jobs" },
          { href: "/app/billing", label: "Credits & Billing" },
          { href: "/app/settings", label: "Workspace & Profiles" },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-lg border border-[var(--color-border)] bg-white px-3.5 py-2 text-[var(--color-ink)] hover:border-[var(--color-blue)]"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <section className="glass-surface p-6 space-y-4">
        <h2 className="text-base font-semibold text-[var(--color-ink)]">Recent signing jobs</h2>
        {jobs.length === 0 ? (
          <p className="text-xs text-[var(--color-muted)]">
            No signing jobs yet. Start your first batch to attach C2PA Content Credentials.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
                  <th scope="col" className="py-2 pr-4">Job</th>
                  <th scope="col" className="py-2 pr-4">Files</th>
                  <th scope="col" className="py-2 pr-4">Status</th>
                  <th scope="col" className="py-2">Created</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id} className="border-b border-[var(--color-border)] last:border-0">
                    <td className="py-2.5 pr-4 font-medium">
                      <Link
                        href={`/app/jobs/${job.id}`}
                        className="text-[var(--color-blue)] hover:underline"
                      >
                        {job.id.slice(0, 8)}…
                      </Link>
                    </td>
                    <td className="py-2.5 pr-4">{job.fileCount}</td>
                    <td className="py-2.5 pr-4">{job.status}</td>
                    <td className="py-2.5 text-[var(--color-muted)]">
                      {job.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
