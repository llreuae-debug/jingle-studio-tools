"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  BookOpen,
  Camera,
  ChevronDown,
  Clapperboard,
  Code2,
  Cpu,
  CreditCard,
  FileCheck2,
  FileSearch,
  FileSignature,
  FileText,
  Film,
  FolderCheck,
  Globe,
  HelpCircle,
  Home,
  KeyRound,
  LayoutGrid,
  Lock,
  Mail,
  Maximize2,
  Menu,
  MessageCircle,
  Minimize2,
  Scale,
  Share2,
  ShieldCheck,
  Sparkles,
  Terminal,
  X,
} from "lucide-react";
import { AccountMenu } from "./AccountMenu";
import { GlassTabs, type GlassTabItem } from "./GlassTabs";
import { useLanguage } from "./LanguageProvider";
import { Logo } from "./Logo";

const WHATSAPP_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "923138654411";

const MAIN_TABS: GlassTabItem[] = [
  {
    id: "check",
    label: "Check",
    href: "/tools/content-credentials-check",
    icon: <ShieldCheck className="h-3.5 w-3.5" />,
    tooltip: "Check C2PA Content Credentials",
  },
  {
    id: "sign",
    label: "Sign",
    href: "/tools/ai-disclosure-signer",
    icon: <FileSignature className="h-3.5 w-3.5" />,
    tooltip: "Sign & Disclose AI Work",
  },
  {
    id: "proof",
    label: "Proof",
    href: "/app",
    icon: <FolderCheck className="h-3.5 w-3.5" />,
    tooltip: "Saved Proof & History",
  },
  {
    id: "pricing",
    label: "Pricing",
    href: "/pricing",
    icon: <CreditCard className="h-3.5 w-3.5" />,
    tooltip: "Plans & Credits",
  },
];

const TOOLS_RIBBON_TABS: GlassTabItem[] = [
  {
    id: "all-tools",
    label: "All Tools",
    href: "/tools",
    icon: <LayoutGrid className="h-3.5 w-3.5" />,
    tooltip: "All Media Tools & Inspection Hub",
  },
  {
    id: "media-metadata-inspector",
    label: "Metadata",
    href: "/tools/media-metadata-inspector",
    icon: <FileSearch className="h-3.5 w-3.5" />,
    tooltip: "Media Metadata Inspector",
  },
  {
    id: "exif-viewer",
    label: "EXIF",
    href: "/tools/exif-viewer",
    icon: <Camera className="h-3.5 w-3.5" />,
    tooltip: "Image EXIF Viewer",
  },
  {
    id: "content-credentials-check",
    label: "C2PA",
    href: "/tools/content-credentials-check",
    icon: <ShieldCheck className="h-3.5 w-3.5" />,
    tooltip: "C2PA Credential Verifier",
  },
  {
    id: "file-integrity-checker",
    label: "Integrity",
    href: "/tools/file-integrity-checker",
    icon: <FileCheck2 className="h-3.5 w-3.5" />,
    tooltip: "File Integrity Checker (SHA-256)",
  },
  {
    id: "image-converter",
    label: "Converter",
    href: "/tools/image-converter",
    icon: <ArrowLeftRight className="h-3.5 w-3.5" />,
    tooltip: "Image Format Converter (PNG/JPG/WebP)",
  },
  {
    id: "image-resizer",
    label: "Resizer",
    href: "/tools/image-resizer",
    icon: <Maximize2 className="h-3.5 w-3.5" />,
    tooltip: "Image Resizer",
  },
  {
    id: "image-compressor",
    label: "Compress",
    href: "/tools/image-compressor",
    icon: <Minimize2 className="h-3.5 w-3.5" />,
    tooltip: "Image Compression Tool",
  },
  {
    id: "video-metadata-inspector",
    label: "Video",
    href: "/tools/video-metadata-inspector",
    icon: <Film className="h-3.5 w-3.5" />,
    tooltip: "Video Metadata Inspector",
  },
  {
    id: "privacy-metadata-cleaner",
    label: "Privacy Clean",
    href: "/tools/privacy-metadata-cleaner",
    icon: <Sparkles className="h-3.5 w-3.5" />,
    tooltip: "Privacy Metadata Cleaner",
  },
  {
    id: "report-generator",
    label: "Reports",
    href: "/tools/report-generator",
    icon: <FileText className="h-3.5 w-3.5" />,
    tooltip: "Media Inspection Report Generator (JSON & PDF)",
  },
  {
    id: "ai-disclosure-signer",
    label: "AI Signer",
    href: "/tools/ai-disclosure-signer",
    icon: <FileSignature className="h-3.5 w-3.5" />,
    tooltip: "AI Disclosure Signer",
  },
];

