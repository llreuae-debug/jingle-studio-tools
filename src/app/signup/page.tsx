"use client";

import React, { useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Lock, UserPlus } from "lucide-react";
import { Logo } from "@/components/Logo";

export default function SignUpPage() {
  const router = useRouter();
  const nameId = useId();
  const emailId = useId();
  const passId = useId();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [devVerifyUrl, setDevVerifyUrl] = useState<string | null>(null);
  const [created, setCreated] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not create account.");
        return;
      }
      setCreated(true);
      if (typeof data.devVerifyUrl === "string") {
        setDevVerifyUrl(data.devVerifyUrl);
      } else {
        router.push("/app");
        router.refresh();
      }
    } catch {
      setError("Network error while creating your account.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-md glass-surface p-6 sm:p-8 space-y-6">
      <div className="space-y-2.5">
        <Logo variant="horizontal" size="sm" theme="light" />
        <h1 className="text-2xl font-bold text-[var(--color-ink)]">Create your account</h1>
        <p className="text-xs text-[var(--color-text-muted)]">
          Start with 10 free credits, save privacy-cleaning history, and access extended media limits.
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

      {created ? (
        <div className="rounded-[14px] border border-emerald-200 bg-emerald-50 p-4 space-y-3 text-xs text-emerald-950">
          <p className="font-semibold flex items-center gap-2">
            <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-emerald-600" />
            Account created and signed in!
          </p>
          <p>
            Please verify your email address to keep recovery and notifications active.
          </p>
          <div className="flex flex-wrap gap-2">
            {devVerifyUrl && (
              <Link href={devVerifyUrl} className="btn-plum px-4 py-2 font-semibold">
                Verify email now
              </Link>
            )}
            <Link href="/app" className="btn-mint px-4 py-2 font-semibold">
              Go to dashboard
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label htmlFor={nameId} className="block text-xs font-medium text-[var(--color-ink)]">
              Full name
            </label>
            <input
              id={nameId}
              type="text"
              required
              autoComplete="name"
              placeholder="Alex Mercer"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full glass-input px-3.5 py-2.5 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor={emailId} className="block text-xs font-medium text-[var(--color-ink)]">
              Email address
            </label>
            <input
              id={emailId}
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full glass-input px-3.5 py-2.5 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor={passId} className="block text-xs font-medium text-[var(--color-ink)]">
              Password (min 6 characters)
            </label>
            <input
              id={passId}
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full glass-input px-3.5 py-2.5 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 btn-plum px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
          >
            <UserPlus aria-hidden="true" className="h-4 w-4" />
            {submitting ? "Creating account…" : "Create account"}
          </button>
        </form>
      )}

      <p className="text-xs text-center text-[var(--color-text-muted)]">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-[var(--color-brand)] hover:underline">
          Log in
        </Link>
      </p>
      <p className="text-[11px] text-center text-[var(--color-text-muted)] flex items-center justify-center gap-1">
        <Lock aria-hidden="true" className="h-3 w-3" />
        Encrypted password hashing &amp; session protection
      </p>
    </div>
  );
}
