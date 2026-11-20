import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BlogPostClient } from "@/components/BlogPostClient";
import { SITE_CONFIG } from "@/config/site";
import { BLOG_POSTS } from "@/content/site-content";

export const dynamicParams = false;

export function generateStaticParams() {
  return BLOG_POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = BLOG_POSTS.find((p) => p.slug === slug);
  if (!post) {
    notFound();
  }
  const canonicalPath = `/blog/${post.slug}`;
  return {
    title: post.title.en,
    description: post.summary.en,
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      title: post.title.en,
      description: post.summary.en,
      type: "article",
      url: `${SITE_CONFIG.siteUrl}${canonicalPath}`,
      publishedTime: post.publishedAt ?? "2026-11-18",
      modifiedTime: post.updatedAt ?? "2026-11-20",
    },
    twitter: {
      card: "summary_large_image",
      title: post.title.en,
      description: post.summary.en,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = BLOG_POSTS.find((p) => p.slug === slug);
  if (!post) {
    notFound();
  }

  const canonicalUrl = `${SITE_CONFIG.siteUrl}/blog/${post.slug}`;
  const graph: Record<string, unknown>[] = [
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
          name: "Blog & Guides",
          item: `${SITE_CONFIG.siteUrl}/blog`,
        },
        {
          "@type": "ListItem",
          position: 3,
          name: post.title.en,
          item: canonicalUrl,
        },
      ],
    },
    {
      "@type": "Article",
      headline: post.title.en,
      description: post.summary.en,
      datePublished: post.publishedAt ?? "2026-11-18",
      dateModified: post.updatedAt ?? "2026-11-20",
      mainEntityOfPage: canonicalUrl,
      author: {
        "@type": "Organization",
        name: SITE_CONFIG.name,
        url: SITE_CONFIG.siteUrl,
      },
      publisher: {
        "@type": "Organization",
        name: SITE_CONFIG.name,
        url: SITE_CONFIG.siteUrl,
        logo: {
          "@type": "ImageObject",
          url: `${SITE_CONFIG.siteUrl}/brand/logo-square-512.png`,
        },
      },
    },
  ];

  if (post.aeoQuestions && post.aeoQuestions.length > 0) {
    graph.push({
      "@type": "FAQPage",
      mainEntity: post.aeoQuestions.map((q) => ({
        "@type": "Question",
        name: q.q,
        acceptedAnswer: {
          "@type": "Answer",
          text: q.a,
        },
      })),
    });
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({ "@context": "https://schema.org", "@graph": graph }),
        }}
      />
      <BlogPostClient post={post} />
    </>
  );
}
