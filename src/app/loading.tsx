import { Logo } from "@/components/Logo";

export default function Loading() {
  return (
    <div className="py-16 flex flex-col items-center justify-center gap-4 text-center">
      <Logo variant="mark" size="lg" theme="light" />
      <p className="text-sm font-medium text-[var(--plum-muted)]">Loading…</p>
    </div>
  );
}
