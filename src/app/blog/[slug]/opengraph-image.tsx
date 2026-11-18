import { BLOG_POSTS } from "@/content/site-content";
import { renderBrandOgImage } from "@/lib/og-template";

export const runtime = "edge";
export const alt = "Blog — Jingle Studio Tools";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function BlogPostOgImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = BLOG_POSTS.find((p) => p.slug === slug);

  return renderBrandOgImage({
    eyebrow: "Jingle Studio Blog",
    title: post?.title.en || "Content Credentials Guide",
    subtitle: post?.summary.en || "Honest provenance and AI disclosure guidance.",
  });
}
