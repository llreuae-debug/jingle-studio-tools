"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, Menu, MessageCircle, X } from "lucide-react";
import { AccountMenu } from "./AccountMenu";
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
  { href: "/tools", label: "All Media Tools" },
  { href: "/tools/media-metadata-inspector", label: "Media Metadata Inspector" },
  { href: "/tools/exif-viewer", label: "Image EXIF Viewer" },
  { href: "/tools/content-credentials-check", label: "Content Credentials Check" },
  { href: "/tools/file-integrity-checker", label: "File Integrity Checker" },
  { href: "/tools/image-converter", label: "Image Format Converter" },
  { href: "/tools/image-resizer", label: "Image Resizer" },
  { href: "/tools/image-compressor", label: "Image Compression Tool" },
  { href: "/tools/video-metadata-inspector", label: "Video Metadata Inspector" },
  { href: "/tools/privacy-metadata-cleaner", label: "Privacy Metadata Cleaner" },
  { href: "/tools/report-generator", label: "Inspection Report Generator" },
  { href: "/tools/ai-disclosure-signer", label: "AI Disclosure Signer" },
  { href: "/tools/instagram-post-check", label: "Instagram Post Check" },
  { href: "/tools/instagram-story-check", label: "Instagram Story Check" },
  { href: "/tools/instagram-reels-check", label: "Instagram Reels Check" },
  { href: "/tools/tiktok-ai-label-check", label: "TikTok AI Label Check" },
];

