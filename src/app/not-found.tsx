import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg glass-surface p-8 text-center space-y-4">
      <Logo variant="stacked" size="md" theme="light" className="mx-auto" />
      <h1 className="text-2xl font-bold text-[var(--plum)]">Page not found (404)</h1>
      <p className="text-xs text-[var(--plum-muted)]">
        The page you requested could not be found.
      </p>
      <Link href="/tools" className="inline-block btn-plum px-5 py-2.5 text-xs font-semibold">
        Back to Jingle Studio Tools
      </Link>
    </div>
  );
}
