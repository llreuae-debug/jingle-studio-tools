import Link from "next/link";

export const metadata = {
  title: "MCP Server",
  description: "Model Context Protocol server at /api/mcp for Content Credentials.",
  alternates: { canonical: "/developers/mcp" },
};

export default function DevelopersMcpPage() {
  const tools = [
    { name: "check_credentials", desc: "Read C2PA credentials from base64 file bytes without storing." },
    { name: "create_sign_job", desc: "Create a C2PA signing job with honest AI disclosure." },
    { name: "get_sign_job", desc: "Inspect signing job progress and download URLs." },
    { name: "get_credit_balance", desc: "Check current workspace credit balance." },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-[var(--plum)]">MCP Server (`/api/mcp`)</h1>
      <p className="text-sm text-[var(--plum-muted)]">
        Connect AI agents to <code>POST /api/mcp</code> using JSON-RPC 2.0 and your workspace
        Bearer API key. The same rate limits, credit charges, and absolute rules apply.
      </p>

      <div className="glass-surface p-6 space-y-3">
        {tools.map((tool) => (
          <div key={tool.name} className="rounded-[20px] bg-[var(--mint)]/50 p-4 text-xs">
            <p className="font-mono font-semibold text-[var(--plum)]">{tool.name}</p>
            <p className="mt-1 text-[var(--plum-muted)]">{tool.desc}</p>
          </div>
        ))}
      </div>

      <Link href="/developers/docs" className="inline-block btn-plum px-5 py-2.5 text-xs font-semibold">
        View MCP &amp; REST examples
      </Link>
    </div>
  );
}
