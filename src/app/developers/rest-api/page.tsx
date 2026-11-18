import Link from "next/link";

export const metadata = {
  title: "REST API",
  description: "REST API endpoints for Content Credentials verification and signing.",
};

export default function DevelopersRestApiPage() {
  const endpoints = [
    { method: "POST", path: "/api/v1/check", desc: "Read a file's C2PA credentials without storing it." },
    { method: "POST", path: "/api/v1/sign-jobs", desc: "Create a signing job with AI-use disclosure answers." },
    { method: "GET", path: "/api/v1/sign-jobs/{id}", desc: "Read job status, per-file results, and download URLs." },
    { method: "GET", path: "/api/v1/credits", desc: "Read the authenticated workspace credit balance." },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-[var(--plum)]">REST API v1</h1>
      <p className="text-sm text-[var(--plum-muted)]">
        All endpoints require a hashed workspace API key in <code>Authorization: Bearer jst_...</code>.
      </p>

      <div className="glass-surface p-6 space-y-3">
        {endpoints.map((ep) => (
          <div
            key={ep.path}
            className="rounded-[20px] bg-[var(--mint)]/50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
          >
            <div className="font-mono font-semibold text-[var(--plum)]">
              <span className="rounded-full bg-[var(--plum)] text-[var(--lime)] px-2.5 py-0.5 mr-2">
                {ep.method}
              </span>
              {ep.path}
            </div>
            <p className="text-[var(--plum)]">{ep.desc}</p>
          </div>
        ))}
      </div>

      <Link href="/developers/docs" className="inline-block btn-plum px-5 py-2.5 text-xs font-semibold">
        View full docs &amp; curl examples
      </Link>
    </div>
  );
}
