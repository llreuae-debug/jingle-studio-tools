import Link from "next/link";

export const metadata = {
  title: "What is SynthID?",
  description: "What Google SynthID is, how it differs from C2PA, and where to check it.",
  alternates: { canonical: "/learn/synthid" },
};

export default function LearnSynthIdPage() {
  return (
    <article className="max-w-3xl glass-surface p-6 sm:p-8 space-y-5">
      <h1 className="text-2xl sm:text-3xl font-bold text-[var(--plum)]">What is SynthID?</h1>
      <p className="text-sm text-[var(--plum)] leading-relaxed">
        SynthID is an invisible watermark from Google for identifying content made with its AI
        tools. It is separate from C2PA Content Credentials.
      </p>
      <p className="text-sm text-[var(--plum-muted)] leading-relaxed">
        Jingle Studio Tools does not detect, change, or remove SynthID. Google offers a SynthID
        check directly inside the Gemini app.
      </p>
      <div className="flex flex-wrap gap-3 pt-2">
        <a
          href="https://support.google.com/gemini/answer/16722517?hl=en"
          target="_blank"
          rel="noreferrer"
          className="btn-plum px-5 py-2.5 text-xs font-semibold"
        >
          Google Gemini SynthID help
        </a>
        <Link href="/tools/content-credentials-check" className="btn-mint px-5 py-2.5 text-xs font-semibold">
          Check C2PA credentials
        </Link>
      </div>
    </article>
  );
}
