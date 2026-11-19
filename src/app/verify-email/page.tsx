"use client";

import React, { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/Logo";

function VerifyEmailInner() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const token = searchParams.get("token") || "";

  const [status, setStatus] = useState<"idle" | "verifying" | "verified" | "error">(
    email && token ? "verifying" : "idle"
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!email || !token) return;
    let active = true;
    fetch("/api/auth/verify-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, token }),
    })
      .then(async (res) => {
        if (!active) return;
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setStatus("verified");
        } else {
          setError(data.error || "Invalid or expired verification link.");
          setStatus("error");
        }
      })
      .catch(() => {
        if (!active) return;
        setError("Network error verifying email.");
        setStatus("error");
      });
    return () => {
      active = false;
    };
  }, [email, token]);

  return (
    <div className="mx-auto max-w-md glass-surface p-6 sm:p-8 space-y-5">
      <Logo variant="horizontal" size="sm" theme="light" />
      <h1 className="text-2xl font-bold text-[var(--color-ink)]">Email verification</h1>

      {status === "verifying" && (
        <p className="text-sm text-[var(--color-text-muted)]">Verifying your email address…</p>
      )}

      {status === "verified" && (
        <div className="rounded-[14px] border border-emerald-200 bg-emerald-50 p-4 space-y-3 text-xs text-emerald-950">
          <p className="font-semibold flex items-center gap-2">
            <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-emerald-600" />
            Your email ({email}) has been verified.
          </p>
          <Link href="/app" className="inline-flex btn-plum px-4 py-2 font-semibold">
            Continue to dashboard
          </Link>
        </div>
      )}

      {status === "error" && (
        <div
          role="alert"
          className="rounded-[14px] border border-rose-200 bg-rose-50 p-4 text-xs text-rose-900 flex items-center gap-2"
        >
          <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {status === "idle" && (
        <div className="space-y-3 text-xs text-[var(--color-text-muted)]">
          <p>
            Open the verification link from your signup confirmation to mark your account email as verified.
          </p>
          <Link href="/login" className="inline-flex btn-mint px-4 py-2 font-semibold">
            Return to login
          </Link>
        </div>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center text-sm text-[var(--color-text-muted)]">
          Loading…
        </div>
      }
    >
      <VerifyEmailInner />
    </Suspense>
  );
}
