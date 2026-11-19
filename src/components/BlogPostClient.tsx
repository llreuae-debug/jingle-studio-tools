"use client";

import React from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { useLanguage } from "@/components/LanguageProvider";
import type { BlogPost } from "@/content/site-content";

export function BlogPostClient({ post }: { post: BlogPost }) {
  const { locale } = useLanguage();

  return (
    <article className="max-w-3xl glass-surface p-6 sm:p-8 space-y-5">
      <Link href="/blog" className="text-xs font-semibold text-[var(--plum)] underline">
        ← Back to blog
      </Link>
      <h1 className="text-2xl sm:text-3xl font-bold text-[var(--plum)]">{post.title[locale]}</h1>
      <div className="space-y-4 text-sm text-[var(--plum)] leading-relaxed">
        {post.body[locale].map((para, idx) => (
          <p key={idx}>{para}</p>
        ))}
      </div>

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
