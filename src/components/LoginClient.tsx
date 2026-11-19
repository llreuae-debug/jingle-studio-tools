"use client";

import React, { useEffect, useId, useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Check, Copy, ExternalLink, Lock } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import { Logo } from "@/components/Logo";
import { sanitizeReturnPath } from "@/lib/safe-redirect";

const LOGIN_COPY = {
  en: {
    headline: "Welcome back",
    subhead: "Sign in to sign files, manage credits and view your history.",
    googleBtn: "Continue with Google",
    googleLoading: "Connecting to Google…",
    googleNotConfigured: "Google sign-in is not configured on this server yet.",
    orEmail: "Or continue with email",
    emailBtn: "Continue with Email",
    inAppTitle: "Google sign-in needs your regular browser.",
    copyLink: "Copy link",
    copied: "Copied",
    openInBrowser: "Open in browser",
    termsPrefix: "By continuing, you agree to our",
    terms: "Terms",
    and: "and",
    privacy: "Privacy Policy",
    errors: {
      Cancelled: "Google sign-in was cancelled. You can try again.",
      AccessDenied: "Google sign-in was cancelled. You can try again.",
      Unverified: "Please use a Google account with a verified email address.",
      Disabled: "This account is unavailable. Contact support for help.",
      LinkRequired: "Verify your existing account before connecting Google.",
      Other: "We could not sign you in. Please try again.",
    },
  },
  id: {
    headline: "Selamat datang kembali",
    subhead: "Masuk untuk menandatangani file, mengelola kredit, dan melihat riwayat Anda.",
    googleBtn: "Lanjutkan dengan Google",
    googleLoading: "Menghubungkan ke Google…",
    googleNotConfigured: "Masuk dengan Google belum dikonfigurasi di server ini.",
    orEmail: "Atau lanjutkan dengan email",
    emailBtn: "Lanjutkan dengan Email",
    inAppTitle: "Masuk dengan Google memerlukan browser reguler Anda.",
    copyLink: "Salin tautan",
    copied: "Disalin",
    openInBrowser: "Buka di browser",
    termsPrefix: "Dengan melanjutkan, Anda menyetujui",
    terms: "Ketentuan",
    and: "dan",
    privacy: "Kebijakan Privasi",
    errors: {
      Cancelled: "Masuk dengan Google dibatalkan. Anda dapat mencoba lagi.",
      AccessDenied: "Masuk dengan Google dibatalkan. Anda dapat mencoba lagi.",
      Unverified: "Gunakan akun Google dengan alamat email yang terverifikasi.",
      Disabled: "Akun ini tidak tersedia. Hubungi dukungan untuk bantuan.",
      LinkRequired: "Verifikasi akun Anda yang ada sebelum menghubungkan Google.",
      Other: "Kami tidak dapat memasukkan Anda. Silakan coba lagi.",
    },
  },
};

function detectInAppBrowser(ua: string): boolean {
  return /Instagram|FBAN|FBAV|TikTok|BytedanceWebview|Musical_ly|Line\/|;\s*wv\)/i.test(ua);
}

function mapErrorCode(code: string | null, msgs: typeof LOGIN_COPY.en.errors): string | null {
  if (!code) return null;
  if (code === "AccessDenied" || code === "Cancelled") return msgs.Cancelled;
  if (code === "Unverified") return msgs.Unverified;
  if (code === "Disabled") return msgs.Disabled;
  if (code === "LinkRequired") return msgs.LinkRequired;
  return msgs.Other;
}

