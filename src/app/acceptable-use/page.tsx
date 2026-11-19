export const metadata = {
  title: "Acceptable Use Policy (Draft)",
  description:
    "Permitted uses of Jingle Studio Tools, provenance preservation commitments, and restrictions on misrepresentation.",
  alternates: { canonical: "/acceptable-use" },
};

export default function AcceptableUsePage() {
  return (
    <article className="max-w-3xl space-y-5 glass-surface p-6 sm:p-8">
      <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs font-medium text-amber-900">
        Draft for legal review before production launch.
      </div>
      <h1 className="text-2xl font-bold text-[var(--color-ink)]">Acceptable Use Policy</h1>
      <p className="text-sm text-[var(--color-muted)] leading-relaxed">
        You may not use Jingle Studio Tools to misrepresent AI-generated or AI-modified media as
        non-AI, to impersonate another creator or organization, or to distribute unlawful content.
      </p>
      <p className="text-sm text-[var(--color-muted)] leading-relaxed">
        Our platform strictly preserves valid parent C2PA ingredients and blocks signing when
        existing credentials fail validation or conflict with a &ldquo;no generative AI&rdquo;
        declaration.
      </p>
    </article>
  );
}
