"use client";

import React from "react";
import { Logo } from "@/components/Logo";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg glass-surface p-8 text-center space-y-4">
      <Logo variant="stacked" size="md" theme="light" className="mx-auto" />
      <h1 className="text-2xl font-bold text-[var(--plum)]">Something went wrong (500)</h1>
      <p className="text-xs text-[var(--plum-muted)]">
        An unexpected error occurred while loading this page.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="btn-plum px-5 py-2.5 text-xs font-semibold"
      >
        Try again
      </button>
    </div>
  );
}
