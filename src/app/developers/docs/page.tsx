import Link from "next/link";

export const metadata = {
  title: "API Documentation",
  description: "Authentication, errors, rate limits, curl, and JavaScript examples.",
};

export default function DevelopersDocsPage() {
  return (
    <div className="space-y-8 max-w-4xl">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-[var(--plum)]">API &amp; MCP Documentation</h1>
        <p className="text-sm text-[var(--plum-muted)]">
          Authenticate every request with a workspace API key from{" "}
          <Link href="/app/developers" className="underline font-semibold text-[var(--plum)]">
            /app/developers
          </Link>
          .
        </p>
      </div>

      <section className="glass-surface p-6 space-y-3 text-xs">
        <h2 className="text-base font-bold text-[var(--plum)]">Authentication &amp; Rate Limits</h2>
        <p className="text-[var(--plum)]">
          Pass <code>Authorization: Bearer jst_...</code> on all <code>/api/v1/*</code> and{" "}
          <code>/api/mcp</code> requests. Keys are stored as SHA-256 hashes and rate-limited to{" "}
          <strong>60 requests per minute</strong> per key.
        </p>
        <h3 className="font-semibold text-[var(--plum)] pt-2">Common Error Codes</h3>
        <ul className="space-y-1 text-[var(--plum-muted)]">
          <li><code>401</code> — Missing, invalid, or revoked API key</li>
          <li><code>402</code> — Insufficient workspace credits (<code>ERR_INSUFFICIENT_CREDITS</code>)</li>
          <li><code>429</code> — Rate limit exceeded (check <code>Retry-After</code>)</li>
          <li><code>ERR_INVALID_EXISTING_CREDENTIALS</code> — Blocked by Guardrail G3</li>
          <li><code>ERR_DISCLOSURE_CONFLICT</code> — Blocked by Guardrail G4 (no_ai on AI ingredient)</li>
        </ul>
      </section>

      <section className="glass-surface p-6 space-y-3 text-xs">
        <h2 className="text-base font-bold text-[var(--plum)]">curl Examples</h2>
        <pre
          role="region"
          aria-label="curl API examples"
          tabIndex={0}
          className="overflow-x-auto rounded-[20px] bg-[var(--plum)] text-[var(--cream)] p-4 font-mono"
        >
          <code>{`# 1. Check workspace credit balance
curl -s https://jingle-studio-tools.vercel.app/api/v1/credits \\
  -H "Authorization: Bearer jst_YOUR_KEY"

# 2. Check a file's Content Credentials (without storing it)
curl -s -X POST https://jingle-studio-tools.vercel.app/api/v1/check \\
  -H "Authorization: Bearer jst_YOUR_KEY" \\
  -F "file=@photo.png"

# 3. Create a signing job
curl -s -X POST https://jingle-studio-tools.vercel.app/api/v1/sign-jobs \\
  -H "Authorization: Bearer jst_YOUR_KEY" \\
  -F "files=@photo.png" \\
  -F "creatorName=Studio Team" \\
  -F "aiUse=full_ai" \\
  -F "modelType=imageGeneration"`}</code>
        </pre>
      </section>

      <section className="glass-surface p-6 space-y-3 text-xs">
        <h2 className="text-base font-bold text-[var(--plum)]">JavaScript Example</h2>
        <pre
          role="region"
          aria-label="JavaScript API example"
          tabIndex={0}
          className="overflow-x-auto rounded-[20px] bg-[var(--plum)] text-[var(--cream)] p-4 font-mono"
        >
          <code>{`const res = await fetch("https://jingle-studio-tools.vercel.app/api/v1/credits", {
  headers: { Authorization: "Bearer jst_YOUR_KEY" },
});
const { balance } = await res.json();
console.log("Credits:", balance);`}</code>
        </pre>
      </section>
    </div>
  );
}
