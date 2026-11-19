"use client";

import React, { Suspense, useId, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, KeyRound } from "lucide-react";
import { Logo } from "@/components/Logo";

function ResetPasswordInner() {
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email") || "";
  const tokenParam = searchParams.get("token") || "";

  const emailId = useId();
  const tokenId = useId();
  const passId = useId();

  const [email, setEmail] = useState(emailParam);
  const [token, setToken] = useState(tokenParam);
  const [newPassword, setNewPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not reset password.");
        return;
      }
      setDone(true);
    } catch {
      setError("Network error resetting password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-md glass-surface p-6 sm:p-8 space-y-6">
      <div className="space-y-2.5">
        <Logo variant="horizontal" size="sm" theme="light" />
        <h1 className="text-2xl font-bold text-[var(--color-ink)]">Reset password</h1>
        <p className="text-xs text-[var(--color-text-muted)]">
          Set a new password for your account. All existing browser sessions will be signed out for security.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-[12px] border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-center gap-2"
        >
          <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {done ? (
        <div className="rounded-[14px] border border-emerald-200 bg-emerald-50 p-4 space-y-3 text-xs text-emerald-950">
          <p className="font-semibold flex items-center gap-2">
            <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-emerald-600" />
            Password updated
          </p>
          <p>You can now log in with your new password.</p>
          <Link href="/login" className="inline-flex btn-plum px-4 py-2 font-semibold">
            Log in
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor={emailId} className="block text-xs font-medium text-[var(--color-ink)]">
              Email address
            </label>
            <input
              id={emailId}
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full glass-input px-3.5 py-2.5 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor={tokenId} className="block text-xs font-medium text-[var(--color-ink)]">
              Reset token
            </label>
            <input
              id={tokenId}
              type="text"
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="w-full glass-input px-3.5 py-2.5 text-sm font-mono"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor={passId} className="block text-xs font-medium text-[var(--color-ink)]">
              New password (min 6 characters)
            </label>
            <input
              id={passId}
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full glass-input px-3.5 py-2.5 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 btn-plum px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            <KeyRound aria-hidden="true" className="h-4 w-4" />
            {submitting ? "Updating password…" : "Update password"}
          </button>
        </form>
      )}
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center text-sm text-[var(--color-text-muted)]">
          Loading…
        </div>
      }
    >
      <ResetPasswordInner />
    </Suspense>
  );
}
