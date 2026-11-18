"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, Menu, MessageCircle, X } from "lucide-react";
import { GlassTabs, type GlassTabItem } from "./GlassTabs";
import { useLanguage } from "./LanguageProvider";
import { Logo } from "./Logo";

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "923138654411";

const MAIN_TABS: GlassTabItem[] = [
  { id: "check", label: "Check", href: "/tools/content-credentials-check" },
  { id: "sign", label: "Sign", href: "/tools/ai-disclosure-signer" },
  { id: "proof", label: "Proof", href: "/app" },
  { id: "pricing", label: "Pricing", href: "/pricing" },
];

const TOOL_MENU_LINKS = [
  { href: "/tools/content-credentials-check", label: "Content Credentials Check" },
  { href: "/tools/ai-disclosure-signer", label: "AI Disclosure Signer" },
  { href: "/tools/instagram-post-check", label: "Instagram Post Check" },
  { href: "/tools/instagram-story-check", label: "Instagram Story Check" },
  { href: "/tools/instagram-reels-check", label: "Instagram Reels Check" },
  { href: "/tools/tiktok-ai-label-check", label: "TikTok AI Label Check" },
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
  const [optimisticTabId, setOptimisticTabId] = useState<string | null>(null);

  const routeTabId = useMemo(() => {
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

  React.useEffect(() => {
    setOptimisticTabId(null);
  }, [pathname]);

  const activeTabId = optimisticTabId || routeTabId;

  const handleTabSelect = (tab: GlassTabItem) => {
    setOptimisticTabId(tab.id);
    if (tab.href) {
      router.push(tab.href);
    }
  };

  return (
    <header className="sticky top-0 z-40 px-4 sm:px-6 pt-3">
      <div className="mx-auto max-w-6xl glass-surface px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold text-[var(--plum)] tracking-tight"
        >
          <Logo variant="horizontal" size="sm" theme="light" />
        </Link>

        <nav aria-label="Primary" className="hidden lg:flex items-center gap-4 text-xs font-semibold">
          <details className="relative group">
            <summary className="list-none cursor-pointer inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[var(--plum)] hover:bg-[var(--mint)]">
              <span>{t.nav.tools}</span>
              <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" />
            </summary>
            <div className="absolute left-0 mt-2 w-60 glass-surface p-2 z-50 space-y-1">
              {TOOL_MENU_LINKS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block rounded-full px-3 py-2 text-xs font-medium text-[var(--plum)] hover:bg-[var(--mint)]"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </details>
          <Link href="/how-it-works" className="text-[var(--plum)] hover:underline">
            How it works
          </Link>
          <Link href="/pricing" className="text-[var(--plum)] hover:underline">
            {t.nav.pricing}
          </Link>
          <Link href="/learn" className="text-[var(--plum)] hover:underline">
            Learn
          </Link>
          <Link href="/developers" className="text-[var(--plum)] hover:underline">
            Developers
          </Link>
        </nav>

        <div className="flex items-center gap-2">
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
            <Link href="/app" className="hidden sm:inline-flex items-center btn-mint px-3.5 py-1.5 text-xs font-semibold">
              {userEmail}
            </Link>
          ) : (
            <Link
              href="/login"
              className="hidden sm:inline-flex items-center px-3 py-1.5 text-xs font-semibold text-[var(--plum)] hover:underline"
            >
              Log in
            </Link>
          )}

          <Link
            href="/tools/content-credentials-check"
            className="hidden sm:inline-flex items-center btn-plum px-3.5 py-1.5 text-xs font-semibold"
          >
            Start free
          </Link>

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

      {/* Main GlassTabs */}
      <div className="mx-auto max-w-6xl mt-2.5 flex justify-center">
        <GlassTabs
          tabs={MAIN_TABS}
          activeId={activeTabId}
          onSelect={handleTabSelect}
          ariaLabel="Main tools navigation"
        />
      </div>

      {mobileOpen && (
        <nav
          aria-label="Mobile"
          className="lg:hidden mx-auto max-w-6xl mt-2 glass-surface p-4 space-y-2 text-sm"
        >
          <div className="px-2 pb-2 border-b border-[rgba(63,17,61,0.12)]">
            <Logo variant="horizontal" size="sm" theme="light" />
          </div>
          {[
            { href: "/tools", label: "Tools" },
            { href: "/how-it-works", label: "How it works" },
            { href: "/pricing", label: "Pricing" },
            { href: "/learn", label: "Learn" },
            { href: "/developers", label: "Developers" },
            { href: userEmail ? "/app" : "/login", label: userEmail ? userEmail : "Log in" },
            { href: "/tools/content-credentials-check", label: "Start free" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className="block rounded-full px-4 py-2 font-medium text-[var(--plum)] hover:bg-[var(--mint)]"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}

export function AppFooter() {
  const { t } = useLanguage();

  return (
    <footer className="relative z-10 px-4 sm:px-6 pb-8 pt-6">
      <div className="mx-auto max-w-6xl glass-surface p-6 sm:p-8 text-xs text-[var(--plum-muted)] space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
          <div className="space-y-2">
            <h2 className="font-bold text-[var(--plum)]">Tools</h2>
            <ul className="space-y-1.5">
              {TOOL_MENU_LINKS.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-[var(--plum)] hover:underline">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <h2 className="font-bold text-[var(--plum)]">Learn</h2>
            <ul className="space-y-1.5">
              <li>
                <Link href="/blog" className="text-[var(--plum)] hover:underline">
                  Blog
                </Link>
              </li>
              <li>
                <Link href="/learn/content-credentials" className="text-[var(--plum)] hover:underline">
                  What are Content Credentials
                </Link>
              </li>
              <li>
                <Link href="/learn/synthid" className="text-[var(--plum)] hover:underline">
                  What is SynthID
                </Link>
              </li>
              <li>
                <Link href="/how-it-works" className="text-[var(--plum)] hover:underline">
                  How it works
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-[var(--plum)] hover:underline">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/faq" className="text-[var(--plum)] hover:underline">
                  FAQ
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <h2 className="font-bold text-[var(--plum)]">Developers</h2>
            <ul className="space-y-1.5">
              <li>
                <Link href="/developers" className="text-[var(--plum)] hover:underline">
                  Overview
                </Link>
              </li>
              <li>
                <Link href="/developers/rest-api" className="text-[var(--plum)] hover:underline">
                  REST API
                </Link>
              </li>
              <li>
                <Link href="/developers/mcp" className="text-[var(--plum)] hover:underline">
                  MCP server
                </Link>
              </li>
              <li>
                <Link href="/developers/docs" className="text-[var(--plum)] hover:underline">
                  API docs
                </Link>
              </li>
              <li>
                <Link href="/app/developers" className="text-[var(--plum)] hover:underline">
                  API keys
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <h2 className="font-bold text-[var(--plum)]">Company</h2>
            <ul className="space-y-1.5">
              <li>
                <Link href="/" className="text-[var(--plum)] hover:underline">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-[var(--plum)] hover:underline">
                  Contact
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-[var(--plum)] hover:underline">
                  Privacy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-[var(--plum)] hover:underline">
                  Terms
                </Link>
              </li>
              <li>
                <Link href="/acceptable-use" className="text-[var(--plum)] hover:underline">
                  Acceptable use
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-[rgba(63,17,61,0.12)]">
          <Logo variant="horizontal" size="sm" theme="light" />
          <p className="font-semibold text-[var(--plum)]">{t.footer.tagline}</p>
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
