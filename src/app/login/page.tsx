"use client";

import React, { Suspense, useId, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Lock } from "lucide-react";
import { Logo } from "@/components/Logo";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/app";

  const emailId = useId();
  const passId = useId();
  const nameId = useId();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await signIn("credentials", {
        email,
        password,
        name,
        redirect: false,
        callbackUrl,
      });
      if (res?.error) {
        setError("Invalid email or password (minimum 6 characters).");
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setError("Could not sign in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-md glass-surface p-6 sm:p-8 space-y-6">
      <div className="space-y-3">
        <Logo variant="horizontal" size="sm" theme="light" />
        <h1 className="text-2xl font-bold text-[var(--plum)]">Sign in or create account</h1>
        <p className="text-xs text-[var(--plum-muted)]">
          New accounts automatically receive a personal workspace with 10 free starter credits.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-[20px] border border-[#a32032]/30 bg-rose-100/90 p-3 text-xs text-[var(--plum)] flex items-center gap-2"
        >
          <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0 text-[#a32032]" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label htmlFor={emailId} className="block text-xs font-medium text-[var(--plum)]">
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

        <div className="space-y-1">
          <label htmlFor={passId} className="block text-xs font-medium text-[var(--plum)]">
            Password (min 6 characters)
          </label>
          <input
            id={passId}
            type="password"
            required
            minLength={6}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full glass-input px-3.5 py-2.5 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor={nameId} className="block text-xs font-medium text-[var(--plum)]">
            Name (for new accounts, optional)
          </label>
          <input
            id={nameId}
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full glass-input px-3.5 py-2.5 text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full inline-flex items-center justify-center gap-2 btn-plum px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
        >
          <Lock aria-hidden="true" className="h-4 w-4" />
          {submitting ? "Signing in…" : "Continue with Email"}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="py-12 text-center text-sm text-[var(--color-muted)]">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
