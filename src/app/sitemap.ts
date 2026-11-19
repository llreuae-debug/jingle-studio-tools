import type { MetadataRoute } from "next";
import { BLOG_POSTS } from "@/content/site-content";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://jinglestudio.io";
  const staticRoutes = [
    "/tools",
    "/tools/media-metadata-inspector",
    "/tools/exif-viewer",
    "/tools/file-integrity-checker",
    "/tools/image-converter",
    "/tools/image-resizer",
    "/tools/image-compressor",
    "/tools/video-metadata-inspector",
    "/tools/privacy-metadata-cleaner",
    "/tools/report-generator",
    "/tools/content-credentials-check",
    "/tools/instagram-post-check",
    "/tools/instagram-story-check",
    "/tools/instagram-reels-check",
    "/tools/tiktok-ai-label-check",
    "/tools/ai-disclosure-signer",
    "/verify",
    "/how-it-works",
    "/learn",
    "/learn/content-credentials",
    "/learn/synthid",
    "/blog",
    ...BLOG_POSTS.map((post) => `/blog/${post.slug}`),
    "/faq",
    "/contact",
    "/developers",
    "/developers/rest-api",
    "/developers/mcp",
    "/developers/docs",
    "/pricing",
    "/privacy",
    "/terms",
    "/acceptable-use",
  ];

  return staticRoutes.map((route) => ({
    url: `${base}${route}`,
    lastModified: new Date("2026-11-20"),
    changeFrequency: "weekly",
    priority: route === "/tools" ? 1 : 0.8,
  }));
}
