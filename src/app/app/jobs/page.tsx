import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getSessionContext } from "@/lib/auth";

export default async function JobsListPage() {
  const ctx = await getSessionContext();
  if (!ctx) {
    redirect("/login?callbackUrl=/app/jobs");
  }

  const db = await getDb();
  const jobs = await db
    .select()
    .from(schema.signJobs)
    .where(eq(schema.signJobs.workspaceId, ctx.workspace.id))
    .orderBy(desc(schema.signJobs.createdAt))
    .limit(50);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-[var(--color-ink)]">Signing Jobs</h1>
        <Link
          href="/app/sign"
          className="rounded-lg bg-[var(--color-blue)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--color-electric)]"
        >
          New batch
        </Link>
      </div>

      <div className="rounded-2xl border border-[var(--color-border)] bg-white p-6">
        {jobs.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">No signing jobs yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-[var(--color-muted)]">
                  <th scope="col" className="py-2 pr-4">Job ID</th>
                  <th scope="col" className="py-2 pr-4">Creator</th>
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
                    <td className="py-2.5 pr-4">{job.creatorName}</td>
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
      </div>
    </div>
  );
}
