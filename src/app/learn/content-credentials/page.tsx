import Link from "next/link";

export const metadata = {
  title: "What are Content Credentials?",
  description: "A plain-language overview of C2PA Content Credentials.",
  alternates: { canonical: "/learn/content-credentials" },
};

export default function LearnContentCredentialsPage() {
  return (
    <article className="max-w-3xl glass-surface p-6 sm:p-8 space-y-5">
      <h1 className="text-2xl sm:text-3xl font-bold text-[var(--plum)]">
        What are Content Credentials?
      </h1>
      <p className="text-sm text-[var(--plum)] leading-relaxed">
        Content Credentials are a signed record attached to a file using the open-source C2PA
        specification. They can show who signed the file, when it was signed, what app or device
        exported it, and what source files (ingredients) or AI tools were declared.
      </p>
      <p className="text-sm text-[var(--plum-muted)] leading-relaxed">
        If a file has no Content Credentials, that only means no declaration was found—it does not
        prove the file is human-made or AI-made. Author names and AI-use answers entered by a user
        are always self-declared.
      </p>
      <div className="flex flex-wrap gap-3 pt-2">
        <Link href="/tools/content-credentials-check" className="btn-plum px-5 py-2.5 text-xs font-semibold">
          Check a file
        </Link>
        <a
          href="https://opensource.contentauthenticity.org/docs/"
          target="_blank"
          rel="noreferrer"
          className="btn-mint px-5 py-2.5 text-xs font-semibold"
        >
          Official CAI Verify docs
        </a>
      </div>
    </article>
  );
}
