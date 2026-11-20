import React from "react";
import Link from "next/link";
import { BookOpen, CheckCircle2, HelpCircle, ShieldCheck } from "lucide-react";
import { SITE_CONFIG } from "@/config/site";
import { CORE_TOOLS } from "@/config/tools-catalog";

export interface ToolPageShellProps {
  currentHref: string;
  badge: string;
  title: string;
  description: string;
  children: React.ReactNode;
}

export function ToolPageShell({
  currentHref,
  badge,
  title,
  description,
  children,
}: ToolPageShellProps) {
  const currentTool = CORE_TOOLS.find((t) => t.href === currentHref);
  const related = CORE_TOOLS.filter((t) => t.href !== currentHref).slice(0, 4);
  const canonicalUrl = `${SITE_CONFIG.siteUrl}${currentHref}`;

  const jsonLdGraph: Record<string, unknown>[] = [
    {
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "JingleStudio Tools",
          item: `${SITE_CONFIG.siteUrl}/tools`,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: title,
          item: canonicalUrl,
        },
      ],
    },
    {
      "@type": "SoftwareApplication",
      name: `${title} — ${SITE_CONFIG.name}`,
      url: canonicalUrl,
      applicationCategory: "MultimediaApplication",
      operatingSystem: "Any (Web Browser)",
      description,
      featureList: currentTool?.keyFeatures ?? [description],
      isAccessibleForFree: true,
    },
  ];

  if (currentTool && currentTool.faqs.length > 0) {
    jsonLdGraph.push({
      "@type": "FAQPage",
      mainEntity: currentTool.faqs.map((faq) => ({
        "@type": "Question",
        name: faq.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: faq.a,
        },
      })),
    });
  }

  const structuredData = {
    "@context": "https://schema.org",
    "@graph": jsonLdGraph,
  };

  return (
    <div className="space-y-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <nav aria-label="Breadcrumb" className="text-xs text-[var(--color-text-muted)]">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/tools" className="font-semibold text-[var(--color-brand)] hover:underline">
              Tools
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="font-medium text-[var(--color-ink)]">
            {title}
          </li>
        </ol>
      </nav>

      <header className="space-y-3">
        <span className="inline-flex items-center rounded-full border border-[var(--color-brand-line)] bg-[var(--color-brand-soft)] px-3 py-0.5 text-[11px] font-semibold text-[var(--color-brand)]">
          {badge}
        </span>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--color-ink)]">
          {title}
        </h1>
        <p className="max-w-2xl text-sm sm:text-base text-[var(--color-text-muted)] leading-relaxed">
          {description}
        </p>
      </header>

      <section aria-label={`${title} workspace`}>{children}</section>

      {currentTool && (
        <section
          aria-label={`How ${title} works and technical specifications`}
          className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-4"
        >
          <article className="lg:col-span-7 glass-surface rounded-[20px] p-6 space-y-4">
            <h2 className="text-lg font-bold text-[var(--color-ink)]">
              How {title} Works
            </h2>
            <ol className="space-y-2.5 text-xs sm:text-sm text-[var(--color-text-muted)] list-decimal pl-5">
              {currentTool.howItWorksSteps.map((step, idx) => (
                <li key={idx} className="leading-relaxed">
                  {step}
                </li>
              ))}
            </ol>

            <div className="pt-3 border-t border-[var(--border)] space-y-2">
              <h3 className="text-sm font-bold text-[var(--color-ink)]">
                Key Capabilities
              </h3>
              <ul className="space-y-1.5 text-xs text-[var(--color-text-muted)]">
                {currentTool.keyFeatures.map((feat, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle2
                      aria-hidden="true"
                      className="h-3.5 w-3.5 shrink-0 text-[var(--color-brand)] mt-0.5"
                    />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            </div>
          </article>

          <aside
            aria-label="Supported formats and privacy architecture"
            className="lg:col-span-5 glass-surface rounded-[20px] p-6 space-y-4"
          >
            <h2 className="text-lg font-bold text-[var(--color-ink)]">
              Supported Formats &amp; Privacy
            </h2>
            <dl className="space-y-3 text-xs">
              <div className="rounded-[12px] border border-[var(--border)] bg-[var(--color-surface-muted)] p-3.5">
                <dt className="font-semibold text-[var(--color-ink)]">Supported Media Formats</dt>
                <dd className="mt-1 text-[var(--color-text-muted)]">{currentTool.formats}</dd>
              </div>
              <div className="rounded-[12px] border border-[var(--border)] bg-[var(--color-surface-muted)] p-3.5">
                <dt className="font-semibold text-[var(--color-ink)]">Execution Model</dt>
                <dd className="mt-1 text-[var(--color-text-muted)]">{currentTool.executionScope}</dd>
              </div>
              <div className="rounded-[12px] border border-[var(--color-brand-line)] bg-[var(--color-brand-soft)]/50 p-3.5 flex items-start gap-2.5">
                <ShieldCheck
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 text-[var(--color-brand)] mt-0.5"
                />
                <div>
                  <dt className="font-semibold text-[var(--color-ink)]">Privacy-First Architecture</dt>
                  <dd className="mt-1 text-[var(--color-text-muted)] leading-relaxed">
                    {currentTool.privacySummary} See our{" "}
                    <Link href="/privacy" className="font-semibold text-[var(--color-brand)] hover:underline">
                      Privacy Policy
                    </Link>{" "}
                    and{" "}
                    <Link href="/how-it-works" className="font-semibold text-[var(--color-brand)] hover:underline">
                      How It Works
                    </Link>{" "}
                    guide.
                  </dd>
                </div>
              </div>
            </dl>

            {currentTool.relatedArticles.length > 0 && (
              <div className="pt-2 border-t border-[var(--border)] space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                  Related Guides &amp; Documentation
                </h3>
                <ul className="space-y-1.5 text-xs">
                  {currentTool.relatedArticles.map((art) => (
                    <li key={art.slug}>
                      <Link
                        href={`/blog/${art.slug}`}
                        className="inline-flex items-center gap-1.5 font-medium text-[var(--color-brand)] hover:underline"
                      >
                        <BookOpen aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                        <span>{art.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </section>
      )}

      {currentTool && currentTool.faqs.length > 0 && (
        <section
          aria-label={`Frequently asked questions about ${title}`}
          className="glass-surface rounded-[20px] p-6 space-y-4"
        >
          <div className="flex items-center gap-2">
            <HelpCircle aria-hidden="true" className="h-5 w-5 text-[var(--color-brand)]" />
            <h2 className="text-lg font-bold text-[var(--color-ink)]">
              Frequently Asked Questions — {title}
            </h2>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {currentTool.faqs.map((faq, idx) => (
              <details
                key={idx}
                name="tool-faq"
                open={idx === 0}
                className="group py-3.5 text-xs sm:text-sm"
              >
                <summary className="cursor-pointer font-bold text-[var(--color-ink)] hover:text-[var(--color-brand)]">
                  {faq.q}
                </summary>
                <p className="mt-2 text-[var(--color-text-muted)] leading-relaxed">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </section>
      )}

      <section aria-label="Related Media Tools" className="border-t border-[var(--border)] pt-8 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-[var(--color-ink)]">More JingleStudio Tools</h2>
          <Link href="/tools#tools-dashboard" className="text-xs font-semibold text-[var(--color-brand)] hover:underline">
            View all 10 tools →
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {related.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="rounded-[14px] border border-[var(--border)] bg-white p-4 text-xs hover:border-[var(--color-brand-light)] hover:bg-[var(--color-brand-soft)]/50"
            >
              <p className="font-bold text-[var(--color-ink)]">{item.title}</p>
              <p className="mt-1 text-[11px] text-[var(--color-text-muted)] line-clamp-2">{item.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
