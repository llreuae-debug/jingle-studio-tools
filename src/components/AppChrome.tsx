"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, MessageCircle, ShieldCheck, X } from "lucide-react";
import { GlassTabs, type GlassTabItem } from "./GlassTabs";
import { useLanguage } from "./LanguageProvider";

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "923138654411";

const MAIN_TABS: GlassTabItem[] = [
  { id: "check", label: "Check", href: "/tools/content-credentials-check" },
  { id: "sign", label: "Sign", href: "/tools/ai-disclosure-signer" },
  { id: "proof", label: "Proof", href: "/app" },
  { id: "pricing", label: "Pricing", href: "/pricing" },
];

export function AppHeader({
  userEmail,
  userRole,
}: {
  userEmail?: string | null;
  userRole?: string | null;
}) {
  const { locale, setLocale, t } = useLanguage();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  const activeTabId = useMemo(() => {
    if (!pathname) return "check";
    if (pathname.startsWith("/tools/ai-disclosure-signer") || pathname.startsWith("/app/sign")) {
      return "sign";
    }
    if (pathname.startsWith("/app") || pathname.startsWith("/p/")) {
      return "proof";
    }
    if (pathname.startsWith("/pricing")) {
      return "pricing";
    }
    return "check";
  }, [pathname]);

  const handleTabSelect = (tab: GlassTabItem) => {
    if (tab.href) {
      router.push(tab.href);
    }
  };

  return (
    <header className="sticky top-0 z-40 px-4 sm:px-6 pt-3">
      <div className="mx-auto max-w-6xl glass-surface px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/tools"
          className="flex items-center gap-2.5 font-semibold text-[var(--plum)] tracking-tight"
        >
          <span
            aria-hidden="true"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--plum)] text-[var(--lime)]"
          >
            <ShieldCheck className="h-4 w-4" />
          </span>
          <span>Jingle Studio Tools</span>
        </Link>

        <div className="hidden lg:block">
          <GlassTabs
            tabs={MAIN_TABS}
            activeId={activeTabId}
            onSelect={handleTabSelect}
            ariaLabel="Main tools navigation"
          />
        </div>

        <div className="flex items-center gap-2.5">
          {userRole === "admin" && (
            <Link
              href="/admin"
              className="hidden sm:inline-flex items-center rounded-full bg-[var(--mint)] px-3 py-1.5 text-xs font-semibold text-[var(--plum)]"
            >
              {t.nav.admin}
            </Link>
          )}

          <div
            role="group"
            aria-label="Language switch"
            className="inline-flex rounded-full border border-[rgba(63,17,61,0.16)] bg-[var(--mint)]/70 p-0.5 text-xs font-semibold"
          >
            <button
              type="button"
              data-affilora-lang="en"
              aria-pressed={locale === "en"}
              onClick={() => setLocale("en")}
              className={`rounded-full px-2.5 py-1 transition-colors ${
                locale === "en"
                  ? "bg-[var(--plum)] text-[var(--cream)]"
                  : "text-[var(--plum)]"
              }`}
            >
              EN
            </button>
            <button
              type="button"
              data-affilora-lang="id"
              aria-pressed={locale === "id"}
              onClick={() => setLocale("id")}
              className={`rounded-full px-2.5 py-1 transition-colors ${
                locale === "id"
                  ? "bg-[var(--plum)] text-[var(--cream)]"
                  : "text-[var(--plum)]"
              }`}
            >
              ID
            </button>
          </div>

          {userEmail ? (
            <Link
              href="/app"
              className="hidden sm:inline-flex items-center btn-mint px-3.5 py-1.5 text-xs font-semibold"
            >
              {userEmail}
            </Link>
          ) : (
            <Link
              href="/login"
              className="hidden sm:inline-flex items-center btn-plum px-4 py-2 text-xs font-semibold"
            >
              {t.nav.signIn}
            </Link>
          )}

          <button
            type="button"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
            className="lg:hidden rounded-full p-2 text-[var(--plum)] hover:bg-[var(--mint)]"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile / tablet GlassTabs + drawer */}
      <div className="lg:hidden mx-auto max-w-6xl mt-2 flex justify-center">
        <GlassTabs
          tabs={MAIN_TABS}
          activeId={activeTabId}
          onSelect={handleTabSelect}
          ariaLabel="Mobile tools navigation"
        />
      </div>

      {mobileOpen && (
        <nav
          aria-label="Mobile"
          className="lg:hidden mx-auto max-w-6xl mt-2 glass-surface p-4 space-y-1.5 text-sm"
        >
          <Link
            href="/tools"
            onClick={() => setMobileOpen(false)}
            className="block rounded-full px-4 py-2 font-medium text-[var(--plum)] hover:bg-[var(--mint)]"
          >
            {t.nav.tools}
          </Link>
          <Link
            href={userEmail ? "/app" : "/login"}
            onClick={() => setMobileOpen(false)}
            className="block rounded-full px-4 py-2 font-semibold text-[var(--plum)] hover:bg-[var(--mint)]"
          >
            {userEmail ? userEmail : t.nav.signIn}
          </Link>
        </nav>
      )}
    </header>
  );
}

export function AppFooter() {
  const { t } = useLanguage();

  return (
    <footer className="relative z-10 px-4 sm:px-6 pb-8 pt-4">
      <div className="mx-auto max-w-6xl glass-surface p-6 text-xs text-[var(--plum-muted)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p className="font-semibold text-[var(--plum)]">{t.footer.tagline}</p>
          <nav aria-label="Legal">
            <ul className="flex flex-wrap items-center gap-4">
              <li>
                <Link href="/privacy" className="text-[var(--plum)] hover:underline">
                  {t.footer.privacy}
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-[var(--plum)] hover:underline">
                  {t.footer.terms}
                </Link>
              </li>
              <li>
                <Link href="/acceptable-use" className="text-[var(--plum)] hover:underline">
                  {t.footer.acceptableUse}
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-3 border-t border-[rgba(63,17,61,0.12)]">
          <p>{t.footer.localNotice}</p>
          <p>{t.footer.disclaimer}</p>
        </div>
      </div>

      <a
        href={`https://wa.me/${WHATSAPP_NUMBER}`}
        target="_blank"
        rel="noreferrer"
        aria-label={t.whatsapp.label}
        className="fixed bottom-5 right-5 z-30 inline-flex items-center gap-2 btn-lime px-4 py-2.5 text-xs font-semibold shadow-lg"
      >
        <MessageCircle aria-hidden="true" className="h-4 w-4 text-[var(--plum)]" />
        <span className="hidden sm:inline text-[var(--plum)]">{t.whatsapp.label}</span>
      </a>
    </footer>
  );
}