export function LoginClient({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale } = useLanguage();
  const c = LOGIN_COPY[locale];

  const callbackUrl = sanitizeReturnPath(searchParams.get("callbackUrl"), "/app");
  const errorParam = searchParams.get("error");

  const emailId = useId();
  const passId = useId();
  const nameId = useId();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(() => mapErrorCode(errorParam, c.errors));
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [isInApp, setIsInApp] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setIsInApp(detectInAppBrowser(navigator.userAgent || ""));
  }, []);

  useEffect(() => {
    setError(mapErrorCode(errorParam, c.errors));
  }, [errorParam, c.errors]);

  const handleGoogleSignIn = async () => {
    if (googleLoading || submitting || !googleEnabled) return;
    setGoogleLoading(true);
    setError(null);
    try {
      await signIn("google", { callbackUrl });
    } catch {
      setError(c.errors.Other);
      setGoogleLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || googleLoading) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/email-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error || c.errors.Other);
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setError(c.errors.Other);
    } finally {
      setSubmitting(false);
    }
  };

  const copyCurrentUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="mx-auto max-w-md glass-surface p-6 sm:p-8 space-y-6">
      <div className="space-y-3">
        <Logo variant="horizontal" size="sm" theme="light" />
        <h1 className="text-2xl font-bold text-[var(--plum)]">{c.headline}</h1>
        <p className="text-xs text-[var(--plum-muted)]">{c.subhead}</p>
      </div>

      {isInApp && (
        <div
          role="alert"
          className="rounded-[16px] border border-[var(--color-brand-line)] bg-[var(--warm-peach)]/70 p-4 text-xs text-[var(--espresso-black)] space-y-3"
        >
          <p className="font-semibold">{c.inAppTitle}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void copyCurrentUrl()}
              className="inline-flex items-center gap-1.5 btn-plum px-3.5 py-1.5 font-semibold"
            >
              {copied ? <Check aria-hidden="true" className="h-3.5 w-3.5" /> : <Copy aria-hidden="true" className="h-3.5 w-3.5" />}
              {copied ? c.copied : c.copyLink}
            </button>
            <a
              href={typeof window !== "undefined" ? window.location.href : "/login"}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 btn-mint px-3.5 py-1.5 font-semibold"
            >
              <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
              {c.openInBrowser}
            </a>
          </div>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-[16px] border border-[#fb2c36]/30 bg-rose-50 p-3 text-xs text-[#b91c1c] flex items-center gap-2"
        >
          <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0 text-[#fb2c36]" />
          <span>{error}</span>
        </div>
      )}

      {/* Official Google Sign-In Button */}
      <div className="space-y-2">
        <button
          type="button"
          disabled={!googleEnabled || googleLoading || submitting || isInApp}
          onClick={() => void handleGoogleSignIn()}
          className="w-full min-h-[44px] inline-flex items-center justify-center gap-3 rounded-full border border-black/10 bg-white px-4 py-2.5 text-sm font-medium text-[var(--espresso-black)] shadow-[var(--shadow-1)] hover:bg-[var(--warm-peach)]/60 hover:border-[var(--color-brand-line)] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150"
        >
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18">
            <path
              fill="#4285F4"
              d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
            />
            <path
              fill="#34A853"
              d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
            />
            <path
              fill="#FBBC05"
              d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
            />
            <path
              fill="#EA4335"
              d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
            />
          </svg>
          <span>{googleLoading ? c.googleLoading : c.googleBtn}</span>
        </button>
        {!googleEnabled && (
          <p className="text-[11px] text-center text-[var(--plum-muted)]">
            {c.googleNotConfigured}
          </p>
        )}
      </div>

      <div className="relative flex items-center py-1">
        <div className="flex-grow border-t border-[var(--border)]" />
        <span className="mx-3 text-[11px] font-medium text-[var(--color-text-muted)]">{c.orEmail}</span>
        <div className="flex-grow border-t border-[var(--border)]" />
      </div>

      <form onSubmit={handleEmailSubmit} className="space-y-4">
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

        <div className="flex items-center justify-between text-xs pt-1">
          <Link
            href="/forgot-password"
            className="font-medium text-[var(--color-brand)] hover:underline"
          >
            Forgot password?
          </Link>
          <Link
            href="/signup"
            className="font-medium text-[var(--color-brand)] hover:underline"
          >
            Create an account
          </Link>
        </div>

        <button
          type="submit"
          disabled={submitting || googleLoading}
          className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 btn-plum px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
        >
          <Lock aria-hidden="true" className="h-4 w-4" />
          {submitting ? "Signing in…" : c.emailBtn}
        </button>
      </form>

      <p className="text-[11px] text-center text-[var(--plum-muted)]">
        {c.termsPrefix}{" "}
        <Link href="/terms" className="underline text-[var(--plum)] font-medium">
          {c.terms}
        </Link>{" "}
        {c.and}{" "}
        <Link href="/privacy" className="underline text-[var(--plum)] font-medium">
          {c.privacy}
        </Link>
        .
      </p>
    </div>
  );
}
