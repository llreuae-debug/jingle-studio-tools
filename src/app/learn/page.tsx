import Link from "next/link";

export const metadata = {
  title: "Learn",
  description: "Guides on C2PA Content Credentials, SynthID, and honest AI disclosure.",
};

export default function LearnIndexPage() {
  return (
    <div className="space-y-8 max-w-4xl">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-[var(--plum)]">Learn</h1>
        <p className="text-sm text-[var(--plum-muted)]">
          Plain-language guides on provenance standards, AI disclosures, and platform labels.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Link href="/learn/content-credentials" className="glass-surface glass-card-interactive p-6 space-y-2 block">
          <h2 className="font-bold text-[var(--plum)]">What are Content Credentials?</h2>
          <p className="text-xs text-[var(--plum-muted)]">
            How C2PA signed manifests, parent ingredients, and trust lists work.
          </p>
        </Link>
        <Link href="/learn/synthid" className="glass-surface glass-card-interactive p-6 space-y-2 block">
          <h2 className="font-bold text-[var(--plum)]">What is SynthID?</h2>
          <p className="text-xs text-[var(--plum-muted)]">
            How Google&apos;s watermark differs from C2PA and where it is checked.
          </p>
        </Link>
        <Link href="/blog" className="glass-surface glass-card-interactive p-6 space-y-2 block">
          <h2 className="font-bold text-[var(--plum)]">Blog</h2>
          <p className="text-xs text-[var(--plum-muted)]">
            Practical walkthroughs for creators, agencies, and real estate marketers.
          </p>
        </Link>
        <Link href="/faq" className="glass-surface glass-card-interactive p-6 space-y-2 block">
          <h2 className="font-bold text-[var(--plum)]">FAQ</h2>
          <p className="text-xs text-[var(--plum-muted)]">
            Answers to common questions about checks, signing, and privacy.
          </p>
        </Link>
      </div>
    </div>
  );
}
