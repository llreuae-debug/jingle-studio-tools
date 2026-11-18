"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, MessageCircle, ShieldCheck, X } from "lucide-react";
import { useLanguage } from "./LanguageProvider";

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "923138654411";

export function AppHeader({
  userEmail,
  userRole,
}: {
  userEmail?: string | null;
  userRole?: string | null;
}) {
  const { locale, setLocale, t } = useLanguage();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { href: "/tools", label: t.nav.tools },
    { href: "/tools/ai-disclosure-signer", label: "Signer" },
    { href: "/pricing", label: t.nav.pricing },
    { href: "/app", label: t.nav.dashboard },
    ...(userRole === "admin" ? [{ href: "/admin", label: t.nav.admin }] : []),
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[var(--color-midnight)] text-[var(--color-on-dark)]">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <Link
          href="/tools"
          className="flex items-center gap-2.5 font-semibold text-white tracking-tight"
        >
          <span
            aria-hidden="true"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-blue)] text-white"
          >
            <ShieldCheck className="h-5 w-5" />
          </span>
          <span>Jingle Studio Tools</span>
        </Link>

        <nav aria-label="Primary" className="hidden md:flex items-center gap-6 text-sm font-medium">
          <ul className="flex items-center gap-6">
            {navLinks.map((item) => {
              const active = pathname === item.href || pathname?.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`transition-colors ${
                      active ? "text-white font-semibold" : "text-slate-300 hover:text-white"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-3">
          <div
            role="group"
            aria-label="Language switch"
            className="inline-flex rounded-lg border border-slate-700 bg-[var(--color-navy)] p-0.5 text-xs font-medium"
          >
            <button
              type="button"
              data-affilora-lang="en"
              aria-pressed={locale === "en"}
              onClick={() => setLocale("en")}
              className={`rounded-md px-2 py-1 transition-colors ${
                locale === "en"
                  ? "bg-[var(--color-blue)] text-white"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              EN
            </button>
            <button
              type="button"
              data-affilora-lang="id"
              aria-pressed={locale === "id"}
              onClick={() => setLocale("id")}
              className={`rounded-md px-2 py-1 transition-colors ${
                locale === "id"
                  ? "bg-[var(--color-blue)] text-white"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              ID
            </button>
          </div>

          {userEmail ? (
            <Link
              href="/app"
              className="hidden sm:inline-flex items-center rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
            >
              {userEmail}
            </Link>
          ) : (
            <Link
              href="/login"
              className="hidden sm:inline-flex items-center rounded-lg bg-[var(--color-blue)] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--color-electric)]"
            >
              {t.nav.signIn}
            </Link>
          )}

          <button
            type="button"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
            className="md:hidden rounded-lg p-2 text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav
          aria-label="Mobile"
          className="md:hidden border-t border-slate-800 bg-[var(--color-navy)] px-4 py-3 space-y-2"
        >
          <ul className="space-y-1.5 text-sm">
            {navLinks.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-lg px-3 py-2 text-slate-200 hover:bg-slate-800 hover:text-white"
                >
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              <Link
                href={userEmail ? "/app" : "/login"}
                onClick={() => setMobileOpen(false)}
                className="block rounded-lg px-3 py-2 font-semibold text-[var(--color-electric)] hover:bg-slate-800"
              >
                {userEmail ? userEmail : t.nav.signIn}
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}

export function AppFooter() {
  const { t } = useLanguage();

  return (
    <footer className="border-t border-[var(--color-border)] bg-white py-8 text-xs text-[var(--color-muted)]">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p className="font-medium text-[var(--color-ink)]">{t.footer.tagline}</p>
          <nav aria-label="Legal">
            <ul className="flex flex-wrap items-center gap-4">
              <li>
                <Link href="/privacy" className="hover:text-[var(--color-blue)] underline">
                  {t.footer.privacy}
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-[var(--color-blue)] underline">
                  {t.footer.terms}
                </Link>
              </li>
              <li>
                <Link href="/acceptable-use" className="hover:text-[var(--color-blue)] underline">
                  {t.footer.acceptableUse}
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-3 border-t border-[var(--color-border)]">
          <p>{t.footer.localNotice}</p>
          <p>{t.footer.disclaimer}</p>
        </div>
      </div>

      <a
        href={`https://wa.me/${WHATSAPP_NUMBER}`}
        target="_blank"
        rel="noreferrer"
        aria-label={t.whatsapp.label}
        className="fixed bottom-5 right-5 z-30 inline-flex items-center gap-2 rounded-full bg-[#16865B] px-4 py-2.5 text-xs font-semibold text-white shadow-lg hover:opacity-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#16865B]"
      >
        <MessageCircle aria-hidden="true" className="h-4 w-4" />
        <span className="hidden sm:inline">{t.whatsapp.label}</span>
      </a>
    </footer>
  );
}
