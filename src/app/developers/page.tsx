import Link from "next/link";

export const metadata = {
  title: "Developers",
  description: "Automate C2PA Content Credentials verification and signing via REST API and MCP.",
};

export default function DevelopersOverviewPage() {
  return (
    <div className="space-y-8">
      <section
        className="rounded-[28px] p-8 sm:p-12 text-white space-y-4 shadow-[var(--shadow-dark-card)]"
        style={{ background: "linear-gradient(135deg, #141312 0%, #c93700 58%, #ff5500 100%)" }}
      >
        <span className="inline-block rounded-full bg-white/15 border border-white/25 px-3.5 py-1 text-xs font-semibold text-white">
          Developers
        </span>
        <h1 className="text-3xl sm:text-5xl font-bold tracking-[-0.025em] text-white">
          Automate Content Credentials
        </h1>
        <p className="text-sm sm:text-base text-[#fae6da] max-w-2xl leading-relaxed">
          Inspect C2PA manifests, create batch signing jobs with honest AI disclosures, and check
          workspace credits over our REST API or MCP server.
        </p>
        <div className="flex flex-wrap gap-3 pt-1">
          <Link
            href="/developers/docs"
            className="rounded-full bg-white text-[var(--espresso-black)] hover:bg-[var(--warm-peach)] px-5 py-2.5 text-xs font-bold shadow-[var(--shadow-2)] transition-colors duration-150"
          >
            API documentation
          </Link>
          <Link
            href="/app/developers"
            className="rounded-full border border-white/40 px-5 py-2.5 text-xs font-semibold text-white hover:bg-white/15 transition-colors duration-150"
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