export function AppHeader({
  userEmail,
  userName,
  userImage,
  userRole,
}: {
  userEmail?: string | null;
  userName?: string | null;
  userImage?: string | null;
  userRole?: string | null;
}) {
  const { locale, setLocale, t } = useLanguage();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [optimisticTabId, setOptimisticTabId] = useState<string | null>(null);
  const toolsMenuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (toolsMenuRef.current) toolsMenuRef.current.open = false;
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (
        toolsMenuRef.current?.open &&
        !toolsMenuRef.current.contains(e.target as Node)
      ) {
        toolsMenuRef.current.open = false;
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (toolsMenuRef.current) toolsMenuRef.current.open = false;
        setMobileOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

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
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-[var(--border)] shadow-[var(--shadow-1)]">
      <div className="mx-auto max-w-[1120px] min-h-[64px] px-4 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/tools"
          className="flex items-center gap-2 font-semibold text-[var(--color-ink)] tracking-tight"
        >
          <Logo variant="horizontal" size="sm" theme="light" />
        </Link>

        <nav aria-label="Primary" className="hidden lg:flex items-center gap-6 text-sm font-medium">
          <details ref={toolsMenuRef} className="relative group">
            <summary className="list-none cursor-pointer inline-flex items-center gap-1 rounded-[10px] px-2.5 py-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-ink)] hover:bg-[var(--color-brand-soft)] transition-colors duration-150">
              <span>{t.nav.tools}</span>
              <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" />
            </summary>
            <div className="absolute left-0 mt-2 w-64 rounded-[14px] border border-[var(--border)] bg-white shadow-[var(--shadow-4)] p-1.5 z-50 space-y-1">
              {TOOL_MENU_LINKS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => {
                    if (toolsMenuRef.current) toolsMenuRef.current.open = false;
                  }}
                  className="block rounded-[10px] px-3 py-2 text-xs font-medium text-[var(--color-ink)] hover:bg-[var(--color-brand-soft)] hover:text-[var(--color-brand)] transition-colors duration-150"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </details>
          <Link href="/how-it-works" className="text-[var(--color-text-muted)] hover:text-[var(--color-ink)] transition-colors duration-150">
            How it works
          </Link>
          <Link href="/pricing" className="text-[var(--color-text-muted)] hover:text-[var(--color-ink)] transition-colors duration-150">
            {t.nav.pricing}
          </Link>
          <Link href="/learn" className="text-[var(--color-text-muted)] hover:text-[var(--color-ink)] transition-colors duration-150">
            Learn
          </Link>
          <Link href="/developers" className="text-[var(--color-text-muted)] hover:text-[var(--color-ink)] transition-colors duration-150">
            Developers
          </Link>
        </nav>

        <div className="flex items-center gap-2.5">
          {userRole === "admin" && (
            <Link
              href="/admin"
              className="hidden sm:inline-flex items-center rounded-[10px] border border-[var(--color-brand-line)] bg-[var(--color-brand-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--color-brand)]"
            >
              {t.nav.admin}
            </Link>
          )}

          <div
            role="group"
            aria-label="Language switch"
            className="inline-flex rounded-[10px] border border-[var(--border)] bg-[var(--color-surface-muted)] p-0.5 text-xs font-semibold"
          >
            <button
              type="button"
              data-affilora-lang="en"
              aria-pressed={locale === "en"}
              onClick={() => setLocale("en")}
              className={`rounded-[8px] px-2.5 py-1 transition-all duration-150 ${
                locale === "en"
                  ? "bg-white text-[var(--color-ink)] shadow-[var(--shadow-1)]"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-ink)]"
              }`}
            >
              EN
            </button>
            <button
              type="button"
              data-affilora-lang="id"
              aria-pressed={locale === "id"}
              onClick={() => setLocale("id")}
              className={`rounded-[8px] px-2.5 py-1 transition-all duration-150 ${
                locale === "id"
                  ? "bg-white text-[var(--color-ink)] shadow-[var(--shadow-1)]"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-ink)]"
              }`}
            >
              ID
            </button>
          </div>

          {userEmail ? (
            <AccountMenu
              user={{ email: userEmail, name: userName, image: userImage }}
            />
          ) : (
            <Link
              href="/login"
              className="hidden sm:inline-flex items-center px-3 py-1.5 text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-ink)] transition-colors duration-150"
            >
              Log in
            </Link>
          )}

          {!userEmail && (
            <Link
              href="/signup"
              className="hidden sm:inline-flex items-center btn-plum px-4 py-2 text-xs font-semibold"
            >
              Sign up free
            </Link>
          )}

          <button
            type="button"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
            className="lg:hidden rounded-[10px] p-2 text-[var(--color-ink)] hover:bg-[var(--color-surface-muted)] transition-colors duration-150"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Main Segmented Tabs */}
      <div className="border-t border-[var(--border)]/70 py-2.5 bg-white/80 flex justify-center px-4">
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
          className="lg:hidden border-t border-[var(--border)] bg-white px-4 py-4 space-y-1.5 text-sm"
        >
          <div className="px-2 pb-2.5 border-b border-[var(--border)]">
            <Logo variant="horizontal" size="sm" theme="light" />
          </div>
          {[
            { href: "/tools", label: "Tools" },
            { href: "/tools/content-credentials-check", label: "Content Credentials Check" },
            { href: "/tools/ai-disclosure-signer", label: "AI Disclosure Signer" },
            { href: "/verify", label: "Verify File or URL" },
            { href: "/how-it-works", label: "How it works" },
            { href: "/pricing", label: "Pricing" },
            { href: "/learn", label: "Learn" },
            { href: "/blog", label: "Blog" },
            { href: "/faq", label: "FAQ" },
            { href: "/developers", label: "Developers" },
            ...(userRole === "admin" ? [{ href: "/admin", label: t.nav.admin }] : []),
            { href: userEmail ? "/app" : "/login", label: userEmail ? userEmail : "Log in" },
            { href: userEmail ? "/app/sign" : "/signup", label: userEmail ? "Sign files" : "Sign up free" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className="block rounded-[10px] px-3.5 py-2 font-medium text-[var(--color-ink)] hover:bg-[var(--color-brand-soft)] hover:text-[var(--color-brand)] transition-colors duration-150"
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
    <footer className="relative z-10 border-t border-[var(--border)] bg-white text-[var(--color-text-muted)] mt-20">
      <div className="mx-auto max-w-[1120px] px-4 sm:px-6 lg:px-8 py-12 text-xs space-y-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8">
          <div className="space-y-3">
            <h2 className="font-semibold text-sm text-[var(--color-ink)]">Tools</h2>
            <ul className="space-y-2">
              {TOOL_MENU_LINKS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="inline-block text-[var(--color-text-muted)] hover:text-[var(--color-ink)] hover:underline transition-colors duration-150"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-3">
            <h2 className="font-semibold text-sm text-[var(--color-ink)]">Learn</h2>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/blog"
                  className="inline-block text-[var(--color-text-muted)] hover:text-[var(--color-ink)] hover:underline transition-colors duration-150"
                >
                  Blog
                </Link>
              </li>
              <li>
                <Link
                  href="/learn/content-credentials"
                  className="inline-block text-[var(--color-text-muted)] hover:text-[var(--color-ink)] hover:underline transition-colors duration-150"
                >
                  What are Content Credentials
                </Link>
              </li>
              <li>
                <Link
                  href="/learn/synthid"
                  className="inline-block text-[var(--color-text-muted)] hover:text-[var(--color-ink)] hover:underline transition-colors duration-150"
                >
                  What is SynthID
                </Link>
              </li>
              <li>
                <Link
                  href="/how-it-works"
                  className="inline-block text-[var(--color-text-muted)] hover:text-[var(--color-ink)] hover:underline transition-colors duration-150"
                >
                  How it works
                </Link>
              </li>
              <li>
                <Link
                  href="/pricing"
                  className="inline-block text-[var(--color-text-muted)] hover:text-[var(--color-ink)] hover:underline transition-colors duration-150"
                >
                  Pricing
                </Link>
              </li>
              <li>
                <Link
                  href="/faq"
                  className="inline-block text-[var(--color-text-muted)] hover:text-[var(--color-ink)] hover:underline transition-colors duration-150"
                >
                  FAQ
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h2 className="font-semibold text-sm text-[var(--color-ink)]">Developers</h2>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/developers"
                  className="inline-block text-[var(--color-text-muted)] hover:text-[var(--color-ink)] hover:underline transition-colors duration-150"
                >
                  Overview
                </Link>
              </li>
              <li>
                <Link
                  href="/developers/rest-api"
                  className="inline-block text-[var(--color-text-muted)] hover:text-[var(--color-ink)] hover:underline transition-colors duration-150"
                >
                  REST API
                </Link>
              </li>
              <li>
                <Link
                  href="/developers/mcp"
                  className="inline-block text-[var(--color-text-muted)] hover:text-[var(--color-ink)] hover:underline transition-colors duration-150"
                >
                  MCP server
                </Link>
              </li>
              <li>
                <Link
                  href="/developers/docs"
                  className="inline-block text-[var(--color-text-muted)] hover:text-[var(--color-ink)] hover:underline transition-colors duration-150"
                >
                  API docs
                </Link>
              </li>
              <li>
                <Link
                  href="/app/developers"
                  className="inline-block text-[var(--color-text-muted)] hover:text-[var(--color-ink)] hover:underline transition-colors duration-150"
                >
                  API keys
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h2 className="font-semibold text-sm text-[var(--color-ink)]">Company</h2>
            <ul className="space-y-2">
              <li>
                <Link
                  href="/tools"
                  className="inline-block text-[var(--color-text-muted)] hover:text-[var(--color-ink)] hover:underline transition-colors duration-150"
                >
                  Home
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="inline-block text-[var(--color-text-muted)] hover:text-[var(--color-ink)] hover:underline transition-colors duration-150"
                >
                  Contact
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="inline-block text-[var(--color-text-muted)] hover:text-[var(--color-ink)] hover:underline transition-colors duration-150"
                >
                  Privacy
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="inline-block text-[var(--color-text-muted)] hover:text-[var(--color-ink)] hover:underline transition-colors duration-150"
                >
                  Terms
                </Link>
              </li>
              <li>
                <Link
                  href="/acceptable-use"
                  className="inline-block text-[var(--color-text-muted)] hover:text-[var(--color-ink)] hover:underline transition-colors duration-150"
                >
                  Acceptable use
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-6 border-t border-[var(--border)]">
          <Logo variant="horizontal" size="sm" theme="light" />
          <p className="font-semibold text-[var(--color-ink)]">{t.footer.tagline}</p>
          <p>{t.footer.localNotice}</p>
          <p>{t.footer.disclaimer}</p>
        </div>
      </div>

      <a
        href={`https://wa.me/${WHATSAPP_NUMBER}`}
        target="_blank"
        rel="noreferrer"
        aria-label={t.whatsapp.label}
        className="fixed bottom-5 right-5 z-30 inline-flex items-center gap-2 rounded-full bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-hover)] px-4 py-2.5 text-xs font-semibold shadow-[var(--shadow-4)] transition-colors duration-150"
      >
        <MessageCircle aria-hidden="true" className="h-4 w-4 text-white" />
        <span className="hidden sm:inline text-white">{t.whatsapp.label}</span>
      </a>
    </footer>
  );
}
