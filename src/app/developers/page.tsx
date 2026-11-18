import Link from "next/link";

export const metadata = {
  title: "Developers",
  description: "Automate C2PA Content Credentials verification and signing via REST API and MCP.",
};

export default function DevelopersOverviewPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-[28px] bg-[var(--plum)] text-[var(--cream)] p-8 space-y-4 shadow-[var(--glass-shadow)]">
        <span className="inline-block rounded-full bg-[var(--lime)] px-3 py-1 text-xs font-semibold text-[var(--plum)]">
          Developers
        </span>
        <h1 className="text-3xl font-bold">Automate Content Credentials</h1>
        <p className="text-sm text-[var(--mint)] max-w-2xl">
          Inspect C2PA manifests, create batch signing jobs with honest AI disclosures, and check
          workspace credits over our REST API or MCP server.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/developers/docs" className="btn-lime px-5 py-2.5 text-xs font-semibold">
            API documentation
          </Link>
          <Link
            href="/app/developers"
            className="rounded-full border border-[var(--lime)]/50 px-5 py-2.5 text-xs font-semibold text-[var(--cream)]"
          >
            Manage API keys
          </Link>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Link href="/developers/rest-api" className="glass-surface glass-card-interactive p-6 space-y-2 block">
          <h2 className="font-bold text-[var(--plum)]">REST API v1</h2>
          <p className="text-xs text-[var(--plum-muted)]">
            Endpoints for checking files, submitting sign jobs, polling status, and checking credits.
          </p>
        </Link>
        <Link href="/developers/mcp" className="glass-surface glass-card-interactive p-6 space-y-2 block">
          <h2 className="font-bold text-[var(--plum)]">MCP Server</h2>
          <p className="text-xs text-[var(--plum-muted)]">
            JSON-RPC 2.0 Model Context Protocol server at <code>/api/mcp</code> for AI agents.
          </p>
        </Link>
        <Link href="/developers/docs" className="glass-surface glass-card-interactive p-6 space-y-2 block">
          <h2 className="font-bold text-[var(--plum)]">Docs &amp; Examples</h2>
          <p className="text-xs text-[var(--plum-muted)]">
            Authentication, rate limits, error codes, and working curl and JavaScript examples.
          </p>
        </Link>
      </div>
    </div>
  );
}