const TOOL_MENU_LINKS = [
  { href: "/tools", label: "All Media Tools", icon: LayoutGrid },
  { href: "/tools/media-metadata-inspector", label: "Media Metadata Inspector", icon: FileSearch },
  { href: "/tools/exif-viewer", label: "Image EXIF Viewer", icon: Camera },
  { href: "/tools/content-credentials-check", label: "Content Credentials Check", icon: ShieldCheck },
  { href: "/tools/file-integrity-checker", label: "File Integrity Checker", icon: FileCheck2 },
  { href: "/tools/video-metadata-inspector", label: "Video Metadata Inspector", icon: Film },
  { href: "/tools/privacy-metadata-cleaner", label: "Privacy Metadata Cleaner", icon: Sparkles },
  { href: "/tools/report-generator", label: "Inspection Report Generator", icon: FileText },
  { href: "/tools/ai-disclosure-signer", label: "AI Disclosure Signer", icon: FileSignature },
  { href: "/tools/image-converter", label: "Image Format Converter", icon: ArrowLeftRight },
  { href: "/tools/image-resizer", label: "Image Resizer", icon: Maximize2 },
  { href: "/tools/image-compressor", label: "Image Compression Tool", icon: Minimize2 },
  { href: "/tools/instagram-post-check", label: "Instagram Post Check", icon: Share2 },
  { href: "/tools/instagram-story-check", label: "Instagram Story Check", icon: Share2 },
  { href: "/tools/instagram-reels-check", label: "Instagram Reels Check", icon: Clapperboard },
  { href: "/tools/tiktok-ai-label-check", label: "TikTok AI Label Check", icon: Clapperboard },
  { href: "/tools/youtube-ai-label-check", label: "YouTube AI Label Check", icon: Clapperboard },
  { href: "/tools/facebook-ai-label-check", label: "Facebook AI Label Check", icon: Globe },
  { href: "/tools/x-ai-label-check", label: "X (Twitter) AI Label Check", icon: Globe },
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
            <div className="absolute left-0 mt-2 w-[460px] rounded-[16px] border border-[var(--border)] bg-white/95 backdrop-blur-md shadow-[var(--shadow-4)] p-2.5 z-50 grid grid-cols-2 gap-1">
              {TOOL_MENU_LINKS.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => {
                      if (toolsMenuRef.current) toolsMenuRef.current.open = false;
                    }}
                    className="group/item flex items-center gap-2 rounded-[10px] px-2.5 py-2 text-xs font-medium text-[var(--color-ink)] hover:bg-[var(--color-brand-soft)] hover:text-[var(--color-brand)] transition-colors duration-150"
                  >
                    <Icon
                      aria-hidden="true"
                      className="h-3.5 w-3.5 shrink-0 text-[var(--color-brand)]/75 group-hover/item:text-[var(--color-brand)]"
                    />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
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
      <div className="border-t border-[var(--border)]/70 py-2.5 bg-white/80 flex flex-col items-center gap-2 px-4">
        <GlassTabs
          tabs={MAIN_TABS}
          activeId={activeTabId}
          onSelect={handleTabSelect}
          ariaLabel="Main tools navigation"
        />
        {pathname?.startsWith("/tools") && (
          <GlassTabs
            tabs={TOOLS_RIBBON_TABS}
            activeId={
              TOOLS_RIBBON_TABS.find((tab) => tab.href === pathname)?.id ?? "all-tools"
            }
            onSelect={handleTabSelect}
            ariaLabel="All media tools navigation"
          />
        )}
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
  const inspectionTools = TOOL_MENU_LINKS.slice(0, 9);
  const utilityTools = TOOL_MENU_LINKS.slice(9);

  const learnLinks = [
    { href: "/blog", label: "Blog", icon: BookOpen },
    { href: "/learn/content-credentials", label: "What are Content Credentials", icon: ShieldCheck },
    { href: "/learn/synthid", label: "What is SynthID", icon: Cpu },
    { href: "/how-it-works", label: "How it works", icon: Sparkles },
    { href: "/pricing", label: "Pricing", icon: CreditCard },
    { href: "/faq", label: "FAQ", icon: HelpCircle },
  ];

  const developerLinks = [
    { href: "/developers", label: "Overview", icon: Code2 },
    { href: "/developers/rest-api", label: "REST API", icon: Terminal },
    { href: "/developers/mcp", label: "MCP server", icon: Cpu },
    { href: "/developers/docs", label: "API docs", icon: FileText },
    { href: "/app/developers", label: "API keys", icon: KeyRound },
  ];

  const companyLinks = [
    { href: "/tools", label: "Home", icon: Home },
    { href: "/contact", label: "Contact", icon: Mail },
    { href: "/privacy", label: "Privacy", icon: Lock },
    { href: "/terms", label: "Terms", icon: Scale },
    { href: "/acceptable-use", label: "Acceptable use", icon: ShieldCheck },
  ];

  return (
    <footer className="relative z-10 border-t border-[var(--border)] bg-white/95 backdrop-blur-sm text-[var(--color-text-muted)] mt-20">
      <div className="mx-auto max-w-[1120px] px-4 sm:px-6 lg:px-8 py-12 text-xs space-y-10">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-6 gap-y-8">
          <div className="space-y-3">
            <h2 className="font-semibold text-sm text-[var(--color-ink)]">Tools</h2>
            <ul className="space-y-2">
              {inspectionTools.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="group inline-flex items-center gap-2 text-[var(--color-text-muted)] hover:text-[var(--color-ink)] transition-colors duration-150"
                    >
                      <Icon
                        aria-hidden="true"
                        className="h-3.5 w-3.5 shrink-0 text-[var(--color-brand)]/70 group-hover:text-[var(--color-brand)]"
                      />
                      <span className="group-hover:underline">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="space-y-3">
            <h2 className="font-semibold text-sm text-[var(--color-ink)]">Utilities &amp; Social</h2>
            <ul className="space-y-2">
              {utilityTools.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="group inline-flex items-center gap-2 text-[var(--color-text-muted)] hover:text-[var(--color-ink)] transition-colors duration-150"
                    >
                      <Icon
                        aria-hidden="true"
                        className="h-3.5 w-3.5 shrink-0 text-[var(--color-brand)]/70 group-hover:text-[var(--color-brand)]"
                      />
                      <span className="group-hover:underline">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="space-y-3">
            <h2 className="font-semibold text-sm text-[var(--color-ink)]">Learn</h2>
            <ul className="space-y-2">
              {learnLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="group inline-flex items-center gap-2 text-[var(--color-text-muted)] hover:text-[var(--color-ink)] transition-colors duration-150"
                    >
                      <Icon
                        aria-hidden="true"
                        className="h-3.5 w-3.5 shrink-0 text-[var(--color-brand)]/70 group-hover:text-[var(--color-brand)]"
                      />
                      <span className="group-hover:underline">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="space-y-3">
            <h2 className="font-semibold text-sm text-[var(--color-ink)]">Developers</h2>
            <ul className="space-y-2">
              {developerLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="group inline-flex items-center gap-2 text-[var(--color-text-muted)] hover:text-[var(--color-ink)] transition-colors duration-150"
                    >
                      <Icon
                        aria-hidden="true"
                        className="h-3.5 w-3.5 shrink-0 text-[var(--color-brand)]/70 group-hover:text-[var(--color-brand)]"
                      />
                      <span className="group-hover:underline">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="space-y-3">
            <h2 className="font-semibold text-sm text-[var(--color-ink)]">Company</h2>
            <ul className="space-y-2">
              {companyLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="group inline-flex items-center gap-2 text-[var(--color-text-muted)] hover:text-[var(--color-ink)] transition-colors duration-150"
                    >
                      <Icon
                        aria-hidden="true"
                        className="h-3.5 w-3.5 shrink-0 text-[var(--color-brand)]/70 group-hover:text-[var(--color-brand)]"
                      />
                      <span className="group-hover:underline">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
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
