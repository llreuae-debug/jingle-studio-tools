"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, ExternalLink, HelpCircle } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import type { BlogPost } from "@/content/site-content";

export function BlogPostClient({ post }: { post: BlogPost }) {
  const { locale } = useLanguage();
  const published = post.publishedAt ?? "2026-11-18";
  const updated = post.updatedAt ?? "2026-11-20";

  return (
    <article className="max-w-3xl glass-surface p-6 sm:p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--color-text-muted)]">
        <Link href="/blog" className="font-semibold text-[var(--color-brand)] hover:underline">
          ← Back to blog
        </Link>
        <span>
          Published <time dateTime={published}>{published}</time> · Updated{" "}
          <time dateTime={updated}>{updated}</time>
        </span>
      </div>

      <header className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-[var(--plum)]">{post.title[locale]}</h1>
        <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
          {post.summary[locale]}
        </p>
      </header>

      <div className="space-y-4 text-sm text-[var(--plum)] leading-relaxed">
        {post.body[locale].map((para, idx) => (
          <p key={idx}>{para}</p>
        ))}
      </div>

      {post.aeoQuestions && post.aeoQuestions.length > 0 && (
        <section
          aria-label="Key questions answered"
          className="pt-4 border-t border-[var(--border)] space-y-3"
        >
          <div className="flex items-center gap-1.5">
            <HelpCircle aria-hidden="true" className="h-4 w-4 text-[var(--color-brand)]" />
            <h2 className="text-sm font-bold text-[var(--color-ink)]">
              Direct Answers &amp; FAQ
            </h2>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {post.aeoQuestions.map((item, idx) => (
              <details
                key={idx}
                name="blog-faq"
                open={idx === 0}
                className="py-3 text-xs sm:text-sm"
              >
                <summary className="cursor-pointer font-bold text-[var(--color-ink)] hover:text-[var(--color-brand)]">
                  {item.q}
                </summary>
                <p className="mt-1.5 text-[var(--color-text-muted)] leading-relaxed">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </section>
      )}

      {post.relatedTools && post.relatedTools.length > 0 && (
        <section
          aria-label="Related JingleStudio tools"
          className="pt-4 border-t border-[var(--border)] space-y-2.5"
        >
          <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--plum-muted)]">
            Try the Related Tools
          </h2>
          <div className="flex flex-wrap gap-2">
            {post.relatedTools.map((tool) => (
              <Link
                key={tool.href}
                href={tool.href}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-brand-line)] bg-[var(--color-brand-soft)] px-3.5 py-1.5 text-xs font-semibold text-[var(--color-brand)] hover:bg-[var(--color-brand-line)]"
              >
                <span>{tool.title}</span>
                <ArrowRight aria-hidden="true" className="h-3 w-3" />
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="pt-4 border-t border-[var(--border)] space-y-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--plum-muted)]">
          Official sources
        </h2>
        <ul className="space-y-1.5 text-xs">
          {post.sources.map((src) => (
            <li key={src.url}>
              <a
                href={src.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 font-medium text-[var(--plum)] underline"
              >
                {src.label}
                <ExternalLink aria-hidden="true" className="h-3 w-3" />
              </a>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
