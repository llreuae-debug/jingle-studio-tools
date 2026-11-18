import Link from "next/link";

export const metadata = {
  title: "How it works",
  description: "Three steps to check, disclose AI use honestly, and share Content Credentials.",
};

export default function HowItWorksPage() {
  return (
    <div className="space-y-8 max-w-4xl">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-[var(--plum)]">Three steps to a clearer file.</h1>
        <p className="text-sm text-[var(--plum-muted)]">
          Inspect provenance locally, attach an honest AI disclosure, and share a verifiable record.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {[
          {
            step: "1",
            title: "Check",
            body: "Drop in a file and read its credentials. Checks run locally in your browser without uploading.",
          },
          {
            step: "2",
            title: "Disclose",
            body: "Tell us how AI was used, in plain language. Existing valid credentials are preserved as a parent ingredient.",
          },
          {
            step: "3",
            title: "Share",
            body: "Download the signed file and publish a proof page if you want one.",
          },
        ].map((item) => (
          <div key={item.step} className="glass-surface p-6 space-y-2.5">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--plum)] text-[var(--lime)] text-xs font-bold">
              {item.step}
            </span>
            <h2 className="font-bold text-[var(--plum)]">{item.title}</h2>
            <p className="text-xs text-[var(--plum-muted)] leading-relaxed">{item.body}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/tools/content-credentials-check" className="btn-plum px-5 py-2.5 text-xs font-semibold">
          Check a file
        </Link>
        <Link href="/tools/ai-disclosure-signer" className="btn-mint px-5 py-2.5 text-xs font-semibold">
          Sign your work
        </Link>
      </div>
    </div>
  );
}
