import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL || "https://jinglestudio.io";
  const routes = [
    "/tools",
    "/tools/content-credentials-check",
    "/tools/instagram-post-check",
    "/tools/instagram-story-check",
    "/tools/instagram-reels-check",
    "/tools/tiktok-ai-label-check",
    "/tools/ai-disclosure-signer",
    "/pricing",
    "/privacy",
    "/terms",
    "/acceptable-use",
  ];

  return routes.map((route) => ({
    url: `${base}${route}`,
    lastModified: new Date("2026-11-19"),
    changeFrequency: "weekly",
    priority: route === "/tools" ? 1 : 0.8,
  }));
}
