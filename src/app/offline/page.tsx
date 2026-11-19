import Link from "next/link";
import { Logo } from "@/components/Logo";

export const metadata = {
  title: "Offline",
  description: "Offline connection notice for Jingle Studio Tools.",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <div className="mx-auto max-w-lg glass-surface p-8 text-center space-y-4">
      <Logo variant="stacked" size="md" theme="light" className="mx-auto" />
      <h1 className="text-2xl font-bold text-[var(--plum)]">You are offline</h1>
      <p className="text-xs text-[var(--plum-muted)]">
        Reconnect to the internet to verify remote URLs or submit batch signing jobs.
      </p>
      <Link href="/tools" className="inline-block btn-plum px-5 py-2.5 text-xs font-semibold">
        Return to tools
      </Link>
    </div>
  );
}
