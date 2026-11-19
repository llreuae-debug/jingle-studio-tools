"use client";

import React from "react";
import Link from "next/link";
import { useLanguage } from "@/components/LanguageProvider";
import { BLOG_POSTS } from "@/content/site-content";
import { handleCardPointerMove } from "@/lib/pointer-glow";

export function BlogIndexClient() {
  const { locale } = useLanguage();

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-[var(--plum)]">Blog</h1>
        <p className="text-sm text-[var(--plum-muted)]">
          {locale === "id"
            ? "Artikel tentang Kredensial Konten, pengungkapan AI, dan aturan platform."
            : "Guides on Content Credentials, honest AI disclosure, and platform rules."}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {BLOG_POSTS.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            onPointerMove={handleCardPointerMove}
            className="glass-surface glass-card-interactive p-6 space-y-2.5 block"
          >
            <h2 className="text-lg font-bold text-[var(--plum)]">{post.title[locale]}</h2>
            <p className="text-xs text-[var(--plum-muted)] leading-relaxed">
              {post.summary[locale]}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
