"use client";

import React, { useId, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Mail } from "lucide-react";
import { Logo } from "@/components/Logo";

export default function ForgotPasswordPage() {
  const emailId = useId();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not process request.");
        return;
      }
      setDoneMsg(data.message);
      if (typeof data.devResetUrl === "string") {
        setDevResetUrl(data.devResetUrl);
      }
    } catch {
      setError("Network error requesting password reset.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-md glass-surface p-6 sm:p-8 space-y-6">
      <div className="space-y-2.5">
        <Logo variant="horizontal" size="sm" theme="light" />
        <h1 className="text-2xl font-bold text-[var(--color-ink)]">Forgot password</h1>
        <p className="text-xs text-[var(--color-text-muted)]">
          Enter your account email and we will generate a single-use password reset token.
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

      {doneMsg ? (
        <div className="rounded-[14px] border border-emerald-200 bg-emerald-50 p-4 space-y-3 text-xs text-emerald-950">
          <p className="font-semibold flex items-center gap-2">
            <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-emerald-600" />
            Reset request prepared
          </p>
          <p>{doneMsg}</p>
          {devResetUrl && (
            <Link href={devResetUrl} className="inline-flex btn-plum px-4 py-2 font-semibold">
              Open password reset page
            </Link>
          )}
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
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full glass-input px-3.5 py-2.5 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 btn-plum px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            <Mail aria-hidden="true" className="h-4 w-4" />
            {submitting ? "Sending…" : "Send reset instructions"}
          </button>
        </form>
      )}

      <p className="text-xs text-center text-[var(--color-text-muted)]">
        Remember your password?{" "}
        <Link href="/login" className="font-semibold text-[var(--color-brand)] hover:underline">
          Back to login
        </Link>
      </p>
    </div>
  );
}
