export const metadata = {
  title: "Terms of Service (Draft)",
  description:
    "Terms covering Jingle Studio Tools C2PA Content Credentials verification, privacy cleaning, and credit billing.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <article className="max-w-3xl space-y-5 glass-surface p-6 sm:p-8">
      <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs font-medium text-amber-900">
        Draft for legal review before production launch.
      </div>
      <h1 className="text-2xl font-bold text-[var(--color-ink)]">Terms of Service</h1>
      <p className="text-sm text-[var(--color-muted)] leading-relaxed">
        Jingle Studio Tools provides C2PA Content Credentials inspection and signing utilities.
        Creator names, websites, and AI-use disclosures entered by users are recorded as
        self-declared assertions.
      </p>
      <p className="text-sm text-[var(--color-muted)] leading-relaxed">
        Credits purchased for batch signing are consumed per successfully signed file. Failed items
        are automatically refunded to your workspace credit ledger.
      </p>
    </article>
  );
}
